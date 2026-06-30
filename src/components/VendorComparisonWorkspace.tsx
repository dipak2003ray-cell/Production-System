import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Scale,
  Award,
  Shield,
  Settings,
  Info,
  Save,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Clock,
  ThumbsUp,
  Star,
  RefreshCw,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  Sliders,
  Check,
  X,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Vendor, VendorComparisonHeader, VendorComparisonLine, TechnicalEvaluation, VendorComparisonRecommendation } from "../types";

interface VendorComparisonWorkspaceProps {
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

export const VendorComparisonWorkspace: React.FC<VendorComparisonWorkspaceProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  // Lists
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);

  // Selection
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  // Loading
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Modals & UI States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Weights Form
  const [commWeight, setCommWeight] = useState(40);
  const [techWeight, setTechWeight] = useState(25);
  const [qualWeight, setQualWeight] = useState(15);
  const [delWeight, setDelWeight] = useState(10);
  const [servWeight = 10, setServWeight] = useState(10);

  // Technical scores edit state
  const [editTechScores, setEditTechScores] = useState<{ [vendorId: string]: any }>({});
  const [comparisonRemarks, setComparisonRemarks] = useState("");
  const [recNotes, setRecNotes] = useState("");

  useEffect(() => {
    fetchComparisons();
    fetchRfqsAndVendors();
  }, []);

  useEffect(() => {
    if (selectedComparisonId) {
      fetchComparisonDetail(selectedComparisonId);
    } else {
      setDetail(null);
    }
  }, [selectedComparisonId]);

  const fetchComparisons = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch("/api/v1/vendor-comparisons");
      setComparisons(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load comparisons");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRfqsAndVendors = async () => {
    try {
      const rfqList = await apiFetch("/api/v1/rfqs");
      setRfqs(rfqList || []);
      const vendorList = await apiFetch("/api/v1/vendors");
      setVendors(vendorList || []);
      const ratingsList = await apiFetch("/api/v1/vendors"); // Sprint 4B ratings exist on vendor or can fetch vendor details
      setRatings(ratingsList || []);
    } catch (err) {
      console.error("Failed to load RFQs/Vendors", err);
    }
  };

  const fetchComparisonDetail = async (id: string) => {
    setIsDetailLoading(true);
    try {
      const data = await apiFetch(`/api/v1/vendor-comparisons/${id}`);
      setDetail(data);
      setComparisonRemarks(data.remarks || "");
      setCommWeight(data.commercial_weight || 40);
      setTechWeight(data.technical_weight || 25);
      setQualWeight(data.quality_weight || 15);
      setDelWeight(data.delivery_weight || 10);
      setServWeight(data.service_weight || 10);
      setRecNotes(data.recommendation?.notes || "");

      // Initialize technical scores forms
      const scoresForm: { [vendorId: string]: any } = {};
      if (Array.isArray(data.technical_evaluations)) {
        data.technical_evaluations.forEach((te: any) => {
          scoresForm[te.vendor_id] = {
            id: te.id,
            quality_score: te.quality_score,
            delivery_score: te.delivery_score,
            compliance_score: te.compliance_score,
            service_score: te.service_score,
            documentation_score: te.documentation_score,
            warranty_score: te.warranty_score
          };
        });
      }
      setEditTechScores(scoresForm);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load comparison detail");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCreateComparison = async (rfqId: string) => {
    setIsLoading(true);
    try {
      await apiFetch(`/api/v1/vendor-comparisons/from-rfq/${rfqId}`, {
        method: "POST"
      });
      setSuccessMsg("Comparison matrix generated successfully.");
      setIsCreateModalOpen(false);
      fetchComparisons();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create comparison");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWeights = async () => {
    if (!detail) return;
    const total = Number(commWeight) + Number(techWeight) + Number(qualWeight) + Number(delWeight) + Number(servWeight);
    if (total !== 100) {
      setErrorMsg(`Evaluation weights must equal 100%. Current total: ${total}%`);
      return;
    }

    try {
      await apiFetch(`/api/v1/vendor-comparisons/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify({
          commercial_weight: commWeight,
          technical_weight: techWeight,
          quality_weight: qualWeight,
          delivery_weight: delWeight,
          service_weight: servWeight,
          remarks: comparisonRemarks
        })
      });
      setSuccessMsg("Evaluation weights updated successfully.");
      fetchComparisonDetail(detail.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save weights");
    }
  };

  const handleSaveTechScore = async (vendorId: string) => {
    if (!detail || !editTechScores[vendorId]) return;
    try {
      await apiFetch(`/api/v1/vendor-comparisons/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify({
          technical_evaluations: [editTechScores[vendorId]]
        })
      });
      setSuccessMsg("Technical scores saved and overall rank compiled.");
      fetchComparisonDetail(detail.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save technical score");
    }
  };

  const handleEvaluateMatrix = async () => {
    if (!detail) return;
    try {
      await apiFetch(`/api/v1/vendor-comparisons/${detail.id}/evaluate`, {
        method: "POST"
      });
      setSuccessMsg("Comparison matrix recalculation triggered successfully.");
      fetchComparisonDetail(detail.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Evaluation trigger failed");
    }
  };

  const handleApproveStatus = async (targetStatus?: string) => {
    if (!detail) return;
    try {
      const res = await apiFetch(`/api/v1/vendor-comparisons/${detail.id}/approve`, {
        method: "POST",
        body: targetStatus ? JSON.stringify({ status: targetStatus }) : undefined
      });
      setSuccessMsg(`Status updated successfully to ${res.status}`);
      fetchComparisonDetail(detail.id);
      fetchComparisons();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to approve/transition status");
    }
  };

  // Helper functions for displaying vendors
  const getVendorName = (vId: string) => {
    const v = vendors.find(item => item.id === vId);
    return v ? v.vendor_name : "Unknown Vendor";
  };

  const getVendorCode = (vId: string) => {
    const v = vendors.find(item => item.id === vId);
    return v ? v.vendor_code : "N/A";
  };

  // Filter comparison list
  const filteredComparisons = comparisons.filter(c => {
    const matchesSearch = c.comparison_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.rfq_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.buyer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Unique vendors inside comparison detail
  const detailVendorIds = detail ? Array.from(new Set(detail.lines.map((l: any) => l.vendor_id))) as string[] : [];

  // Commercial totals per vendor
  const vendorTotalsMap = detailVendorIds.reduce((acc: { [vendorId: string]: any }, vId) => {
    const vLines = detail.lines.filter((l: any) => l.vendor_id === vId);
    const total = vLines.reduce((sum: number, l: any) => sum + Number(l.total_cost || 0), 0);
    const maxLeadTime = vLines.reduce((max: number, l: any) => Math.max(max, Number(l.lead_time_days || 0)), 0);
    const maxMoq = vLines.reduce((max: number, l: any) => Math.max(max, Number(l.moq || 0)), 0);
    
    // Ratings
    const v = vendors.find(item => item.id === vId);
    const vRatingObj = ratings.find((r: any) => r.id === vId) || {};
    
    acc[vId] = {
      vendorId: vId,
      vendorName: v ? v.vendor_name : "Unknown",
      vendorCode: v ? v.vendor_code : "N/A",
      totalCost: total,
      maxLeadTime,
      maxMoq,
      rating: vRatingObj
    };
    return acc;
  }, {});

  // Find lowest total cost
  const lowestTotalCost = detailVendorIds.length > 0 
    ? Math.min(...detailVendorIds.map(vId => vendorTotalsMap[vId]?.totalCost || Infinity))
    : 0;

  // Fully responded RFQs with at least 2 quotes
  const rfqCandidates = rfqs.filter(r => {
    // Has a comparison already?
    const hasComp = comparisons.some(c => c.rfq_id === r.id);
    if (hasComp) return false;

    // Has at least 2 quotes?
    // In our backend/db, filter quotes
    // But since we are on the client, we can allow user to pick any FULLY_RESPONDED/UNDER_EVALUATION/SENT RFQs 
    // and let the backend throw validation if quotes count is too low! Let's display warning but let them select.
    return r.status === "FULLY_RESPONDED" || r.status === "UNDER_EVALUATION" || r.status === "SENT" || r.status === "PARTIALLY_RESPONDED";
  });

  // Locked check
  const isLocked = detail && (detail.status === "APPROVED" || detail.status === "COMPLETED");

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-slate-900 bg-slate-950 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Vendor Comparison & Source Selection
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Evaluate commercial offers, score technical performance, and authorize vendor selection
            </p>
          </div>
        </div>

        {selectedComparisonId && (
          <button
            onClick={() => setSelectedComparisonId(null)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs text-slate-400 hover:text-white transition-all font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Register</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {!selectedComparisonId ? (
            /* REGISTER VIEW */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* FILTERS & SEARCH ROW */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-900">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search comparison, buyer, RFQ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500/50 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-950/40"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Comparison Session</span>
                </button>
              </div>

              {/* LIST TABLE */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400">Loading comparison register...</p>
                </div>
              ) : filteredComparisons.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-900 rounded-xl">
                  <Scale className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-slate-300">No Comparison Sessions Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Generate a vendor comparison session to start assessing commercial quotations side-by-side.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-900 rounded-xl bg-slate-950">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-900 text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                        <th className="px-6 py-3.5">Comparison ID</th>
                        <th className="px-6 py-3.5">RFQ Number</th>
                        <th className="px-6 py-3.5">Buyer</th>
                        <th className="px-6 py-3.5">Comparison Date</th>
                        <th className="px-6 py-3.5">Quotations</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {filteredComparisons.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-900/30 transition-all text-xs text-slate-300 group"
                        >
                          <td className="px-6 py-4 font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {c.comparison_number}
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400">{c.rfq_number}</td>
                          <td className="px-6 py-4">{c.buyer}</td>
                          <td className="px-6 py-4 text-slate-400">{c.comparison_date}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold font-mono text-[10px]">
                              {c.quotations_count} Quotes
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                c.status === "APPROVED" || c.status === "COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : c.status === "UNDER_REVIEW"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : c.status === "REJECTED"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-slate-800 text-slate-300 border-slate-700"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedComparisonId(c.id)}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded text-[11px] font-semibold transition-all group-hover:border-emerald-500/30"
                            >
                              Open Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ) : (
            /* DETAILS VIEW */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {isDetailLoading || !detail ? (
                <div className="flex flex-col items-center justify-center py-40 gap-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400">Loading evaluation matrix details...</p>
                </div>
              ) : (
                <>
                  {/* WORKSPACE DETAIL HEADER CARD */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-xl border border-slate-900 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-white">
                            {detail.comparison_number}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              detail.status === "APPROVED" || detail.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : detail.status === "UNDER_REVIEW"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : detail.status === "REJECTED"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {detail.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 block">RFQ Reference</span>
                            <span className="text-slate-300 font-mono font-semibold">
                              {detail.rfq_number} ({detail.rfq_status})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Comparison Date</span>
                            <span className="text-slate-300">{detail.comparison_date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Assigned Buyer</span>
                            <span className="text-white font-semibold">{detail.buyer}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Remarks</span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={comparisonRemarks}
                              onChange={(e) => setComparisonRemarks(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-emerald-500 disabled:opacity-50 mt-1"
                              placeholder="Add general comparison remarks..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-900">
                        <button
                          onClick={handleEvaluateMatrix}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white rounded text-xs font-semibold transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Trigger Recalculation</span>
                        </button>
                      </div>
                    </div>

                    {/* STATUS WORKFLOW & GOVERNANCE ACTIONS */}
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-900 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>Governance & Status Transitions</span>
                      </h3>

                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-400">
                          Configure overall comparison states in accordance with Sprint 3 multi-level security policies.
                        </p>

                        <div className="flex flex-col gap-2 pt-2">
                          {detail.status === "DRAFT" && (
                            <button
                              onClick={() => handleApproveStatus("UNDER_REVIEW")}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Submit for Review</span>
                            </button>
                          )}

                          {detail.status === "UNDER_REVIEW" && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleApproveStatus("APPROVED")}
                                className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-all flex items-center justify-center gap-1"
                              >
                                <Check className="w-4 h-4" />
                                <span>Approve Session</span>
                              </button>
                              <button
                                onClick={() => handleApproveStatus("REJECTED")}
                                className="py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-400 font-bold rounded text-xs transition-all flex items-center justify-center gap-1"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}

                          {detail.status === "APPROVED" && (
                            <button
                              onClick={() => handleApproveStatus("COMPLETED")}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Set to Completed</span>
                            </button>
                          )}

                          {(detail.status === "COMPLETED" || detail.status === "REJECTED") && (
                            <div className="flex items-center gap-2 text-xs bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-400 justify-center font-mono">
                              <Info className="w-4 h-4 text-emerald-400" />
                              <span>Comparison history locked.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WEIGHTS CONFIGURATION CARD */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          Multicriteria Scoring Weights (%)
                        </h3>
                      </div>
                      {!isLocked && (
                        <button
                          onClick={handleSaveWeights}
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] transition-all"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save Evaluation Weights</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Commercial Price</span>
                          <span className="font-semibold text-white">{commWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={commWeight}
                          onChange={(e) => setCommWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Technical Capability</span>
                          <span className="font-semibold text-white">{techWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={techWeight}
                          onChange={(e) => setTechWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Quality History</span>
                          <span className="font-semibold text-white">{qualWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={qualWeight}
                          onChange={(e) => setQualWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Delivery History</span>
                          <span className="font-semibold text-white">{delWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={delWeight}
                          onChange={(e) => setDelWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Service History</span>
                          <span className="font-semibold text-white">{servWeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          disabled={isLocked}
                          value={servWeight}
                          onChange={(e) => setServWeight(Number(e.target.value))}
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-900/60 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>Weights must equal exactly 100%.</span>
                      <span className={`font-bold ${Number(commWeight) + Number(techWeight) + Number(qualWeight) + Number(delWeight) + Number(servWeight) === 100 ? "text-emerald-400" : "text-rose-400"}`}>
                        Current Sum: {Number(commWeight) + Number(techWeight) + Number(qualWeight) + Number(delWeight) + Number(servWeight)}%
                      </span>
                    </div>
                  </div>

                  {/* SIDE-BY-SIDE MATRIX GRID */}
                  <div className="bg-slate-900/40 rounded-xl border border-slate-900 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-900">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Vendor Quotation Side-by-Side Comparison Matrix
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                          {/* COLUMN HEADERS */}
                          <tr className="bg-slate-950 border-b border-slate-900 text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            <th className="px-6 py-4 border-r border-slate-900/60 min-w-[200px]">Material Details</th>
                            {detailVendorIds.map((vId) => (
                              <th key={vId} className="px-6 py-4 min-w-[220px]">
                                <div className="text-xs text-white font-bold">{getVendorName(vId)}</div>
                                <div className="text-[10px] text-slate-400">{getVendorCode(vId)}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-xs">
                          {/* MATERIAL ROWS */}
                          {detail.rfq_lines.map((rfqLine: any) => (
                            <tr key={rfqLine.id} className="hover:bg-slate-900/20">
                              <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                                <div>{rfqLine.description}</div>
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                  Qty: {rfqLine.quantity} {rfqLine.uom}
                                </div>
                              </td>

                              {detailVendorIds.map((vId) => {
                                const compLine = detail.lines.find(
                                  (l: any) => l.material_id === rfqLine.material_id && l.vendor_id === vId
                                );
                                return (
                                  <td key={vId} className="px-6 py-4">
                                    {compLine ? (
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">Unit Price:</span>
                                          <span className="font-semibold text-white font-mono">
                                            {compLine.unit_price.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                          <span className="text-slate-500">Disc / Tax %:</span>
                                          <span className="text-slate-300">
                                            {compLine.discount_percent}% / {compLine.tax_percent}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                          <span className="text-slate-500">Freight:</span>
                                          <span className="text-slate-300 font-mono">
                                            {compLine.freight.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-slate-900/40 font-semibold">
                                          <span className="text-slate-400">Line Cost:</span>
                                          <span className="text-emerald-400 font-mono">
                                            {compLine.total_cost.toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-600 font-mono">No Quotation</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* COMMERCIAL SUMMARY HEADER */}
                          <tr className="bg-slate-950 font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                            <td className="px-6 py-3 border-r border-slate-900/60 font-bold">
                              Commercial Rankings
                            </td>
                            {detailVendorIds.map((vId) => (
                              <td key={vId} className="px-6 py-3 font-bold">
                                {getVendorCode(vId)} Summary
                              </td>
                            ))}
                          </tr>

                          {/* COMMERCIAL SUMMARY VALUES */}
                          <tr className="bg-slate-900/30">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Grand Total Cost
                            </td>
                            {detailVendorIds.map((vId) => {
                              const total = vendorTotalsMap[vId]?.totalCost || 0;
                              const isLowest = total === lowestTotalCost && lowestTotalCost > 0;
                              return (
                                <td key={vId} className="px-6 py-4 font-mono">
                                  <div className="text-sm font-bold text-white flex items-center justify-between">
                                    <span>{total.toFixed(2)}</span>
                                    {isLowest && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 font-sans tracking-wide">
                                        LOWEST
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-slate-900/30">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Price Variance %
                            </td>
                            {detailVendorIds.map((vId) => {
                              const total = vendorTotalsMap[vId]?.totalCost || 0;
                              const variance = total - lowestTotalCost;
                              const pct = lowestTotalCost > 0 ? (variance / lowestTotalCost) * 100 : 0;
                              return (
                                <td key={vId} className="px-6 py-4 font-mono text-slate-300">
                                  {pct === 0 ? (
                                    <span className="text-emerald-400 font-bold">Benchmark (0%)</span>
                                  ) : (
                                    <span>+{pct.toFixed(1)}%</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-slate-900/30">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Lead Time / MOQ
                            </td>
                            {detailVendorIds.map((vId) => {
                              const summary = vendorTotalsMap[vId];
                              return (
                                <td key={vId} className="px-6 py-4">
                                  <div className="text-slate-300 font-mono">
                                    {summary?.maxLeadTime} Days / MOQ: {summary?.maxMoq}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          {/* HISTORICAL RATINGS SECTION */}
                          <tr className="bg-slate-950 font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                            <td className="px-6 py-3 border-r border-slate-900/60 font-bold">
                              Sprint 4B Historical Ratings (Vendor Master)
                            </td>
                            {detailVendorIds.map((vId) => (
                              <td key={vId} className="px-6 py-3 font-bold">
                                {getVendorCode(vId)} History
                              </td>
                            ))}
                          </tr>

                          <tr className="bg-slate-900/10">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Historical Performance Ratings
                            </td>
                            {detailVendorIds.map((vId) => {
                              // We fetch from ratings array
                              const summary = vendorTotalsMap[vId];
                              // rating structure can be from ratings db
                              const r = ratings.find((item: any) => item.id === vId) || {};
                              const quality = r.quality_rating || r.rating?.quality_rating || 4.2;
                              const delivery = r.delivery_rating || r.rating?.delivery_rating || 4.1;
                              const service = r.service_rating || r.rating?.service_rating || 4.3;
                              return (
                                <td key={vId} className="px-6 py-4 space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Quality rating:</span>
                                    <span className="text-white font-bold">{quality} / 5</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Delivery rating:</span>
                                    <span className="text-white font-bold">{delivery} / 5</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Service rating:</span>
                                    <span className="text-white font-bold">{service} / 5</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          {/* MANUAL TECHNICAL EVALUATION SECTION */}
                          <tr className="bg-slate-950 font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                            <td className="px-6 py-3 border-r border-slate-900/60 font-bold">
                              Technical Evaluation (Manual Scores 1-10)
                            </td>
                            {detailVendorIds.map((vId) => (
                              <td key={vId} className="px-6 py-3 font-bold flex justify-between items-center">
                                <span>{getVendorCode(vId)} Scores</span>
                                {!isLocked && (
                                  <button
                                    onClick={() => handleSaveTechScore(vId)}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                                    title="Save vendor technical evaluation"
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            ))}
                          </tr>

                          {/* QUALITY, COMPLIANCE, SERVICE SCORES INPUTS */}
                          <tr className="bg-slate-900/20">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Product Quality & Tech Compliance
                            </td>
                            {detailVendorIds.map((vId) => {
                              const scores = editTechScores[vId] || {};
                              return (
                                <td key={vId} className="px-6 py-4 space-y-3">
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Product Quality:</span>
                                      <span className="font-semibold text-white">{scores.quality_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.quality_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, quality_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Technical Compliance:</span>
                                      <span className="font-semibold text-white">{scores.compliance_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.compliance_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, compliance_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-slate-900/20">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Delivery Capability & Service Support
                            </td>
                            {detailVendorIds.map((vId) => {
                              const scores = editTechScores[vId] || {};
                              return (
                                <td key={vId} className="px-6 py-4 space-y-3">
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Delivery Capability:</span>
                                      <span className="font-semibold text-white">{scores.delivery_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.delivery_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, delivery_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Service Support:</span>
                                      <span className="font-semibold text-white">{scores.service_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.service_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, service_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-slate-900/20">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300">
                              Warranty & Documentation
                            </td>
                            {detailVendorIds.map((vId) => {
                              const scores = editTechScores[vId] || {};
                              return (
                                <td key={vId} className="px-6 py-4 space-y-3">
                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Warranty Score:</span>
                                      <span className="font-semibold text-white">{scores.warranty_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.warranty_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, warranty_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex justify-between text-[10px] mb-1">
                                      <span className="text-slate-500">Documentation Compliance:</span>
                                      <span className="font-semibold text-white">{scores.documentation_score || 8}/10</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      disabled={isLocked}
                                      value={scores.documentation_score || 8}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditTechScores({
                                          ...editTechScores,
                                          [vId]: { ...scores, documentation_score: val }
                                        });
                                      }}
                                      className="w-full h-1 bg-slate-950 rounded-lg accent-emerald-400 cursor-pointer"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>

                          {/* OVERALL WEIGHTED COMPILED SCORE SECTION */}
                          <tr className="bg-slate-950 font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                            <td className="px-6 py-3 border-r border-slate-900/60 font-bold">
                              Composite Score Sheet (Normalized / 100)
                            </td>
                            {detailVendorIds.map((vId) => (
                              <td key={vId} className="px-6 py-3 font-bold">
                                {getVendorCode(vId)} Composite Metrics
                              </td>
                            ))}
                          </tr>

                          <tr className="bg-slate-900/40 font-mono text-xs">
                            <td className="px-6 py-4 border-r border-slate-900/60 font-semibold text-slate-300 font-sans">
                              Weighted Overall Rating
                            </td>
                            {detailVendorIds.map((vId) => {
                              const totalCost = vendorTotalsMap[vId]?.totalCost || 0;
                              const commScore = totalCost > 0 ? (lowestTotalCost / totalCost) * 100 : 0;

                              const te = detail.technical_evaluations.find((e: any) => e.vendor_id === vId) || {};
                              const techAvg = te.weighted_avg || 8;
                              const techScore = techAvg * 10;

                              const r = ratings.find((item: any) => item.id === vId) || {};
                              const quality = r.quality_rating || r.rating?.quality_rating || 4.2;
                              const delivery = r.delivery_rating || r.rating?.delivery_rating || 4.1;
                              const service = r.service_rating || r.rating?.service_rating || 4.3;

                              const qualHistoryScore = (quality <= 5) ? quality * 20 : quality * 10;
                              const delHistoryScore = (delivery <= 5) ? delivery * 20 : delivery * 10;
                              const servHistoryScore = (service <= 5) ? service * 20 : service * 10;

                              // Total Overall Score
                              const overallScore = (commScore * commWeight / 100) +
                                                   (techScore * techWeight / 100) +
                                                   (qualHistoryScore * qualWeight / 100) +
                                                   (delHistoryScore * delWeight / 100) +
                                                   (servHistoryScore * servWeight / 100);

                              return (
                                <td key={vId} className="px-6 py-4 font-bold text-emerald-400 text-sm">
                                  {overallScore.toFixed(2)} / 100
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* RECOMMENDATION DASHBOARD PANEL */}
                  {detail.recommendation && (
                    <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-900 space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                        <Award className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                          Procurement Decision & Recommendation Summary
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* COMMERCIAL AWARD */}
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-900">
                          <div className="flex items-center gap-2 mb-2 text-emerald-400">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                              Best Commercial Supplier
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mb-2">
                            {getVendorName(detail.recommendation.best_commercial_vendor_id)}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {detail.recommendation.best_commercial_reason}
                          </p>
                        </div>

                        {/* TECHNICAL AWARD */}
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-900">
                          <div className="flex items-center gap-2 mb-2 text-emerald-400">
                            <Star className="w-4 h-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                              Best Technical Supplier
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mb-2">
                            {getVendorName(detail.recommendation.best_technical_vendor_id)}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {detail.recommendation.best_technical_reason}
                          </p>
                        </div>

                        {/* OVERALL COMPOSITE AWARD */}
                        <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-500/20 shadow-lg shadow-emerald-950/20">
                          <div className="flex items-center gap-2 mb-2 text-emerald-400">
                            <Award className="w-4 h-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                              Overall Best Recommendation
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mb-2">
                            {getVendorName(detail.recommendation.overall_best_vendor_id)}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {detail.recommendation.overall_best_reason}
                          </p>
                        </div>
                      </div>

                      {/* STATS ROW */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-900 text-center font-mono">
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-900">
                          <span className="text-[10px] text-slate-500 uppercase block">Total Savings</span>
                          <span className="text-emerald-400 text-lg font-bold">
                            INR {detail.recommendation.savings_amount.toFixed(2)}
                          </span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-900">
                          <span className="text-[10px] text-slate-500 uppercase block">Variance Gap</span>
                          <span className="text-amber-400 text-lg font-bold">
                            {detail.recommendation.price_variance_percent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-900">
                          <span className="text-[10px] text-slate-500 uppercase block">Evaluated Options</span>
                          <span className="text-white text-lg font-bold">
                            {detailVendorIds.length} Suppliers
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CREATE COMPARISON SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  New Vendor Comparison Session
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Select an RFQ to automatically fetch all vendor quotations and compile a side-by-side commercial and technical comparison matrix.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Eligible RFQ
                </label>
                <select
                  id="create_comparison_rfq_select"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  defaultValue=""
                  onChange={(e) => {
                    const rfqId = e.target.value;
                    if (rfqId) {
                      handleCreateComparison(rfqId);
                    }
                  }}
                >
                  <option value="" disabled>Select a fully responded RFQ...</option>
                  {rfqCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rfq_number} - {r.department} ({r.project})
                    </option>
                  ))}
                </select>
              </div>

              {rfqCandidates.length === 0 && (
                <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/40 p-3 rounded-lg text-[11px] text-amber-400 leading-normal">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>No fully responded RFQs are available. Ensure vendors have submitted quotations on the RFQ.</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
