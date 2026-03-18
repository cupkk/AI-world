import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Briefcase,
  Clock3,
  FileText,
  FolderKanban,
  type LucideIcon,
  Mail,
  MapPin,
  Phone,
  Shield,
  Ticket,
  UserCheck,
  UserMinus,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/StateDisplay";
import { SearchBar } from "../../components/ui/SearchBar";
import { useTranslation } from "../../hooks/useTranslation";
import {
  adminUpdateUserStatusByApi,
  fetchAdminUsersByApi,
} from "../../lib/api";
import { usePageTitle } from "../../lib/usePageTitle";
import { useAuthStore } from "../../store/authStore";
import type { AdminUserItem, AdminUserStats, Role, UserAccountStatus } from "../../types";

const ROLE_FILTERS: Array<Role | "ALL"> = [
  "ALL",
  "ADMIN",
  "EXPERT",
  "LEARNER",
  "ENTERPRISE_LEADER",
];

const STATUS_FILTERS: Array<UserAccountStatus | "ALL"> = [
  "ALL",
  "active",
  "pending_identity_review",
  "suspended",
];

const EMPTY_STATS: AdminUserStats = {
  totalCount: 0,
  activeCount: 0,
  pendingCount: 0,
  suspendedCount: 0,
  adminCount: 0,
  expertCount: 0,
  learnerCount: 0,
  enterpriseCount: 0,
};

const EN_COPY = {
  title: "User Directory",
  description:
    "Visualize every account, filter quickly, and handle account status before launch.",
  review: "Review",
  content: "Content Management",
  admin: "Admin",
  totalUsers: "Total Users",
  activeUsers: "Active",
  pendingUsers: "Pending Review",
  suspendedUsers: "Suspended",
  admins: "Admins",
  experts: "Experts",
  learners: "Learners",
  enterprises: "Enterprises",
  searchPlaceholder: "Search by name, email, company, or phone...",
  allRoles: "All Roles",
  allStatuses: "All Statuses",
  clearFilters: "Clear filters",
  results: "results",
  profile: "Profile",
  email: "Email",
  contactEmail: "Contact",
  phone: "Phone",
  company: "Company",
  titleLabel: "Title",
  location: "Location",
  createdAt: "Created",
  lastLoginAt: "Last login",
  neverLoggedIn: "No login yet",
  invitesIssued: "Invites issued",
  invitesUsed: "Invites used",
  contentCount: "Content",
  knowledgeBaseCount: "Knowledge Base",
  applicationCount: "Applications",
  activate: "Activate",
  suspend: "Suspend",
  currentAdmin: "Current admin",
  emptyTitle: "No users found",
  emptyDescription:
    "Try adjusting search keywords or filters to reveal the matching accounts.",
  activated: "User activated",
  suspended: "User suspended",
  roleAll: "All roles",
  roleAdmin: "Admin",
  roleExpert: "Expert",
  roleLearner: "Learner",
  roleEnterprise: "Enterprise",
  statusAll: "All statuses",
  statusActive: "Active",
  statusPending: "Pending review",
  statusSuspended: "Suspended",
};

const ZH_COPY = {
  title: "用户总览",
  description: "集中查看全部账号数据，按条件筛选，并在上线前直接处理账号状态。",
  review: "审核台",
  content: "内容管理",
  admin: "管理员",
  totalUsers: "总用户数",
  activeUsers: "正常账号",
  pendingUsers: "待审核",
  suspendedUsers: "已停用",
  admins: "管理员",
  experts: "专家",
  learners: "学习者",
  enterprises: "企业",
  searchPlaceholder: "按姓名、邮箱、公司或手机号搜索...",
  allRoles: "全部角色",
  allStatuses: "全部状态",
  clearFilters: "清空筛选",
  results: "条结果",
  profile: "查看主页",
  email: "登录邮箱",
  contactEmail: "联系邮箱",
  phone: "手机号",
  company: "公司",
  titleLabel: "头衔",
  location: "地区",
  createdAt: "创建时间",
  lastLoginAt: "最近登录",
  neverLoggedIn: "尚未登录",
  invitesIssued: "发放邀请码",
  invitesUsed: "已用邀请码",
  contentCount: "内容数",
  knowledgeBaseCount: "知识库文件",
  applicationCount: "申请数",
  activate: "恢复账号",
  suspend: "停用账号",
  currentAdmin: "当前管理员",
  emptyTitle: "未找到用户",
  emptyDescription: "调整搜索关键词或筛选条件后，再查看匹配账号。",
  activated: "账号已恢复",
  suspended: "账号已停用",
  roleAll: "全部角色",
  roleAdmin: "管理员",
  roleExpert: "专家",
  roleLearner: "学习者",
  roleEnterprise: "企业",
  statusAll: "全部状态",
  statusActive: "正常",
  statusPending: "待审核",
  statusSuspended: "停用",
};

function formatDateTime(value: string | undefined, language: "en" | "zh") {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRoleLabel(role: Role, copy: typeof EN_COPY) {
  switch (role) {
    case "ADMIN":
      return copy.roleAdmin;
    case "EXPERT":
      return copy.roleExpert;
    case "ENTERPRISE_LEADER":
      return copy.roleEnterprise;
    default:
      return copy.roleLearner;
  }
}

function getStatusLabel(
  status: UserAccountStatus | undefined,
  copy: typeof EN_COPY,
) {
  switch (status) {
    case "suspended":
      return copy.statusSuspended;
    case "pending_identity_review":
      return copy.statusPending;
    default:
      return copy.statusActive;
  }
}

function getStatusBadgeClass(status: UserAccountStatus | undefined) {
  switch (status) {
    case "suspended":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "pending_identity_review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}

function getRoleBadgeClass(role: Role) {
  switch (role) {
    case "ADMIN":
      return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
    case "EXPERT":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "ENTERPRISE_LEADER":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300";
    default:
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }
}

export function Users() {
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const copy = language === "zh" ? ZH_COPY : EN_COPY;
  usePageTitle(copy.title);

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [stats, setStats] = useState<AdminUserStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<UserAccountStatus | "ALL">("ALL");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  async function loadData(options?: { silent?: boolean }) {
    const requestId = ++requestIdRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
    } else if (!options?.silent) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchAdminUsersByApi({
        q: deferredSearch.trim() || undefined,
        role: roleFilter,
        status: statusFilter,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setUsers(result.items);
      setStats(result.stats);
      setHasError(false);
      hasLoadedRef.current = true;
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setUsers([]);
      setStats(EMPTY_STATS);
      setHasError(true);
    } finally {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isInitialLoad) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void loadData();
  }, [deferredSearch, roleFilter, statusFilter]);

  async function reloadAfterMutation() {
    await loadData({ silent: true });
  }

  async function handleToggleStatus(targetUser: AdminUserItem) {
    const nextStatus =
      targetUser.status === "suspended" ? "active" : "suspended";
    setBusyUserId(targetUser.id);

    try {
      await adminUpdateUserStatusByApi(targetUser.id, nextStatus);
      await reloadAfterMutation();
      toast.success(
        nextStatus === "active" ? copy.activated : copy.suspended,
      );
    } catch (error: any) {
      toast.error(error?.message || t("api.request_failed"));
    } finally {
      setBusyUserId(null);
    }
  }

  const hasActiveFilters =
    deferredSearch.trim().length > 0 ||
    roleFilter !== "ALL" ||
    statusFilter !== "ALL";

  const summaryCards = [
    {
      key: "total",
      label: copy.totalUsers,
      value: stats.totalCount,
      Icon: UsersIcon,
      className: "border-white/10 bg-zinc-900/50 text-zinc-100",
    },
    {
      key: "active",
      label: copy.activeUsers,
      value: stats.activeCount,
      Icon: UserCheck,
      className: "border-emerald-500/20 bg-emerald-500/5 text-emerald-100",
    },
    {
      key: "pending",
      label: copy.pendingUsers,
      value: stats.pendingCount,
      Icon: Clock3,
      className: "border-amber-500/20 bg-amber-500/5 text-amber-100",
    },
    {
      key: "suspended",
      label: copy.suspendedUsers,
      value: stats.suspendedCount,
      Icon: UserMinus,
      className: "border-red-500/20 bg-red-500/5 text-red-100",
    },
  ] satisfies Array<{
    key: string;
    label: string;
    value: number;
    Icon: LucideIcon;
    className: string;
  }>;

  if (hasError) {
    return <ErrorState onRetry={() => void loadData()} />;
  }

  if (isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
          >
            <Shield className="mr-1 h-3 w-3" />
            {copy.admin}
          </Badge>
          {isRefreshing ? (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-zinc-300"
            >
              {language === "zh" ? "刷新中" : "Refreshing"}
            </Badge>
          ) : null}
          <Link to="/admin/review">
            <Button variant="outline" size="sm">
              {copy.review}
            </Button>
          </Link>
          <Link to="/admin/hub">
            <Button variant="outline" size="sm">
              {copy.content}
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            data-testid={`admin-users-stat-${card.key}`}
            className={`rounded-2xl border p-4 ${card.className}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{card.label}</p>
              <card.Icon className="h-4 w-4 opacity-80" />
            </div>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <Card className="glass-panel">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={copy.searchPlaceholder}
              className="w-full"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | "ALL")}
              className="rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
              data-testid="admin-users-role-filter"
            >
              <option value="ALL">{copy.allRoles}</option>
              {ROLE_FILTERS.filter((item) => item !== "ALL").map((item) => (
                <option key={item} value={item}>
                  {getRoleLabel(item as Role, copy)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as UserAccountStatus | "ALL")
              }
              className="rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500 focus:outline-none"
              data-testid="admin-users-status-filter"
            >
              <option value="ALL">{copy.allStatuses}</option>
              {STATUS_FILTERS.filter((item) => item !== "ALL").map((item) => (
                <option key={item} value={item}>
                  {getStatusLabel(item as UserAccountStatus, copy)}
                </option>
              ))}
            </select>
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("ALL");
                  setStatusFilter("ALL");
                }}
              >
                {copy.clearFilters}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 text-zinc-300">
              <UsersIcon className="mr-1 h-3 w-3" />
              <span data-testid="admin-users-results-count">
                {users.length} {copy.results}
              </span>
            </Badge>
            <Badge variant="outline" className="border-indigo-500/20 text-indigo-300">
              {copy.admins}: {stats.adminCount}
            </Badge>
            <Badge variant="outline" className="border-sky-500/20 text-sky-300">
              {copy.experts}: {stats.expertCount}
            </Badge>
            <Badge variant="outline" className="border-zinc-500/20 text-zinc-300">
              {copy.learners}: {stats.learnerCount}
            </Badge>
            <Badge variant="outline" className="border-fuchsia-500/20 text-fuchsia-300">
              {copy.enterprises}: {stats.enterpriseCount}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {users.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <div className="space-y-4">
          {users.map((item) => {
            const isSelf = currentUser?.id === item.id;
            const lastLoginLabel =
              formatDateTime(item.lastLoginAt, language) || copy.neverLoggedIn;

            return (
              <Card
                key={item.id}
                className="glass-panel overflow-hidden"
                data-testid={`admin-users-row-${item.id}`}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-lg font-semibold text-indigo-300">
                        {(item.name || item.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold text-zinc-100">
                            {item.name || item.email}
                          </h2>
                          <Badge
                            variant="outline"
                            className={getRoleBadgeClass(item.role)}
                          >
                            {getRoleLabel(item.role, copy)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClass(item.status)}
                          >
                            {getStatusLabel(item.status, copy)}
                          </Badge>
                          {isSelf ? (
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/5 text-zinc-300"
                            >
                              {copy.currentAdmin}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="grid gap-2 text-sm text-zinc-400 md:grid-cols-2 xl:grid-cols-3">
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.email}: {item.email || "-"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.contactEmail}: {item.contactEmail || "-"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.phone}: {item.phone || "-"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.company}: {item.company || item.companyName || "-"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.titleLabel}: {item.title || "-"}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-zinc-500" />
                            <span className="truncate">
                              {copy.location}: {item.location || "-"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Link to={`/u/${item.id}`}>
                        <Button variant="outline" size="sm">
                          {copy.profile}
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleToggleStatus(item)}
                        disabled={isSelf || busyUserId === item.id}
                        className={
                          item.status === "suspended"
                            ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                            : "border-red-500/30 text-red-300 hover:bg-red-500/10"
                        }
                        data-testid={`admin-users-toggle-status-${item.id}`}
                      >
                        {item.status === "suspended" ? copy.activate : copy.suspend}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-white/5 pt-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {copy.createdAt}
                      </p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {formatDateTime(item.createdAt, language) || "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {copy.lastLoginAt}
                      </p>
                      <p className="mt-2 text-sm text-zinc-200">{lastLoginLabel}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <Ticket className="h-3.5 w-3.5" />
                        {copy.invitesIssued}
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">
                        {item.inviteIssuedCount} / {copy.invitesUsed} {item.inviteUsedCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <FileText className="h-3.5 w-3.5" />
                        {copy.contentCount}
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">{item.contentCount}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <BookOpen className="h-3.5 w-3.5" />
                        {copy.knowledgeBaseCount}
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">
                        {item.knowledgeBaseCount}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <FolderKanban className="h-3.5 w-3.5" />
                        {copy.applicationCount}
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">
                        {item.applicationCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        <UsersIcon className="h-3.5 w-3.5" />
                        {language === "zh" ? "账号 ID" : "Account ID"}
                      </div>
                      <p className="mt-2 break-all text-sm text-zinc-200">{item.id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
