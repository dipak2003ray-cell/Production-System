import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { ShieldAlert, CheckCircle, Flame, ArrowRight, UserCheck, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

export const BootstrapPage: React.FC = () => {
  const { checkBootstrap } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!formData.email || !formData.fullName || !formData.password) {
      setServerError("Please supply all required parameters to finalize bootstrap.");
      return;
    }

    if (formData.password.length < 8) {
      setServerError("Password must be at least 8 characters long for system security compliance.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setServerError("Password fields do not match. Re-enter your intended password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v1/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setServerError(data.message || "Failed to initialize bootstrap layout.");
        return;
      }

      setSuccess(true);
      setTimeout(async () => {
        await checkBootstrap(); // Reload state
      }, 2000);
    } catch {
      setServerError("Unable to contact server environment. Make sure Backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden font-sans">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-950/20 rounded-full filter blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-800/10 rounded-full filter blur-3xl pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <span className="p-3 bg-emerald-950/60 border border-emerald-900 rounded-2xl text-emerald-400">
              <UserCheck className="w-8 h-8" />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">System Bootstrap required</h1>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            You are deploying a fresh instance of the Job Costing & BOM Platform. Define the principal L2-Admin credentials below to secure the platform.
          </p>
        </div>

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-center space-y-4"
          >
            <div className="flex justify-center">
              <ShieldCheck className="w-12 h-12 text-emerald-400 animate-bounce" />
            </div>
            <h3 className="font-bold text-lg text-emerald-200">Bootstrap Successful!</h3>
            <p className="text-xs text-emerald-300 max-w-xs mx-auto leading-relaxed">
              Global variables successfully seeded. Registering audit records... Redirecting into operational console.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {serverError && (
              <div className="p-3.5 bg-red-950/50 border border-red-900/60 text-red-300 text-xs rounded-lg flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">
                Administrator Full name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Priyam Mukherjee"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">
                Email Identity (Primary Username) *
              </label>
              <input
                type="email"
                required
                placeholder="admin@ccspacemaker.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Retype password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-550 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition-all outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800 text-[10px] text-slate-400 leading-relaxed space-y-1">
              <span className="font-bold text-slate-300 block mb-0.5">COMPLIANCE INSTRUCTION</span>
              <li>Primary administrator represents authority grade <strong>L2-Admin</strong>.</li>
              <li>Required schema migrations and role models will configure automatically.</li>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-550 active:bg-emerald-700 text-white font-medium text-xs rounded-lg py-2.5 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Registering System Admin..." : "Finalize Core Bootstrap"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
