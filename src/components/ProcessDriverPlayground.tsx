import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { ProcessMaster } from "../types";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Settings, 
  HelpCircle, 
  Loader2, 
  FileText, 
  AlertTriangle, 
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { motion } from "motion/react";

interface ValidationDetail {
  field: string;
  message: string;
}

interface ValidationResponse {
  is_valid: boolean;
  driver_type?: string;
  resolved_sub_type?: string;
  resolved_thickness?: number;
  errors: ValidationDetail[];
}

interface ResolutionResponse {
  rate_card_id: string;
  rate: number;
  rate_unit: string;
  resolved_sub_type?: string;
  resolved_thickness?: number;
  effective_date: string;
  message?: string;
}

export const ProcessDriverPlayground: React.FC = () => {
  const { apiFetch } = useAuth();
  
  // Data lists
  const [processes, setProcesses] = useState<ProcessMaster[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);

  // Form State
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [thickness, setThickness] = useState("");
  const [subType, setSubType] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Action / Output States
  const [loadingAction, setLoadingAction] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [rateResult, setRateResult] = useState<ResolutionResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch registered processes
  const fetchProcesses = async () => {
    setLoadingProcs(true);
    try {
      const res = await apiFetch("/api/v1/processes");
      if (res.ok) {
        const data = await res.json();
        // Only show active processes with driver_type defined
        const activeDriversOnes = data.filter((p: ProcessMaster) => p.is_active && p.driver_type);
        setProcesses(activeDriversOnes);
        if (activeDriversOnes.length > 0) {
          setSelectedProcessId(activeDriversOnes[0].id);
        }
      }
    } catch {
      setErrorMsg("Failed to synchronize active processes registry.");
    } finally {
      setLoadingProcs(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  const activeProcess = processes.find(p => p.id === selectedProcessId);

  // Automatically reset inputs if a fixed structure is chosen
  useEffect(() => {
    if (activeProcess) {
      const lowerDriver = (activeProcess.driver_type || "").trim().toUpperCase();
      if (lowerDriver === "PER_STROKE") {
        setSubType("BENDING");
        setThickness("");
      } else if (lowerDriver === "PER_HOUR") {
        setSubType("WELDING");
        setThickness("");
      } else if (lowerDriver === "PER_CUT") {
        setSubType("");
      }
    }
  }, [selectedProcessId]);

  const runResolutionEngine = async () => {
    if (!selectedProcessId) {
      setErrorMsg("Please register or select an active process to test.");
      return;
    }

    setLoadingAction(true);
    setValidationResult(null);
    setRateResult(null);
    setErrorMsg(null);

    const payload = {
      thickness: thickness ? parseFloat(thickness) : null,
      sub_type: subType.trim() || null
    };

    try {
      // 1. Run validation POST
      const validateRes = await apiFetch("/api/v1/process-drivers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_id: selectedProcessId,
          payload
        })
      });

      const valData: ValidationResponse = await validateRes.json();
      setValidationResult(valData);

      if (!valData.is_valid) {
        setLoadingAction(false);
        return;
      }

      // 2. Run Rate resolution lookup
      const resolveRes = await apiFetch("/api/v1/process-drivers/resolve-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_id: selectedProcessId,
          payload,
          effective_date: effectiveDate
        })
      });

      if (resolveRes.ok) {
        const rateData: ResolutionResponse = await resolveRes.json();
        setRateResult(rateData);
      } else {
        const errDetails = await resolveRes.json();
        setErrorMsg(errDetails.detail || "Rate Card Resolution failed: No active rate satisfies parameters.");
      }

    } catch {
      setErrorMsg("An unexpected server communication fault occurred.");
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950 p-6 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-mono font-extrabold tracking-widest text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40 uppercase">
              Sprint 2B Engine
            </span>
          </div>
          <h2 className="text-base font-extrabold text-white uppercase mt-1">Process Driver Playground</h2>
          <p className="text-slate-400 text-[11px] font-medium leading-relaxed mt-0.5">
            Evaluate, test, and resolve master costing variables across multiple pricing categories and thickness ranges.
          </p>
        </div>
        <button 
          onClick={fetchProcesses}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] font-bold text-slate-300 rounded-lg transition-all"
        >
          Sync Registers
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Input Configuration Console */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>Driver Test Configurations</span>
          </h3>

          {loadingProcs ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-4 font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Gathering Master Registers...</span>
            </div>
          ) : processes.length === 0 ? (
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 stroke-1.5" />
              <p className="text-xs font-semibold text-slate-300">No active drivers configured.</p>
              <p className="text-[10px] text-slate-500 mt-1">Make sure you add processes and specify dynamic driver types in the Process Master first.</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Process Select */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Target process *</label>
                <select
                  value={selectedProcessId}
                  onChange={(e) => setSelectedProcessId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-xs text-white outline-none transition-all"
                >
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.driver_type}]
                    </option>
                  ))}
                </select>
                {activeProcess && (
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5 bg-slate-900/60 p-2.5 rounded border border-slate-800/80 font-mono">
                    Active Driver: <strong className="text-white">{activeProcess.driver_type}</strong>
                  </p>
                )}
              </div>

              {/* Physical Thickness Input */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">
                  Physical Thickness (mm)
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="e.g. 3.25"
                  value={thickness}
                  onChange={(e) => setThickness(e.target.value)}
                  disabled={activeProcess && (activeProcess.driver_type === "PER_STROKE" || activeProcess.driver_type === "PER_HOUR" || activeProcess.driver_type === "PER_SQ_METER")}
                  className={`w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all ${
                    activeProcess && (activeProcess.driver_type === "PER_STROKE" || activeProcess.driver_type === "PER_HOUR" || activeProcess.driver_type === "PER_SQ_METER") ? "opacity-35 cursor-not-allowed bg-slate-950" : ""
                  }`}
                />
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                  Applicable only for PER_METER (Laser Cutting) or PER_CUT (Shearing).
                </span>
              </div>

              {/* Dynamic Materials Sub-type */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">
                  Specification / Alloy Subtype
                </label>
                <input
                  type="text"
                  placeholder="e.g. MS, SS, EPOXY"
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                  disabled={activeProcess && (activeProcess.driver_type === "PER_CUT")}
                  className={`w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all uppercase ${
                    activeProcess && (activeProcess.driver_type === "PER_CUT") ? "opacity-35 cursor-not-allowed bg-slate-950" : ""
                  }`}
                />
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                  Bending forced to "BENDING", Welding to "WELDING". Shearing deactivates this.
                </span>
              </div>

              {/* Effective Date Selector */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Effective Date Profile</span>
                </label>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                />
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                  Simulate historical, current, or future rates lookup criteria.
                </span>
              </div>

              {/* Run Trigger */}
              <button
                onClick={runResolutionEngine}
                disabled={loadingAction}
                className="w-full bg-emerald-600 hover:bg-emerald-555 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {loadingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Logic Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Resolution Pipeline</span>
                  </>
                )}
              </button>

            </div>
          )}
        </div>

        {/* Dynamic Results Console */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Messages */}
          {errorMsg && (
            <div className="p-4 bg-red-950/40 border border-red-900 text-red-300 text-xs rounded-xl flex items-start gap-3 shadow">
              <XCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Billing Resolution Failed</strong>
                <span className="leading-relaxed text-[11px] block mt-0.5">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Validation Engine Results Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Driver Validation Engine Outputs</span>
              {validationResult && (
                <span className={`text-[10px] font-mono tracking-wider font-extrabold px-2 py-0.5 rounded border ${
                  validationResult.is_valid
                    ? "bg-emerald-950/35 text-emerald-400 border-emerald-900/40"
                    : "bg-red-950/35 text-red-400 border-red-900/40"
                }`}>
                  {validationResult.is_valid ? "VALID" : "INVALID_DRIVER_INPUT"}
                </span>
              )}
            </h3>

            {!validationResult ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <HelpCircle className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">Configure inputs on the left pane and run the validation pipeline.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Detected Driver Category</span>
                    <span className="text-white text-xs font-bold">{validationResult.driver_type || "N/A"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Resolved Sub-type</span>
                    <span className="text-emerald-400 text-xs font-bold">{validationResult.resolved_sub_type || "-"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Resolved Thickness</span>
                    <span className="text-white text-xs font-bold">
                      {validationResult.resolved_thickness !== undefined && validationResult.resolved_thickness !== null
                        ? `${validationResult.resolved_thickness} mm`
                        : "-"
                      }
                    </span>
                  </div>
                </div>

                {validationResult.is_valid ? (
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-emerald-300 text-[11px] leading-relaxed flex gap-2.5 items-start">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      All structural driver metadata constraints matched nicely. Input is approved for dynamic backend pricing lookup execution.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 border border-red-900/40 p-3 rounded-xl bg-red-950/15">
                    <span className="text-[9px] font-bold text-red-400 tracking-wider block uppercase mb-1">Identified validation failures</span>
                    {validationResult.errors.map((e, idx) => (
                      <div key={idx} className="flex gap-2 text-[11px] text-red-300 items-start">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span><strong>Field [{e.field}]:</strong> {e.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rate Lookup Engine Results Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Rate Lookup & Pricing Outcomes</span>
              {rateResult && (
                <span className="text-[10px] font-mono tracking-wider font-extrabold px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-900/40 text-emerald-400">
                  RATE_RESOLVED
                </span>
              )}
            </h3>

            {!rateResult ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <FileText className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">No active pricing resolved. Validation must succeed and an active rate card must exist.</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Major Big Rate display */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center relative overflow-hidden">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-widest block mb-2">PRECISION RECONCILED RATE</span>
                  <div className="text-4xl font-extrabold text-white font-mono tracking-tight flex items-center justify-center gap-1.5">
                    <span className="text-lg text-emerald-400 font-bold font-sans">₹</span>
                    <span>{Number(rateResult.rate).toFixed(4)}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold font-mono uppercase bg-slate-950 border border-slate-850 px-2 py-0.5 rounded block mt-2.5 w-max mx-auto">
                    {rateResult.rate_unit}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[9px] uppercase font-bold text-slate-550 block mb-1">Matched Rate Card UUID</span>
                    <span className="text-slate-350 text-[10px] break-all select-all font-mono">{rateResult.rate_card_id}</span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[9px] uppercase font-bold text-slate-550 block mb-1">Effective Release Date</span>
                    <span className="text-slate-300 text-xs font-bold leading-none">{rateResult.effective_date}</span>
                  </div>
                </div>

                {rateResult.message && (
                  <p className="text-[10px] text-slate-500 font-mono italic">
                    Engine Log: {rateResult.message}
                  </p>
                )}

              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
