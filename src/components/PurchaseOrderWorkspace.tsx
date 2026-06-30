import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Eye,
  Printer,
  Edit2,
  Trash2,
  User,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  FileCheck,
  RotateCcw,
  Check,
  AlertCircle,
  Clock
} from "lucide-react";
import { PurchaseOrderHeader, PurchaseOrderLine, VendorAcknowledgement, PurchaseOrderRevision } from "../types";

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function PurchaseOrderWorkspace({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}: Props) {
  // Tabs: "REGISTER" | "CREATOR" | "PRINT_PREVIEW"
  const [activeTab, setActiveTab] = useState<"REGISTER" | "CREATOR" | "PRINT_PREVIEW">("REGISTER");

  // State arrays
  const [purchaseOrders, setPurchaseOrders] = useState<(PurchaseOrderHeader & { vendor_name: string; vendor_code: string })[]>([]);
  const [selectedPo, setSelectedPo] = useState<(PurchaseOrderHeader & {
    vendor_name: string;
    vendor_code: string;
    lines: PurchaseOrderLine[];
    acknowledgements: VendorAcknowledgement[];
    revisions: PurchaseOrderRevision[];
  }) | null>(null);

  const [approvedComparisons, setApprovedComparisons] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("");

  // Loading
  const [loading, setLoading] = useState(false);

  // Manual PO builder state
  const [manualVendorId, setManualVendorId] = useState("");
  const [manualCurrency, setManualCurrency] = useState("INR");
  const [manualPaymentTerms, setManualPaymentTerms] = useState("Net 30");
  const [manualDeliveryTerms, setManualDeliveryTerms] = useState("Ex-Works");
  const [manualIncoterms, setManualIncoterms] = useState("FOB");
  const [manualDeliveryAddress, setManualDeliveryAddress] = useState("CCS SPACEMAKER Factory, Gurgaon");
  const [manualBillingAddress, setManualBillingAddress] = useState("CCS SPACEMAKER SI PVT LTD, Gurgaon");
  const [manualExpectedDeliveryDate, setManualExpectedDeliveryDate] = useState("");
  const [manualRemarks, setManualRemarks] = useState("");
  const [manualLines, setManualLines] = useState<Partial<PurchaseOrderLine>[]>([
    { material_id: "", material_code: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 18, freight: 0, uom: "PCS" }
  ]);

  // Acknowledgement form state
  const [ackStatus, setAckStatus] = useState<"ACCEPTED" | "ACCEPTED_WITH_COMMENTS" | "CHANGES_REQUESTED" | "DECLINED">("ACCEPTED");
  const [ackComments, setAckComments] = useState("");
  const [ackContact, setAckContact] = useState("");

  // Revision form state
  const [revisionSummary, setRevisionSummary] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  // Print state
  const [printData, setPrintData] = useState<any>(null);

  // Fetch metrics helper
  const openPOs = purchaseOrders.filter(po => ["DRAFT", "UNDER_REVIEW"].includes(po.status)).length;
  const issuedPOs = purchaseOrders.filter(po => po.status === "ISSUED").length;
  const acknowledgedPOs = purchaseOrders.filter(po => po.status === "ACKNOWLEDGED").length;
  const outstandingPOs = purchaseOrders.filter(po => ["ISSUED", "ACKNOWLEDGED", "UNDER_REVIEW"].includes(po.status)).length;

  useEffect(() => {
    fetchPurchaseOrders();
    fetchApprovedComparisons();
    fetchMaterials();
    fetchVendors();
  }, []);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/purchase-orders");
      setPurchaseOrders(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to retrieve purchase orders.");
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedComparisons = async () => {
    try {
      const data = await apiFetch("/api/v1/vendor-comparisons");
      const approved = (data || []).filter((c: any) => c.status === "APPROVED" || c.status === "COMPLETED");
      setApprovedComparisons(approved);
    } catch (err) {}
  };

  const fetchMaterials = async () => {
    try {
      const data = await apiFetch("/api/v1/materials");
      setMaterials(data || []);
    } catch (err) {}
  };

  const fetchVendors = async () => {
    try {
      const data = await apiFetch("/api/v1/vendors");
      setVendors(data || []);
    } catch (err) {}
  };

  const handleSelectPo = async (poId: string) => {
    setLoading(true);
    try {
      const detailed = await apiFetch(`/api/v1/purchase-orders/${poId}`);
      setSelectedPo(detailed);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch purchase order details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromComparison = async (comparisonId: string, customVendorId?: string) => {
    setLoading(true);
    try {
      const payload: any = {};
      if (customVendorId) {
        payload.vendor_id = customVendorId;
      }
      const newPo = await apiFetch(`/api/v1/purchase-orders/from-comparison/${comparisonId}`, {
        method: "POST",
        body: payload
      });
      setSuccessMsg(`Successfully generated Purchase Order: ${newPo.po_number}`);
      fetchPurchaseOrders();
      handleSelectPo(newPo.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create Purchase Order from comparison recommendation.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVendorId) {
      setErrorMsg("Please select a vendor.");
      return;
    }
    const cleanLines = manualLines.filter(l => l.material_id && l.quantity && l.quantity > 0);
    if (cleanLines.length === 0) {
      setErrorMsg("PO must contain at least one valid material line with a quantity greater than zero.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        vendor_id: manualVendorId,
        currency: manualCurrency,
        payment_terms: manualPaymentTerms,
        delivery_terms: manualDeliveryTerms,
        incoterms: manualIncoterms,
        delivery_address: manualDeliveryAddress,
        billing_address: manualBillingAddress,
        expected_delivery_date: manualExpectedDeliveryDate || new Date(Date.now() + 14*24*3600*1000).toISOString().split("T")[0],
        remarks: manualRemarks,
        lines: cleanLines
      };

      const newPo = await apiFetch("/api/v1/purchase-orders", {
        method: "POST",
        body: payload
      });

      setSuccessMsg(`Purchase Order ${newPo.po_number} created successfully as DRAFT.`);
      setErrorMsg(null);
      fetchPurchaseOrders();
      handleSelectPo(newPo.id);
      setActiveTab("REGISTER");

      // Reset manual builder state
      setManualVendorId("");
      setManualLines([{ material_id: "", material_code: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 18, freight: 0, uom: "PCS" }]);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit manual purchase order.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePO = async () => {
    if (!selectedPo) return;
    setLoading(true);
    try {
      const payload = {
        currency: selectedPo.currency,
        payment_terms: selectedPo.payment_terms,
        delivery_terms: selectedPo.delivery_terms,
        incoterms: selectedPo.incoterms,
        delivery_address: selectedPo.delivery_address,
        billing_address: selectedPo.billing_address,
        expected_delivery_date: selectedPo.expected_delivery_date,
        remarks: selectedPo.remarks,
        lines: selectedPo.lines
      };

      const updated = await apiFetch(`/api/v1/purchase-orders/${selectedPo.id}`, {
        method: "PUT",
        body: payload
      });

      setSuccessMsg(`Successfully saved edits for ${updated.po_number}.`);
      setErrorMsg(null);
      fetchPurchaseOrders();
      handleSelectPo(selectedPo.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update Purchase Order details.");
    } finally {
      setLoading(false);
    }
  };

  const handleLifecycleAction = async (poId: string, action: "submit" | "approve" | "issue" | "cancel") => {
    setLoading(true);
    try {
      await apiFetch(`/api/v1/purchase-orders/${poId}/${action}`, {
        method: "POST"
      });
      setSuccessMsg(`Purchase Order status successfully updated via lifecycle transition: ${action.toUpperCase()}`);
      setErrorMsg(null);
      fetchPurchaseOrders();
      handleSelectPo(poId);
    } catch (err: any) {
      setErrorMsg(err.message || `Action '${action}' failed on this purchase order.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAcknowledgement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    setLoading(true);
    try {
      await apiFetch(`/api/v1/purchase-orders/${selectedPo.id}/acknowledge`, {
        method: "POST",
        body: {
          acknowledgement_status: ackStatus,
          comments: ackComments,
          contact_person: ackContact
        }
      });
      setSuccessMsg(`Acknowledgement successfully recorded: Vendor status updated.`);
      setAckComments("");
      setAckContact("");
      fetchPurchaseOrders();
      handleSelectPo(selectedPo.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record vendor acknowledgement.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    if (!revisionSummary) {
      setErrorMsg("Please provide a brief revision summary.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/api/v1/purchase-orders/${selectedPo.id}/revise`, {
        method: "POST",
        body: {
          change_summary: revisionSummary
        }
      });
      setSuccessMsg(`Purchase Order revised to new Revision. Previous revision locked.`);
      setErrorMsg(null);
      setRevisionSummary("");
      setShowRevisionModal(false);
      fetchPurchaseOrders();
      handleSelectPo(selectedPo.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revise Purchase Order.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPreview = async (poId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/purchase-orders/${poId}/print`);
      setPrintData(data);
      setActiveTab("PRINT_PREVIEW");
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate print layout.");
    } finally {
      setLoading(false);
    }
  };

  // Manual PO Line item utilities
  const handleAddManualLine = () => {
    setManualLines([
      ...manualLines,
      { material_id: "", material_code: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 18, freight: 0, uom: "PCS" }
    ]);
  };

  const handleRemoveManualLine = (index: number) => {
    setManualLines(manualLines.filter((_, i) => i !== index));
  };

  const handleManualLineChange = (index: number, field: keyof PurchaseOrderLine, value: any) => {
    const updated = [...manualLines];
    if (field === "material_id") {
      const selectedMat = materials.find(m => m.id === value);
      updated[index] = {
        ...updated[index],
        material_id: value,
        material_code: selectedMat ? selectedMat.code : "",
        description: selectedMat ? selectedMat.description : "",
        unit_price: selectedMat ? (selectedMat.last_rate || 0) : 0,
        uom: selectedMat ? (selectedMat.std_unit || "PCS") : "PCS"
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    setManualLines(updated);
  };

  // Filter lists
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          po.vendor_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? po.status === statusFilter : true;
    const matchesVendor = vendorFilter ? po.vendor_id === vendorFilter : true;
    const matchesBuyer = buyerFilter ? po.buyer.toLowerCase().includes(buyerFilter.toLowerCase()) : true;
    return matchesSearch && matchesStatus && matchesVendor && matchesBuyer;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-semibold">DRAFT</span>;
      case "UNDER_REVIEW":
        return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-semibold">UNDER_REVIEW</span>;
      case "APPROVED":
        return <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-semibold">APPROVED</span>;
      case "ISSUED":
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold text-center uppercase tracking-wider">ISSUED</span>;
      case "ACKNOWLEDGED":
        return <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs font-semibold">ACKNOWLEDGED</span>;
      case "CANCELLED":
        return <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs font-semibold">CANCELLED</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" id="po-workspace-container">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            Purchase Order Management Workspace
          </h1>
          <p className="text-sm text-slate-500">
            Sprint 4E: Legally binding PO creation, lifecycle governance, audit trails, and professional printing layouts.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <button
            id="tab-btn-register"
            onClick={() => setActiveTab("REGISTER")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "REGISTER"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            PO Register & Lifecycle
          </button>
          <button
            id="tab-btn-creator"
            onClick={() => setActiveTab("CREATOR")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "CREATOR"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            Create PO Manually
          </button>
        </div>
      </div>

      {/* PROCUREMENT EXECUTIVE METRICS DASHBOARD */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="procurement-metrics-dashboard">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total POs</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-slate-800">{purchaseOrders.length}</span>
            <span className="text-xs text-slate-400 font-medium">Platform</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Open Drafts</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-600">{openPOs}</span>
            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Pending</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Issued POs</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-600">{issuedPOs}</span>
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">To Vendors</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Acknowledged</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-600">{acknowledgedPOs}</span>
            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Legally Bound</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Outstanding POs</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-slate-900">{outstandingPOs}</span>
            <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">In-Progress</span>
          </div>
        </div>
      </div>

      {/* ACTIVE VIEWPORTS */}
      {activeTab === "REGISTER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="viewport-register">
          
          {/* LEFT: PURCHASE ORDER REGISTER */}
          <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                Purchase Order Registry
              </h2>
              <button
                onClick={fetchPurchaseOrders}
                className="text-slate-500 hover:text-emerald-600 p-1 rounded hover:bg-slate-50 transition"
                title="Refresh PO List"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* SELECTION ENGINE: CREATE PO FROM APPROVED COMPARISONS */}
            {approvedComparisons.length > 0 && (
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 space-y-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Convert Approved Vendor Comparison
                </span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {approvedComparisons.map((c) => {
                    // Check if this comparison already has a generated PO
                    const hasPO = purchaseOrders.some(po => po.vendor_comparison_id === c.id);
                    if (hasPO) return null;

                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between bg-white p-2 rounded border border-emerald-100 text-xs hover:border-emerald-300 transition"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800">{c.comparison_number}</p>
                          <p className="text-[10px] text-slate-400">Date: {c.comparison_date} | Buyer: {c.buyer}</p>
                        </div>
                        <button
                          id={`btn-convert-${c.id}`}
                          onClick={() => handleCreateFromComparison(c.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-2.5 rounded text-[10px] transition flex items-center gap-1"
                        >
                          Generate PO
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  {approvedComparisons.every(c => purchaseOrders.some(po => po.vendor_comparison_id === c.id)) && (
                    <p className="text-[10px] text-slate-400 italic">All approved comparisons have been converted.</p>
                  )}
                </div>
              </div>
            )}

            {/* FILTERS */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by PO# or vendor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div>
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none text-xs"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* REGISTER LIST */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" id="po-registry-list">
              {filteredPOs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-150">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No purchase orders located</p>
                </div>
              ) : (
                filteredPOs.map((po) => {
                  const isSelected = selectedPo?.id === po.id;
                  return (
                    <div
                      key={po.id}
                      id={`po-card-${po.po_number}`}
                      onClick={() => handleSelectPo(po.id)}
                      className={`p-3 rounded-lg border transition cursor-pointer text-xs space-y-2 ${
                        isSelected
                          ? "bg-slate-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/15"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm">{po.po_number}</span>
                        {getStatusBadge(po.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <div>
                          <span className="font-medium text-slate-400">Vendor:</span> <span className="text-slate-700 font-semibold">{po.vendor_name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">Total:</span> <span className="text-slate-800 font-bold">{po.currency} {po.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">Date:</span> <span>{po.po_date}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">Rev:</span> <span className="bg-slate-100 text-slate-700 px-1 rounded font-bold">R{po.revision_number}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: PURCHASE ORDER DETAILS VIEW & ACTION COMPOSER */}
          <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-6" id="po-details-pane">
            {!selectedPo ? (
              <div className="p-16 text-center text-slate-400 space-y-3">
                <FileText className="h-12 w-12 text-slate-200 mx-auto" />
                <h3 className="text-base font-semibold text-slate-600">No Purchase Order Selected</h3>
                <p className="text-xs max-w-sm mx-auto text-slate-400">
                  Select a purchase order from the registry list, or convert an approved vendor comparison recommendation to preview PO headers, lines, lifecycle governance steps, and audit workflows.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Header info bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-150 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800">{selectedPo.po_number}</h2>
                      <span className="bg-slate-100 text-slate-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                        Rev {selectedPo.revision_number}
                      </span>
                      {getStatusBadge(selectedPo.status)}
                    </div>
                    <p className="text-xs text-slate-400">
                      Created on {selectedPo.po_date} | Buyer: {selectedPo.buyer}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 self-start sm:self-center">
                    <button
                      id="btn-print-preview"
                      onClick={() => handlePrintPreview(selectedPo.id)}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1.5 transition"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Preview
                    </button>
                    {/* Status lifecycle actions */}
                    {selectedPo.status === "DRAFT" && (
                      <button
                        id="btn-po-submit"
                        onClick={() => handleLifecycleAction(selectedPo.id, "submit")}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-3 rounded text-xs flex items-center gap-1.5 transition"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit for Approval
                      </button>
                    )}
                    {selectedPo.status === "UNDER_REVIEW" && authState.role === "L2-Admin" && (
                      <button
                        id="btn-po-approve"
                        onClick={() => handleLifecycleAction(selectedPo.id, "approve")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs flex items-center gap-1.5 transition"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve PO
                      </button>
                    )}
                    {selectedPo.status === "APPROVED" && (
                      <button
                        id="btn-po-issue"
                        onClick={() => handleLifecycleAction(selectedPo.id, "issue")}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-xs flex items-center gap-1.5 transition"
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        Issue to Vendor
                      </button>
                    )}
                    {/* Revision triggering */}
                    {["APPROVED", "ISSUED", "ACKNOWLEDGED"].includes(selectedPo.status) && (
                      <button
                        id="btn-po-trigger-revise"
                        onClick={() => setShowRevisionModal(true)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded text-xs flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Revise PO
                      </button>
                    )}
                    {selectedPo.status !== "CANCELLED" && (
                      <button
                        id="btn-po-cancel"
                        onClick={() => handleLifecycleAction(selectedPo.id, "cancel")}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-1.5 px-3 rounded text-xs flex items-center gap-1 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Header Information Sheet */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Vendor Target</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedPo.vendor_name}</p>
                    <p className="text-[10px] text-slate-400">Code: {selectedPo.vendor_code}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Total Committment</span>
                    <p className="font-bold text-emerald-700 text-sm mt-0.5">
                      {selectedPo.currency} {selectedPo.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-slate-400">VAT & Freight Included</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Expected Delivery</span>
                    <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      {selectedPo.expected_delivery_date}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Payment Terms</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{selectedPo.payment_terms}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Delivery & Incoterms</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{selectedPo.delivery_terms} ({selectedPo.incoterms})</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Linked References</span>
                    <p className="font-semibold text-slate-600 mt-0.5 truncate" title={`Comparison: ${selectedPo.vendor_comparison_id}`}>
                      VC: {selectedPo.vendor_comparison_id ? "Active Matrix" : "Manual Direct"}
                    </p>
                  </div>
                </div>

                {/* PO lines details table */}
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                    Purchase Order Lines
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="p-2 font-bold">Material Code</th>
                          <th className="p-2 font-bold">Description</th>
                          <th className="p-2 font-bold text-right">Quantity</th>
                          <th className="p-2 font-bold">UOM</th>
                          <th className="p-2 font-bold text-right">Unit Price</th>
                          <th className="p-2 font-bold text-right">Discount %</th>
                          <th className="p-2 font-bold text-right">Tax %</th>
                          <th className="p-2 font-bold text-right">Freight</th>
                          <th className="p-2 font-bold text-right">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPo.lines.map((l, idx) => (
                          <tr key={l.id || idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-semibold text-slate-800">{l.material_code}</td>
                            <td className="p-2 text-slate-600">{l.description}</td>
                            <td className="p-2 text-right font-semibold text-slate-700">{l.quantity}</td>
                            <td className="p-2 text-slate-500">{l.uom}</td>
                            <td className="p-2 text-right">{l.unit_price.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-500">{l.discount_percent}%</td>
                            <td className="p-2 text-right text-slate-500">{l.tax_percent}%</td>
                            <td className="p-2 text-right">{l.freight.toFixed(2)}</td>
                            <td className="p-2 text-right font-bold text-slate-800">
                              {l.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* INLINE EDIT MODE (DRAFT ONLY) */}
                {["DRAFT", "UNDER_REVIEW"].includes(selectedPo.status) && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Edit2 className="h-4 w-4 text-emerald-600" />
                        Modify Header Parameters (Draft Stage)
                      </span>
                      <button
                        onClick={handleUpdatePO}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-[11px] transition"
                      >
                        Save Header Changes
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Expected Delivery Date</label>
                        <input
                          type="date"
                          value={selectedPo.expected_delivery_date}
                          onChange={(e) => setSelectedPo({ ...selectedPo, expected_delivery_date: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Payment Terms</label>
                        <input
                          type="text"
                          value={selectedPo.payment_terms}
                          onChange={(e) => setSelectedPo({ ...selectedPo, payment_terms: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Delivery Terms</label>
                        <input
                          type="text"
                          value={selectedPo.delivery_terms}
                          onChange={(e) => setSelectedPo({ ...selectedPo, delivery_terms: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-400 font-medium mb-1">Delivery Address</label>
                        <input
                          type="text"
                          value={selectedPo.delivery_address}
                          onChange={(e) => setSelectedPo({ ...selectedPo, delivery_address: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2 md:col-span-1">
                        <label className="block text-slate-400 font-medium mb-1">Remarks</label>
                        <input
                          type="text"
                          value={selectedPo.remarks || ""}
                          onChange={(e) => setSelectedPo({ ...selectedPo, remarks: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* VENDOR ACKNOWLEDGEMENT RECORDING (ONLY FOR ISSUED OR ACKNOWLEDGED STATUS) */}
                {["ISSUED", "ACKNOWLEDGED", "UNDER_REVIEW"].includes(selectedPo.status) && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 text-xs" id="vendor-acknowledgement-panel">
                    <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-emerald-600" />
                      Vendor Acknowledgement & Change Loop
                    </h4>

                    {selectedPo.acknowledgements && selectedPo.acknowledgements.length > 0 && (
                      <div className="bg-white p-3 rounded-lg border border-slate-150 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Acknowledgement History</span>
                        {selectedPo.acknowledgements.map((ack) => (
                          <div key={ack.id} className="border-l-2 border-emerald-500 pl-2.5 py-1 text-slate-700">
                            <div className="flex items-center justify-between font-bold">
                              <span>Status: {ack.acknowledgement_status}</span>
                              <span className="text-slate-400 text-[10px]">{ack.acknowledgement_date}</span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">Comments: {ack.comments || "No comments"}</p>
                            <p className="text-slate-400 text-[10px]">Contact: {ack.contact_person}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleRecordAcknowledgement} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Acknowledgement Status</label>
                        <select
                          value={ackStatus}
                          onChange={(e: any) => setAckStatus(e.target.value)}
                          className="w-full border border-slate-200 rounded p-1.5 bg-white text-xs font-semibold"
                        >
                          <option value="ACCEPTED">Vendor Accepted</option>
                          <option value="ACCEPTED_WITH_COMMENTS">Vendor Accepted with Comments</option>
                          <option value="CHANGES_REQUESTED">Vendor Requested Changes</option>
                          <option value="DECLINED">Vendor Declined</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Contact Person</label>
                        <input
                          type="text"
                          required
                          value={ackContact}
                          onChange={(e) => setAckContact(e.target.value)}
                          placeholder="Sales Manager name"
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Acknowledge / Submit Comment</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={ackComments}
                            onChange={(e) => setAckComments(e.target.value)}
                            placeholder="Optional comment/details"
                            className="w-full border border-slate-200 rounded p-1.5 bg-white"
                          />
                          <button
                            type="submit"
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 rounded transition"
                          >
                            Record
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* REVISION HISTORY LOG */}
                {selectedPo.revisions && selectedPo.revisions.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="h-4 w-4 text-amber-500" />
                      PO Revisions & Snapshots
                    </h4>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                      {selectedPo.revisions.map((rev) => (
                        <div key={rev.id} className="p-2 bg-white rounded border border-slate-250 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px]">
                          <div>
                            <span className="font-bold text-slate-800">Revision #{rev.revision_number}</span>
                            <span className="text-slate-400 mx-1.5">|</span>
                            <span className="text-slate-600 font-semibold">{rev.change_summary}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Revised by {rev.revised_by} on {new Date(rev.revised_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      )}

      {/* CREATE MANUAL PURCHASE ORDER TAB */}
      {activeTab === "CREATOR" && (
        <form onSubmit={handleCreateManualPO} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 text-xs" id="viewport-creator">
          <div className="border-b border-slate-150 pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Manual Purchase Order Builder
            </h2>
            <p className="text-slate-400">Draft a purchase order from scratch by selecting materials and specific quantities.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Vendor *</label>
              <select
                required
                value={manualVendorId}
                onChange={(e) => setManualVendorId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-white font-medium"
              >
                <option value="">Select Vendor...</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name} ({v.vendor_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <input
                type="text"
                value={manualCurrency}
                onChange={(e) => setManualCurrency(e.target.value)}
                placeholder="INR"
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={manualExpectedDeliveryDate}
                onChange={(e) => setManualExpectedDeliveryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={manualPaymentTerms}
                onChange={(e) => setManualPaymentTerms(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Delivery Terms</label>
              <input
                type="text"
                value={manualDeliveryTerms}
                onChange={(e) => setManualDeliveryTerms(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Incoterms</label>
              <input
                type="text"
                value={manualIncoterms}
                onChange={(e) => setManualIncoterms(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Delivery Address</label>
              <input
                type="text"
                value={manualDeliveryAddress}
                onChange={(e) => setManualDeliveryAddress(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
              <input
                type="text"
                value={manualRemarks}
                onChange={(e) => setManualRemarks(e.target.value)}
                placeholder="Optional remarks"
                className="w-full border border-slate-200 rounded-lg p-2.5"
              />
            </div>
          </div>

          {/* Lines Builder Table */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Purchase Lines</span>
              <button
                type="button"
                onClick={handleAddManualLine}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-3 rounded flex items-center gap-1 transition"
              >
                <Plus className="h-4 w-4" />
                Add Item Row
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="p-2">Material / Component *</th>
                    <th className="p-2">UOM</th>
                    <th className="p-2 text-right">Quantity</th>
                    <th className="p-2 text-right">Quoted price</th>
                    <th className="p-2 text-right">Discount %</th>
                    <th className="p-2 text-right">Tax %</th>
                    <th className="p-2 text-right">Freight</th>
                    <th className="p-2 text-right">Line Total</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manualLines.map((line, index) => {
                    const rowTotal = (Number(line.quantity || 0) * Number(line.unit_price || 0)) * (1 - Number(line.discount_percent || 0)/100) * (1 + Number(line.tax_percent || 0)/100) + Number(line.freight || 0);
                    return (
                      <tr key={index} className="hover:bg-slate-50/20">
                        <td className="p-2 w-[240px]">
                          <select
                            required
                            value={line.material_id}
                            onChange={(e) => handleManualLineChange(index, "material_id", e.target.value)}
                            className="w-full border border-slate-200 rounded p-1 bg-white"
                          >
                            <option value="">Select material...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.code} - {m.description}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 w-[70px]">
                          <input
                            type="text"
                            value={line.uom || ""}
                            onChange={(e) => handleManualLineChange(index, "uom", e.target.value)}
                            className="w-full border border-slate-200 rounded p-1 bg-slate-50 text-slate-500"
                            readOnly
                          />
                        </td>
                        <td className="p-2 w-[80px] text-right">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity || ""}
                            onChange={(e) => handleManualLineChange(index, "quantity", Number(e.target.value))}
                            className="w-full border border-slate-200 rounded p-1 text-right"
                          />
                        </td>
                        <td className="p-2 w-[100px] text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.unit_price || ""}
                            onChange={(e) => handleManualLineChange(index, "unit_price", Number(e.target.value))}
                            className="w-full border border-slate-200 rounded p-1 text-right"
                          />
                        </td>
                        <td className="p-2 w-[80px] text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={line.discount_percent || ""}
                            onChange={(e) => handleManualLineChange(index, "discount_percent", Number(e.target.value))}
                            className="w-full border border-slate-200 rounded p-1 text-right"
                          />
                        </td>
                        <td className="p-2 w-[80px] text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={line.tax_percent || ""}
                            onChange={(e) => handleManualLineChange(index, "tax_percent", Number(e.target.value))}
                            className="w-full border border-slate-200 rounded p-1 text-right"
                          />
                        </td>
                        <td className="p-2 w-[90px] text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.freight || ""}
                            onChange={(e) => handleManualLineChange(index, "freight", Number(e.target.value))}
                            className="w-full border border-slate-200 rounded p-1 text-right"
                          />
                        </td>
                        <td className="p-2 text-right font-bold text-slate-800">
                          {rowTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          {manualLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveManualLine(index)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
            <button
              type="button"
              onClick={() => setActiveTab("REGISTER")}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg transition"
            >
              Generate Manual Purchase Order
            </button>
          </div>
        </form>
      )}

      {/* PRINT-READY PREVIEW TAB */}
      {activeTab === "PRINT_PREVIEW" && printData && (
        <div className="space-y-6" id="viewport-print-preview">
          
          {/* Action Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">Professional PDF-ready layout compiled. Use printer or Ctrl+P.</span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("REGISTER")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded transition"
              >
                Back to Registry
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded transition flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Document
              </button>
            </div>
          </div>

          {/* HIGH FIDELITY PRINT COMPOSER */}
          <div className="bg-white border-2 border-slate-200 rounded-xl shadow-md p-8 max-w-4xl mx-auto text-slate-800 space-y-8 font-sans" id="printable-purchase-order-document">
            
            {/* Standard Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
              <div className="space-y-1.5 text-xs">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{printData.companyDetails.company_name}</h2>
                <p className="text-slate-500 leading-relaxed max-w-md">
                  {printData.companyDetails.address}
                </p>
                <p className="text-slate-400">Factory: {printData.companyDetails.factory_address}</p>
                <p className="font-semibold text-slate-700">GSTIN: {printData.companyDetails.gstin}</p>
                <p className="text-slate-500">Email: {printData.companyDetails.email} | Tel: {printData.companyDetails.phone}</p>
              </div>
              <div className="text-right space-y-1 text-xs">
                <span className="bg-emerald-600 text-white font-black px-4 py-1.5 text-sm tracking-wide rounded block">PURCHASE ORDER</span>
                <p className="font-bold text-slate-800 pt-2 text-base">PO Number: {printData.poHeader.po_number}</p>
                <p className="text-slate-500">Date: {printData.poHeader.po_date}</p>
                <p className="text-slate-500">Revision: R{printData.poHeader.revision_number}</p>
                <p className="text-slate-500">Buyer: {printData.poHeader.buyer}</p>
              </div>
            </div>

            {/* Vendor vs Delivery Addresses */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Details</span>
                <p className="font-bold text-slate-900 text-sm">{printData.vendorDetails?.vendor_name}</p>
                <p className="text-slate-500">Code: {printData.vendorDetails?.vendor_code}</p>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{printData.vendorDetails?.address}</p>
                <p className="text-slate-600">GSTIN: {printData.vendorDetails?.gstin}</p>
                <p className="text-slate-600">Email: {printData.vendorDetails?.email} | Tel: {printData.vendorDetails?.phone}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery & Billing Instructions</span>
                <p className="font-semibold text-slate-800">Ship To:</p>
                <p className="text-slate-600 leading-relaxed">{printData.poHeader.delivery_address}</p>
                <p className="font-semibold text-slate-800 pt-1">Bill To:</p>
                <p className="text-slate-600 leading-relaxed">{printData.poHeader.billing_address}</p>
              </div>
            </div>

            {/* Terms Column */}
            <div className="grid grid-cols-4 gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-150 text-[11px]">
              <div>
                <span className="font-semibold text-slate-400">Payment Terms</span>
                <p className="font-bold text-slate-800 mt-0.5">{printData.poHeader.payment_terms}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Delivery Terms</span>
                <p className="font-bold text-slate-800 mt-0.5">{printData.poHeader.delivery_terms}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Incoterms</span>
                <p className="font-bold text-slate-800 mt-0.5">{printData.poHeader.incoterms}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Expected Date</span>
                <p className="font-bold text-slate-800 mt-0.5">{printData.poHeader.expected_delivery_date}</p>
              </div>
            </div>

            {/* Materials Details Table */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Line Item Specifications</span>
              <table className="w-full text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-200">
                    <th className="p-2 font-bold">#</th>
                    <th className="p-2 font-bold">Code</th>
                    <th className="p-2 font-bold">Description</th>
                    <th className="p-2 text-right font-bold">Qty</th>
                    <th className="p-2 font-bold">UOM</th>
                    <th className="p-2 text-right font-bold">Rate</th>
                    <th className="p-2 text-right font-bold">Disc %</th>
                    <th className="p-2 text-right font-bold">Tax %</th>
                    <th className="p-2 text-right font-bold">Freight</th>
                    <th className="p-2 text-right font-bold">Line Total ({printData.poHeader.currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-250">
                  {printData.poLines.map((l: any, idx: number) => (
                    <tr key={l.id} className="text-[11px] hover:bg-slate-50/10">
                      <td className="p-2 font-medium">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900">{l.material_code}</td>
                      <td className="p-2 leading-relaxed">{l.description}</td>
                      <td className="p-2 text-right font-bold">{l.quantity}</td>
                      <td className="p-2 text-slate-500">{l.uom}</td>
                      <td className="p-2 text-right">{l.unit_price.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-500">{l.discount_percent}%</td>
                      <td className="p-2 text-right text-slate-500">{l.tax_percent}%</td>
                      <td className="p-2 text-right">{l.freight.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold text-slate-900">
                        {l.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Columns */}
            <div className="flex justify-between items-start pt-4 text-xs">
              <div className="max-w-md text-slate-500 leading-relaxed">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Standard Remarks</span>
                <p className="whitespace-pre-wrap">{printData.poHeader.remarks || "No supplementary terms or remarks. Subject to standard corporate procurement compliance regulations."}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 min-w-[280px] space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{printData.poHeader.currency} {printData.totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxes Calculated:</span>
                  <span>{printData.poHeader.currency} {printData.totals.tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Total Discount Allowed:</span>
                  <span className="text-rose-600">({printData.poHeader.currency} {printData.totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Freight Allocated:</span>
                  <span>{printData.poHeader.currency} {printData.totals.freight.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-2 font-extrabold text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span>{printData.poHeader.currency} {printData.totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Signatory Boxes */}
            <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-xs">
              {printData.authorizedSignatories.map((sig: any, index: number) => (
                <div key={index} className="text-center space-y-4">
                  <div className="h-10 flex items-end justify-center">
                    <span className="text-slate-400 italic font-serif text-[10px]">Digitally Authenticated / Platform Signature Logged</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <p className="font-bold text-slate-800">{sig.name}</p>
                    <p className="text-slate-400 text-[10px]">{sig.designation}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* REVISION CREATOR MODAL WINDOW */}
      {showRevisionModal && selectedPo && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <RotateCcw className="h-5 w-5 text-amber-500" />
                Spawn Purchase Order Revision
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                You are revising {selectedPo.po_number}. Spawning a revision locks the current version (Rev {selectedPo.revision_number}) immutably in the history log and creates a fresh editable version (Rev {selectedPo.revision_number + 1}) reset back to DRAFT.
              </p>
            </div>
            <form onSubmit={handleTriggerRevision} className="space-y-4">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Reason for Revision / Change Log Summary *</label>
                <textarea
                  required
                  rows={3}
                  value={revisionSummary}
                  onChange={(e) => setRevisionSummary(e.target.value)}
                  placeholder="Specify what changes are requested (e.g. Rate adjustment, material quantity update, date postponement)."
                  className="w-full border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-1.5 px-3 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded transition"
                >
                  Spawn Rev {selectedPo.revision_number + 1}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
