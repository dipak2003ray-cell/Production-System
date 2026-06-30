import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  User, 
  Layers, 
  FileText, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  BarChart3,
  Users2,
  Gauge,
  Printer,
  ChevronRight,
  Sparkles,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GovernanceDashboardWorkspaceProps {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const GovernanceDashboardWorkspace: React.FC<GovernanceDashboardWorkspaceProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  // Loading & refresh states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // API Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [sla, setSla] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [performance, setPerformance] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);

  // UI Local States
  const [selectedReportTab, setSelectedReportTab] = useState<string>("workflow");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState<string>("");

  const fetchAllGovernanceData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [
        dashRes,
        kpiRes,
        slaRes,
        analyticsRes,
        perfRes,
        healthRes,
        reportsRes
      ] = await Promise.all([
        apiFetch("/api/v1/governance/dashboard"),
        apiFetch("/api/v1/governance/kpis"),
        apiFetch("/api/v1/governance/sla"),
        apiFetch("/api/v1/governance/workflow-analytics"),
        apiFetch("/api/v1/governance/user-performance"),
        apiFetch("/api/v1/governance/health"),
        apiFetch("/api/v1/governance/reports")
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (slaRes.ok) setSla(await slaRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (perfRes.ok) setPerformance(await perfRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (reportsRes.ok) setReports(await reportsRes.json());

      setErrorMsg(null);
    } catch (err) {
      console.error("Failed to load governance intelligence datasets", err);
      setErrorMsg("Governance subsystem synchronization failed. Please retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllGovernanceData();
  }, []);

  const handleManualPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">
          Synthesizing Operational Governance intelligence...
        </span>
      </div>
    );
  }

  // Fallbacks in case APIs returned empty arrays / structures
  const dashStats = dashboard || {
    pending_approvals: 0,
    approved_today: 0,
    rejected_estimates: 0,
    awaiting_review: 0,
    locked_estimates: 0,
    active_revisions: 0,
    avg_approval_time_hours: 0,
    avg_revision_count: 0,
    overall_workflow_health_pct: 100
  };

  const kpiStats = kpis || {
    total_estimates: 0,
    by_status: { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0, LOCKED: 0, SUPERSEDED: 0, CHANGES_REQUESTED: 0 },
    approval_rate_pct: 100,
    avg_turnaround_hours: 0,
    avg_revisions: 0
  };

  const anaStats = analytics || {
    avg_time_by_role: { "L1-Estimator": 0, "L2-Admin": 0, "L3-Approver": 0 },
    avg_time_by_level: { "Level 1": 0, "Level 2": 0, "Level 3": 0 },
    rejection_rate: 0,
    change_request_freq: 0,
    approval_success_rate: 100,
    workflow_completion_rate: 100,
    avg_workflow_duration_hours: 0,
    avg_revision_count: 0
  };

  const healthScore = health || {
    score: 100,
    rating: "EXCELLENT",
    sla_compliance_pct: 100,
    rejection_rate_pct: 0,
    revision_overhead_avg: 1.0,
    backlog_count: 0,
    overdue_count: 0
  };

  const activeReports = reports || {
    workflow_summary_report: { title: "Workflow", description: "", headers: [], rows: [] },
    approval_summary_report: { title: "Approvals", description: "", headers: [], rows: [] },
    revision_summary_report: { title: "Revisions", description: "", headers: [], rows: [] },
    sla_summary_report: { title: "SLA Tracker", description: "", headers: [], rows: [] },
    health_summary_report: { title: "Health Assessment", description: "", headers: [], rows: [] }
  };

  // Filter SLA list
  const filteredSla = sla.filter(item => {
    if (slaFilter === "all") return true;
    if (slaFilter === "breached") return item.is_overdue === true;
    if (slaFilter === "warning") return item.sla_status === "AMBER";
    if (slaFilter === "compliant") return item.sla_status === "GREEN";
    return true;
  });

  // Filter Performance Grid
  const filteredPerformance = performance.filter(user => {
    if (!userSearch) return true;
    return (
      user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.role.toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  // Color mappings for Health Status
  const getHealthRatingColor = (rating: string) => {
    const r = rating.toUpperCase();
    if (r.includes("EXCELLENT")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
    if (r.includes("GOOD")) return "text-cyan-400 bg-cyan-500/10 border-cyan-500/25";
    if (r.includes("NEED") || r.includes("ATTENTION") || r.includes("AMBER")) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    return "text-rose-400 bg-rose-500/10 border-rose-500/25";
  };

  const getSlaBadgeColor = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes("GREEN") || s.includes("COMPLIANT")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (s.includes("AMBER") || s.includes("WARNING")) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  return (
    <div className="space-y-6" id="governance-workspace-view">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950 border border-slate-900 rounded-xl p-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Executive Governance & SLA Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time compliance monitoring, SLA verification, user performance diagnostics, and operational health scorecards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAllGovernanceData(true)}
            className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            disabled={refreshing}
            id="gov-refresh-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Intelligence"}
          </button>
          
          <button
            onClick={handleManualPrint}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/10"
            id="gov-print-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Audit Report
          </button>
        </div>
      </div>

      {/* EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="gov-kpi-grid">
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-2.5 hover:border-slate-800/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Pending Reviews</span>
            <span className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">{dashStats.pending_approvals}</div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Awaiting level verification
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-2.5 hover:border-slate-800/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Concluded Today</span>
            <span className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">{dashStats.approved_today}</div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live approved volume
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-2.5 hover:border-slate-800/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Active Revisions</span>
            <span className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">{dashStats.active_revisions}</div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              Avg depth: <strong className="text-cyan-400 font-mono">{dashStats.avg_revision_count}</strong> revs
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-2.5 hover:border-slate-800/80 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Avg Turnaround Time</span>
            <span className="p-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">{dashStats.avg_approval_time_hours}h</div>
            <p className="text-[10px] text-slate-400 mt-1">
              Submission to conclusion
            </p>
          </div>
        </motion.div>

      </div>

      {/* TOP ROW: GOVERNANCE HEALTH SCORE & APPROVAL FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* GOVERNANCE HEALTH CARD */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-900 rounded-xl p-6 flex flex-col justify-between space-y-6" id="gov-health-card">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">System Health Score</h3>
              <span className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-slate-400 font-mono">Sprint 3D</span>
            </div>
            
            <div className="flex items-center justify-center py-6 relative">
              {/* Semi circle SVG dial or simple progress dial */}
              <svg className="w-40 h-24" viewBox="0 0 100 60">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                <path 
                  d="M 10 50 A 40 40 0 0 1 90 50" 
                  fill="none" 
                  stroke="url(#healthGradient)" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  strokeDasharray="125.6" 
                  strokeDashoffset={125.6 - (125.6 * healthScore.score) / 100}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-[48%] flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-mono text-white tracking-tighter">{healthScore.score}%</span>
                <span className={`text-[10px] px-2 py-0.5 mt-1 rounded-full font-bold border ${getHealthRatingColor(healthScore.rating)}`}>
                  {healthScore.rating}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-900">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">SLA Compliance Rate</span>
              <span className="font-mono text-white font-bold">{healthScore.sla_compliance_pct}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${healthScore.sla_compliance_pct}%` }}></div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Rejection Rate Frequency</span>
              <span className="font-mono text-white font-bold">{healthScore.rejection_rate_pct}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${healthScore.rejection_rate_pct}%` }}></div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-3 mt-1">
              <div className="p-2 bg-slate-900 border border-slate-850 rounded">
                <div className="text-xs font-bold text-rose-400 font-mono">{healthScore.overdue_count}</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Overdue</div>
              </div>
              <div className="p-2 bg-slate-900 border border-slate-850 rounded">
                <div className="text-xs font-bold text-slate-300 font-mono">{healthScore.backlog_count}</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">In Backlog</div>
              </div>
            </div>
          </div>
        </div>

        {/* APPROVAL FUNNEL */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-900 rounded-xl p-6 space-y-4 flex flex-col justify-between" id="gov-funnel-card">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Estimate Approval Funnel</h3>
            <p className="text-[11px] text-slate-500">
              Role-based transition pipeline efficiency showing conversion velocity at each validation sequence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 relative">
            
            {/* STAGE 1 */}
            <div className="bg-slate-900/45 border border-slate-850 p-4 rounded-xl space-y-3 relative overflow-hidden group">
              <div className="absolute right-2 top-2 text-[10px] font-mono font-black text-slate-800">01</div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Level 1 Review</span>
                <div className="text-base font-bold text-white font-mono">L1-Estimator</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Success Rate</span>
                  <span className="text-emerald-400 font-bold font-mono">100%</span>
                </div>
                <div className="w-full bg-slate-850 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: "100%" }}></div>
                </div>
                <div className="text-[10px] text-slate-500 italic">Auto-routes to sequence order 1</div>
              </div>
            </div>

            {/* STAGE 2 */}
            <div className="bg-slate-900/45 border border-slate-850 p-4 rounded-xl space-y-3 relative overflow-hidden group">
              <div className="absolute right-2 top-2 text-[10px] font-mono font-black text-slate-800">02</div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Level 2 Approval</span>
                <div className="text-base font-bold text-white font-mono">L2-Admin</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Success Rate</span>
                  <span className="text-emerald-400 font-bold font-mono">{100 - anaStats.rejection_rate}%</span>
                </div>
                <div className="w-full bg-slate-850 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${100 - anaStats.rejection_rate}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 italic">Time-to-approve: ~{anaStats.avg_time_by_role["L2-Admin"]} hrs</div>
              </div>
            </div>

            {/* STAGE 3 */}
            <div className="bg-slate-900/45 border border-slate-850 p-4 rounded-xl space-y-3 relative overflow-hidden group">
              <div className="absolute right-2 top-2 text-[10px] font-mono font-black text-slate-800">03</div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Level 3 Audit</span>
                <div className="text-base font-bold text-white font-mono">L3-Approver</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Success Rate</span>
                  <span className="text-cyan-400 font-bold font-mono">{anaStats.approval_success_rate}%</span>
                </div>
                <div className="w-full bg-slate-850 rounded-full h-1.5">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${anaStats.approval_success_rate}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-500 italic">Final lock and signature authorization</div>
              </div>
            </div>

          </div>

          <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-slate-500 font-mono">
            <div>SLA limit: 24.0 hours per queue node</div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Overall completion rate: {anaStats.workflow_completion_rate}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* MIDDLE ROW: SLA TRACKER & ROLE STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SLA TRACKER MONITOR */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-900 rounded-xl p-6 space-y-4" id="gov-sla-monitor">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Live SLA Queue Monitor</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Track queue age and pending levels for outstanding reviews.</p>
            </div>
            
            {/* SLA Filter Toggles */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
              {["all", "breached", "warning", "compliant"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSlaFilter(f)}
                  className={`px-2 py-1 rounded text-[10px] uppercase font-bold font-mono transition-all cursor-pointer ${
                    slaFilter === f
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-400 divide-y divide-slate-900">
              <thead>
                <tr className="text-slate-500 font-semibold text-[10px] uppercase font-mono bg-slate-900/20">
                  <th className="py-2.5 px-3">Estimate #</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Role Node</th>
                  <th className="py-2.5 px-3">Queue Age</th>
                  <th className="py-2.5 px-3">Time Left</th>
                  <th className="py-2.5 px-3 text-right">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {filteredSla.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center italic text-slate-500">
                      No matching estimates found in the current active SLA queue.
                    </td>
                  </tr>
                ) : (
                  filteredSla.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/15">
                      <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">{item.estimate_number}</td>
                      <td className="py-3 px-3 max-w-[180px] truncate">{item.description}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300">
                          {item.current_approver_role}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {Math.floor(item.current_approval_age_mins / 60)}h {item.current_approval_age_mins % 60}m
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {item.is_overdue ? (
                          <span className="text-rose-400 font-bold">Overdue</span>
                        ) : (
                          <span>{Math.floor(item.time_remaining_mins / 60)}h left</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold font-mono ${getSlaBadgeColor(item.sla_status)}`}>
                          {item.sla_status === "RED" ? "BREACHED" : item.sla_status === "AMBER" ? "WARNING" : "COMPLIANT"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROLE DURATIONS / REVISION ANALYTICS */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-900 rounded-xl p-6 space-y-5" id="gov-analytics-charts">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Queue Durations by Role</h3>
            <p className="text-[11px] text-slate-500">Average retention timeline in hours before sequence forward.</p>
          </div>

          <div className="space-y-4">
            {Object.entries(anaStats.avg_time_by_role).map(([role, hours]: [string, any]) => (
              <div key={role} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">{role}</span>
                  <span className="font-bold font-mono text-emerald-400">{hours} hrs</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (hours / 24) * 100)}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-900 grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-900/50 p-2 border border-slate-850 rounded">
              <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Change Requests</span>
              <strong className="text-base text-cyan-400 font-mono font-bold">{anaStats.change_request_freq}</strong>
              <span className="block text-[8px] text-slate-600 font-mono mt-0.5">Average per estimate</span>
            </div>
            <div className="bg-slate-900/50 p-2 border border-slate-850 rounded">
              <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Rejection Rate</span>
              <strong className="text-base text-rose-400 font-mono font-bold">{anaStats.rejection_rate}%</strong>
              <span className="block text-[8px] text-slate-600 font-mono mt-0.5">Concluded ratio</span>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: USER PERFORMANCE GRID */}
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 space-y-4" id="gov-performance-grid">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Estimator & Reviewer Performance Metrics</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Operational velocity and productivity statistics by user account.</p>
          </div>

          {/* User Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user email or role..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-8.5 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 w-full sm:w-64 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-400 divide-y divide-slate-900">
            <thead>
              <tr className="text-slate-500 font-semibold text-[10px] uppercase font-mono bg-slate-900/20">
                <th className="py-2.5 px-3">Authorized User</th>
                <th className="py-2.5 px-3">Role Node</th>
                <th className="py-2.5 px-3 text-center">Spawned Est.</th>
                <th className="py-2.5 px-3 text-center">Approved</th>
                <th className="py-2.5 px-3 text-center">Rejected</th>
                <th className="py-2.5 px-3 text-center">Req Changes</th>
                <th className="py-2.5 px-3 text-center">Comments Posted</th>
                <th className="py-2.5 px-3 text-right">In Queue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/50">
              {filteredPerformance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center italic text-slate-500">
                    No matching user activity found.
                  </td>
                </tr>
              ) : (
                filteredPerformance.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-900/15">
                    <td className="py-3 px-3">
                      <div>
                        <div className="font-semibold text-slate-200">{user.full_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{user.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-900 border border-slate-850 text-slate-300 rounded font-mono text-[10px]">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-white">{user.estimates_created}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">{user.approvals_completed}</td>
                    <td className="py-3 px-3 text-center font-mono text-rose-400">{user.rejections_completed}</td>
                    <td className="py-3 px-3 text-center font-mono text-amber-400">{user.revision_requests}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{user.comments_posted}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {user.pending_reviews > 0 ? (
                        <span className="text-amber-400">{user.pending_reviews} pending</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXECUTIVE REPORTS GENERATOR */}
      <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden" id="gov-executive-reports">
        
        <div className="p-6 border-b border-slate-900 bg-slate-950">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Printable Executive Reports</h3>
          <p className="text-[11px] text-slate-500">Select, generate, and isolate operational datasets formatted for corporate review boards.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex overflow-x-auto bg-slate-900/30 border-b border-slate-900 p-2 gap-1">
          {[
            { id: "workflow", label: "Workflow Summary", report: activeReports.workflow_summary_report },
            { id: "approvals", label: "Approval Log", report: activeReports.approval_summary_report },
            { id: "revisions", label: "Revision Lineage", report: activeReports.revision_summary_report },
            { id: "sla", label: "SLA Assessment", report: activeReports.sla_summary_report },
            { id: "health", label: "Governance Health", report: activeReports.health_summary_report }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedReportTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans transition-all whitespace-nowrap cursor-pointer ${
                selectedReportTab === tab.id
                  ? "bg-slate-950 border border-slate-800 text-emerald-400 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Panel */}
        <div className="p-6 space-y-4">
          {(() => {
            let selectedReport = activeReports.workflow_summary_report;
            if (selectedReportTab === "approvals") selectedReport = activeReports.approval_summary_report;
            if (selectedReportTab === "revisions") selectedReport = activeReports.revision_summary_report;
            if (selectedReportTab === "sla") selectedReport = activeReports.sla_summary_report;
            if (selectedReportTab === "health") selectedReport = activeReports.health_summary_report;

            return (
              <div className="space-y-4" id={`executive-report-panel-${selectedReportTab}`}>
                <div className="bg-slate-900/20 p-4 border border-slate-900 rounded-lg">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    {selectedReport.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{selectedReport.description}</p>
                </div>

                <div className="overflow-x-auto border border-slate-900 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-400 divide-y divide-slate-900">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-300 font-bold font-mono">
                        {selectedReport.headers.map((header: string, idx: number) => (
                          <th key={idx} className="py-3 px-4">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50 bg-slate-950">
                      {selectedReport.rows.length === 0 ? (
                        <tr>
                          <td colSpan={selectedReport.headers.length} className="py-6 text-center italic text-slate-500">
                            No active entries recorded for this category.
                          </td>
                        </tr>
                      ) : (
                        selectedReport.rows.map((row: any[], rowIdx: number) => (
                          <tr key={rowIdx} className="hover:bg-slate-900/10">
                            {row.map((cell: any, cellIdx: number) => (
                              <td key={cellIdx} className="py-3 px-4 text-slate-300 font-mono">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

    </div>
  );
};
