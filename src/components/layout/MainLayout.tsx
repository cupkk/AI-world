import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-zinc-100 mesh-bg">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
