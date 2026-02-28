import { formatRole } from "../lib/utils";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useTranslation } from "../hooks/useTranslation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { BrainCircuit, Mail, Lock, User as UserIcon, ArrowRight, CheckCircle2, Ticket, ShieldCheck } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";

export function Login() {
  usePageTitle("Login");
  const { t } = useTranslation();
  const { login, verifiedInviteCode, setVerifiedInviteCode } = useAuthStore();
  const { users, consumeInviteCode } = useDataStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [isRegister, setIsRegister] = useState(searchParams.get("tab") === "register");
  const [selectedRole, setSelectedRole] = useState<"LEARNER" | "EXPERT" | "ENTERPRISE_LEADER">("LEARNER");
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    setIsRegister(searchParams.get("tab") === "register");
  }, [searchParams]);

  // If user tries to register without a verified invite code, redirect to invite page
  const needsInviteCode = isRegister && !verifiedInviteCode;

  const handleDemoLogin = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      login(user);
      toast.success(`Welcome back, ${user.name}!`);
      navigate("/hub");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegister) {
      if (!verifiedInviteCode) {
        toast.error("Please verify an invitation code first.");
        navigate("/invite");
        return;
      }
      const demoUser = users.find(u => u.role === selectedRole) || users[0];
      consumeInviteCode(verifiedInviteCode, demoUser.id);
      login(demoUser);
      toast.success("Account created successfully! Welcome to AI-World.");
    } else {
      login(users[0]);
      toast.success(`Welcome back, ${users[0].name}!`);
    }
    navigate("/hub");
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30">
      {/* Left Side - Atmospheric Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-indigo-400 w-fit">
            <BrainCircuit className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight text-white">AI-World</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
            {t("login.title")}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-8">
            {t("login.desc")}
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              <span>{t("login.check_1")}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              <span>{t("login.check_2")}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              <span>{t("login.check_3")}</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-zinc-500">
          {t("landing.footer")}
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2 text-indigo-400">
              <BrainCircuit className="h-8 w-8" />
              <span className="text-2xl font-bold tracking-tight text-white">AI-World</span>
            </Link>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {isRegister ? t("login.create_account") : t("login.welcome_back")}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {isRegister ? t("login.create_desc") : t("login.welcome_desc")}
            </p>
          </div>

          {/* Custom Tabs */}
          <div className="flex p-1 bg-zinc-900/50 rounded-lg border border-white/5">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegister ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {t("login.sign_in_tab")}
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegister ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {t("login.register_tab")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && needsInviteCode && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                  <Ticket className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-amber-300">{t("login.invite_req")}</h3>
                <p className="text-xs text-zinc-400">
                  {t("login.invite_desc")}
                </p>
                <Link to="/invite">
                  <Button className="mt-2 bg-amber-600 hover:bg-amber-500 text-white gap-2">
                    <Ticket className="h-4 w-4" />
                    {t("login.btn_invite")}
                  </Button>
                </Link>
              </div>
            )}

            {isRegister && verifiedInviteCode && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-400 font-medium">{t("login.invite_verified")}</p>
                  <p className="text-xs text-zinc-500 truncate font-mono">{verifiedInviteCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVerifiedInviteCode(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {t("login.change")}
                </button>
              </div>
            )}

            {isRegister && !needsInviteCode && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("login.role_label")}</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRole("LEARNER")}
                      className={`p-3 text-xs font-medium rounded-xl border transition-all flex flex-col items-center gap-2 ${selectedRole === "LEARNER" ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      {t("role.learner")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("EXPERT")}
                      className={`p-3 text-xs font-medium rounded-xl border transition-all flex flex-col items-center gap-2 ${selectedRole === "EXPERT" ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      {t("role.expert")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("ENTERPRISE_LEADER")}
                      className={`p-3 text-xs font-medium rounded-xl border transition-all flex flex-col items-center gap-2 ${selectedRole === "ENTERPRISE_LEADER" ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      {t("role.enterprise")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("login.name")}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="pl-10 bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            {(!isRegister || !needsInviteCode) && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">{t("login.email")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-10 bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300">{t("login.password")}</label>
                    {!isRegister && (
                      <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300">Forgot password?</a>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 bg-zinc-900/50 border-white/10 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                  {isRegister ? t("login.btn_create") : t("login.btn_sign_in")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#050505] px-2 text-zinc-500">{t("login.demo_users")}</span>
            </div>
          </div>

          <div className="grid gap-3">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleDemoLogin(user.id)}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/30 p-3 transition-all hover:bg-zinc-800/80 hover:border-white/10 group text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatar} fallback={user.name.charAt(0)} className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{user.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {formatRole(user.role)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Login</span>
              </button>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
}
