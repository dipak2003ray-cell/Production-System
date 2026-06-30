import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  TrendingUp,
  Search,
  Layers,
  Activity,
  Compass,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  Percent,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CostIntelligenceWorkspaceProps {
  authState: any;
  apiFetch: any;
}

export const CostIntelligenceWorkspace: React.FC<CostIntelligenceWorkspaceProps> = ({
  authState,
  apiFetch
}) => {
  // Navigation tabs matching routes
  const [subTab, setSubTab] = useState<"breakdown" | "explorer" | "traceability" | "simulation">("breakdown");

  // Selection state
  const [costSheets, setCostSheets] = useState<any[]>([]);
  const [selectedCostSheetId, setSelectedCostSheetId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Specific fetched data
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [explorerData, setExplorerData] = useState<any>(null);
  const [traceabilityData, setTraceabilityData] = useState<any>(null);
  const [impactData, setImpactData] = useState<any>(null);

  // Simulation variables
  const [simulationParams, setSimulationParams] = useState({
    material_rate_change_pct: 0,
    process_rate_change_pct: 0,
    scrap_rate_change_pct: 0,
    overhead_change_pct: 0,
    quantity_change_pct: 0
  });
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  // Fetch initial cost sheets
  const fetchCostSheets = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/v1/cost-sheets");
      if (res.ok) {
        const data = await res.json();
        setCostSheets(data);
        if (data.length > 0) {
          setSelectedCostSheetId(data[0].id);
        }
      } else {
        setErrorMsg("Failed to query existing cost sheets.");
      }
    } catch {
      setErrorMsg("Network error loading cost sheets workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostSheets();
  }, []);

  // Sync route path to subTab
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/cost-analysis") setSubTab("breakdown");
    else if (path === "/cost-explorer") setSubTab("explorer");
    else if (path === "/cost-traceability") setSubTab("traceability");
    else if (path === "/cost-simulation") setSubTab("simulation");
  }, []);

  const updateRoute = (tab: "breakdown" | "explorer" | "traceability" | "simulation") => {
    setSubTab(tab);
    let path = "/cost-analysis";
    if (tab === "explorer") path = "/cost-explorer";
    else if (tab === "traceability") path = "/cost-traceability";
    else if (tab === "simulation") path = "/cost-simulation";
    window.history.pushState({}, "", path);
  };

  // Load selected Cost Sheet details
  const loadCostSheetIntelligence = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch breakdown
      const analysisRes = await apiFetch(`/api/v1/cost-analysis/${id}`);
      if (analysisRes.ok) {
        const analysis = await analysisRes.json();
        setAnalysisData(analysis);
      }

      // 2. Fetch explorer hierarchy
      const explorerRes = await apiFetch(`/api/v1/cost-explorer/${id}`);
      if (explorerRes.ok) {
        const explorer = await explorerRes.json();
        setExplorerData(explorer);
      }

      // 3. Fetch traceability audit
      const traceabilityRes = await apiFetch(`/api/v1/cost-traceability/${id}`);
      if (traceabilityRes.ok) {
        const traceability = await traceabilityRes.json();
        setTraceabilityData(traceability);
      }

      // 4. Fetch standard impact analysis
      const impactRes = await apiFetch(`/api/v1/cost-impact/${id}`);
      if (impactRes.ok) {
        const impacts = await impactRes.json();
        setImpactData(impacts);
      }

      // Reset simulation params
      setSimulationParams({
        material_rate_change_pct: 0,
        process_rate_change_pct: 0,
        scrap_rate_change_pct: 0,
        overhead_change_pct: 0,
        quantity_change_pct: 0
      });
      setSimulationResult(null);

    } catch (e) {
      setErrorMsg("Error communicating with cost intelligence engine APIs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCostSheetId) {
      loadCostSheetIntelligence(selectedCostSheetId);
    }
  }, [selectedCostSheetId]);

  // Handle Simulation dispatch
  const handleRunSimulation = async () => {
    if (!selectedCostSheetId) return;
    setSimulating(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/v1/cost-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost_sheet_id: selectedCostSheetId,
          ...simulationParams
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Simulation calculation error.");
      }
    } catch {
      setErrorMsg("Network failure during simulation engine run.");
    } finally {
      setSimulating(false);
    }
  };

  const handleResetSimulation = () => {
    setSimulationParams({
      material_rate_change_pct: 0,
      process_rate_change_pct: 0,
      scrap_rate_change_pct: 0,
      overhead_change_pct: 0,
      quantity_change_pct: 0
    });
    setSimulationResult(null);
  };

  // Node expand/collapse state mapping for explorer tree
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Format Helper
  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Upper Context Selector Header */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-extrabold tracking-widest uppercase text-white font-mono">
              Cost Intelligence Workspace
            </h2>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed max-w-2xl">
            Audit-grade costing insights, multi-level recursive BOM drill-down, exact rate-card traceability, and non-destructive dynamic What-If simulations.
          </p>
        </div>

        {/* Dynamic Selection Input */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
            Target Cost Sheet:
          </label>
          <select
            value={selectedCostSheetId}
            onChange={(e) => setSelectedCostSheetId(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-4 py-2 font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer min-w-[200px]"
          >
            {costSheets.length === 0 ? (
              <option value="">No Cost Sheets Available</option>
            ) : (
              costSheets.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.cost_sheet_number} ({cs.status})
                </option>
              ))
            )}
          </select>

          <button
            onClick={() => selectedCostSheetId && loadCostSheetIntelligence(selectedCostSheetId)}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-all"
            title="Reload metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Unified Sub-Navigation System */}
      <div className="flex border-b border-slate-800 space-x-1.5">
        <button
          onClick={() => updateRoute("breakdown")}
          className={`px-4 py-3 text-xs font-bold transition-all relative ${
            subTab === "breakdown" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Breakdown Dashboard</span>
          </div>
          {subTab === "breakdown" && (
            <motion.div layoutId="subTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => updateRoute("explorer")}
          className={`px-4 py-3 text-xs font-bold transition-all relative ${
            subTab === "explorer" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Cost Explorer</span>
          </div>
          {subTab === "explorer" && (
            <motion.div layoutId="subTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => updateRoute("traceability")}
          className={`px-4 py-3 text-xs font-bold transition-all relative ${
            subTab === "traceability" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Traceability Viewer</span>
          </div>
          {subTab === "traceability" && (
            <motion.div layoutId="subTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => updateRoute("simulation")}
          className={`px-4 py-3 text-xs font-bold transition-all relative ${
            subTab === "simulation" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            <span>What-If Simulation</span>
          </div>
          {subTab === "simulation" && (
            <motion.div layoutId="subTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Surface Loading Guard */}
      {loading && !analysisData && (
        <div className="py-24 flex flex-col items-center justify-center text-slate-500">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
          <p className="text-xs font-mono">Running mathematical models, fetching rate structures...</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-900 text-red-300 text-xs rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Main Analysis Tab Rendering */}
      {subTab === "breakdown" && analysisData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-5">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 relative overflow-hidden group">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Material Cost Contribution</span>
              <div className="text-xl font-bold font-mono text-white mt-1.5">{fmtCurrency(analysisData.total_material_cost)}</div>
              <div className="text-[11px] font-mono font-extrabold text-emerald-400 mt-0.5">{analysisData.material_pct}% of total</div>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 relative overflow-hidden group">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Process Cost Contribution</span>
              <div className="text-xl font-bold font-mono text-white mt-1.5">{fmtCurrency(analysisData.total_process_cost)}</div>
              <div className="text-[11px] font-mono font-extrabold text-emerald-400 mt-0.5">{analysisData.process_pct}% of total</div>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 relative overflow-hidden group">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Scrap Recovery Offset</span>
              <div className="text-xl font-bold font-mono text-red-400 mt-1.5">-{fmtCurrency(analysisData.total_scrap_credit)}</div>
              <div className="text-[11px] font-mono font-extrabold text-red-400 mt-0.5">{analysisData.scrap_credit_pct}% deduction</div>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 relative overflow-hidden group">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Overhead Burden Cost</span>
              <div className="text-xl font-bold font-mono text-white mt-1.5">{fmtCurrency(analysisData.total_overhead_cost)}</div>
              <div className="text-[11px] font-mono font-extrabold text-emerald-400 mt-0.5">{analysisData.overhead_pct}% of total</div>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 relative overflow-hidden group">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500">Sub Assembly Rollup</span>
              <div className="text-xl font-bold font-mono text-white mt-1.5">{fmtCurrency(analysisData.total_sub_assembly_cost)}</div>
              <div className="text-[11px] font-mono font-extrabold text-emerald-400 mt-0.5">{analysisData.sub_assembly_pct}% of total</div>
            </div>

            <div className="bg-slate-950 border border-emerald-950 rounded-2xl p-5 relative overflow-hidden group bg-gradient-to-tr from-slate-950 to-emerald-950/15">
              <span className="text-[9px] uppercase font-mono font-extrabold text-emerald-400">Final Manufacturing Cost</span>
              <div className="text-2xl font-black font-mono text-white mt-1.5">{fmtCurrency(analysisData.grand_total_cost)}</div>
              <div className="text-[11px] font-mono font-semibold text-slate-400 mt-0.5">Authoritative FMC Rollup</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Visual Contribution Breakdown Chart Card */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-900 pb-3">
                Visual FMC Contribution Breakdown
              </h3>

              <div className="space-y-5">
                
                {/* Horizontal Stacked Bar */}
                <div className="h-6 w-full rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${analysisData.material_pct}%` }}
                    className="h-full bg-emerald-500 hover:opacity-90 transition-all"
                    title={`Material Cost: ${analysisData.material_pct}%`}
                  />
                  <div
                    style={{ width: `${analysisData.process_pct}%` }}
                    className="h-full bg-blue-500 hover:opacity-90 transition-all"
                    title={`Process Cost: ${analysisData.process_pct}%`}
                  />
                  <div
                    style={{ width: `${analysisData.overhead_pct}%` }}
                    className="h-full bg-indigo-500 hover:opacity-90 transition-all"
                    title={`Overhead Burden: ${analysisData.overhead_pct}%`}
                  />
                  <div
                    style={{ width: `${analysisData.sub_assembly_pct}%` }}
                    className="h-full bg-amber-500 hover:opacity-90 transition-all"
                    title={`Sub Assembly: ${analysisData.sub_assembly_pct}%`}
                  />
                </div>

                {/* Legend List */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold">Material Cost</span>
                      <span className="font-mono text-white font-bold">{fmtCurrency(analysisData.total_material_cost)} ({analysisData.material_pct}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-500" />
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold">Process Cost</span>
                      <span className="font-mono text-white font-bold">{fmtCurrency(analysisData.total_process_cost)} ({analysisData.process_pct}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm bg-indigo-500" />
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold">Overhead Burden</span>
                      <span className="font-mono text-white font-bold">{fmtCurrency(analysisData.total_overhead_cost)} ({analysisData.overhead_pct}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500" />
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold">Sub Assembly</span>
                      <span className="font-mono text-white font-bold">{fmtCurrency(analysisData.total_sub_assembly_cost)} ({analysisData.sub_assembly_pct}%)</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-850 rounded-xl leading-relaxed text-[11px] text-slate-400">
                  <span className="font-bold text-slate-200 block mb-1">Scrap Offset Impact Log</span>
                  This sheet benefits from <span className="font-bold text-emerald-400">-{fmtCurrency(analysisData.total_scrap_credit)}</span> in Scrap Recovery Credit ({analysisData.scrap_credit_pct}%), reducing the overall FMC required by that exact factor.
                </div>

              </div>
            </div>

            {/* Standard Impact Analysis Scenario Cards */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-900 pb-3">
                Cost Impact Analysis Scenarios
              </h3>

              {impactData && impactData.scenarios ? (
                <div className="space-y-4">
                  {impactData.scenarios.map((sc: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl flex items-center justify-between hover:border-slate-800 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{sc.name}</span>
                          <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                            {sc.factor}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">{sc.impact_description}</p>
                      </div>

                      <div className="text-right shrink-0 ml-4">
                        <div className="text-xs font-mono font-bold text-white">
                          {fmtCurrency(sc.simulated_cost)}
                        </div>
                        <div className={`text-[10px] font-mono font-extrabold mt-0.5 ${
                          sc.variance_percentage > 0 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {sc.variance_percentage > 0 ? "+" : ""}{sc.variance_percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Activity className="w-8 h-8 mb-2 opacity-55" />
                  <span>No scenarios compiled for this sheet.</span>
                </div>
              )}
            </div>

          </div>
        </motion.div>
      )}

      {/* Cost Explorer Tree Tab */}
      {subTab === "explorer" && explorerData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5 border-b border-slate-900 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Cost Sheet Line Item Explorer
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Click rows to drill-down and collapse recursive levels</p>
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded border border-emerald-900/40">
              Total Cost: {fmtCurrency(explorerData.rate)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[650px] space-y-1.5">
              
              {/* Header row */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-slate-900 text-[10px] uppercase tracking-wider font-extrabold text-slate-500 font-sans">
                <div className="col-span-5">Component Identifier / Details</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2 text-right">Quantity / UOM</div>
                <div className="col-span-1.5 text-right">Base Rate</div>
                <div className="col-span-1.5 text-right">Subtotal</div>
              </div>

              {/* Recursive list renderer */}
              {explorerData.children && explorerData.children.length > 0 ? (
                explorerData.children.map((child: any) => (
                  <ExplorerRow
                    key={child.id}
                    node={child}
                    level={0}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                    fmtCurrency={fmtCurrency}
                  />
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Layers className="w-10 h-10 mb-2 opacity-40" />
                  <span>No breakdown rows recorded in this sheet.</span>
                </div>
              )}

            </div>
          </div>
        </motion.div>
      )}

      {/* Traceability Auditor Tab */}
      {subTab === "traceability" && traceabilityData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Materials Module */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-900 pb-3 flex items-center justify-between">
                <span>Material Trace Audit</span>
                <span className="text-[9px] font-mono font-bold text-slate-500">
                  {traceabilityData.materials ? traceabilityData.materials.length : 0} items
                </span>
              </h3>

              <div className="space-y-4">
                {traceabilityData.materials && traceabilityData.materials.length > 0 ? (
                  traceabilityData.materials.map((mat: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-3 hover:border-slate-800 transition-all">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-white block">{mat.code}</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {fmtCurrency(mat.final_cost)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">{mat.description}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-850 pt-2.5">
                        <div>
                          <span className="text-slate-600 font-sans block text-[8px] font-bold uppercase">Rate Card ID</span>
                          <span className="text-slate-300 block truncate">{mat.rate_card_id}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans block text-[8px] font-bold uppercase">Effective Date</span>
                          <span className="text-slate-300 block">{mat.effective_date}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans block text-[8px] font-bold uppercase">UOM Conversion</span>
                          <span className="text-slate-300 block">{mat.conversion}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans block text-[8px] font-bold uppercase">Waste factor</span>
                          <span className="text-slate-300 block">{mat.waste_factor}x applied</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">No Material dependencies traced.</div>
                )}
              </div>
            </div>

            {/* Processes Module */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-900 pb-3 flex items-center justify-between">
                <span>Process Driver Trace</span>
                <span className="text-[9px] font-mono font-bold text-slate-500">
                  {traceabilityData.processes ? traceabilityData.processes.length : 0} items
                </span>
              </h3>

              <div className="space-y-4">
                {traceabilityData.processes && traceabilityData.processes.length > 0 ? (
                  traceabilityData.processes.map((proc: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-3 hover:border-slate-800 transition-all">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-white block">{proc.code}</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {fmtCurrency(proc.final_cost)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">{proc.description}</span>
                      </div>

                      <div className="space-y-2 text-[10px] font-mono text-slate-400 border-t border-slate-850 pt-2.5">
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-sans">Active Driver Constraint:</span>
                          <span className="text-slate-300">{proc.driver}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-sans">Rate Card Lookup:</span>
                          <span className="text-slate-300 truncate max-w-[150px]">{proc.rate_card_id}</span>
                        </div>
                        <div className="pt-1 bg-slate-950 p-2 rounded border border-slate-850 leading-normal text-[9px] text-slate-400">
                          <span className="block text-[8px] font-bold text-slate-500 mb-0.5 font-sans uppercase">Formula Resolution Explanation</span>
                          {proc.formula}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">No Processes tracked on this sheet.</div>
                )}
              </div>
            </div>

            {/* Scrap Recovery Module */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-900 pb-3 flex items-center justify-between">
                <span>Scrap Recovery Offset</span>
                <span className="text-[9px] font-mono font-bold text-slate-500">
                  {traceabilityData.scraps ? traceabilityData.scraps.length : 0} lines
                </span>
              </h3>

              <div className="space-y-4">
                {traceabilityData.scraps && traceabilityData.scraps.length > 0 ? (
                  traceabilityData.scraps.map((scr: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-3 hover:border-slate-800 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-white block">Recovery Class: {scr.scrap_type}</span>
                          <span className="text-[10px] font-mono font-bold text-slate-500 block mt-0.5">
                            Standard Scrap Index Rate: {fmtCurrency(scr.rate)} / KG
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-extrabold text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/35">
                          -{fmtCurrency(scr.recovery_credit)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No Scrap recovery offset models calculated.
                  </div>
                )}
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* What-If Simulation Sandbox Tab */}
      {subTab === "simulation" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Simulation Inputs Config */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl h-fit space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-900 pb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Simulation Sandbox Controls</span>
            </h3>

            <div className="space-y-5">
              
              {/* Material Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Material Rate Shift</span>
                  <span className={`font-mono ${simulationParams.material_rate_change_pct > 0 ? "text-amber-400" : simulationParams.material_rate_change_pct < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                    {simulationParams.material_rate_change_pct > 0 ? "+" : ""}{simulationParams.material_rate_change_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={simulationParams.material_rate_change_pct}
                  onChange={(e) => setSimulationParams({ ...simulationParams, material_rate_change_pct: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Process Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Process Rate Shift</span>
                  <span className={`font-mono ${simulationParams.process_rate_change_pct > 0 ? "text-amber-400" : simulationParams.process_rate_change_pct < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                    {simulationParams.process_rate_change_pct > 0 ? "+" : ""}{simulationParams.process_rate_change_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={simulationParams.process_rate_change_pct}
                  onChange={(e) => setSimulationParams({ ...simulationParams, process_rate_change_pct: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Scrap Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Scrap Index Rate Shift</span>
                  <span className={`font-mono ${simulationParams.scrap_rate_change_pct > 0 ? "text-emerald-400" : simulationParams.scrap_rate_change_pct < 0 ? "text-amber-400" : "text-slate-400"}`}>
                    {simulationParams.scrap_rate_change_pct > 0 ? "+" : ""}{simulationParams.scrap_rate_change_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={simulationParams.scrap_rate_change_pct}
                  onChange={(e) => setSimulationParams({ ...simulationParams, scrap_rate_change_pct: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Overhead Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Overhead Rate Shift</span>
                  <span className={`font-mono ${simulationParams.overhead_change_pct > 0 ? "text-amber-400" : simulationParams.overhead_change_pct < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                    {simulationParams.overhead_change_pct > 0 ? "+" : ""}{simulationParams.overhead_change_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="5"
                  value={simulationParams.overhead_change_pct}
                  onChange={(e) => setSimulationParams({ ...simulationParams, overhead_change_pct: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Quantity Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Batch Quantity Multiplier</span>
                  <span className={`font-mono ${simulationParams.quantity_change_pct > 0 ? "text-amber-400" : simulationParams.quantity_change_pct < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                    {simulationParams.quantity_change_pct > 0 ? "+" : ""}{simulationParams.quantity_change_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="100"
                  step="5"
                  value={simulationParams.quantity_change_pct}
                  onChange={(e) => setSimulationParams({ ...simulationParams, quantity_change_pct: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  onClick={handleResetSimulation}
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Params</span>
                </button>

                <button
                  onClick={handleRunSimulation}
                  disabled={simulating}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-550 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold text-white rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                >
                  {simulating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Simulate FMC</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Simulation Results Display */}
          <div className="lg:col-span-8 space-y-6">
            
            {simulationResult ? (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                
                {/* Result Comparison card */}
                <div className="bg-slate-950 border border-emerald-950 rounded-2xl p-6 shadow-xl relative overflow-hidden bg-gradient-to-tr from-slate-950 to-emerald-950/10">
                  <span className="text-[10px] uppercase font-mono font-extrabold text-emerald-400 bg-emerald-950/20 border border-emerald-900/60 px-2 py-0.5 rounded">
                    Simulation Output Resolution (Strict Non-Destructive)
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5 pt-3.5 border-t border-slate-900">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Current Active FMC</span>
                      <div className="text-2xl font-bold font-mono text-slate-400 mt-1">
                        {fmtCurrency(simulationResult.original_grand_total)}
                      </div>
                    </div>

                    <div className="flex items-center justify-center md:border-x border-slate-900 py-3 md:py-0">
                      <div className="text-center">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">FMC Delta Variance</span>
                        <div className={`text-2xl font-black font-mono mt-1 ${
                          simulationResult.variance_absolute > 0 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {simulationResult.variance_absolute > 0 ? "+" : ""}{fmtCurrency(simulationResult.variance_absolute)}
                        </div>
                        <span className={`text-[10px] font-mono font-extrabold block mt-0.5 ${
                          simulationResult.variance_percentage > 0 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          ({simulationResult.variance_percentage > 0 ? "+" : ""}{simulationResult.variance_percentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 text-[10px] uppercase font-bold block">Simulated Projective FMC</span>
                      <div className="text-3xl font-black font-mono text-white mt-1">
                        {fmtCurrency(simulationResult.simulated_grand_total)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subcomponent Drill-Down */}
                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-900 pb-3 mb-4">
                    Subcomponent Variance Breakdown
                  </h4>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-400">Material Cost Segment</span>
                      <div className="font-mono text-right">
                        <span className="text-slate-500 line-through mr-2">{fmtCurrency(simulationResult.original_material_cost)}</span>
                        <span className="text-white font-bold">{fmtCurrency(simulationResult.simulated_material_cost)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-400">Processing Cost Segment</span>
                      <div className="font-mono text-right">
                        <span className="text-slate-500 line-through mr-2">{fmtCurrency(simulationResult.original_process_cost)}</span>
                        <span className="text-white font-bold">{fmtCurrency(simulationResult.simulated_process_cost)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-400">Scrap Recovery Credit</span>
                      <div className="font-mono text-right text-red-400">
                        <span className="text-slate-600 line-through mr-2">-{fmtCurrency(simulationResult.original_scrap_credit)}</span>
                        <span className="font-bold">-{fmtCurrency(simulationResult.simulated_scrap_credit)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-400">Overhead Burden Cost</span>
                      <div className="font-mono text-right">
                        <span className="text-slate-500 line-through mr-2">{fmtCurrency(simulationResult.original_overhead_cost)}</span>
                        <span className="text-white font-bold">{fmtCurrency(simulationResult.simulated_overhead_cost)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Sub Assembly Rollup Cost</span>
                      <div className="font-mono text-right">
                        <span className="text-slate-500 line-through mr-2">{fmtCurrency(simulationResult.original_sub_assembly_cost)}</span>
                        <span className="text-white font-bold">{fmtCurrency(simulationResult.simulated_sub_assembly_cost)}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              <div className="bg-slate-950 border border-slate-850 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[350px]">
                <Sliders className="w-12 h-12 mb-4 opacity-40 text-emerald-400 stroke-1.5" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-350 mb-1">Sandbox Awaiting Dispatch</h4>
                <p className="text-xs max-w-sm text-slate-450 leading-relaxed">
                  Modify the sliders on the left and click "Simulate FMC" to trace the mathematical projection of rate shifts.
                </p>
              </div>
            )}

          </div>

        </motion.div>
      )}

    </div>
  );
};

// Tree Row helper for Cost Explorer
interface ExplorerRowProps {
  node: any;
  level: number;
  expandedNodes: Record<string, boolean>;
  toggleNode: (nodeId: string) => void;
  fmtCurrency: (val: number) => string;
}

const ExplorerRow: React.FC<ExplorerRowProps> = ({
  node,
  level,
  expandedNodes,
  toggleNode,
  fmtCurrency
}) => {
  const isExpanded = expandedNodes[node.id];
  const hasChildren = node.children && node.children.length > 0;

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "MATERIAL": return "bg-emerald-950/30 text-emerald-400 border-emerald-900/40";
      case "PROCESS": return "bg-blue-950/30 text-blue-400 border-blue-900/40";
      case "SUB_ASSEMBLY": return "bg-amber-950/30 text-amber-400 border-amber-900/40";
      case "SCRAP_RECOVERY": return "bg-red-950/30 text-red-400 border-red-900/40";
      case "OVERHEAD": return "bg-indigo-950/30 text-indigo-400 border-indigo-900/40";
      default: return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  return (
    <>
      <div
        className="grid grid-cols-12 gap-4 px-4 py-2.5 rounded-lg border border-slate-900 bg-slate-950/30 hover:bg-slate-900/40 items-center text-xs font-medium cursor-pointer transition-all"
        onClick={() => hasChildren && toggleNode(node.id)}
        style={{ paddingLeft: `${Math.max(16, level * 20)}px` }}
      >
        <div className="col-span-5 flex items-center gap-1.5 text-white">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {hasChildren && (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <span className="font-bold truncate">{node.name}</span>
        </div>

        <div className="col-span-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${getBadgeStyle(node.item_type)}`}>
            {node.item_type}
          </span>
        </div>

        <div className="col-span-2 text-right font-mono text-slate-400">
          {node.quantity} <span className="text-[10px] lowercase text-slate-600">{node.uom}</span>
        </div>

        <div className="col-span-1.5 text-right font-mono text-slate-400">
          {node.rate > 0 ? fmtCurrency(node.rate) : "—"}
        </div>

        <div className="col-span-1.5 text-right font-mono font-bold text-white">
          {fmtCurrency(node.subtotal)}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1.5">
          {node.children.map((child: any) => (
            <ExplorerRow
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              fmtCurrency={fmtCurrency}
            />
          ))}
        </div>
      )}
    </>
  );
};
