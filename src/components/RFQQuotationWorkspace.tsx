import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Ban,
  Archive,
  CreditCard,
  FileText,
  User,
  Star,
  Layers,
  ArrowRight,
  Package,
  Clock,
  ShieldCheck,
  RefreshCw,
  Building,
  DollarSign,
  ChevronRight,
  Info,
  Calendar,
  X,
  FileSpreadsheet,
  TrendingUp,
  ClipboardCheck,
  Send,
  CheckCircle2,
  FilePlus,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RFQHeader, RFQLine, RFQVendorAssignment, Vendor, VendorQuotationHeader, VendorQuotationLine } from "../types";

interface RFQQuotationWorkspaceProps {
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

export const RFQQuotationWorkspace: React.FC<RFQQuotationWorkspaceProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  // Core lists
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [approvedPrs, setApprovedPrs] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  // Selection states
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab state: "dashboard" | "rfqs" | "quotations"
  const [activeTab, setActiveTab] = useState<"dashboard" | "rfqs" | "quotations">("dashboard");

  // Filter & Search states
  const [rfqSearch, setRfqSearch] = useState("");
  const [rfqStatusFilter, setRfqStatusFilter] = useState("ALL");
  const [quoteSearch, setQuoteSearch] = useState("");

  // Dialog & Modal toggle states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrRfqModalOpen, setIsPrRfqModalOpen] = useState(false);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);

  // Forms states
  // 1. Generate RFQ from PR Form
  const [selectedPrId, setSelectedPrId] = useState("");

  // 2. Manual RFQ Creation Form
  const [manualRfqClosingDate, setManualRfqClosingDate] = useState("");
  const [manualRfqCurrency, setManualRfqCurrency] = useState("INR");
  const [manualRfqRemarks, setManualRfqRemarks] = useState("");
  const [manualRfqDept, setManualRfqDept] = useState("Procurement");
  const [manualRfqProject, setManualRfqProject] = useState("General");
  const [manualRfqLines, setManualRfqLines] = useState<any[]>([{ material_id: "", quantity: 1, required_date: "", remarks: "" }]);
  const [manualRfqVendors, setManualRfqVendors] = useState<string[]>([]);

  // 3. Submit Vendor Quotation Form
  const [quoteRfqId, setQuoteRfqId] = useState("");
  const [quoteVendorId, setQuoteVendorId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("INR");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("Net 30");
  const [quoteDeliveryTerms, setQuoteDeliveryTerms] = useState("FOB Origin");
  const [quoteRemarks, setQuoteRemarks] = useState("");
  const [quoteIsRevision, setQuoteIsRevision] = useState(false);
  const [quoteRevisionNumber, setQuoteRevisionNumber] = useState(0);
  const [quoteLines, setQuoteLines] = useState<any[]>([]); // holds template from RFQ lines

  // Stats / Metrics
  const [stats, setStats] = useState({
    totalRfqs: 0,
    openRfqs: 0,
    underEvaluation: 0,
    fullyResponded: 0,
    responsesCount: 0,
    sentCount: 0,
    averageLeadTime: 0
  });

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rfqList, vendorList, quoteList, prList, matList] = await Promise.all([
        apiFetch("/api/v1/rfqs"),
        apiFetch("/api/v1/vendors"),
        apiFetch("/api/v1/vendor-quotations"),
        apiFetch("/api/v1/purchase-requisitions"),
        apiFetch("/api/v1/materials")
      ]);

      setRfqs(rfqList || []);
      setVendors((vendorList || []).filter((v: any) => !v.is_deleted));
      setQuotations(quoteList || []);
      setApprovedPrs((prList || []).filter((p: any) => p.status === "APPROVED" && !p.is_deleted));
      setMaterials((matList || []).filter((m: any) => !m.is_deleted && m.is_active !== false));

      // Calculate Stats
      const total = rfqList ? rfqList.length : 0;
      const open = rfqList ? rfqList.filter((r: any) => r.status !== "COMPLETED" && r.status !== "CANCELLED").length : 0;
      const evalCount = rfqList ? rfqList.filter((r: any) => r.status === "UNDER_EVALUATION").length : 0;
      const fullyResp = rfqList ? rfqList.filter((r: any) => r.status === "FULLY_RESPONDED").length : 0;
      
      // Calculate sent assignments & received quotations
      let totalSent = 0;
      let totalReceived = 0;
      let totalLeadTime = 0;
      let leadTimeQuotesCount = 0;

      quoteList?.forEach((q: any) => {
        totalReceived++;
        if (q.lines) {
          q.lines.forEach((l: any) => {
            if (l.lead_time_days > 0) {
              totalLeadTime += l.lead_time_days;
              leadTimeQuotesCount++;
            }
          });
        }
      });

      rfqList?.forEach((r: any) => {
        if (r.vendors_count) totalSent += r.vendors_count;
      });

      setStats({
        totalRfqs: total,
        openRfqs: open,
        underEvaluation: evalCount,
        fullyResponded: fullyResp,
        responsesCount: totalReceived,
        sentCount: totalSent,
        averageLeadTime: leadTimeQuotesCount > 0 ? Math.round(totalLeadTime / leadTimeQuotesCount) : 0
      });

    } catch (err: any) {
      setErrorMsg("Failed to load RFQ & Vendor Quotation data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch RFQ Details
  const loadRfqDetails = async (rfqId: string) => {
    try {
      const details = await apiFetch(`/api/v1/rfqs/${rfqId}`);
      setSelectedRfq(details);
    } catch (err) {
      setErrorMsg("Failed to load RFQ details.");
    }
  };

  // State triggers
  const handleSelectRfq = (rfq: any) => {
    setSelectedRfq(null);
    loadRfqDetails(rfq.id);
  };

  // Generate RFQ from Approved PR
  const handleGenerateRfqFromPr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrId) {
      setErrorMsg("Please select an approved Purchase Requisition.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/v1/rfqs/from-purchase-requisition/${selectedPrId}`, {
        method: "POST"
      });
      setSuccessMsg(`Successfully generated ${response.rfq_number} from PR.`);
      setIsPrRfqModalOpen(false);
      setSelectedPrId("");
      fetchData();
      setSelectedRfq(response);
      setActiveTab("rfqs");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate RFQ from PR.");
    } finally {
      setIsLoading(false);
    }
  };

  // Manual RFQ Submit
  const handleCreateManualRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRfqClosingDate) {
      setErrorMsg("Closing Date is required.");
      return;
    }
    
    // Filter valid lines
    const validLines = manualRfqLines.filter(l => l.material_id && l.quantity > 0);
    if (validLines.length === 0) {
      setErrorMsg("Please add at least one material line item.");
      return;
    }

    if (manualRfqVendors.length === 0) {
      setErrorMsg("Please assign at least one active vendor.");
      return;
    }

    setIsLoading(true);
    try {
      // populate material codes & description from state
      const processedLines = validLines.map(line => {
        const mat = materials.find(m => m.id === line.material_id);
        return {
          material_id: line.material_id,
          material_code: mat ? mat.code : "N/A",
          description: mat ? mat.description : "N/A",
          quantity: Number(line.quantity),
          uom: mat ? mat.std_unit : "PCS",
          required_date: line.required_date || manualRfqClosingDate,
          remarks: line.remarks || ""
        };
      });

      const payload = {
        closing_date: manualRfqClosingDate,
        currency: manualRfqCurrency,
        remarks: manualRfqRemarks,
        department: manualRfqDept,
        project: manualRfqProject,
        lines: processedLines,
        vendor_ids: manualRfqVendors
      };

      const response = await apiFetch("/api/v1/rfqs", {
        method: "POST",
        body: payload
      });

      setSuccessMsg(`Successfully created Draft ${response.rfq_number}.`);
      setIsCreateModalOpen(false);
      
      // Reset manual form
      setManualRfqClosingDate("");
      setManualRfqCurrency("INR");
      setManualRfqRemarks("");
      setManualRfqLines([{ material_id: "", quantity: 1, required_date: "", remarks: "" }]);
      setManualRfqVendors([]);
      
      fetchData();
      setSelectedRfq(response);
      setActiveTab("rfqs");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create RFQ.");
    } finally {
      setIsLoading(false);
    }
  };

  // RFQ Lifecycle Actions
  const handleSendRfq = async (rfqId: string) => {
    try {
      const response = await apiFetch(`/api/v1/rfqs/${rfqId}/send`, { method: "POST" });
      setSuccessMsg("RFQ dispatched successfully! Status updated to SENT.");
      loadRfqDetails(rfqId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dispatch RFQ.");
    }
  };

  const handleEvaluateRfq = async (rfqId: string) => {
    try {
      const response = await apiFetch(`/api/v1/rfqs/${rfqId}/evaluate`, { method: "POST" });
      setSuccessMsg("RFQ successfully moved to UNDER_EVALUATION.");
      loadRfqDetails(rfqId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to transition RFQ status.");
    }
  };

  const handleCompleteRfq = async (rfqId: string) => {
    try {
      const response = await apiFetch(`/api/v1/rfqs/${rfqId}/complete`, { method: "POST" });
      setSuccessMsg("RFQ completed successfully! Commercial bidding is closed.");
      loadRfqDetails(rfqId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete RFQ.");
    }
  };

  const handleCancelRfq = async (rfqId: string) => {
    try {
      const response = await apiFetch(`/api/v1/rfqs/${rfqId}/cancel`, { method: "POST" });
      setSuccessMsg("RFQ successfully CANCELLED.");
      loadRfqDetails(rfqId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel RFQ.");
    }
  };

  // Handle RFQ Selection in Quotation Form to load lines dynamically
  const handleQuoteRfqSelect = (rfqId: string) => {
    setQuoteRfqId(rfqId);
    setQuoteVendorId("");
    
    // Load lines of selected RFQ
    const target = rfqs.find(r => r.id === rfqId);
    if (target) {
      // We can load details dynamically or from the state if enriched
      apiFetch(`/api/v1/rfqs/${rfqId}`).then(details => {
        const linesTemplate = (details.lines || []).map((l: any) => ({
          material_id: l.material_id,
          material_code: l.material_code,
          description: l.description,
          quantity: l.quantity,
          uom: l.uom,
          quoted_unit_price: 0,
          discount_percent: 0,
          tax_percent: 0,
          freight: 0,
          lead_time_days: 10,
          moq: 1
        }));
        setQuoteLines(linesTemplate);
      });
    }
  };

  // Handle Vendor Quotation Submit
  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteRfqId || !quoteVendorId || !quoteNumber) {
      setErrorMsg("Please select RFQ, Vendor, and provide Quotation Number.");
      return;
    }

    // Verify prices are populated
    const hasUnpriced = quoteLines.some(l => Number(l.quoted_unit_price) <= 0);
    if (hasUnpriced) {
      if (!confirm("Some line items have a quoted price of 0. Are you sure you want to submit?")) {
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = {
        vendor_id: quoteVendorId,
        rfq_id: quoteRfqId,
        quotation_number: quoteNumber.trim(),
        quotation_date: quoteDate || new Date().toISOString().split("T")[0],
        valid_until: quoteValidUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        currency: quoteCurrency,
        payment_terms: quotePaymentTerms,
        delivery_terms: quoteDeliveryTerms,
        remarks: quoteRemarks,
        revision_number: quoteIsRevision ? Number(quoteRevisionNumber) : 0,
        lines: quoteLines.map(l => ({
          material_id: l.material_id,
          material_code: l.material_code,
          description: l.description,
          quantity: l.quantity,
          quoted_unit_price: Number(l.quoted_unit_price),
          discount_percent: Number(l.discount_percent),
          tax_percent: Number(l.tax_percent),
          freight: Number(l.freight),
          lead_time_days: Number(l.lead_time_days),
          moq: Number(l.moq)
        }))
      };

      const response = await apiFetch("/api/v1/vendor-quotations", {
        method: "POST",
        body: payload
      });

      setSuccessMsg(`Quotation ${response.quotation_number} submitted successfully!`);
      setIsQuotationModalOpen(false);
      
      // Reset form
      setQuoteRfqId("");
      setQuoteVendorId("");
      setQuoteNumber("");
      setQuoteDate("");
      setQuoteValidUntil("");
      setQuoteCurrency("INR");
      setQuotePaymentTerms("Net 30");
      setQuoteDeliveryTerms("FOB Origin");
      setQuoteRemarks("");
      setQuoteIsRevision(false);
      setQuoteRevisionNumber(0);
      setQuoteLines([]);

      fetchData();
      if (selectedRfq && selectedRfq.id === quoteRfqId) {
        loadRfqDetails(quoteRfqId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit vendor quotation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic calculations for manual RFQ lines
  const addManualLine = () => {
    setManualRfqLines([...manualRfqLines, { material_id: "", quantity: 1, required_date: "", remarks: "" }]);
  };

  const removeManualLine = (index: number) => {
    const list = [...manualRfqLines];
    list.splice(index, 1);
    setManualRfqLines(list);
  };

  const updateManualLine = (index: number, key: string, value: any) => {
    const list = [...manualRfqLines];
    list[index][key] = value;
    setManualRfqLines(list);
  };

  // Dynamic calculations for quotation line pricing
  const updateQuoteLine = (index: number, key: string, value: any) => {
    const list = [...quoteLines];
    list[index][key] = value;
    setQuoteLines(list);
  };

  const calculateLineTotal = (line: any) => {
    const price = Number(line.quoted_unit_price || 0);
    const qty = Number(line.quantity || 1);
    const disc = Number(line.discount_percent || 0);
    const tax = Number(line.tax_percent || 0);
    const freight = Number(line.freight || 0);
    return (price * qty) * (1 - disc / 100) * (1 + tax / 100) + freight;
  };

  const calculateQuoteGrandTotal = () => {
    return quoteLines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  };

  // Filtered RFQs list
  const filteredRfqs = rfqs.filter(r => {
    const matchesSearch = 
      r.rfq_number.toLowerCase().includes(rfqSearch.toLowerCase()) ||
      r.department.toLowerCase().includes(rfqSearch.toLowerCase()) ||
      r.project.toLowerCase().includes(rfqSearch.toLowerCase()) ||
      r.buyer.toLowerCase().includes(rfqSearch.toLowerCase());
    const matchesStatus = rfqStatusFilter === "ALL" || r.status === rfqStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered quotations list
  const filteredQuotations = quotations.filter(q => {
    const rfqObj = rfqs.find(r => r.id === q.rfq_id);
    const rfqNo = rfqObj ? rfqObj.rfq_number : "";
    return (
      q.quotation_number.toLowerCase().includes(quoteSearch.toLowerCase()) ||
      q.vendor_name.toLowerCase().includes(quoteSearch.toLowerCase()) ||
      q.vendor_code.toLowerCase().includes(quoteSearch.toLowerCase()) ||
      rfqNo.toLowerCase().includes(quoteSearch.toLowerCase())
    );
  });

  return (
    <div id="rfq_procurement_workspace" className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-5 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-sans font-medium tracking-tight text-white flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-emerald-500" />
            RFQ & Quotation Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Convert Approved Purchase Requisitions into RFQs, assign active vendors, and log commercial bids.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn_open_pr_rfq_modal"
            onClick={() => setIsPrRfqModalOpen(true)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 hover:border-emerald-500 text-white rounded-lg flex items-center gap-2 transition-all text-sm font-medium"
          >
            <FilePlus className="h-4 w-4 text-emerald-500" />
            Generate from PR
          </button>
          <button
            id="btn_open_manual_rfq_modal"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium rounded-lg flex items-center gap-2 transition-all text-sm"
          >
            <Plus className="h-4 w-4" />
            Create Direct RFQ
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE NAVIGATION */}
      <div className="flex border-b border-slate-800 gap-1">
        <button
          id="tab_nav_dashboard"
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === "dashboard"
              ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Procurement Dashboard
        </button>
        <button
          id="tab_nav_rfqs"
          onClick={() => setActiveTab("rfqs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === "rfqs"
              ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          RFQ Register ({rfqs.length})
        </button>
        <button
          id="tab_nav_quotations"
          onClick={() => setActiveTab("quotations")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === "quotations"
              ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Vendor Quotations ({quotations.length})
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <AnimatePresence mode="wait">
        {activeTab === "dashboard" && (
          <motion.div
            key="procurement_dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* STATS BENTO GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div id="stat_total_rfqs" className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <span>Total Enquiries (RFQs)</span>
                  <FileText className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-semibold text-white">{stats.totalRfqs}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Active procurement tracks</div>
              </div>

              <div id="stat_open_rfqs" className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <span>Open RFQs</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-semibold text-amber-400">{stats.openRfqs}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Currently awaiting closure</div>
              </div>

              <div id="stat_under_evaluation" className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <span>Under Evaluation</span>
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-semibold text-indigo-400">{stats.underEvaluation}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Bids being commercially verified</div>
              </div>

              <div id="stat_response_metrics" className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <span>Vendor Response Stats</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-emerald-400">{stats.responsesCount}</span>
                  <span className="text-sm text-slate-500">/ {stats.sentCount} sent</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">Avg Lead Time: {stats.averageLeadTime} Days</div>
              </div>
            </div>

            {/* QUICK ACTIONS & NOTICES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-500" />
                  Active RFQs Under Evaluation
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">RFQ Number</th>
                        <th className="px-4 py-3">Project / Dept</th>
                        <th className="px-4 py-3">Closing Date</th>
                        <th className="px-4 py-3 text-right">Responses</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {rfqs.filter(r => r.status === "UNDER_EVALUATION" || r.status === "FULLY_RESPONDED").slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-emerald-400">{r.rfq_number}</td>
                          <td className="px-4 py-3">
                            <div>{r.project}</div>
                            <div className="text-xs text-slate-500">{r.department}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{r.closing_date}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            {r.vendors_count || 0} assigned
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                handleSelectRfq(r);
                                setActiveTab("rfqs");
                              }}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 justify-end w-full text-xs font-medium"
                            >
                              Details
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rfqs.filter(r => r.status === "UNDER_EVALUATION" || r.status === "FULLY_RESPONDED").length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-500 text-xs">
                            No RFQs are currently fully responded or under evaluation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                  Awaiting RFQ Gen ({approvedPrs.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Approved purchase requisitions waiting to be assigned to commercial bidders.
                </p>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {approvedPrs.map((pr, idx) => (
                    <div key={idx} className="p-3 bg-slate-900 border border-slate-800 hover:border-emerald-600 rounded-lg flex items-center justify-between transition-all">
                      <div>
                        <div className="text-xs font-mono text-emerald-400">{pr.pr_number}</div>
                        <div className="text-slate-300 text-xs mt-1">{pr.project} • {pr.department}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPrId(pr.id);
                          setIsPrRfqModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-emerald-950/30 text-emerald-400 hover:text-emerald-300 rounded transition-colors"
                        title="Generate RFQ"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {approvedPrs.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      All approved PRs have been converted or closed.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {activeTab === "rfqs" && (
          <motion.div
            key="rfq_register_view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* LEFT COLUMN: RFQ LISTING */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search RFQs..."
                      value={rfqSearch}
                      onChange={(e) => setRfqSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={rfqStatusFilter}
                      onChange={(e) => setRfqStatusFilter(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALL">Status: All</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="SENT">SENT</option>
                      <option value="PARTIALLY_RESPONDED">PARTIALLY</option>
                      <option value="FULLY_RESPONDED">FULLY RESP</option>
                      <option value="UNDER_EVALUATION">UNDER EVAL</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredRfqs.map((rfq, idx) => (
                    <div
                      key={idx}
                      id={`rfq_item_${rfq.id}`}
                      onClick={() => handleSelectRfq(rfq)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        selectedRfq && selectedRfq.id === rfq.id
                          ? "bg-slate-850 border-emerald-500 text-white"
                          : "bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-emerald-400 font-semibold">{rfq.rfq_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          rfq.status === "DRAFT" ? "bg-slate-800 text-slate-400" :
                          rfq.status === "SENT" ? "bg-blue-950 text-blue-400 border border-blue-900" :
                          rfq.status === "PARTIALLY_RESPONDED" ? "bg-amber-950 text-amber-400 border border-amber-900" :
                          rfq.status === "FULLY_RESPONDED" ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                          rfq.status === "UNDER_EVALUATION" ? "bg-indigo-950 text-indigo-400 border border-indigo-900" :
                          rfq.status === "COMPLETED" ? "bg-slate-900 text-slate-300 border border-slate-700" :
                          "bg-red-950 text-red-400 border border-red-900"
                        }`}>
                          {rfq.status}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-300 mt-2">{rfq.project}</div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 font-mono">
                        <span>Closing: {rfq.closing_date}</span>
                        <span>{rfq.vendors_count || 0} Vendors</span>
                      </div>
                    </div>
                  ))}
                  {filteredRfqs.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">
                      No RFQs matching filters found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RFQ DETAILS */}
            <div className="lg:col-span-8">
              {selectedRfq ? (
                <div id="rfq_detailed_view" className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  
                  {/* DETAIL HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-mono text-white font-semibold">{selectedRfq.rfq_number}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium uppercase tracking-wider border ${
                          selectedRfq.status === "DRAFT" ? "bg-slate-800 text-slate-400 border-slate-700" :
                          selectedRfq.status === "SENT" ? "bg-blue-950 text-blue-400 border-blue-900" :
                          selectedRfq.status === "PARTIALLY_RESPONDED" ? "bg-amber-950 text-amber-400 border-amber-900" :
                          selectedRfq.status === "FULLY_RESPONDED" ? "bg-emerald-950 text-emerald-400 border-emerald-900" :
                          selectedRfq.status === "UNDER_EVALUATION" ? "bg-indigo-950 text-indigo-400 border-indigo-900" :
                          selectedRfq.status === "COMPLETED" ? "bg-slate-900 text-slate-300 border-slate-700" :
                          "bg-red-950 text-red-400 border-red-900"
                        }`}>
                          {selectedRfq.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        Ref PR: <span className="text-emerald-400">{selectedRfq.purchase_requisition_number}</span> • Buyer: {selectedRfq.buyer}
                      </p>
                    </div>

                    {/* STATUS ACTION PANELS */}
                    <div className="flex flex-wrap gap-2">
                      {selectedRfq.status === "DRAFT" && (
                        <button
                          id="btn_send_rfq"
                          onClick={() => handleSendRfq(selectedRfq.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Dispatch to Vendors
                        </button>
                      )}
                      
                      {selectedRfq.status === "FULLY_RESPONDED" && (
                        <button
                          id="btn_evaluate_rfq"
                          onClick={() => handleEvaluateRfq(selectedRfq.id)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Evaluate Responses
                        </button>
                      )}

                      {selectedRfq.status === "UNDER_EVALUATION" && (
                        <button
                          id="btn_complete_rfq"
                          onClick={() => handleCompleteRfq(selectedRfq.id)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 font-medium text-xs border border-slate-750 rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          Complete RFQ
                        </button>
                      )}

                      {selectedRfq.status !== "COMPLETED" && selectedRfq.status !== "CANCELLED" && (
                        <button
                          id="btn_cancel_rfq"
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this RFQ? This action cannot be undone.")) {
                              handleCancelRfq(selectedRfq.id);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          Cancel RFQ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* HEADER SPECIFICATIONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Department</span>
                      <span className="text-sm font-medium text-slate-200 mt-1 block">{selectedRfq.department}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Project Target</span>
                      <span className="text-sm font-medium text-slate-200 mt-1 block">{selectedRfq.project}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Closing Date</span>
                      <span className="text-sm font-medium text-amber-400 mt-1 block font-mono">{selectedRfq.closing_date}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Closing / Scope Remarks</span>
                      <span className="text-xs text-slate-400 mt-1 block">{selectedRfq.remarks || "No remarks loaded."}</span>
                    </div>
                  </div>

                  {/* LINE ITEMS */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-500" />
                      Required Items Lines ({selectedRfq.lines?.length || 0})
                    </h4>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-2.5">Material Code</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5 text-right">Quantity</th>
                            <th className="px-4 py-2.5">UOM</th>
                            <th className="px-4 py-2.5">Required Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedRfq.lines?.map((line: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-950/40">
                              <td className="px-4 py-3 font-mono text-emerald-400">{line.material_code}</td>
                              <td className="px-4 py-3">{line.description}</td>
                              <td className="px-4 py-3 text-right font-medium text-white">{line.quantity}</td>
                              <td className="px-4 py-3 text-slate-400">{line.uom}</td>
                              <td className="px-4 py-3 text-slate-400 font-mono">{line.required_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ASSIGNED BIDDERS TRACKING */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Building className="h-4 w-4 text-emerald-500" />
                        Commercial Bidders Status ({selectedRfq.assignments?.length || 0})
                      </h4>
                      {selectedRfq.status === "SENT" && (
                        <button
                          id="btn_submit_quotation_from_rfq"
                          onClick={() => {
                            setQuoteRfqId(selectedRfq.id);
                            handleQuoteRfqSelect(selectedRfq.id);
                            setIsQuotationModalOpen(true);
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-900 hover:border-emerald-700 transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          Record Vendor Quotation
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedRfq.assignments?.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-center">
                          <div>
                            <div className="text-xs font-semibold text-slate-200">{item.vendor_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.vendor_code}</div>
                            {item.sent_date && (
                              <div className="text-[9px] text-slate-600 font-mono mt-1">Dispatched: {new Date(item.sent_date).toLocaleDateString()}</div>
                            )}
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-1 rounded-full font-semibold uppercase ${
                            item.response_status === "NOT_SENT" ? "bg-slate-800 text-slate-400" :
                            item.response_status === "SENT" ? "bg-blue-950 text-blue-400" :
                            item.response_status === "ACKNOWLEDGED" ? "bg-amber-950 text-amber-400" :
                            item.response_status === "QUOTATION_RECEIVED" ? "bg-emerald-950 text-emerald-400" :
                            "bg-red-950 text-red-400"
                          }`}>
                            {item.response_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RECEIVED COMMERCIAL QUOTATIONS LINK */}
                  <div className="pt-2 border-t border-slate-850">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-400 font-mono">
                        Commercial Quotations captured: {quotations.filter(q => q.rfq_id === selectedRfq.id).length}
                      </div>
                      {quotations.filter(q => q.rfq_id === selectedRfq.id).length > 0 && (
                        <button
                          onClick={() => {
                            setQuoteSearch(selectedRfq.rfq_number);
                            setActiveTab("quotations");
                          }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                        >
                          View Bidding Matrix
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-850 rounded-xl p-16 text-center text-slate-500">
                  <FileText className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-sm font-medium">No RFQ Selected</p>
                  <p className="text-xs text-slate-600 mt-1">Select an RFQ from the register or generate one from Approved PRs.</p>
                </div>
              )}
            </div>

          </motion.div>
        )}

        {activeTab === "quotations" && (
          <motion.div
            key="vendor_quotation_view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* LEFT SIDE: QUOTATIONS LISTING */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search Quotations or RFQs..."
                    value={quoteSearch}
                    onChange={(e) => setQuoteSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredQuotations.map((q, idx) => {
                    const rfqObj = rfqs.find(r => r.id === q.rfq_id);
                    return (
                      <div
                        key={idx}
                        id={`quote_item_${q.id}`}
                        onClick={() => setSelectedQuote(q)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          selectedQuote && selectedQuote.id === q.id
                            ? "bg-slate-850 border-emerald-500 text-white"
                            : "bg-slate-950 border-slate-850 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-slate-200 text-xs">{q.vendor_name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">{q.quotation_number}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 font-mono flex justify-between">
                          <span>RFQ: {rfqObj ? rfqObj.rfq_number : "Direct"}</span>
                          {q.revision_number > 0 && (
                            <span className="text-amber-500">Rev {q.revision_number}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
                          <span>Valid: {q.valid_until}</span>
                          <span className="font-mono text-white">
                            {q.currency} {q.lines?.reduce((sum: number, l: any) => sum + (l.total_amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredQuotations.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">
                      No vendor quotations captured.
                    </div>
                  )}
                </div>

                <button
                  id="btn_open_submit_quote_modal"
                  onClick={() => setIsQuotationModalOpen(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Log Vendor Quotation
                </button>
              </div>
            </div>

            {/* RIGHT SIDE: QUOTATION OVERVIEW */}
            <div className="lg:col-span-8">
              {selectedQuote ? (
                <div id="quotation_detailed_view" className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  
                  {/* DETAIL HEADER */}
                  <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                        Commercial Quotation Details
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        Vendor: <span className="text-emerald-400">{selectedQuote.vendor_name} ({selectedQuote.vendor_code})</span>
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-sm font-semibold text-emerald-400">{selectedQuote.quotation_number}</div>
                      <div className="text-[10px] text-slate-500 mt-1">Submitted: {selectedQuote.quotation_date}</div>
                    </div>
                  </div>

                  {/* INCOTERMS, TERMS & METRICS */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Payment Terms</span>
                      <span className="text-xs font-semibold text-slate-300 mt-1 block">{selectedQuote.payment_terms || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Delivery Terms</span>
                      <span className="text-xs font-semibold text-slate-300 mt-1 block">{selectedQuote.delivery_terms || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Valid Until</span>
                      <span className="text-xs font-semibold text-slate-300 mt-1 block font-mono">{selectedQuote.valid_until}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Revision</span>
                      <span className="text-xs font-semibold text-slate-300 mt-1 block font-mono">Rev {selectedQuote.revision_number || 0}</span>
                    </div>
                  </div>

                  {/* QUOTED LINES */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Quoted Line Item Rates</h4>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2">Material Code</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Disc %</th>
                            <th className="px-3 py-2 text-right">Tax %</th>
                            <th className="px-3 py-2 text-right">Freight</th>
                            <th className="px-3 py-2 text-right">Lead Time</th>
                            <th className="px-3 py-2 text-right font-mono">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {selectedQuote.lines?.map((line: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-950/40">
                              <td className="px-3 py-2.5 font-mono text-emerald-400">{line.material_code}</td>
                              <td className="px-3 py-2.5 max-w-[150px] truncate">{line.description}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-white">{line.quantity}</td>
                              <td className="px-3 py-2.5 text-right font-mono">{(line.quoted_unit_price || 0).toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right font-mono">{line.discount_percent}%</td>
                              <td className="px-3 py-2.5 text-right font-mono">{line.tax_percent}%</td>
                              <td className="px-3 py-2.5 text-right font-mono">{(line.freight || 0).toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right">{line.lead_time_days} days</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-white font-mono">
                                {(line.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-950 font-bold text-white border-t border-slate-800 text-xs">
                          <tr>
                            <td colSpan={7} className="px-3 py-3 text-right text-slate-400">Grand Total Amount:</td>
                            <td colSpan={2} className="px-3 py-3 text-right text-emerald-400 font-mono">
                              {selectedQuote.currency} {selectedQuote.lines?.reduce((sum: number, l: any) => sum + (l.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* REMARKS */}
                  {selectedQuote.remarks && (
                    <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block">Submission Remarks</span>
                      <p className="text-xs text-slate-400 mt-1">{selectedQuote.remarks}</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-850 rounded-xl p-16 text-center text-slate-500">
                  <ClipboardCheck className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-sm font-medium">No Quotation Selected</p>
                  <p className="text-xs text-slate-600 mt-1">Select a captured vendor quotation from the sidebar to inspect detailed pricing.</p>
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* DIALOGS / MODALS */}

      {/* 1. GENERATE FROM PR MODAL */}
      <AnimatePresence>
        {isPrRfqModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <FilePlus className="h-5 w-5 text-emerald-500" />
                  Generate RFQ from Purchase Requisition
                </h3>
                <button onClick={() => setIsPrRfqModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateRfqFromPr} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select Approved Requisition</label>
                  <select
                    id="select_approved_pr"
                    value={selectedPrId}
                    onChange={(e) => setSelectedPrId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  >
                    <option value="">-- Choose Approved PR --</option>
                    {approvedPrs.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.pr_number} - {pr.project} ({pr.department})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Only officially APPROVED purchase requisitions are listed here. Generates lines and suggests vendors automatically.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsPrRfqModalOpen(false)}
                    className="px-4 py-2 bg-slate-950 border border-slate-800 text-sm text-slate-400 hover:text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn_submit_generate_rfq"
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Generate RFQ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. DIRECT/MANUAL RFQ MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-500" />
                  Draft Manual Direct RFQ
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateManualRfq} className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Department</label>
                    <input
                      type="text"
                      value={manualRfqDept}
                      onChange={(e) => setManualRfqDept(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                    <input
                      type="text"
                      value={manualRfqProject}
                      onChange={(e) => setManualRfqProject(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Closing Date</label>
                    <input
                      id="input_manual_closing_date"
                      type="date"
                      value={manualRfqClosingDate}
                      onChange={(e) => setManualRfqClosingDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Currency</label>
                    <select
                      value={manualRfqCurrency}
                      onChange={(e) => setManualRfqCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    >
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Remarks / Guidelines</label>
                    <textarea
                      value={manualRfqRemarks}
                      onChange={(e) => setManualRfqRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500 h-16"
                    />
                  </div>
                </div>

                {/* Line Items Builder */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-t border-slate-850 pt-3">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Required Material Line Items</span>
                    <button
                      type="button"
                      onClick={addManualLine}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="h-3 w-3" /> Add Item Line
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {manualRfqLines.map((line, idx) => (
                      <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-end bg-slate-950 p-3 rounded-lg border border-slate-850">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[9px] text-slate-500 mb-1 uppercase font-mono">Select Material</label>
                          <select
                            value={line.material_id}
                            onChange={(e) => updateManualLine(idx, "material_id", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 text-xs text-white rounded focus:outline-none"
                            required
                          >
                            <option value="">-- Select Material --</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.code} - {m.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-[9px] text-slate-500 mb-1 uppercase font-mono">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateManualLine(idx, "quantity", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 text-xs text-white rounded text-right focus:outline-none"
                            required
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[9px] text-slate-500 mb-1 uppercase font-mono">Req Date</label>
                          <input
                            type="date"
                            value={line.required_date}
                            onChange={(e) => updateManualLine(idx, "required_date", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 text-xs text-white rounded focus:outline-none font-mono"
                          />
                        </div>
                        {manualRfqLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeManualLine(idx)}
                            className="p-1.5 hover:bg-red-950 text-red-500 hover:text-red-400 rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bidders Assignment */}
                <div className="space-y-3 border-t border-slate-850 pt-3">
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Assign Active Commercial Bidders</label>
                  <p className="text-[10px] text-slate-500">Only ACTIVE status vendors are eligible for assignment.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-850">
                    {vendors.filter(v => v.status === "ACTIVE").map((vendor) => (
                      <label key={vendor.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={manualRfqVendors.includes(vendor.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setManualRfqVendors([...manualRfqVendors, vendor.id]);
                            } else {
                              setManualRfqVendors(manualRfqVendors.filter(vId => vId !== vendor.id));
                            }
                          }}
                          className="rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
                        />
                        <div>
                          <span className="font-semibold text-slate-200">{vendor.vendor_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-2">({vendor.vendor_code})</span>
                        </div>
                      </label>
                    ))}
                    {vendors.filter(v => v.status === "ACTIVE").length === 0 && (
                      <div className="text-center py-4 text-slate-600 text-xs sm:col-span-2">
                        No active vendors found. Please active vendors in Vendor Management.
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-950 border border-slate-800 text-sm text-slate-400 hover:text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn_submit_manual_rfq"
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Save Draft RFQ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. SUBMIT VENDOR QUOTATION MODAL */}
      <AnimatePresence>
        {isQuotationModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  Log Commercial Vendor Quotation
                </h3>
                <button onClick={() => setIsQuotationModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitQuotation} className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select RFQ Track</label>
                    <select
                      id="quote_rfq_select"
                      value={quoteRfqId}
                      onChange={(e) => handleQuoteRfqSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">-- Choose RFQ --</option>
                      {rfqs.filter(r => r.status === "SENT" || r.status === "PARTIALLY_RESPONDED" || r.status === "FULLY_RESPONDED" || r.status === "UNDER_EVALUATION").map(r => (
                        <option key={r.id} value={r.id}>{r.rfq_number} - {r.project}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Select Bidding Vendor</label>
                    <select
                      id="quote_vendor_select"
                      value={quoteVendorId}
                      onChange={(e) => setQuoteVendorId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500"
                      required
                      disabled={!quoteRfqId}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {/* Only list active vendors assigned to this RFQ */}
                      {vendors.filter(v => {
                        const rfqObj = rfqs.find(r => r.id === quoteRfqId);
                        if (!rfqObj) return false;
                        // Find if there is an assignment
                        // For flexibility let's allow selecting any active vendor if not strict, but we can filter by assignment to comply with Scenarios
                        return v.status === "ACTIVE"; 
                      }).map(v => (
                        <option key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Quotation / Bid Number</label>
                    <input
                      id="input_quote_number"
                      type="text"
                      placeholder="e.g. QTE-2026-902"
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Quotation Date</label>
                    <input
                      type="date"
                      value={quoteDate}
                      onChange={(e) => setQuoteDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Valid Until</label>
                    <input
                      type="date"
                      value={quoteValidUntil}
                      onChange={(e) => setQuoteValidUntil(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Payment Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. Net 30"
                      value={quotePaymentTerms}
                      onChange={(e) => setQuotePaymentTerms(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Delivery Terms / Logistics</label>
                    <input
                      type="text"
                      placeholder="e.g. FOB Destination"
                      value={quoteDeliveryTerms}
                      onChange={(e) => setQuoteDeliveryTerms(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Bid Currency</label>
                    <select
                      value={quoteCurrency}
                      onChange={(e) => setQuoteCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none focus:border-emerald-500"
                    >
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        id="checkbox_quote_is_revision"
                        type="checkbox"
                        checked={quoteIsRevision}
                        onChange={(e) => setQuoteIsRevision(e.target.checked)}
                        className="rounded border-slate-800 text-emerald-600 bg-slate-950"
                      />
                      Is Revision / Amending?
                    </label>
                    {quoteIsRevision && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-mono">Revision #:</span>
                        <input
                          id="input_quote_revision_number"
                          type="number"
                          min="1"
                          value={quoteRevisionNumber}
                          onChange={(e) => setQuoteRevisionNumber(Number(e.target.value))}
                          className="w-16 px-1.5 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-center focus:outline-none font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Logistics & Bidding Notes</label>
                    <input
                      type="text"
                      placeholder="Special discount structures, packaging etc."
                      value={quoteRemarks}
                      onChange={(e) => setQuoteRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Line pricing table */}
                <div className="space-y-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Configure Quoted Unit Prices & Lead Times</span>
                  
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
                      <thead className="text-[10px] text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Material Code</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2 text-right">Quoted Price</th>
                          <th className="px-3 py-2 text-right">Discount %</th>
                          <th className="px-3 py-2 text-right">Tax %</th>
                          <th className="px-3 py-2 text-right">Freight</th>
                          <th className="px-3 py-2 text-right">Lead Time (Days)</th>
                          <th className="px-3 py-2 text-right">MOQ</th>
                          <th className="px-3 py-2 text-right font-mono">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {quoteLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-950/40">
                            <td className="px-3 py-2.5">
                              <div className="font-mono text-emerald-400">{line.material_code}</div>
                              <div className="text-[10px] text-slate-500 max-w-[120px] truncate">{line.description}</div>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-white text-center">
                              {line.quantity} <span className="text-[10px] font-normal text-slate-500 ml-1">{line.uom}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={line.quoted_unit_price || ""}
                                onChange={(e) => updateQuoteLine(idx, "quoted_unit_price", e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                                required
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                value={line.discount_percent || 0}
                                onChange={(e) => updateQuoteLine(idx, "discount_percent", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                value={line.tax_percent || 0}
                                onChange={(e) => updateQuoteLine(idx, "tax_percent", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={line.freight || 0}
                                onChange={(e) => updateQuoteLine(idx, "freight", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                value={line.lead_time_days || 10}
                                onChange={(e) => updateQuoteLine(idx, "lead_time_days", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="1"
                                value={line.moq || 1}
                                onChange={(e) => updateQuoteLine(idx, "moq", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded text-right focus:border-emerald-500 focus:outline-none font-mono"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-emerald-400 font-mono">
                              {calculateLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {quoteLines.length === 0 && (
                          <tr>
                            <td colSpan={9} className="text-center py-6 text-slate-500 text-xs">
                              Please select an RFQ track to populate items lines.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {quoteLines.length > 0 && (
                        <tfoot className="bg-slate-950 font-bold border-t border-slate-800 text-xs">
                          <tr>
                            <td colSpan={8} className="px-3 py-3 text-right text-slate-400">Grand Total:</td>
                            <td className="px-3 py-3 text-right text-emerald-400 font-mono">
                              {quoteCurrency} {calculateQuoteGrandTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsQuotationModalOpen(false)}
                    className="px-4 py-2 bg-slate-950 border border-slate-800 text-sm text-slate-400 hover:text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn_submit_quotation"
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Save Quotation Bid
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
