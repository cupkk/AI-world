import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { BrainCircuit, ArrowLeft } from "lucide-react";
import { usePageTitle } from "../lib/usePageTitle";

export function NotFound() {
  usePageTitle("404 Not Found");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-white selection:bg-indigo-500/30 p-6">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 text-center max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-indigo-400 mb-12">
          <BrainCircuit className="h-8 w-8" />
          <span className="text-xl font-bold tracking-tight text-white">AI-World</span>
        </Link>

        <h1 className="text-8xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold text-zinc-100">
          Page Not Found
        </h2>
        <p className="mt-3 text-zinc-400 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/hub">
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              Go to Knowledge Hub
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
