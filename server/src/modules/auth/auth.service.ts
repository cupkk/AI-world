import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { MailService } from '../../common/mail/mail.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { serializeUser, serializeInvite } from '../../common/serializers/serialize';
import {
  isProductionEnv,
  parseBooleanFlag,
} from '../../common/config/runtime.util';

const SALT_ROUNDS = 12;
const LOGIN_RATE_LIMIT_KEY = 'ratelimit:login:';
const DEFAULT_LOGIN_RATE_LIMIT = 5; // 5 attempts
const DEFAULT_LOGIN_RATE_WINDOW = 60; // per 60 seconds
const RESET_TOKEN_PREFIX = 'pwd_reset:';
const RESET_TOKEN_TTL = 3600; // 1 hour
const DEFAULT_DEV_DEMO_INVITE_CODES = [
  'AIWORLD-EXPERT-2026',
  'AIWORLD-LEARNER-2026',
  'AIWORLD-ENTERPRISE-2026',
  'WELCOME2026',
];

type DemoRole = 'EXPERT' | 'LEARNER' | 'ENTERPRISE_LEADER';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private demoInviteProdWarningLogged = false;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private isProduction(): boolean {
    return isProductionEnv(
      this.configService.get<string>('NODE_ENV', 'development'),
    );
  }

  private isDevMode(): boolean {
    return !this.isProduction();
  }

  private getLoginRateLimitConfig() {
    const configuredLimit = Number.parseInt(
      this.configService.get<string>('LOGIN_RATE_LIMIT_MAX', ''),
      10,
    );
    const configuredWindow = Number.parseInt(
      this.configService.get<string>('LOGIN_RATE_LIMIT_WINDOW_SECONDS', ''),
      10,
    );

    return {
      limit:
        Number.isFinite(configuredLimit) && configuredLimit > 0
          ? configuredLimit
          : DEFAULT_LOGIN_RATE_LIMIT,
      windowSeconds:
        Number.isFinite(configuredWindow) && configuredWindow > 0
          ? configuredWindow
          : DEFAULT_LOGIN_RATE_WINDOW,
    };
  }

  private getConfiguredDemoInviteCodes(): string[] {
    const raw = this.configService.get<string>('DEMO_INVITE_CODES', '');
    return raw
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  private warnIfProductionDemoInviteConfigured() {
    if (this.demoInviteProdWarningLogged || !this.isProduction()) {
      return;
    }

    const enableDemoInvites = parseBooleanFlag(
      this.configService.get<string>('ENABLE_DEMO_INVITES'),
      false,
    );

    if (!enableDemoInvites && this.getConfiguredDemoInviteCodes().length === 0) {
      return;
    }

    this.demoInviteProdWarningLogged = true;
    this.logger.warn(
      'Ignoring demo invite configuration because reusable demo invites are disabled in production.',
    );
  }

  private isDemoModeEnabled(): boolean {
    if (this.isProduction()) {
      this.warnIfProductionDemoInviteConfigured();
      return false;
    }

    return parseBooleanFlag(
      this.configService.get<string>('ENABLE_DEMO_INVITES'),
      this.isDevMode(),
    );
  }

  private getReusableDemoInviteCodes(): string[] {
    if (!this.isDemoModeEnabled()) {
      return [];
    }

    const configuredCodes = this.getConfiguredDemoInviteCodes();
    if (configuredCodes.length > 0) return configuredCodes;
    return DEFAULT_DEV_DEMO_INVITE_CODES;
  }

  private isReusableDemoInviteCode(code: string): boolean {
    return this.getReusableDemoInviteCodes().includes(code.trim().toUpperCase());
  }

  private inferDemoRole(code: string): DemoRole {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.includes('EXPERT')) {
      return 'EXPERT';
    }
    if (normalizedCode.includes('ENTERPRISE')) {
      return 'ENTERPRISE_LEADER';
    }
    return 'LEARNER';
  }

  private buildProfileData(
    userId: string,
    dto: RegisterDto,
    role: DemoRole,
    isReusableDemoInvite: boolean,
  ) {
    if (!isReusableDemoInvite) {
      return {
        userId,
        displayName: dto.displayName,
        phone: dto.phone || undefined,
      };
    }

    const baseProfile = {
      userId,
      displayName: dto.displayName,
      phone: dto.phone || undefined,
      contactEmail: dto.email,
      onboardingDone: true,
    };

    switch (role) {
      case 'EXPERT':
        return {
          ...baseProfile,
          headline: 'AI Researcher & Expert',
          org: 'AI-World Research Lab',
          academicTitle: 'Research Scientist',
          researchField: 'Machine Learning',
          personalPage: 'https://ai-world.asia',
          platformIntents: ['publish_research', 'find_collaborators', 'mentor_students'],
        };
      case 'ENTERPRISE_LEADER':
        return {
          ...baseProfile,
          headline: 'AI Transformation Lead',
          title: 'Enterprise Innovation Lead',
          companyName: 'AI-World Demo Enterprise',
          taxId: 'DEMO-ENTERPRISE-2026',
          businessScope: 'AI strategy planning, pilot delivery, and enterprise solution design.',
          platformIntents: ['find_ai_partner', 'post_needs', 'find_solutions'],
        };
      default:
        return {
          ...baseProfile,
          headline: 'AI Learner',
          org: 'AI-World Academy',
          major: 'Computer Science',
          platformIntents: ['learn_ai', 'join_projects', 'build_skills'],
        };
    }
  }

  /**
   * Verify invite code is valid and unused
   * Configured reusable demo codes always pass regardless of DB state
   */
  async verifyInviteCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();

    // Dev demo codes always valid — skip DB check entirely
    if (this.isReusableDemoInviteCode(normalizedCode)) {
      return {
        valid: true,
        id: `demo-${normalizedCode}`,
        code: normalizedCode,
        status: 'UNUSED',
        createdAt: new Date().toISOString(),
      };
    }

    const invite = await this.prisma.invite.findUnique({
      where: { code: normalizedCode },
    });

    if (!invite) {
      throw new BadRequestException('Invalid invite code');
    }

    if (invite.status !== 'unused') {
      throw new BadRequestException('Invite code has already been used');
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    return { valid: true, ...serializeInvite(invite) };
  }

  /**
   * Register a new user with invite code
   */
  async register(dto: RegisterDto) {
    const normalizedInviteCode = dto.inviteCode.trim().toUpperCase();
    const isReusableDemoInvite = this.isReusableDemoInviteCode(normalizedInviteCode);

    // 1. Verify invite code
    const invite = isReusableDemoInvite
      ? null
      : await this.prisma.invite.findUnique({
          where: { code: normalizedInviteCode },
        });

    if (!isReusableDemoInvite && (!invite || invite.status !== 'unused')) {
      throw new BadRequestException('Invalid or already used invite code');
    }

    if (!isReusableDemoInvite && invite?.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    // 2. Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // 4. Determine role & status
    //    Demo invite codes → auto-activate with role inferred from code
    let userRole: DemoRole = 'LEARNER';
    let userStatus: string = 'pending_identity_review';

    if (isReusableDemoInvite) {
      userStatus = 'active';
      userRole = this.inferDemoRole(normalizedInviteCode);
    }

    // 5. Create user + profile + mark invite as used (transaction)
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: userRole as any,
          status: userStatus as any,
        },
      });

      await tx.profile.create({
        data: this.buildProfileData(
          newUser.id,
          dto,
          userRole,
          isReusableDemoInvite,
        ) as any,
      });

      if (!isReusableDemoInvite && invite) {
        await tx.invite.update({
          where: { id: invite.id },
          data: {
            status: 'used',
            boundUserId: newUser.id,
          },
        });
      }

      return newUser;
    });

    this.logger.log(`New user registered: ${user.id} (${user.email})`);

    // Re-fetch with profile for serialization
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: {
          include: { profileTags: { include: { tag: true } } },
        },
      },
    });

    return serializeUser(fullUser);
  }

  /**
   * Login with email + password
   */
  async login(dto: LoginDto, ip: string) {
    // Rate limiting
    const { limit, windowSeconds } = this.getLoginRateLimitConfig();
    const rateLimitKey = `${LOGIN_RATE_LIMIT_KEY}${ip}`;
    const allowed = await this.redis.checkRateLimit(
      rateLimitKey,
      limit,
      windowSeconds,
    );

    if (!allowed) {
      throw new BadRequestException(
        'Too many login attempts. Please try again later.',
      );
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
      include: {
        profile: {
          include: {
            profileTags: { include: { tag: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'suspended') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    // Verify password
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.id}`);

    return {
      user: { id: user.id, role: user.role, status: user.status },
      serialized: serializeUser(user),
    };
  }

  /**
   * Get current user info
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            profileTags: {
              include: { tag: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return serializeUser(user);
  }

  // ── Password Reset ─────────────────────────────────────

  /**
   * Request a password reset email.
   * Always returns success to prevent email enumeration.
   */
  async requestPasswordReset(email: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user) {
      // Don't reveal whether the email exists
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
      return { success: true };
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const redisKey = `${RESET_TOKEN_PREFIX}${token}`;

    // Store token → userId mapping in Redis with TTL
    await this.redis.set(redisKey, user.id, RESET_TOKEN_TTL);

    // Build reset URL
    const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:5173');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    await this.mailService.send({
      to: email,
      subject: 'AI-World 密码重置 / Password Reset',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>密码重置 / Password Reset</h2>
          <p>您正在申请重置 AI-World 账户密码，请点击下方链接完成操作：</p>
          <p>You have requested a password reset for your AI-World account. Click the link below:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              重置密码 / Reset Password
            </a>
          </p>
          <p style="color:#888;font-size:13px;">
            此链接将在 1 小时后失效。如非本人操作，请忽略此邮件。<br/>
            This link expires in 1 hour. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
      text: `AI-World 密码重置\n\n请访问以下链接重置密码 / Visit this link to reset your password:\n${resetUrl}\n\n此链接将在 1 小时后失效。`,
    });

    this.logger.log(`Password reset email sent to user ${user.id}`);
    return { success: true };
  }

  /**
   * Reset password using a valid token.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    const redisKey = `${RESET_TOKEN_PREFIX}${token}`;
    const userId = await this.redis.get(redisKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate the token
    await this.redis.del(redisKey);

    this.logger.log(`Password reset completed for user ${userId}`);
    return { success: true };
  }
}
