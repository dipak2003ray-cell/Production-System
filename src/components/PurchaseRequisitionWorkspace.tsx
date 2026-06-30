import React, { useState, useEffect } from "react";
import { 
  FileText, 
  PlusCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  ArrowLeft, 
  Calendar, 
  User, 
  Layers, 
  DollarSign, 
  Trash2, 
  Info,
  Check,
  Ban,
  ArrowRight
} from "lucide-react";

interface PurchaseRequisitionWorkspaceProps {
  authState: {
    isAuthenticated: boolean;
    token: string | null;
    user: {
      id: string;
      email: string;
      role: string;
      full_name: string;
    } | null;
  };
  apiFetch: (path: string, options?: any) => Promise<any>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const PurchaseRequisitionWorkspace: React.FC<PurchaseRequisitionWorkspaceProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  // State variables
  const [prs, setPrs] = useState<any[]>([]);
  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"list" | "generate" | "manual">("list");
  
  // Lists for generation / manual creations
  const [approvedEstimates, setApprovedEstimates] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Generation state
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");
  const [selectedEstimateDetails, setSelectedEstimateDetails] = useState<any | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(false);
  const [duplicatePrWarning, setDuplicatePrWarning] = useState<string | null>(null);

  // Manual Form state
  const [department, setDepartment] = useState("Procurement Division");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [remarks, setRemarks] = useState("");
  const [formLines, setFormLines] = useState<any[]>([]);
  
  // Material search for manual line builder
  const [materialSearchText, setMaterialSearchText] = useState("");
  const [selectedFormMaterial, setSelectedFormMaterial] = useState<any | null>(null);
  const [lineQuantity, setLineQuantity] = useState<number>(1);
  const [lineRequiredDate, setLineRequiredDate] = useState<string>("");
  const [lineRemarks, setLineRemarks] = useState("");

  // Search/Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");

  // Loading States
  const [loading, setLoading] = useState(false);

  // Initial loads
  useEffect(() => {
    fetchPRs();
    fetchApprovedEstimates();
    fetchMaterials();
  }, []);

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/v1/purchase-requisitions");
      if (Array.isArray(data)) {
        setPrs(data);
      }
    } catch (e: any) {
      setErrorMsg("Failed to retrieve Purchase Requisitions: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedEstimates = async () => {
    try {
      const data = await apiFetch("/api/v1/estimates");
      if (Array.isArray(data)) {
        // filter only approved
        const approved = data.filter((e: any) => e.status === "APPROVED" && !e.is_deleted);
        setApprovedEstimates(approved);
      }
    } catch (e: any) {
      console.error("Failed to load approved estimates", e);
    }
  };

  const fetchMaterials = async () => {
    try {
      const data = await apiFetch("/api/v1/materials");
      if (Array.isArray(data)) {
        setMaterials(data.filter((m: any) => !m.is_deleted));
      }
    } catch (e: any) {
      console.error("Failed to load material master", e);
    }
  };

  const fetchPrDetails = async (id: string) => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/v1/purchase-requisitions/${id}`);
      if (data && data.id) {
        setSelectedPr(data);
      }
    } catch (e: any) {
      setErrorMsg("Failed to load details: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Check duplicate PR warning when selecting an estimate for generation
  useEffect(() => {
    if (selectedEstimateId) {
      const est = approvedEstimates.find(e => e.id === selectedEstimateId);
      if (est) {
        // Search if active PR already exists for this estimate in our prs state
        const matchingPr = prs.find(p => p.estimate_id === est.id && p.status !== "CANCELLED");
        if (matchingPr) {
          setDuplicatePrWarning(`An active Purchase Requisition '${matchingPr.pr_number}' already exists for this Estimate. Generating a new one will duplicate the request. Please tick 'Allow Duplicate Requisition Override' below if you explicitly intend to generate anyway.`);
        } else {
          setDuplicatePrWarning(null);
        }
        
        // Fetch Estimate BOM details to preview lines before generating
        loadEstimateBOMPreview(est);
      }
    } else {
      setSelectedEstimateDetails(null);
      setDuplicatePrWarning(null);
    }
  }, [selectedEstimateId, prs]);

  const loadEstimateBOMPreview = async (est: any) => {
    try {
      if (est.bom_header_id) {
        const bomTree = await apiFetch(`/api/v1/boms/${est.bom_header_id}/tree`);
        // filter material lines
        if (bomTree && Array.isArray(bomTree.lines)) {
          const mats = bomTree.lines.filter((l: any) => l.line_type === "MATERIAL" && !l.is_deleted);
          setSelectedEstimateDetails({
            estimate: est,
            materialLines: mats
          });
        }
      }
    } catch (e) {
      console.error("BOM preview error", e);
    }
  };

  // Generation action
  const handleGeneratePR = async () => {
    if (!selectedEstimateId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const payload = {
        allow_duplicate: allowDuplicate
      };

      const result = await apiFetch(`/api/v1/purchase-requisitions/from-estimate/${selectedEstimateId}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (result && result.id) {
        setSuccessMsg(`Successfully generated Purchase Requisition ${result.pr_number}`);
        // Reset states
        setSelectedEstimateId("");
        setAllowDuplicate(false);
        setActiveSubTab("list");
        fetchPRs();
        fetchPrDetails(result.id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate Purchase Requisition");
    } finally {
      setLoading(false);
    }
  };

  // Submit action
  const handleSubmitPr = async (id: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch(`/api/v1/purchase-requisitions/${id}/submit`, {
        method: "POST"
      });
      if (res && res.id) {
        setSuccessMsg(`PR ${res.pr_number} successfully submitted to review.`);
        fetchPRs();
        fetchPrDetails(id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to submit Purchase Requisition");
    } finally {
      setLoading(false);
    }
  };

  // Approve action
  const handleApprovePr = async (id: string) => {
    const notes = prompt("Enter approval remarks / comment (optional):") || "";
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch(`/api/v1/purchase-requisitions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes })
      });
      if (res && res.id) {
        setSuccessMsg(`PR ${res.pr_number} approved successfully.`);
        fetchPRs();
        fetchPrDetails(id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  // Cancel action
  const handleCancelPr = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this Purchase Requisition? This action is irreversible.")) return;
    const notes = prompt("Reason for cancellation:") || "";
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch(`/api/v1/purchase-requisitions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ notes })
      });
      if (res && res.id) {
        setSuccessMsg(`PR ${res.pr_number} cancelled.`);
        fetchPRs();
        fetchPrDetails(id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Cancellation failed");
    } finally {
      setLoading(false);
    }
  };

  // Manual line builder utilities
  const addFormLine = () => {
    if (!selectedFormMaterial) {
      alert("Please select a material from the dropdown first.");
      return;
    }
    if (lineQuantity <= 0) {
      alert("Required quantity must be greater than zero.");
      return;
    }

    const matchedMat = materials.find(m => m.id === selectedFormMaterial.id);
    if (!matchedMat) return;

    const rate = matchedMat.last_rate || 0;
    const amount = rate * lineQuantity;

    const newLine = {
      id: "formline-" + Date.now(),
      material_id: matchedMat.id,
      material_code: matchedMat.code,
      description: matchedMat.description,
      required_quantity: Number(lineQuantity),
      uom: matchedMat.std_unit,
      required_date: lineRequiredDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      estimated_unit_rate: rate,
      estimated_amount: amount,
      remarks: lineRemarks
    };

    setFormLines([...formLines, newLine]);
    
    // Clear line fields
    setSelectedFormMaterial(null);
    setLineQuantity(1);
    setLineRemarks("");
  };

  const removeFormLine = (id: string) => {
    setFormLines(formLines.filter(l => l.id !== id));
  };

  const handleCreateManualPR = async () => {
    if (formLines.length === 0) {
      alert("At least one material requisition line must be added to create the PR.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const payload = {
        department,
        project,
        priority,
        remarks,
        lines: formLines
      };

      const result = await apiFetch("/api/v1/purchase-requisitions", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (result && result.id) {
        setSuccessMsg(`Manual Purchase Requisition ${result.pr_number} created successfully.`);
        // Reset manual form state
        setProject("");
        setRemarks("");
        setFormLines([]);
        setActiveSubTab("list");
        fetchPRs();
        fetchPrDetails(result.id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to create manual Purchase Requisition");
    } finally {
      setLoading(false);
    }
  };

  // Filtered PRs list
  const filteredPrs = prs.filter(p => {
    const matchSearch = 
      p.pr_number.toLowerCase().includes(filterSearch.toLowerCase()) ||
      p.project.toLowerCase().includes(filterSearch.toLowerCase()) ||
      p.department.toLowerCase().includes(filterSearch.toLowerCase());
    
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    const matchPriority = filterPriority === "ALL" || p.priority === filterPriority;

    return matchSearch && matchStatus && matchPriority;
  });

  const getStatusBadge = (status: string) => {
    const base = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ";
    switch (status) {
      case "DRAFT":
        return base + "bg-slate-800 text-slate-300 border border-slate-700/50";
      case "SUBMITTED":
        return base + "bg-blue-900/40 text-blue-300 border border-blue-800/40";
      case "UNDER_REVIEW":
        return base + "bg-amber-900/40 text-amber-300 border border-amber-800/40 animate-pulse";
      case "APPROVED":
        return base + "bg-emerald-950 text-emerald-300 border border-emerald-800/60";
      case "CANCELLED":
        return base + "bg-rose-950 text-rose-300 border border-rose-800/60";
      default:
        return base + "bg-slate-700 text-slate-200";
    }
  };

  const getPriorityBadge = (prio: string) => {
    const base = "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ";
    switch (prio) {
      case "LOW":
        return base + "bg-slate-900 text-slate-400";
      case "MEDIUM":
        return base + "bg-slate-900 text-blue-400";
      case "HIGH":
        return base + "bg-slate-900 text-amber-500";
      case "URGENT":
        return base + "bg-rose-950 text-rose-400 border border-rose-900";
      default:
        return base + "bg-slate-900 text-slate-400";
    }
  };

  // Determine if the current active user role is authorized to approve this PR
  const isAuthorizedToApprove = selectedPr && authState.user && 
    selectedPr.status === "UNDER_REVIEW" && 
    authState.user.role === selectedPr.current_approver_role;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans" id="pr-workspace-container">
      
      {/* MODULE HEADER */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-900 bg-slate-950">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-950/50 text-emerald-400 rounded border border-emerald-800/40">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-white font-sans">
              Purchase Requisition Foundation
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sprint 4A Execution Layer — Generation and governance of procurement requisitions directly from engineering BOM estimates.
          </p>
        </div>

        {/* TOP BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveSubTab("list");
              setSelectedPr(null);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "list" && !selectedPr
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/25"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            All Requisitions ({prs.length})
          </button>
          
          <button
            onClick={() => {
              setActiveSubTab("generate");
              setSelectedPr(null);
              setSelectedEstimateId("");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === "generate"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/25"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Generate from Estimate
          </button>

          <button
            onClick={() => {
              setActiveSubTab("manual");
              setSelectedPr(null);
              setFormLines([]);
              setProject("");
              setRemarks("");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === "manual"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/25"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Draft Manual PR
          </button>
        </div>
      </div>

      {/* DETAILED VIEW WINDOW OR SUBTAB SPACE */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-950/40">
        
        {loading && (
          <div className="flex items-center justify-center p-12">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-xs text-slate-400 font-mono">Syncing transaction state...</span>
          </div>
        )}

        {/* PR DETAILED VIEW OVERLAY */}
        {selectedPr ? (
          <div className="max-w-6xl mx-auto bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 shadow-2xl backdrop-blur-sm" id="pr-detail-window">
            
            {/* BACK BUTTON */}
            <button 
              onClick={() => {
                setSelectedPr(null);
                fetchPRs();
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Procurement Register</span>
            </button>

            {/* PR DETAIL HEADER CARD */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-5 rounded-lg bg-slate-950 border border-slate-800 mb-6">
              <div className="md:col-span-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono font-bold text-white bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                    {selectedPr.pr_number}
                  </span>
                  {getStatusBadge(selectedPr.status)}
                </div>
                <h2 className="text-sm font-bold text-slate-300 mt-4 font-sans">
                  Project: <span className="text-white text-base font-extrabold">{selectedPr.project}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Department: <span className="font-semibold text-slate-200">{selectedPr.department}</span>
                </p>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Metadata</div>
                <div className="space-y-1 mt-2 text-xs">
                  <div className="text-slate-400">Date: <span className="font-semibold text-slate-200">{selectedPr.pr_date}</span></div>
                  <div className="text-slate-400">Requested By: <span className="font-semibold text-slate-200">{selectedPr.requested_by}</span></div>
                  <div className="text-slate-400 flex items-center gap-1.5 mt-1">
                    Priority: {getPriorityBadge(selectedPr.priority)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">Estimated Procurement Value</div>
                <div className="text-2xl font-extrabold text-white mt-2 font-mono">
                  Rs. {Number(selectedPr.lines?.reduce((acc: number, l: any) => acc + (l.estimated_amount || 0), 0) || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Total Requisition Lines: <span className="text-slate-200 font-bold font-mono">{selectedPr.lines?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* REMARKS BANNER */}
            {selectedPr.remarks && (
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 text-xs text-slate-300 flex gap-2 mb-6">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Origin / Requisitioner Remarks:</span>
                  {selectedPr.remarks}
                </div>
              </div>
            )}

            {/* MAIN PR WORKFLOW CONTROL PANEL */}
            <div className="p-5 bg-slate-950/40 rounded-lg border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Requisition Lifecycle & Approval Panel</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reuses the shared company Approval Matrix. Required sign-offs must be processed in exact sequential order.
                </p>
                
                {selectedPr.status === "UNDER_REVIEW" && (
                  <div className="mt-3 flex items-center gap-2 p-2 bg-amber-950/20 rounded border border-amber-900/30">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span className="text-xs text-amber-300 font-semibold">
                      Current Action Required by: <span className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-white text-[11px] font-bold">{selectedPr.current_approver_role}</span> (Level {selectedPr.current_approval_level})
                    </span>
                  </div>
                )}
              </div>

              {/* ACTION COMMAND BAR */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Submit Action */}
                {selectedPr.status === "DRAFT" && (
                  <button
                    onClick={() => handleSubmitPr(selectedPr.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Submit Requisition
                  </button>
                )}

                {/* Approve Action */}
                {selectedPr.status === "UNDER_REVIEW" && (
                  <div className="flex items-center gap-2">
                    {!isAuthorizedToApprove && (
                      <span className="text-[10px] text-slate-500 bg-slate-900 py-1.5 px-3 rounded-lg border border-slate-800 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-500" />
                        Role Restriction: {selectedPr.current_approver_role} Required
                      </span>
                    )}

                    <button
                      disabled={!isAuthorizedToApprove}
                      onClick={() => handleApprovePr(selectedPr.id)}
                      className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                        isAuthorizedToApprove
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/25"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/30"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve Level {selectedPr.current_approval_level}
                    </button>
                  </div>
                )}

                {/* Cancel Action */}
                {["DRAFT", "UNDER_REVIEW"].includes(selectedPr.status) && (
                  <button
                    onClick={() => handleCancelPr(selectedPr.id)}
                    className="px-4 py-2 bg-rose-950/65 hover:bg-rose-900 text-rose-300 text-xs font-extrabold rounded-lg border border-rose-900/40 transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel Requisition
                  </button>
                )}

                {selectedPr.status === "APPROVED" && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/50 rounded-lg text-emerald-400 border border-emerald-900 text-xs font-bold font-mono uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    Fully Approved & Released
                  </div>
                )}

                {selectedPr.status === "CANCELLED" && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/50 rounded-lg text-rose-400 border border-rose-900 text-xs font-bold font-mono uppercase tracking-wider">
                    <XCircle className="w-4 h-4" />
                    Cancelled Requisition
                  </div>
                )}
              </div>
            </div>

            {/* LINE ITEM GRID */}
            <div className="mb-8">
              <h3 className="text-xs uppercase font-extrabold text-slate-400 mb-3 tracking-widest">Requisitioned Line Items</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-900/85 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono tracking-widest">
                    <tr>
                      <th className="px-5 py-3">Material Code</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3 text-right">Required Qty</th>
                      <th className="px-5 py-3">UOM</th>
                      <th className="px-5 py-3">Required Date</th>
                      <th className="px-5 py-3 text-right">Est. Unit Rate</th>
                      <th className="px-5 py-3 text-right">Est. Amount</th>
                      <th className="px-5 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {selectedPr.lines && selectedPr.lines.length > 0 ? (
                      selectedPr.lines.map((line: any) => (
                        <tr key={line.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-bold text-white">{line.material_code}</td>
                          <td className="px-5 py-3.5 text-slate-300">{line.description}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-slate-100">{line.required_quantity}</td>
                          <td className="px-5 py-3.5 text-slate-400 font-mono text-center">{line.uom}</td>
                          <td className="px-5 py-3.5 text-slate-300 font-mono">{line.required_date}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-slate-300">Rs. {Number(line.estimated_unit_rate).toFixed(2)}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-emerald-400 font-bold">Rs. {Number(line.estimated_amount).toFixed(2)}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-slate-900 border border-slate-800 text-slate-400">
                              {line.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-500 font-mono">No line items requisitions present.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUDIT LOGS & TIMELINE HISTORIES */}
            <div>
              <h3 className="text-xs uppercase font-extrabold text-slate-400 mb-3 tracking-widest">Workflow Timeline & Certification Trails</h3>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-5">
                {selectedPr.history && selectedPr.history.length > 0 ? (
                  <div className="relative border-l-2 border-slate-800 ml-3 pl-6 space-y-6">
                    {selectedPr.history.map((h: any, idx: number) => (
                      <div key={h.id} className="relative">
                        {/* Dot marker */}
                        <span className="absolute -left-9 top-1 w-3.5 h-3.5 rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        </span>
                        
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="text-white font-bold">{h.user_name}</span>
                          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-mono uppercase">{h.user_role}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        
                        <div className="text-xs font-semibold text-slate-200 mt-1">
                          Action: <span className="text-white font-mono bg-slate-900 py-0.5 px-1 rounded uppercase tracking-wider">{h.action}</span>
                          <span className="text-slate-500 mx-2">|</span>
                          Transition: <span className="text-slate-400">{h.previous_status}</span> &rarr; <span className="text-emerald-400 font-bold">{h.new_status}</span>
                        </div>

                        {h.comments && (
                          <div className="mt-1.5 text-xs text-slate-400 bg-slate-900/30 p-2.5 rounded border border-slate-900/60 font-mono">
                            &ldquo;{h.comments}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 font-mono py-4 text-xs">No verification actions catalogued.</div>
                )}
              </div>
            </div>

          </div>
        ) : (
          
          /* ACTIVE VIEWS / SUBTABS */
          <div className="max-w-7xl mx-auto">
            
            {/* OVERVIEW TABLE LIST VIEW */}
            {activeSubTab === "list" && (
              <div className="space-y-6" id="all-prs-register">
                
                {/* SEARCH AND FILTERS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 shadow-lg">
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search PR #, Project, or Department..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="UNDER_REVIEW">UNDER REVIEW</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>

                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                {/* PR LIST REGISTER TABLE */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-900/30">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono tracking-widest">
                      <tr>
                        <th className="px-5 py-4">PR Number</th>
                        <th className="px-5 py-4">Date</th>
                        <th className="px-5 py-4">Department</th>
                        <th className="px-5 py-4">Project</th>
                        <th className="px-5 py-4 text-center">Priority</th>
                        <th className="px-5 py-4 text-center">Status</th>
                        <th className="px-5 py-4 text-right">Items Count</th>
                        <th className="px-5 py-4 text-right">Procurement Value</th>
                        <th className="px-5 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {filteredPrs.length > 0 ? (
                        filteredPrs.map((pr) => (
                          <tr 
                            key={pr.id} 
                            onClick={() => fetchPrDetails(pr.id)}
                            className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-4 font-mono font-bold text-white">{pr.pr_number}</td>
                            <td className="px-5 py-4 text-slate-400 font-mono">{pr.pr_date}</td>
                            <td className="px-5 py-4 text-slate-300 font-semibold">{pr.department}</td>
                            <td className="px-5 py-4 text-white font-medium">{pr.project}</td>
                            <td className="px-5 py-4 text-center">{getPriorityBadge(pr.priority)}</td>
                            <td className="px-5 py-4 text-center">{getStatusBadge(pr.status)}</td>
                            <td className="px-5 py-4 text-right font-mono text-slate-400">{pr.total_materials || 0}</td>
                            <td className="px-5 py-4 text-right font-mono text-emerald-400 font-bold">
                              Rs. {Number(pr.estimated_procurement_value || 0).toLocaleString()}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchPrDetails(pr.id);
                                }}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-white font-bold rounded border border-slate-800 transition-colors"
                              >
                                View / Audit
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-5 py-12 text-center text-slate-500 font-mono">
                            No Purchase Requisitions found matching the chosen search and filter parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* GENERATE PR INTERFACE SUBTAB */}
            {activeSubTab === "generate" && (
              <div className="max-w-4xl mx-auto bg-slate-900/60 rounded-xl border border-slate-800 p-6 shadow-xl" id="generate-pr-window">
                <h2 className="text-base font-extrabold text-white mb-1">Generate Purchase Requisition from Approved Estimate</h2>
                <p className="text-xs text-slate-400 mb-6">Select a frozen and approved estimate below. The system will pull released material lines, consolidate quantities, resolve rates and generate a PR.</p>

                <div className="space-y-6">
                  {/* Select approved estimate */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Approved Estimate Reference</label>
                    <select
                      value={selectedEstimateId}
                      onChange={(e) => setSelectedEstimateId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="">-- Choose Approved Estimate --</option>
                      {approvedEstimates.map(est => (
                        <option key={est.id} value={est.id}>
                          {est.estimate_number} - {est.description} (Rev {est.revision_number})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DUPLICATE WARNING BOX */}
                  {duplicatePrWarning && (
                    <div className="p-4 bg-amber-950/20 rounded-lg border border-amber-900/30 text-xs text-amber-300 flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white block">Active Request Registered</span>
                        {duplicatePrWarning}
                      </div>
                    </div>
                  )}

                  {/* PREVIEW OF ELIGIBLE MATERIAL LINES */}
                  {selectedEstimateDetails && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-widest">BOM Material Lines Preview ({selectedEstimateDetails.materialLines?.length || 0})</h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                        <table className="w-full text-xs text-left text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[9px] uppercase font-mono tracking-wider">
                            <tr>
                              <th className="px-4 py-2.5">Material Code</th>
                              <th className="px-4 py-2.5">Description</th>
                              <th className="px-4 py-2.5 text-right">BOM Quantity</th>
                              <th className="px-4 py-2.5">UOM</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 font-mono">
                            {selectedEstimateDetails.materialLines?.map((l: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-900/20">
                                <td className="px-4 py-2.5 text-white font-bold">{l.material_code || "N/A"}</td>
                                <td className="px-4 py-2.5 text-slate-300">{l.description}</td>
                                <td className="px-4 py-2.5 text-right text-slate-100">{l.quantity}</td>
                                <td className="px-4 py-2.5 text-slate-400">{l.uom}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Overriding option for duplicates */}
                  {duplicatePrWarning && (
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="override_duplicate"
                        checked={allowDuplicate}
                        onChange={(e) => setAllowDuplicate(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 bg-slate-950 border-slate-800 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="override_duplicate" className="text-xs text-slate-300 select-none">
                        Allow Duplicate Requisition Override (I confirm I want to generate another active PR for this estimate)
                      </label>
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      disabled={!selectedEstimateId || (duplicatePrWarning && !allowDuplicate)}
                      onClick={handleGeneratePR}
                      className={`px-5 py-2.5 text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition-all ${
                        selectedEstimateId && (!duplicatePrWarning || allowDuplicate)
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/25"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                      }`}
                    >
                      <span>Generate Purchase Requisition</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* MANUAL DRAFT FORM SUBTAB */}
            {activeSubTab === "manual" && (
              <div className="max-w-5xl mx-auto bg-slate-900/60 rounded-xl border border-slate-800 p-6 shadow-xl" id="manual-pr-form">
                <h2 className="text-base font-extrabold text-white mb-1">Create Manual Purchase Requisition Draft</h2>
                <p className="text-xs text-slate-400 mb-6">Manually configure department, project reference, priority, and select materials from the verified Material Master register.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Dept */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Procurement Division"
                    />
                  </div>
                  
                  {/* Project Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Reference</label>
                    <input
                      type="text"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Rig Structural Assembly Steel"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Priority</label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                {/* REMARKS */}
                <div className="mb-8">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks / Special Instructions</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-emerald-500"
                    placeholder="Enter context, shipping instructions or comments..."
                  />
                </div>

                {/* LINE ITEM BUILDER PANEL */}
                <div className="p-5 bg-slate-950 rounded-lg border border-slate-800 mb-8">
                  <h3 className="text-xs uppercase font-extrabold text-slate-400 mb-4 tracking-widest">Material Line Items Builder</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                    {/* Material Master Select */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Material Master Lookup</label>
                      <select
                        value={selectedFormMaterial ? selectedFormMaterial.id : ""}
                        onChange={(e) => {
                          const mat = materials.find(m => m.id === e.target.value);
                          setSelectedFormMaterial(mat || null);
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none"
                      >
                        <option value="">-- Choose Material --</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            [{m.code}] {m.description} ({m.std_unit}) - Rs. {m.last_rate}/unit {m.is_active === false ? "(INACTIVE)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity Required</label>
                      <input
                        type="number"
                        min={1}
                        value={lineQuantity}
                        onChange={(e) => setLineQuantity(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none font-mono"
                      />
                    </div>

                    {/* Add Line button */}
                    <button
                      type="button"
                      onClick={addFormLine}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors"
                    >
                      Add Line Item
                    </button>
                  </div>

                  {/* Temporary line register */}
                  <div className="overflow-x-auto rounded border border-slate-800 mt-5">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 text-[9px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2">Material Code</th>
                          <th className="px-4 py-2">Description</th>
                          <th className="px-4 py-2 text-right">Quantity</th>
                          <th className="px-4 py-2">UOM</th>
                          <th className="px-4 py-2 text-right">Unit Rate</th>
                          <th className="px-4 py-2 text-right">Estimated Amount</th>
                          <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 font-mono text-[11px]">
                        {formLines.length > 0 ? (
                          formLines.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-900/30">
                              <td className="px-4 py-2 text-white font-bold">{l.material_code}</td>
                              <td className="px-4 py-2 text-slate-300">{l.description}</td>
                              <td className="px-4 py-2 text-right text-slate-100">{l.required_quantity}</td>
                              <td className="px-4 py-2 text-slate-400">{l.uom}</td>
                              <td className="px-4 py-2 text-right text-slate-300">Rs. {Number(l.estimated_unit_rate).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-emerald-400 font-bold">Rs. {Number(l.estimated_amount).toFixed(2)}</td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeFormLine(l.id)}
                                  className="text-rose-500 hover:text-rose-400 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No items added to requisition line yet. Use the builders above.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* CREATION SUBMIT ACTIONS */}
                <div className="pt-5 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-mono">
                    Total Procurement Draft Value: <span className="text-emerald-400 font-bold">Rs. {formLines.reduce((acc, l) => acc + (l.estimated_amount || 0), 0).toLocaleString()}</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setActiveSubTab("list");
                        setFormLines([]);
                      }}
                      className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Cancel Draft
                    </button>
                    
                    <button
                      disabled={formLines.length === 0}
                      onClick={handleCreateManualPR}
                      className={`px-5 py-2.5 text-xs font-extrabold rounded-lg transition-all ${
                        formLines.length > 0
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/25"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                      }`}
                    >
                      Save & Draft Requisition
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
