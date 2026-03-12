import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_DEV_ADMIN_PASSWORD = 'admin123!';

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return defaultValue;
  }
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv.trim().toLowerCase() === 'production';
const requestedDemoData = parseBooleanFlag(
  process.env.SEED_INCLUDE_DEMO_DATA,
  !isProduction,
);
const includeDemoData = !isProduction && requestedDemoData;
const forceAdminPasswordReset = parseBooleanFlag(
  process.env.SEED_FORCE_RESET_ADMIN_PASSWORD,
  false,
);
const configuredAdminPassword =
  process.env.SEED_ADMIN_PASSWORD || (!isProduction ? DEFAULT_DEV_ADMIN_PASSWORD : '');

async function ensureAdminUser() {
  const adminEmail = 'admin@aiworld.dev';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin && !configuredAdminPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is required to create the admin user in production.',
    );
  }

  const hashedPassword = configuredAdminPassword
    ? await bcrypt.hash(configuredAdminPassword, 12)
    : null;

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { email: adminEmail },
        data: {
          role: UserRole.ADMIN,
          status: UserStatus.active,
          ...(forceAdminPasswordReset && hashedPassword
            ? { passwordHash: hashedPassword }
            : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword!,
          role: UserRole.ADMIN,
          status: UserStatus.active,
        },
      });

  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: {
      displayName: 'AI-World Admin',
      headline: 'Platform Administrator',
      onboardingDone: true,
    },
    create: {
      userId: admin.id,
      displayName: 'AI-World Admin',
      headline: 'Platform Administrator',
      onboardingDone: true,
    },
  });

  if (!existingAdmin) {
    console.log(`  OK Admin user created: ${adminEmail}`);
  } else if (forceAdminPasswordReset && hashedPassword) {
    console.log(`  OK Admin user password rotated by seed: ${adminEmail}`);
  } else {
    console.log(`  OK Admin user preserved without password reset: ${adminEmail}`);
  }

  if (!isProduction && configuredAdminPassword === DEFAULT_DEV_ADMIN_PASSWORD) {
    console.log(`  DEV Admin password: ${DEFAULT_DEV_ADMIN_PASSWORD}`);
  }

  return admin;
}

async function main() {
  console.log('Seeding database...');
  console.log(`  Environment: ${nodeEnv}`);
  if (isProduction && requestedDemoData) {
    console.warn(
      '  WARN Ignoring SEED_INCLUDE_DEMO_DATA because demo/sample seed data is disabled in production.',
    );
  }
  console.log(`  Demo/sample data enabled: ${includeDemoData}`);

  const admin = await ensureAdminUser();

  // 1. Create some common tags
  const tagNames = [
    'AI',
    'Machine Learning',
    'Deep Learning',
    'NLP',
    'Computer Vision',
    'Robotics',
    'Ethics',
    'Healthcare',
    'Finance',
    'Education',
    'Climate',
    'Open Source',
  ];
  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  OK ${tagNames.length} tags created`);

  if (includeDemoData) {
    // 2. Create demo invite codes
    const demoCodes = [
      'AIWORLD-EXPERT-2026',
      'AIWORLD-LEARNER-2026',
      'AIWORLD-ENTERPRISE-2026',
      'WELCOME2026',
    ];
    for (const code of demoCodes) {
      await prisma.invite.upsert({
        where: { code },
        update: {
          issuedByAdminId: admin.id,
        },
        create: {
          code,
          issuedByAdminId: admin.id,
        },
      });
    }
    console.log(`  OK Demo invite codes: ${demoCodes.join(', ')}`);

    // 3. Create stable sample accounts used by automated smoke tests
    const expertPassword = await bcrypt.hash('expert123!', 12);
    const expert = await prisma.user.upsert({
      where: { email: 'expert@aiworld.dev' },
      update: {
        passwordHash: expertPassword,
        role: UserRole.EXPERT,
        status: UserStatus.active,
      },
      create: {
        email: 'expert@aiworld.dev',
        passwordHash: expertPassword,
        role: UserRole.EXPERT,
        status: UserStatus.active,
      },
    });
    await prisma.profile.upsert({
      where: { userId: expert.id },
      update: {
        displayName: 'Demo Expert',
        headline: 'AI Researcher & Expert',
        bio: 'A demo expert account for testing purposes.',
        org: 'AI Research Lab',
        academicTitle: 'Principal Investigator',
        researchField: 'Natural Language Processing',
        personalPage: 'https://ai-world.asia',
        onboardingDone: true,
        platformIntents: ['publish_research', 'find_collaborators', 'mentor_students'],
      },
      create: {
        userId: expert.id,
        displayName: 'Demo Expert',
        headline: 'AI Researcher & Expert',
        bio: 'A demo expert account for testing purposes.',
        org: 'AI Research Lab',
        academicTitle: 'Principal Investigator',
        researchField: 'Natural Language Processing',
        personalPage: 'https://ai-world.asia',
        onboardingDone: true,
        platformIntents: ['publish_research', 'find_collaborators', 'mentor_students'],
      },
    });
    console.log('  OK Expert user: expert@aiworld.dev / expert123!');

    const learnerPassword = await bcrypt.hash('learner123!', 12);
    const learner = await prisma.user.upsert({
      where: { email: 'learner@aiworld.dev' },
      update: {
        passwordHash: learnerPassword,
        role: UserRole.LEARNER,
        status: UserStatus.active,
      },
      create: {
        email: 'learner@aiworld.dev',
        passwordHash: learnerPassword,
        role: UserRole.LEARNER,
        status: UserStatus.active,
      },
    });
    await prisma.profile.upsert({
      where: { userId: learner.id },
      update: {
        displayName: 'Demo Learner',
        headline: 'AI Enthusiast',
        bio: 'A demo learner account for testing purposes.',
        org: 'AI-World Academy',
        major: 'Computer Science',
        onboardingDone: true,
        platformIntents: ['learn_ai', 'join_projects', 'build_skills'],
      },
      create: {
        userId: learner.id,
        displayName: 'Demo Learner',
        headline: 'AI Enthusiast',
        bio: 'A demo learner account for testing purposes.',
        org: 'AI-World Academy',
        major: 'Computer Science',
        onboardingDone: true,
        platformIntents: ['learn_ai', 'join_projects', 'build_skills'],
      },
    });
    console.log('  OK Learner user: learner@aiworld.dev / learner123!');

    // 4. Create reusable demo accounts aligned with the invite page shortcuts
    const demoPassword = await bcrypt.hash('Demo@2026', 12);
    const demoAccounts = [
      {
        email: 'expert@demo.aiworld.dev',
        role: UserRole.EXPERT,
        profile: {
          displayName: 'Demo Expert',
          headline: 'AI Researcher & Expert',
          bio: 'A reusable expert demo account for invite-code previews.',
          contactEmail: 'expert@demo.aiworld.dev',
          org: 'AI-World Research Lab',
          academicTitle: 'Research Scientist',
          researchField: 'Machine Learning',
          personalPage: 'https://ai-world.asia',
          onboardingDone: true,
          platformIntents: ['publish_research', 'find_collaborators', 'mentor_students'],
        },
      },
      {
        email: 'learner@demo.aiworld.dev',
        role: UserRole.LEARNER,
        profile: {
          displayName: 'Demo Learner',
          headline: 'AI Enthusiast',
          bio: 'A reusable learner demo account for invite-code previews.',
          contactEmail: 'learner@demo.aiworld.dev',
          org: 'AI-World Academy',
          major: 'Computer Science',
          onboardingDone: true,
          platformIntents: ['learn_ai', 'join_projects', 'build_skills'],
        },
      },
      {
        email: 'enterprise@demo.aiworld.dev',
        role: UserRole.ENTERPRISE_LEADER,
        profile: {
          displayName: 'Demo Enterprise',
          headline: 'AI Transformation Lead',
          bio: 'A reusable enterprise demo account for invite-code previews.',
          contactEmail: 'enterprise@demo.aiworld.dev',
          title: 'Enterprise Innovation Lead',
          companyName: 'AI-World Demo Enterprise',
          taxId: 'DEMO-ENTERPRISE-2026',
          businessScope: 'AI strategy planning, pilot delivery, and enterprise solution design.',
          onboardingDone: true,
          platformIntents: ['find_ai_partner', 'post_needs', 'find_solutions'],
        },
        enterpriseProfile: {
          aiStrategyText: 'Build internal AI capability through high-impact pilots and cross-functional enablement.',
          casesText: 'Knowledge assistant, workflow automation, and decision-support prototypes.',
          achievementsText: 'Looking for applied researchers, solution architects, and delivery partners.',
        },
      },
      {
        email: 'demo@demo.aiworld.dev',
        role: UserRole.LEARNER,
        profile: {
          displayName: 'Demo User',
          headline: 'AI Explorer',
          bio: 'A generic reusable demo account for invite-code previews.',
          contactEmail: 'demo@demo.aiworld.dev',
          org: 'AI-World Community',
          major: 'Product Design',
          onboardingDone: true,
          platformIntents: ['learn_ai', 'join_projects', 'find_jobs'],
        },
      },
    ];

    for (const account of demoAccounts) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: {
          passwordHash: demoPassword,
          role: account.role,
          status: UserStatus.active,
        },
        create: {
          email: account.email,
          passwordHash: demoPassword,
          role: account.role,
          status: UserStatus.active,
        },
      });

      await prisma.profile.upsert({
        where: { userId: user.id },
        update: account.profile,
        create: {
          userId: user.id,
          ...account.profile,
        },
      });

      if (account.enterpriseProfile) {
        await prisma.enterpriseProfile.upsert({
          where: { userId: user.id },
          update: account.enterpriseProfile,
          create: {
            userId: user.id,
            ...account.enterpriseProfile,
          },
        });
      }
    }
    console.log(
      `  OK Demo users: ${demoAccounts.map((account) => account.email).join(', ')} / Demo@2026`,
    );
  } else {
    console.log('  SKIP Demo invite codes and sample accounts');
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
