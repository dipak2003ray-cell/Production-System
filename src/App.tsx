import React from "react";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { BootstrapPage } from "./components/BootstrapPage";
import { LoginPage } from "./components/LoginPage";
import { DashboardShell } from "./components/DashboardShell";
import { RefreshCw } from "lucide-react";

const AppContent: React.FC = () => {
  const { authState, bootstrapStatus } = useAuth();

  // If bootstrap status hasn't loaded yet, show a clean, branded loading state
  if (!bootstrapStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <div className="text-center">
            <h2 className="text-sm font-extrabold tracking-widest uppercase text-white">CCS SPACEMAKER</h2>
            <p className="text-slate-500 text-[10px] uppercase font-mono mt-1">Contacting core database foundation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Phase 1: Gate with system bootstrap if uninitialized
  if (!bootstrapStatus.bootstrapped) {
    return <BootstrapPage />;
  }

  // Phase 2: Gate with secure Login screen
  if (!authState.isAuthenticated) {
    return <LoginPage />;
  }

  // Phase 3: Deliver master Full-Stack Bento Dashboard
  return <DashboardShell />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
