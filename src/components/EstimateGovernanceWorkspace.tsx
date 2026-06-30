import React, { useState, useEffect } from "react";
import { 
  FileText, 
  ShieldCheck, 
  History, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  RefreshCw, 
  Layers, 
  FileSpreadsheet, 
  GitCommit, 
  ArrowRight, 
  User, 
  Calendar,
  ChevronRight,
  ClipboardList,
  Activity,
  Settings,
  XCircle,
  HelpCircle,
  Plus,
  MessageSquare,
  Clock,
  Shield,
  Tag,
  Bell,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Estimate {
  id: string;
  estimate_number: string;
  description: string;
  status: "DRAFT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "LOCKED" | "SUPERSEDED" | "REJECTED";
  revision_number: number;
  parent_estimate_id: string | null;
  previous_revision_id: string | null;
  is_current_active: boolean;
  revision_notes: string | null;
  revision_timestamp: string | null;
  cost_sheet_id: string | null;
  bom_header_id: string | null;
  customer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_approval_level?: number | null;
  current_approver_role?: string | null;
  pending_approval?: boolean;
}

interface WorkflowHistory {
  id: string;
  estimate_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  notes: string | null;
  timestamp: string;
}

interface WorkflowDetails {
  estimate_id: string;
  estimate_number: string;
  current_status: string;
  available_next_actions: string[];
  allowed_transitions: string[];
  timeline: WorkflowHistory[];
}

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const EstimateGovernanceWorkspace: React.FC<Props> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedEst, setSelectedEst] = useState<Estimate | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDetails | null>(null);
  const [revisions, setRevisions] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Sprint 3B - Multi-Level Approval states
  const [approvalProgress, setApprovalProgress] = useState<any | null>(null);
  const [approvalMatrix, setApprovalMatrix] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "matrix">("details");
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixForm, setMatrixForm] = useState({
    id: "",
    approval_level: "",
    role: "",
    sequence_order: "",
    is_active: true
  });

  // Sprint 3C - Approval History, Collaboration, Notifications & Audit states
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "history" | "timeline" | "comments" | "audit">("summary");
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentType, setNewCommentType] = useState("GENERAL");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading3C, setLoading3C] = useState(false);

  // Lists of BOMs and Cost Sheets to attach
  const [boms, setBoms] = useState<any[]>([]);
  const [costSheets, setCostSheets] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Create form state
  const [form, setForm] = useState({
    description: "",
    bom_header_id: "",
    cost_sheet_id: "",
    customer_id: "",
    revision_notes: ""
  });

  const loadReferences = async () => {
    try {
      const [bomRes, csRes, custRes] = await Promise.all([
        apiFetch("/api/v1/boms"),
        apiFetch("/api/v1/cost-sheets"),
        apiFetch("/api/v1/customers")
      ]);
      if (bomRes.ok) setBoms(await bomRes.json());
      if (csRes.ok) setCostSheets(await csRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch (err) {
      console.error("Failed to load reference listings", err);
    }
  };

  const loadApprovalMatrix = async () => {
    try {
      const res = await apiFetch("/api/v1/approval-matrix");
      if (res.ok) {
        setApprovalMatrix(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch approval matrix", err);
    }
  };

  const loadEstimates = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/v1/estimates");
      if (res.ok) {
        const data = await res.json();
        setEstimates(data);
        // Reselect if we have one
        if (selectedEst) {
          const fresh = data.find((e: any) => e.id === selectedEst.id);
          if (fresh) {
            setSelectedEst(fresh);
          }
        }
      } else {
        setErrorMsg("Failed to pull estimate database records.");
      }
    } catch {
      setErrorMsg("Network error connecting to estimate governance API.");
    } finally {
      setLoading(false);
    }
  };

  const loadSprint3CDetails = async (estId: string) => {
    setLoading3C(true);
    try {
      const [histRes, tlRes, commRes, auditRes] = await Promise.all([
        apiFetch(`/api/v1/estimates/${estId}/approval-history`),
        apiFetch(`/api/v1/estimates/${estId}/timeline`),
        apiFetch(`/api/v1/estimates/${estId}/comments`),
        apiFetch(`/api/v1/audit/${estId}`)
      ]);
      if (histRes.ok) setApprovalHistory(await histRes.json());
      if (tlRes.ok) setTimelineEvents(await tlRes.json());
      if (commRes.ok) setComments(await commRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (err) {
      console.error("Failed to fetch Sprint 3C details", err);
    } finally {
      setLoading3C(false);
    }
  };

  const loadWorkflowDetails = async (estId: string) => {
    try {
      const [wfRes, revRes, progressRes] = await Promise.all([
        apiFetch(`/api/v1/estimates/${estId}/workflow`),
        apiFetch(`/api/v1/estimates/${estId}/revisions`),
        apiFetch(`/api/v1/estimates/${estId}/approval-progress`)
      ]);
      if (wfRes.ok) setWorkflow(await wfRes.json());
      if (revRes.ok) setRevisions(await revRes.json());
      if (progressRes.ok) setApprovalProgress(await progressRes.json());
    } catch (err) {
      console.error("Failed to fetch workflow history", err);
    }
  };

  useEffect(() => {
    loadEstimates();
    loadReferences();
    loadApprovalMatrix();
  }, []);

  useEffect(() => {
    if (selectedEst) {
      loadWorkflowDetails(selectedEst.id);
      loadSprint3CDetails(selectedEst.id);
      setActiveSubTab("summary"); // reset sub tab
    } else {
      setWorkflow(null);
      setRevisions([]);
      setApprovalProgress(null);
      setApprovalHistory([]);
      setTimelineEvents([]);
      setComments([]);
      setAuditLogs([]);
    }
  }, [selectedEst]);

  const handleSelect = (est: Estimate) => {
    setSelectedEst(est);
    setActionNotes("");
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEst || !newCommentText.trim()) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/estimates/${selectedEst.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newCommentText,
          comment_type: newCommentType
        })
      });

      if (res.ok) {
        setNewCommentText("");
        setSuccessMsg("Comment added successfully.");
        const freshComment = await res.json();
        setComments(prev => [...prev, freshComment]);
        
        // Reload timeline and audit log triggered by comment
        const tlRes = await apiFetch(`/api/v1/estimates/${selectedEst.id}/timeline`);
        if (tlRes.ok) setTimelineEvents(await tlRes.json());
        const auditRes = await apiFetch(`/api/v1/audit/${selectedEst.id}`);
        if (auditRes.ok) setAuditLogs(await auditRes.json());
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to post comment.");
      }
    } catch {
      setErrorMsg("Network error posting comment.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!form.description) {
      setErrorMsg("Description is mandatory to define a governance estimate.");
      return;
    }

    try {
      const res = await apiFetch("/api/v1/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const created = await res.json();
        setSuccessMsg(`Successfully created new estimate ${created.estimate_number}`);
        setShowCreateModal(false);
        setForm({ description: "", bom_header_id: "", cost_sheet_id: "", customer_id: "", revision_notes: "" });
        await loadEstimates();
        setSelectedEst(created);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to create new estimate governance node.");
      }
    } catch {
      setErrorMsg("Network issue encountered while posting estimate.");
    }
  };

  const handleWorkflowAction = async (action: "submit" | "approve" | "reject" | "request-changes" | "lock" | "new-revision") => {
    if (!selectedEst) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/estimates/${selectedEst.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: actionNotes || undefined })
      });

      if (res.ok) {
        const updated = await res.json();
        setSuccessMsg(`Successfully completed workflow operation: ${action.toUpperCase()}`);
        setActionNotes("");
        await loadEstimates();
        setSelectedEst(updated);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || `Failed to transition status via action: ${action}`);
      }
    } catch {
      setErrorMsg("Failed to communicate action with the server.");
    }
  };

  const getStatusBadge = (status: Estimate["status"]) => {
    const config: Record<Estimate["status"], { bg: string, text: string, icon: any }> = {
      DRAFT: { bg: "bg-blue-500/10 border border-blue-500/20", text: "text-blue-400", icon: ClipboardList },
      UNDER_REVIEW: { bg: "bg-amber-500/10 border border-amber-500/20", text: "text-amber-400", icon: RefreshCw },
      CHANGES_REQUESTED: { bg: "bg-red-500/10 border border-red-500/20", text: "text-red-400", icon: AlertCircle },
      APPROVED: { bg: "bg-emerald-500/10 border border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle },
      LOCKED: { bg: "bg-slate-500/15 border border-slate-500/20", text: "text-slate-300", icon: Lock },
      SUPERSEDED: { bg: "bg-purple-500/10 border border-purple-500/20", text: "text-purple-400", icon: GitCommit },
      REJECTED: { bg: "bg-rose-500/10 border border-rose-500/20", text: "text-rose-400", icon: XCircle }
    };

    const target = config[status] || { bg: "bg-slate-800", text: "text-slate-400", icon: ClipboardList };
    const IconComponent = target.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${target.bg} ${target.text}`}>
        <IconComponent className="w-3 h-3" />
        {status.replace("_", " ")}
      </span>
    );
  };

  const getBOMName = (id: string | null) => {
    if (!id) return "None attached";
    const match = boms.find(b => b.id === id);
    return match ? `${match.part_number} (Rev ${match.revision_number})` : id;
  };

  const getCostSheetName = (id: string | null) => {
    if (!id) return "None attached";
    const match = costSheets.find(c => c.id === id);
    return match ? `${match.cost_sheet_number || "CS"} (${match.status})` : id;
  };

  const getCustomerName = (id: string | null) => {
    if (!id) return "None";
    const match = customers.find(c => c.id === id);
    return match ? match.name : id;
  };

  const handleMatrixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const body = {
      approval_level: Number(matrixForm.approval_level),
      role: matrixForm.role,
      sequence_order: Number(matrixForm.sequence_order),
      is_active: matrixForm.is_active
    };

    try {
      let res;
      if (matrixForm.id) {
        // Edit mode
        res = await apiFetch(`/api/v1/approval-matrix/${matrixForm.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else {
        // Add mode
        res = await apiFetch("/api/v1/approval-matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      if (res.ok) {
        setSuccessMsg(matrixForm.id ? "Approval matrix level updated." : "New approval level added successfully.");
        setShowMatrixModal(false);
        await loadApprovalMatrix();
        if (selectedEst) {
          await loadWorkflowDetails(selectedEst.id);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to save approval matrix level.");
      }
    } catch {
      setErrorMsg("Network error saving matrix configuration.");
    }
  };

  return (
    <div className="space-y-6 text-white font-sans" id="estimate-governance-root">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 text-emerald-400 mb-1">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-widest uppercase font-mono">Sprint 3A Governance</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Estimate Lifecycle & Revision Console</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Authorize and log workflow state machine transitions, freeze/lock final estimations, and spawn new revision lines.
          </p>
        </div>

        {["L2-Admin", "L1-Estimator"].includes(authState.user?.role) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 px-4 py-2 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all shadow-lg shadow-emerald-950/20 cursor-pointer"
            id="btn-create-estimate-workspace"
          >
            <PlusCircle className="w-4 h-4" />
            Initialize Estimate
          </button>
        )}
      </div>

      {/* WORKSPACE BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ESTIMATES LIST (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-slate-950/60 border border-slate-800/60 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-850 bg-slate-950/80 flex items-center justify-between">
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono">Estimate Register</h3>
            <button 
              onClick={loadEstimates} 
              className="text-slate-500 hover:text-emerald-400 transition-colors p-1 rounded-md"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-slate-900/50 max-h-[600px] overflow-y-auto">
            {estimates.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-mono uppercase">No estimates initiated</p>
              </div>
            ) : (
              estimates.map(est => {
                const isSelected = selectedEst?.id === est.id;
                return (
                  <button
                    key={est.id}
                    onClick={() => handleSelect(est)}
                    className={`w-full text-left p-4 transition-all duration-150 flex items-start justify-between gap-3 ${
                      isSelected 
                        ? "bg-slate-800/40 border-l-2 border-emerald-400" 
                        : "hover:bg-slate-900/30 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold font-mono text-white tracking-wide">{est.estimate_number}</span>
                        {est.is_current_active && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-bold tracking-widest uppercase scale-90 font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs line-clamp-1">{est.description}</p>
                      {est.status === "UNDER_REVIEW" && est.current_approver_role && (
                        <div className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/15 px-2 py-0.5 rounded inline-flex items-center gap-1 font-mono mt-1">
                          <Activity className="w-3 h-3 animate-pulse text-amber-400" />
                          Lvl {est.current_approval_level}: Pending {est.current_approver_role}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-1">
                        <span>Rev {est.revision_number}</span>
                        <span>•</span>
                        <span>{est.created_by.split("@")[0]}</span>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(est.status)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL & TIMELINE PANE (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEst ? (
            <div className="space-y-4">
              {/* Tab navigation */}
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-4 py-2.5 text-xs font-extrabold font-mono tracking-wider uppercase transition-all rounded-t-lg border-b-2 cursor-pointer ${
                    activeTab === "details"
                      ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Details & Decision Hub
                </button>
                <button
                  onClick={() => setActiveTab("matrix")}
                  className={`px-4 py-2.5 text-xs font-extrabold font-mono tracking-wider uppercase transition-all rounded-t-lg border-b-2 cursor-pointer ${
                    activeTab === "matrix"
                      ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Governance Matrix Config ({approvalMatrix.length})
                </button>
              </div>

              {activeTab === "details" ? (
                <div className="bg-slate-950/30 border border-slate-800/50 rounded-xl p-6 space-y-6 shadow-xl">
                  {/* DETAILS CARD HEADER */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-850 pb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h2 className="text-xl font-bold tracking-tight text-white font-mono">{selectedEst.estimate_number}</h2>
                        {getStatusBadge(selectedEst.status)}
                      </div>
                      <p className="text-xs text-slate-400 font-sans">{selectedEst.description}</p>
                    </div>

                    <div className="text-left sm:text-right font-mono text-[10px] text-slate-500 space-y-0.5">
                      <div>Revision: <span className="text-slate-300 font-bold">{selectedEst.revision_number}</span></div>
                      <div>Created: <span className="text-slate-300">{new Date(selectedEst.created_at).toLocaleString()}</span></div>
                      <div>Owner: <span className="text-emerald-400">{selectedEst.created_by}</span></div>
                    </div>
                  </div>

                  {/* SPRINT 3B: PIPELINE PROGRESS */}
                  {selectedEst.status === "UNDER_REVIEW" && approvalProgress && (
                    <div className="bg-slate-900/35 border border-slate-800/60 rounded-lg p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-extrabold tracking-wider uppercase text-amber-400 font-mono flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                            Active Multi-Level Approval Pipeline
                          </h4>
                          <div className="text-xs font-bold text-slate-200 font-mono">
                            Pending on level: <span className="text-amber-300">{selectedEst.current_approval_level}</span> ({selectedEst.current_approver_role})
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-400">Progress: <span className="text-white text-sm font-bold">{approvalProgress.overall_progress_percent}%</span></span>
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${approvalProgress.overall_progress_percent}%` }}
                        />
                      </div>

                      {/* Levels grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {approvalMatrix.map((lvl) => {
                          const isCompleted = (approvalProgress.completed_levels || []).some((cl: any) => cl.approval_level === lvl.approval_level);
                          const isCurrent = selectedEst.current_approval_level === lvl.approval_level;

                          let borderStyle = "border-slate-900 bg-slate-950/20 text-slate-500";
                          let badgeText = "Upcoming";

                          if (isCompleted) {
                            borderStyle = "border-emerald-500/15 bg-emerald-500/5 text-emerald-400/90";
                            badgeText = "Approved";
                          } else if (isCurrent) {
                            borderStyle = "border-amber-500/30 bg-amber-500/5 text-amber-300 ring-1 ring-amber-500/10";
                            badgeText = "Pending";
                          }

                          return (
                            <div key={lvl.id} className={`border p-2.5 rounded text-xs flex items-center justify-between gap-1.5 font-mono ${borderStyle}`}>
                              <div className="truncate">
                                <span className="block text-[8px] uppercase tracking-wider opacity-60">Level {lvl.approval_level}</span>
                                <span className="block font-bold truncate">{lvl.role}</span>
                              </div>
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-950/50">
                                {badgeText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PIPELINE FULLY COMPLETED / APPROVED STATE DISPLAY */}
                  {(selectedEst.status === "APPROVED" || selectedEst.status === "LOCKED") && approvalProgress && (
                    <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-mono text-xs font-bold text-emerald-400 block uppercase">Approval Process Finalized</span>
                          <span className="text-[11px] text-slate-400 block font-sans">
                            All {approvalMatrix.length} governance verification levels were cleared successfully. Record signed off by all authorizing roles.
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(approvalProgress.completed_levels || []).map((cl: any) => (
                          <span key={cl.approval_level} className="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono font-bold">
                            L{cl.approval_level}: {cl.approved_by_role} ({cl.signer}) APPROVED
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ATTACHED ENTITIES SUMMARY */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/40 border border-slate-800/40 p-3.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500 font-mono">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        Attached BOM Rev
                      </div>
                      <div className="text-xs font-bold text-slate-200 font-mono truncate">
                        {getBOMName(selectedEst.bom_header_id)}
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/40 p-3.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500 font-mono">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        Attached Cost Sheet
                      </div>
                      <div className="text-xs font-bold text-slate-200 font-mono truncate">
                        {getCostSheetName(selectedEst.cost_sheet_id)}
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/40 p-3.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500 font-mono">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        Corporate Client
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {getCustomerName(selectedEst.customer_id)}
                      </div>
                    </div>
                  </div>

                  {/* ESTIMATE LOCK WARNING IF FREEZED */}
                  {selectedEst.status === "LOCKED" && (
                    <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/30 p-4 rounded-lg text-xs text-red-300 font-sans">
                      <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-red-200 font-mono uppercase tracking-wider mb-0.5">MANDATORY LOCK COMPLIANCE</span>
                        This estimate record has been permanently frozen under the status <span className="font-bold underline">LOCKED</span>. Under the Sprint 3A governance rules, all associated BOM revisions and Cost Sheets cannot be edited, re-calculated, or re-allocated. Only spawning a new active revision increment is permitted.
                      </div>
                    </div>
                  )}

                  {/* ACTION CENTER / DECISION INTERFACE */}
                  <div className="bg-slate-900/25 border border-slate-800/40 p-5 rounded-lg space-y-4">
                    <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Workflow Transition Hub
                    </h4>

                    {/* ROLE AUTHORIZATION CHECKS & ALERTS */}
                    {selectedEst.status === "UNDER_REVIEW" && selectedEst.current_approver_role && (
                      <div className="p-3 rounded border text-xs font-mono">
                        {authState.user?.role === selectedEst.current_approver_role ? (
                          <div className="text-emerald-400 bg-emerald-500/5 border-emerald-500/15 p-1 rounded flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Action Authorized: Your active role <span className="underline font-bold">({authState.user.role})</span> matches required reviewer level.</span>
                          </div>
                        ) : (
                          <div className="text-amber-400 bg-amber-500/5 border-amber-500/15 p-1 rounded flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Read-Only: Awaiting sign-off by role <span className="underline font-bold">({selectedEst.current_approver_role})</span>. Your role is {authState.user?.role || "Visitor"}.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {workflow && workflow.available_next_actions.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2.5">
                          {workflow.available_next_actions.includes("SUBMIT") && (
                            <button
                              onClick={() => handleWorkflowAction("submit")}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded text-xs font-bold uppercase font-mono tracking-wider cursor-pointer"
                            >
                              Submit For Review
                            </button>
                          )}
                          {workflow.available_next_actions.includes("APPROVE") && (
                            <button
                              onClick={() => handleWorkflowAction("approve")}
                              disabled={selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role}
                              className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase font-mono tracking-wider cursor-pointer ${
                                selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40"
                                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                              }`}
                            >
                              Approve Level
                            </button>
                          )}
                          {workflow.available_next_actions.includes("REJECT") && (
                            <button
                              onClick={() => handleWorkflowAction("reject")}
                              disabled={selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role}
                              className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase font-mono tracking-wider cursor-pointer ${
                                selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40"
                                  : "bg-red-600 hover:bg-red-500 text-white"
                              }`}
                            >
                              Reject & Void
                            </button>
                          )}
                          {workflow.available_next_actions.includes("REQUEST_CHANGES") && (
                            <button
                              onClick={() => handleWorkflowAction("request-changes")}
                              disabled={selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role}
                              className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase font-mono tracking-wider cursor-pointer ${
                                selectedEst.status === "UNDER_REVIEW" && authState.user?.role !== selectedEst.current_approver_role
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40"
                                  : "bg-amber-600 hover:bg-amber-500 text-slate-950"
                              }`}
                            >
                              Request Changes
                            </button>
                          )}
                          {workflow.available_next_actions.includes("LOCK") && (
                            <button
                              onClick={() => handleWorkflowAction("lock")}
                              className="bg-slate-750 hover:bg-slate-700 border border-slate-700/60 text-white px-3.5 py-1.5 rounded text-xs font-bold uppercase font-mono tracking-wider cursor-pointer flex items-center gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              Lock & Freeze
                            </button>
                          )}
                          {workflow.available_next_actions.includes("CREATE_REVISION") && (
                            <button
                              onClick={() => handleWorkflowAction("new-revision")}
                              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 px-4 py-2 rounded text-xs font-extrabold uppercase font-mono tracking-wider cursor-pointer flex items-center gap-1.5"
                            >
                              <PlusCircle className="w-4 h-4" />
                              Spawn Revision increment
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Operation Remarks / Change Notes</label>
                          <input
                            type="text"
                            placeholder="Detail audit justification or revision changelogs..."
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-emerald-400/80 p-2.5 rounded text-xs text-white placeholder-slate-600 font-sans focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic font-sans">
                        No available governance next actions. This estimate is in its terminal state.
                      </div>
                    )}
                  </div>

                  {/* Sprint 3C - Sub Tab Navigation */}
                  <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/60 pb-1 mt-6">
                    <button
                      onClick={() => setActiveSubTab("summary")}
                      className={`px-3.5 py-2 text-xs font-bold font-mono tracking-wide rounded-t-md border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSubTab === "summary"
                          ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Summary & Actions
                    </button>
                    <button
                      onClick={() => setActiveSubTab("history")}
                      className={`px-3.5 py-2 text-xs font-bold font-mono tracking-wide rounded-t-md border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSubTab === "history"
                          ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      Approval History ({approvalHistory.length})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("timeline")}
                      className={`px-3.5 py-2 text-xs font-bold font-mono tracking-wide rounded-t-md border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSubTab === "timeline"
                          ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Workflow Timeline ({timelineEvents.length})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("comments")}
                      className={`px-3.5 py-2 text-xs font-bold font-mono tracking-wide rounded-t-md border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSubTab === "comments"
                          ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Comments ({comments.length})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("audit")}
                      className={`px-3.5 py-2 text-xs font-bold font-mono tracking-wide rounded-t-md border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSubTab === "audit"
                          ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                          : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Audit Trail ({auditLogs.length})
                    </button>
                  </div>

                  {activeSubTab === "summary" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      {/* Left Column: Specifications & Lock state */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-slate-500" />
                          Core Linkages & Specifications
                        </h4>
                        <div className="space-y-3 bg-slate-900/15 border border-slate-850 p-4 rounded-xl">
                          <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                            <span className="text-slate-400 font-sans">Attached BOM</span>
                            <span className="font-mono text-slate-200 font-bold">{getBOMName(selectedEst.bom_header_id)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs border-b border-slate-900/50 pb-2">
                            <span className="text-slate-400 font-sans">Attached Cost Sheet</span>
                            <span className="font-mono text-slate-200 font-bold">{getCostSheetName(selectedEst.cost_sheet_id)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pb-1">
                            <span className="text-slate-400 font-sans">Target Customer</span>
                            <span className="font-mono text-slate-200 font-bold">{getCustomerName(selectedEst.customer_id)}</span>
                          </div>
                        </div>

                        {selectedEst.status === "LOCKED" && (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                            <div className="space-y-1">
                              <h5 className="text-xs font-bold text-slate-200 uppercase font-mono">Immutable Governance Vault Enabled</h5>
                              <p className="text-[11px] text-slate-400 font-sans">This estimate revision has been locked and serves as a finalized, un-deletable document. Associated cost sheet and BOM are frozen to protect audit integrity.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Revision Lineage */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <GitCommit className="w-4 h-4 text-slate-500" />
                          Revision Lineage Tree
                        </h4>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {revisions && revisions.length > 0 ? (
                            revisions.map((rev) => (
                              <div 
                                key={rev.id} 
                                onClick={() => handleSelect(rev)}
                                className={`flex items-center justify-between p-2.5 rounded border transition-all cursor-pointer ${
                                  rev.id === selectedEst.id 
                                    ? "bg-slate-800/30 border-emerald-400/50" 
                                    : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="text-[10px] font-bold font-mono text-slate-200">
                                    Revision {rev.revision_number} • {rev.estimate_number}
                                  </div>
                                  <div className="text-[9px] text-slate-500 font-mono">
                                    Spawned: {new Date(rev.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div>
                                  {getStatusBadge(rev.status)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-600 italic">No revisions found for this root chain</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSubTab === "history" && (
                    <div className="space-y-4 pt-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <History className="w-4 h-4 text-emerald-400" />
                          Multi-Level Approval Log (Lineage Chain)
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-0.5 border border-slate-800 rounded font-mono">
                          {approvalHistory.length} entries
                        </span>
                      </div>

                      {approvalHistory.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-6 bg-slate-900/10 border border-slate-850 rounded-xl text-center font-sans">
                          No official approval transitions have been logged for this lineage.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {approvalHistory.map((h) => (
                            <div key={h.id} className="bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-lg p-4 space-y-2.5 transition-all">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                  <span className="font-extrabold font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                                    Level {h.approval_level}
                                  </span>
                                  <span className={`font-extrabold px-2 py-0.5 rounded text-[10px] uppercase font-mono border ${
                                    h.action_type === "APPROVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    h.action_type === "REJECT" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  }`}>
                                    {h.action_type === "APPROVE" ? "APPROVED" : h.action_type === "REJECT" ? "REJECTED" : h.action_type === "REQUEST_CHANGES" ? "CHANGES REQUESTED" : h.action_type}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    on Rev {h.revision_number}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                                  {new Date(h.timestamp).toLocaleString()}
                                </div>
                              </div>
                              <p className="text-xs font-sans text-slate-300 bg-slate-950/20 p-2.5 border border-slate-900 rounded">
                                <span className="text-slate-500 select-none">Comments:</span> {h.comments || "No remarks provided."}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono border-t border-slate-900 pt-2 mt-1">
                                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold">{h.user_role}</span>
                                <span>{h.user_name} ({h.user_id})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeSubTab === "timeline" && (
                    <div className="space-y-4 pt-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          Complete Lifecycle Workflow Timeline
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-0.5 border border-slate-800 rounded font-mono">
                          {timelineEvents.length} events
                        </span>
                      </div>

                      {timelineEvents.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-6 bg-slate-900/10 border border-slate-850 rounded-xl text-center font-sans">
                          No timeline events registered for this estimate lineage.
                        </div>
                      ) : (
                        <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-2 py-2">
                          {timelineEvents.map((t) => {
                            const eventTypeColors: Record<string, string> = {
                              CREATION: "bg-blue-500 ring-blue-500/20",
                              SUBMISSION: "bg-yellow-500 ring-yellow-500/20",
                              APPROVAL: "bg-emerald-500 ring-emerald-500/20",
                              REJECTION: "bg-rose-500 ring-rose-500/20",
                              CHANGES_REQUESTED: "bg-red-500 ring-red-500/20",
                              LOCK: "bg-slate-400 ring-slate-400/20",
                              REVISION: "bg-purple-500 ring-purple-500/20",
                              COMMENT: "bg-pink-500 ring-pink-500/20"
                            };
                            const dotColor = eventTypeColors[t.event_type] || "bg-emerald-400 ring-emerald-400/20";
                            return (
                              <div key={t.id} className="relative space-y-1">
                                {/* Indicator Dot */}
                                <div className={`absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 border border-slate-950`} />
                                
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-200">
                                      {t.event_title}
                                    </span>
                                    <span className="text-[9px] bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                                      {t.event_type}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-mono">
                                      Rev {t.revision_number}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(t.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 font-sans pr-4">{t.event_description}</p>
                                <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                                  <span>by {t.user_name}</span>
                                  <span className="bg-slate-900 text-slate-400 px-1 rounded text-[8px] uppercase">{t.user_role}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeSubTab === "comments" && (
                    <div className="space-y-4 pt-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                          Collaboration & Reviewer Discussions
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-0.5 border border-slate-800 rounded font-mono">
                          {comments.length} comments
                        </span>
                      </div>

                      {/* Post Comment Form */}
                      <form onSubmit={handleAddComment} className="bg-slate-900/35 border border-slate-850 p-4 rounded-xl space-y-3 shadow-md">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                          <div className="flex-1 space-y-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono">Comment Message</label>
                            <input
                              type="text"
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              placeholder="Type your feedback, review notes, or clarification request here..."
                              className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 p-2.5 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                            />
                          </div>

                          <div className="sm:w-[180px] space-y-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase font-mono">Type</label>
                            <select
                              value={newCommentType}
                              onChange={(e) => setNewCommentType(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 h-[38px] px-2"
                            >
                              <option value="GENERAL">General Feedback</option>
                              <option value="CLARIFICATION">Clarification</option>
                              <option value="TECHNICAL_REVIEW">Technical Review</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={!newCommentText.trim()}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-mono font-bold text-xs uppercase px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Post Comment
                          </button>
                        </div>
                      </form>

                      {/* List Comments */}
                      {comments.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-6 bg-slate-900/10 border border-slate-850 rounded-xl text-center font-sans">
                          No reviewer comments posted yet. Start the conversation above!
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {comments.map((c) => {
                            const commentColors: Record<string, { bg: string, text: string }> = {
                              GENERAL: { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", text: "General" },
                              CLARIFICATION: { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", text: "Clarification" },
                              TECHNICAL_REVIEW: { bg: "bg-purple-500/10 text-purple-400 border-purple-500/20", text: "Tech Review" }
                            };
                            const col = commentColors[c.comment_type] || { bg: "bg-slate-800 text-slate-400 border-transparent", text: c.comment_type };
                            return (
                              <div key={c.id} className="bg-slate-900/35 border border-slate-850 p-4 rounded-lg space-y-2 transition-all hover:bg-slate-900/45">
                                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-300">{c.user_name}</span>
                                    <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[8px] uppercase">{c.user_role}</span>
                                    <span className="text-slate-500">Rev {c.revision_number}</span>
                                  </div>
                                  <div className="text-slate-500">
                                    {new Date(c.timestamp).toLocaleString()}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-250 font-sans leading-relaxed whitespace-pre-wrap">{c.message}</p>
                                <div className="pt-1 flex">
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${col.bg}`}>
                                    {col.text}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeSubTab === "audit" && (
                    <div className="space-y-4 pt-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-emerald-400" />
                          Security Audit Log (Estimate Family Chain)
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-0.5 border border-slate-800 rounded font-mono">
                          {auditLogs.length} logs
                        </span>
                      </div>

                      {auditLogs.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-6 bg-slate-900/10 border border-slate-850 rounded-xl text-center font-sans">
                          No security-grade audit logs captured for this estimate.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-850 rounded-lg">
                          <table className="w-full text-left border-collapse text-[11px] font-mono">
                            <thead>
                              <tr className="bg-slate-900/80 border-b border-slate-850 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                                <th className="p-3">Timestamp</th>
                                <th className="p-3">User</th>
                                <th className="p-3">Action Class</th>
                                <th className="p-3">Event Detail</th>
                                <th className="p-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map((log) => (
                                <tr key={log.id} className="border-b border-slate-900/40 hover:bg-slate-900/20 transition-colors">
                                  <td className="p-3 whitespace-nowrap text-slate-400">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <div className="font-bold text-slate-200">{log.user_email}</div>
                                    <div className="text-[9px] text-slate-500">id: {log.user_id} ({log.user_role})</div>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <span className="bg-slate-900 text-emerald-400 border border-slate-850/60 px-2 py-0.5 rounded text-[10px] font-bold">
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="p-3 font-sans text-slate-300 leading-normal max-w-[280px]">
                                    {log.details}
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${
                                      log.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" : "bg-red-500/10 text-red-400 border border-red-500/15"
                                    }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950/30 border border-slate-800/50 rounded-xl p-6 space-y-6 shadow-xl">
                  {/* GOVERNANCE MATRIX INTERACTIVE LIST */}
                  <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                        <Settings className="w-4 h-4 text-emerald-400" />
                        Configurable Approval Matrix
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-sans">
                        Configure the required multi-level approval stages and authority roles for estimate signatures.
                      </p>
                    </div>
                    {authState.user?.role === "L2-Admin" && (
                      <button
                        onClick={() => {
                          setMatrixForm({ id: "", approval_level: "", role: "L1-Estimator", sequence_order: "", is_active: true });
                          setShowMatrixModal(true);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded text-xs font-bold font-mono tracking-wide uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Level
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 font-sans border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                          <th className="py-3 px-4">Level</th>
                          <th className="py-3 px-4">Role Authorization</th>
                          <th className="py-3 px-4">Sequence Order</th>
                          <th className="py-3 px-4">Status</th>
                          {authState.user?.role === "L2-Admin" && <th className="py-3 px-4 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/40">
                        {approvalMatrix.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                              No approval levels configured. Estimates will auto-approve upon submission.
                            </td>
                          </tr>
                        ) : (
                          approvalMatrix.map((lvl) => (
                            <tr key={lvl.id} className="hover:bg-slate-900/25 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-white">Level {lvl.approval_level}</td>
                              <td className="py-3 px-4 font-medium text-slate-200">
                                <span className="bg-slate-800 border border-slate-700/60 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {lvl.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-400">{lvl.sequence_order}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider ${
                                  lvl.is_active 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" 
                                    : "bg-slate-800 text-slate-400 border border-slate-700/50"
                                }`}>
                                  {lvl.is_active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </td>
                              {authState.user?.role === "L2-Admin" && (
                                <td className="py-3 px-4 text-right space-x-2 font-mono">
                                  <button
                                    onClick={() => {
                                      setMatrixForm({
                                        id: lvl.id,
                                        approval_level: String(lvl.approval_level),
                                        role: lvl.role,
                                        sequence_order: String(lvl.sequence_order),
                                        is_active: lvl.is_active
                                      });
                                      setShowMatrixModal(true);
                                    }}
                                    className="text-slate-400 hover:text-white text-[10px] uppercase font-bold underline cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await apiFetch(`/api/v1/approval-matrix/${lvl.id}`, {
                                          method: "PUT",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ is_active: !lvl.is_active })
                                        });
                                        if (res.ok) {
                                          setSuccessMsg(`Successfully toggled Level ${lvl.approval_level} active state.`);
                                          await loadApprovalMatrix();
                                          if (selectedEst) {
                                            await loadWorkflowDetails(selectedEst.id);
                                          }
                                        } else {
                                          const err = await res.json();
                                          setErrorMsg(err.message || "Failed to update matrix level status.");
                                        }
                                      } catch (err) {
                                        setErrorMsg("Failed to communicate with the matrix database.");
                                      }
                                    }}
                                    className="text-slate-400 hover:text-emerald-400 text-[10px] uppercase font-bold underline cursor-pointer"
                                  >
                                    {lvl.is_active ? "Deactivate" : "Activate"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500 h-[450px] flex flex-col items-center justify-center">
              <ShieldCheck className="w-12 h-12 mb-4 text-slate-600 stroke-[1.25]" />
              <h3 className="text-sm font-extrabold tracking-widest uppercase text-slate-400 font-mono">No Estimate Selected</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
                Select an existing estimate from the registry panel, or create a brand new governance estimation tree node.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL DIALOG */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10"
              id="estimate-creation-modal"
            >
              <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
                <h3 className="text-sm font-extrabold tracking-wider uppercase text-white font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Initialize Governance Estimate
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Description / Target Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CCS Spacemaker Phase 1 Modular Panels"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-emerald-400/85 p-2.5 rounded text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Attach BOM Master Revision (Optional)</label>
                  <select
                    value={form.bom_header_id}
                    onChange={(e) => setForm({ ...form, bom_header_id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 p-2.5 rounded text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Select Active Part BOM --</option>
                    {boms.map(b => (
                      <option key={b.id} value={b.id}>{b.part_number} (Rev {b.revision_number})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Attach Cost Sheet (Optional)</label>
                  <select
                    value={form.cost_sheet_id}
                    onChange={(e) => setForm({ ...form, cost_sheet_id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 p-2.5 rounded text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Select Compliant Cost Sheet --</option>
                    {costSheets.map(c => (
                      <option key={c.id} value={c.id}>{c.cost_sheet_number} ({c.status})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Corporate Client / Customer</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 p-2.5 rounded text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Select Customer Organization --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Initial Change / Revision Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Initial draft configuration."
                    value={form.revision_notes}
                    onChange={(e) => setForm({ ...form, revision_notes: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-emerald-400/85 p-2.5 rounded text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded text-xs font-extrabold uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Initialize
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showMatrixModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMatrixModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10 animate-fade-in"
              id="approval-matrix-edit-modal"
            >
              <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
                <h3 className="text-sm font-extrabold tracking-wider uppercase text-white font-mono flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  {matrixForm.id ? "Edit Matrix Level" : "Add Matrix Level"}
                </h3>
                <button onClick={() => setShowMatrixModal(false)} className="text-slate-400 hover:text-white font-bold">&times;</button>
              </div>

              <form onSubmit={handleMatrixSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Approval Level</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="e.g. 1"
                    value={matrixForm.approval_level}
                    onChange={(e) => setMatrixForm({ ...matrixForm, approval_level: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-emerald-400/85 p-2.5 rounded text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Authorized Role</label>
                  <select
                    value={matrixForm.role}
                    onChange={(e) => setMatrixForm({ ...matrixForm, role: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 p-2.5 rounded text-xs text-white focus:outline-none"
                  >
                    <option value="L1-Estimator">L1-Estimator</option>
                    <option value="PM">PM</option>
                    <option value="L2-Admin">L2-Admin</option>
                    <option value="Signatory">Signatory</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">Sequence Order</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="e.g. 10"
                    value={matrixForm.sequence_order}
                    onChange={(e) => setMatrixForm({ ...matrixForm, sequence_order: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-emerald-400/85 p-2.5 rounded text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="matrix-lvl-active"
                    checked={matrixForm.is_active}
                    onChange={(e) => setMatrixForm({ ...matrixForm, is_active: e.target.checked })}
                    className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                  />
                  <label htmlFor="matrix-lvl-active" className="text-xs text-slate-300 font-mono font-bold select-none cursor-pointer">
                    Level is active and required in workflow
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMatrixModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded text-xs font-extrabold uppercase tracking-wider font-mono cursor-pointer"
                  >
                    {matrixForm.id ? "Update Level" : "Create Level"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
