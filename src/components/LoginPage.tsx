import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Lock, Mail, ShieldAlert, KeyRound, Clock, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutExp, setLockoutExp] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLockoutExp(null);

    if (!email || !password) {
      setError("Please supply both login credentials parameters.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Authentication procedure failed.");
      if (result.code === "LOGIN_LOCKED") {
        setLockoutExp("Security Lock Applied: Your profile is locked after 3 consecutive wrong pass entries.");
      }
    }
  };

  // Helper login links for sandbox demonstration
  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("spacemaker123");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden font-sans">
      {/* Aesthetic glowing grid background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-950/15 rounded-full filter blur-[120px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="text-xs font-bold tracking-widest text-emerald-400 uppercase mb-1">
            CCS SPACEMAKER SI PVT LTD
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mb-1.5">
            Job Costing & BOM Platform
          </h1>
          <p className="text-slate-400 text-xs">
            Authenticate to coordinate estimating, engineering bills, and purchase order items.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-300 text-xs rounded-lg flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Security Failure</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">
              Email Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="operator@ccspacemaker.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg pl-10 pr-4 py-2 text-xs font-medium text-white transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type={showPass ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg pl-10 pr-10 py-2 text-xs font-medium text-white transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-550 active:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2.5 transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Authenticating Session Identity..." : "Secure Login Session"}
            <Lock className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Dynamic developer helper tray */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sandbox Fast-Credential Injector</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
              If you have just bootstrapped the system, use that account. Alternatively, use these pre-seeding credentials (password for all is <code className="text-emerald-400 font-bold">spacemaker123</code>):
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => handleQuickLogin("admin@ccsgroup.co.in")}
                className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800/85 px-2 py-1.5 rounded transition text-slate-300 truncate"
              >
                <strong>L2-Admin</strong>: admin@ccsgroup.co.in
              </button>
              <button
                onClick={() => handleQuickLogin("estimator@ccsgroup.co.in")}
                className="text-left bg-slate-900 hover:bg-slate-800 border border-slate-800/85 px-2 py-1.5 rounded transition text-slate-300 truncate"
              >
                <strong>Estimator</strong>: estimator@ccsgroup.co.in
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
