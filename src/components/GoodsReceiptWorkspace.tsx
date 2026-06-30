import React, { useState, useEffect } from "react";
import {
  Truck,
  FileText,
  Plus,
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  History,
  ClipboardCheck,
  RefreshCw,
  Eye,
  Archive,
  Layers,
  ArrowRight
} from "lucide-react";
import {
  GoodsReceiptHeader,
  GoodsReceiptLine,
  GoodsReceiptHistory,
  PurchaseOrderHeader,
  PurchaseOrderLine
} from "../types";

interface GoodsReceiptWorkspaceProps {
  authState: {
    isAuthenticated: boolean;
    token: string | null;
    user: any;
  };
  apiFetch: (path: string, options?: any) => Promise<any>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function GoodsReceiptWorkspace({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}: GoodsReceiptWorkspaceProps) {
  // Navigation & UI state
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedGrn, setSelectedGrn] = useState<any | null>(null);
  const [selectedGrnLines, setSelectedGrnLines] = useState<GoodsReceiptLine[]>([]);
  const [selectedGrnHistory, setSelectedGrnHistory] = useState<GoodsReceiptHistory[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [openPurchaseOrders, setOpenPurchaseOrders] = useState<PurchaseOrderHeader[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"details" | "lines" | "inspection" | "history">("details");

  // Local state for edits
  const [editWarehouse, setEditWarehouse] = useState<string>("");
  const [editVehicle, setEditVehicle] = useState<string>("");
  const [editTransporter, setEditTransporter] = useState<string>("");
  const [editInvoiceNum, setEditInvoiceNum] = useState<string>("");
  const [editInvoiceDate, setEditInvoiceDate] = useState<string>("");
  const [editRemarks, setEditRemarks] = useState<string>("");

  // Line edits
  const [lineEdits, setLineEdits] = useState<{ [lineId: string]: Partial<GoodsReceiptLine> }>({});

  useEffect(() => {
    fetchGRNs();
  }, []);

  const fetchGRNs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/grns");
      setGrns(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load Goods Receipt Notes.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPOsForReceipt = async () => {
    try {
      const data = await apiFetch("/api/v1/purchase-orders");
      // Filter only open POs: ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED
      const open = (data || []).filter(
        (po: any) =>
          (po.status === "ISSUED" || po.status === "ACKNOWLEDGED" || po.status === "PARTIALLY_RECEIVED") &&
          !po.is_deleted
      );
      setOpenPurchaseOrders(open);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load Purchase Orders.");
    }
  };

  const loadGrnDetails = async (grnId: string) => {
    try {
      const details = await apiFetch(`/api/v1/grns/${grnId}`);
      setSelectedGrn(details);
      setSelectedGrnLines(details.lines || []);
      setSelectedGrnHistory(details.history || []);
      
      // Initialize form fields
      setEditWarehouse(details.warehouse || "Main Warehouse");
      setEditVehicle(details.vehicle_number || "");
      setEditTransporter(details.transporter || "");
      setEditInvoiceNum(details.supplier_invoice_number || "");
      setEditInvoiceDate(details.supplier_invoice_date || "");
      setEditRemarks(details.remarks || "");

      // Initialize line edits
      const edits: { [id: string]: Partial<GoodsReceiptLine> } = {};
      (details.lines || []).forEach((line: GoodsReceiptLine) => {
        edits[line.id] = {
          receiving_quantity: line.receiving_quantity,
          accepted_quantity: line.accepted_quantity,
          rejected_quantity: line.rejected_quantity,
          warehouse_location: line.warehouse_location || "Main Warehouse",
          batch_number: line.batch_number || "",
          serial_number: line.serial_number || "",
          inspection_status: line.inspection_status || "PENDING"
        };
      });
      setLineEdits(edits);
      setActiveTab("details");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load GRN details.");
    }
  };

  const handleCreateGrnFromPo = async () => {
    if (!selectedPoId) {
      setErrorMsg("Please select a Purchase Order first.");
      return;
    }
    try {
      const newGrn = await apiFetch(`/api/v1/grns/from-po/${selectedPoId}`, {
        method: "POST"
      });
      setSuccessMsg(`Goods Receipt ${newGrn.grn_number} drafted successfully!`);
      setShowCreateModal(false);
      setSelectedPoId("");
      fetchGRNs();
      loadGrnDetails(newGrn.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate GRN from PO.");
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedGrn) return;
    try {
      const updatedLines = Object.keys(lineEdits).map((id) => ({
        id,
        ...lineEdits[id]
      }));

      await apiFetch(`/api/v1/grns/${selectedGrn.id}`, {
        method: "PUT",
        body: {
          warehouse: editWarehouse,
          vehicle_number: editVehicle,
          transporter: editTransporter,
          supplier_invoice_number: editInvoiceNum,
          supplier_invoice_date: editInvoiceDate,
          remarks: editRemarks,
          lines: updatedLines
        }
      });

      setSuccessMsg("Changes saved successfully!");
      loadGrnDetails(selectedGrn.id);
      fetchGRNs();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save changes.");
    }
  };

  const handleSubmitForInspection = async () => {
    if (!selectedGrn) return;
    try {
      // First save any current screen changes
      await handleSaveChanges();

      await apiFetch(`/api/v1/grns/${selectedGrn.id}/submit`, {
        method: "POST"
      });

      setSuccessMsg("Goods Receipt Note successfully submitted for Inspection!");
      loadGrnDetails(selectedGrn.id);
      fetchGRNs();
    } catch (err: any) {
      setErrorMsg(err.message || "Validation failed during submission.");
    }
  };

  const handleLogInspectionLine = (lineId: string, field: keyof GoodsReceiptLine, value: any) => {
    setLineEdits((prev) => {
      const line = prev[lineId] || {};
      const updated = { ...line, [field]: value };

      // Auto-validate and correct accepted/rejected sums if possible
      if (field === "receiving_quantity") {
        updated.accepted_quantity = value;
        updated.rejected_quantity = 0;
      } else if (field === "accepted_quantity") {
        const recQty = updated.receiving_quantity ?? 0;
        updated.rejected_quantity = Math.max(0, recQty - Number(value));
      } else if (field === "rejected_quantity") {
        const recQty = updated.receiving_quantity ?? 0;
        updated.accepted_quantity = Math.max(0, recQty - Number(value));
      }

      return {
        ...prev,
        [lineId]: updated
      };
    });
  };

  const handlePostInspectionResults = async () => {
    if (!selectedGrn) return;
    try {
      const updatedLines = Object.keys(lineEdits).map((id) => ({
        id,
        ...lineEdits[id]
      }));

      await apiFetch(`/api/v1/grns/${selectedGrn.id}/inspect`, {
        method: "POST",
        body: { lines: updatedLines }
      });

      setSuccessMsg("Inspection results logged successfully.");
      loadGrnDetails(selectedGrn.id);
      fetchGRNs();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save inspection details.");
    }
  };

  const handleFinalizeReceipt = async () => {
    if (!selectedGrn) return;
    try {
      // Log latest screen fields first
      await handlePostInspectionResults();

      const result = await apiFetch(`/api/v1/grns/${selectedGrn.id}/receive`, {
        method: "POST"
      });

      setSuccessMsg(`Goods Receipt Note finalized successfully! PO status is now: ${result.poStatus}`);
      loadGrnDetails(selectedGrn.id);
      fetchGRNs();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to post goods receipt note.");
    }
  };

  const handleCancelGrn = async () => {
    if (!selectedGrn) return;
    if (!window.confirm("Are you absolutely sure you want to cancel this Goods Receipt Note? This action will restore any received quantities on the Purchase Order.")) {
      return;
    }
    try {
      await apiFetch(`/api/v1/grns/${selectedGrn.id}/cancel`, {
        method: "POST"
      });

      setSuccessMsg("Goods Receipt Note successfully cancelled!");
      loadGrnDetails(selectedGrn.id);
      fetchGRNs();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel GRN.");
    }
  };

  // KPI calculations
  const totalCreated = grns.length;
  const underInspection = grns.filter((g) => g.status === "UNDER_INSPECTION").length;
  const fullyReceived = grns.filter((g) => g.status === "RECEIVED").length;
  const draftCount = grns.filter((g) => g.status === "DRAFT").length;

  const filteredGrns = grns.filter((g) => {
    const matchesSearch =
      g.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.supplier_invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "" || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="grn_workspace">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-400" />
            Goods Receipt Note (GRN) Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track material deliveries, perform quality inspections, and synchronize purchase order receipts.
          </p>
        </div>
        {!selectedGrn && (
          <button
            id="btn_new_grn"
            onClick={() => {
              fetchPOsForReceipt();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            Draft Receipt Note
          </button>
        )}
      </div>

      {/* KPI SUMMARIES */}
      {!selectedGrn && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="grn_kpi_cards">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-800/80 text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Received</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{totalCreated}</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-800/80 text-amber-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Under Inspection</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{underInspection}</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-800/80 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed receipts</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{fullyReceived}</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-800/80 text-slate-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Drafts</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{draftCount}</h3>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW CONTAINER */}
      {!selectedGrn ? (
        <div className="bg-slate-900 border border-slate-800/85 rounded-xl overflow-hidden shadow-xl">
          {/* SEARCH & FILTERS */}
          <div className="p-4 border-b border-slate-800/60 flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by GRN#, Vendor, PO# or Supplier Invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/60 transition-all"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
                <option value="RECEIVED">Received</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={fetchGRNs}
                className="p-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                title="Refresh List"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* REGISTRY GRID */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3 px-4">GRN Details</th>
                  <th className="py-3 px-4">Vendor & Source PO</th>
                  <th className="py-3 px-4">Gate Details</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        Fetching Goods Receipt Notes...
                      </div>
                    </td>
                  </tr>
                ) : filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No Goods Receipt Notes matching search parameters.
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map((grn) => {
                    let statusColor = "bg-slate-800 text-slate-300 border-slate-700";
                    if (grn.status === "UNDER_INSPECTION") statusColor = "bg-amber-900/35 text-amber-300 border-amber-800/55";
                    if (grn.status === "RECEIVED") statusColor = "bg-emerald-950 text-emerald-300 border-emerald-800/60";
                    if (grn.status === "PARTIALLY_RECEIVED") statusColor = "bg-blue-950 text-blue-300 border-blue-800/60";
                    if (grn.status === "CANCELLED") statusColor = "bg-rose-950 text-rose-300 border-rose-800/60";

                    return (
                      <tr key={grn.id} className="hover:bg-slate-800/25 transition-all">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-white block">{grn.grn_number}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Dated: {grn.grn_date}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-white font-medium">{grn.vendor_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">PO Ref: {grn.po_number}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {grn.vehicle_number ? (
                            <span className="block text-slate-300">Veh: {grn.vehicle_number}</span>
                          ) : (
                            <span className="text-slate-600 italic block">No vehicle info</span>
                          )}
                          <span className="text-[10px] text-slate-500 block mt-0.5">Received By: {grn.received_by}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-slate-300 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/50">
                            {grn.warehouse}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>
                            {grn.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => loadGrnDetails(grn.id)}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1 rounded transition-all font-semibold"
                          >
                            Open Details &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* DETAIL & EDIT WORKSPACE VIEW */
        <div className="space-y-6" id="grn_detail_view">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedGrn(null);
                  fetchGRNs();
                }}
                className="p-2 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white font-mono">{selectedGrn.grn_number}</h2>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    PO: {selectedGrn.po_number}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supplier: {selectedGrn.vendor_name} &bull; Date: {selectedGrn.grn_date}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* STATEFUL WORKFLOW BUTTONS */}
              {selectedGrn.status === "DRAFT" && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={handleSubmitForInspection}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-500/5"
                  >
                    Submit for Inspection
                  </button>
                </>
              )}

              {selectedGrn.status === "UNDER_INSPECTION" && (
                <>
                  <button
                    onClick={handlePostInspectionResults}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                  >
                    Save Inspection Log
                  </button>
                  <button
                    onClick={handleFinalizeReceipt}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/5"
                  >
                    Post Goods Receipt (Post Receipt)
                  </button>
                </>
              )}

              {selectedGrn.status !== "CANCELLED" && (
                <button
                  onClick={handleCancelGrn}
                  className="bg-rose-950 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancel Receipt Note
                </button>
              )}
            </div>
          </div>

          {/* TABS */}
          <div className="flex border-b border-slate-800 gap-1">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeTab === "details"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Gate & Invoice Header Details
            </button>
            <button
              onClick={() => setActiveTab("lines")}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeTab === "lines"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Receipt Lines Grid ({selectedGrnLines.length})
            </button>
            <button
              onClick={() => setActiveTab("inspection")}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeTab === "inspection"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Inspection & Tracking Wizard
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
                activeTab === "history"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Lifecycle History & Audit Trail
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            {activeTab === "details" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="header_details_tab">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Warehouse & Shipping Details
                  </h3>
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Destination Warehouse / Store
                    </label>
                    <select
                      disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                      value={editWarehouse}
                      onChange={(e) => setEditWarehouse(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                    >
                      <option value="Main Warehouse">Main Warehouse</option>
                      <option value="Raw Materials Store">Raw Materials Store</option>
                      <option value="Production Buffer Store">Production Buffer Store</option>
                      <option value="Finished Goods Store">Finished Goods Store</option>
                      <option value="Cold Storage Zone A">Cold Storage Zone A</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Vehicle Number
                      </label>
                      <input
                        type="text"
                        disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                        placeholder="e.g. KA-03-HA-4567"
                        value={editVehicle}
                        onChange={(e) => setEditVehicle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Transporter Name
                      </label>
                      <input
                        type="text"
                        disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                        placeholder="e.g. BlueDart Logistics"
                        value={editTransporter}
                        onChange={(e) => setEditTransporter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Supplier Invoice Details
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Supplier Invoice Number
                      </label>
                      <input
                        type="text"
                        disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                        placeholder="e.g. INV-1002345"
                        value={editInvoiceNum}
                        onChange={(e) => setEditInvoiceNum(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Supplier Invoice Date
                      </label>
                      <input
                        type="date"
                        disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                        value={editInvoiceDate}
                        onChange={(e) => setEditInvoiceDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Remarks / Gate Notes
                    </label>
                    <textarea
                      disabled={selectedGrn.status !== "DRAFT" && selectedGrn.status !== "UNDER_INSPECTION"}
                      rows={3}
                      placeholder="Enter any observations or package damage notes upon receipt..."
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "lines" && (
              <div className="space-y-4" id="lines_tab">
                <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">Receipt Quantities & Over-receive Guardrails</span>
                  </div>
                  <span className="text-[10px] text-slate-400 italic">
                    Note: Receiving quantity is limited to (PO Ordered - Previously Received)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/20">
                        <th className="py-2.5 px-3">Material Code & Desc</th>
                        <th className="py-2.5 px-3 text-right">PO Qty</th>
                        <th className="py-2.5 px-3 text-right">Previously Rec.</th>
                        <th className="py-2.5 px-3 text-right">Pending Qty</th>
                        <th className="py-2.5 px-3 text-right w-36">Receiving Qty</th>
                        <th className="py-2.5 px-3">UOM</th>
                        <th className="py-2.5 px-3">Sub-Warehouse Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {selectedGrnLines.map((line) => {
                        const edits = lineEdits[line.id] || {};
                        const currentRecQty = edits.receiving_quantity ?? line.receiving_quantity;
                        const currentLoc = edits.warehouse_location ?? line.warehouse_location;
                        const maxAllowed = line.ordered_quantity - line.previously_received_quantity;
                        const isEditable = selectedGrn.status === "DRAFT";

                        return (
                          <tr key={line.id} className="hover:bg-slate-800/10">
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-emerald-400 block">{line.material_code}</span>
                              <span className="text-slate-400 text-[11px] block mt-0.5">{line.description}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-300">{line.ordered_quantity}</td>
                            <td className="py-3 px-3 text-right text-slate-400">{line.previously_received_quantity}</td>
                            <td className="py-3 px-3 text-right text-blue-400 font-semibold">{maxAllowed}</td>
                            <td className="py-3 px-3">
                              {isEditable ? (
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxAllowed}
                                    value={currentRecQty}
                                    onChange={(e) =>
                                      handleLogInspectionLine(line.id, "receiving_quantity", Number(e.target.value))
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                                  />
                                  {currentRecQty > maxAllowed && (
                                    <span className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                                      <AlertCircle className="w-3 h-3" /> Exceeds pending!
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-right font-bold text-white pr-2">{line.receiving_quantity}</div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-400 uppercase font-mono">{line.uom}</td>
                            <td className="py-3 px-3">
                              {selectedGrn.status === "DRAFT" || selectedGrn.status === "UNDER_INSPECTION" ? (
                                <input
                                  type="text"
                                  placeholder="e.g. Aisle 3, Row B"
                                  value={currentLoc}
                                  onChange={(e) =>
                                    handleLogInspectionLine(line.id, "warehouse_location", e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs placeholder-slate-700 focus:outline-none"
                                />
                              ) : (
                                <span className="text-slate-300">{line.warehouse_location}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "inspection" && (
              <div className="space-y-5" id="inspection_tab">
                <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white">Log QA Inspection, Batch & Serial Tracking</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Inspection required for receipt posting. If FAILED, Rejected quantity is mandatory.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/20">
                        <th className="py-2.5 px-3">Material Code</th>
                        <th className="py-2.5 px-3 text-right">Rec. Qty</th>
                        <th className="py-2.5 px-3">QA Status</th>
                        <th className="py-2.5 px-3 text-right w-28">Accepted Qty</th>
                        <th className="py-2.5 px-3 text-right w-28">Rejected Qty</th>
                        <th className="py-2.5 px-3 w-40">Batch Number</th>
                        <th className="py-2.5 px-3 w-40">Serial Number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {selectedGrnLines.map((line) => {
                        const edits = lineEdits[line.id] || {};
                        const recQty = edits.receiving_quantity ?? line.receiving_quantity;
                        const status = edits.inspection_status ?? line.inspection_status;
                        const accepted = edits.accepted_quantity ?? line.accepted_quantity;
                        const rejected = edits.rejected_quantity ?? line.rejected_quantity;
                        const batch = edits.batch_number ?? line.batch_number;
                        const serial = edits.serial_number ?? line.serial_number;

                        const isInspectionEditable = selectedGrn.status === "DRAFT" || selectedGrn.status === "UNDER_INSPECTION";

                        return (
                          <tr key={line.id} className="hover:bg-slate-800/10">
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-white block">{line.material_code}</span>
                              <span className="text-[10px] text-slate-500 block">{line.description}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-400 pr-4">{recQty}</td>
                            <td className="py-3 px-3">
                              {isInspectionEditable ? (
                                <select
                                  value={status}
                                  onChange={(e) =>
                                    handleLogInspectionLine(line.id, "inspection_status", e.target.value)
                                  }
                                  className={`border rounded px-2 py-1 text-xs font-semibold focus:outline-none ${
                                    status === "PASSED"
                                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                                      : status === "FAILED"
                                      ? "bg-rose-950/40 text-rose-300 border-rose-800"
                                      : "bg-slate-950 text-slate-300 border-slate-800"
                                  }`}
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="PASSED">PASSED</option>
                                  <option value="FAILED">FAILED</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    status === "PASSED"
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800/40"
                                      : status === "FAILED"
                                      ? "bg-rose-950 text-rose-300 border border-rose-800/40"
                                      : "bg-slate-800 text-slate-400"
                                  }`}
                                >
                                  {status}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isInspectionEditable ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={recQty}
                                  value={accepted}
                                  onChange={(e) =>
                                    handleLogInspectionLine(line.id, "accepted_quantity", Number(e.target.value))
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                                />
                              ) : (
                                <span className="block text-right font-semibold text-emerald-400 pr-2">{line.accepted_quantity}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isInspectionEditable ? (
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={recQty}
                                    value={rejected}
                                    onChange={(e) =>
                                      handleLogInspectionLine(line.id, "rejected_quantity", Number(e.target.value))
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                                  />
                                  {status === "FAILED" && rejected <= 0 && (
                                    <span className="text-[9px] text-rose-400 flex items-center gap-0.5 font-bold">
                                      <AlertCircle className="w-2.5 h-2.5" /> Required!
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="block text-right font-semibold text-rose-400 pr-2">{line.rejected_quantity}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isInspectionEditable ? (
                                <input
                                  type="text"
                                  placeholder="Batch / Lot #"
                                  value={batch}
                                  onChange={(e) =>
                                    handleLogInspectionLine(line.id, "batch_number", e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs placeholder-slate-700 focus:outline-none"
                                />
                              ) : (
                                <span className="text-slate-300 font-mono">{line.batch_number || "N/A"}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isInspectionEditable ? (
                                <input
                                  type="text"
                                  placeholder="Serial Number"
                                  value={serial}
                                  onChange={(e) =>
                                    handleLogInspectionLine(line.id, "serial_number", e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs placeholder-slate-700 focus:outline-none"
                                />
                              ) : (
                                <span className="text-slate-300 font-mono">{line.serial_number || "N/A"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {(selectedGrn.status === "DRAFT" || selectedGrn.status === "UNDER_INSPECTION") && (
                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handlePostInspectionResults}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-500/10"
                    >
                      Save QA Records
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-6" id="history_tab">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  GRN Lifecycle Audit Log
                </h3>

                <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-3">
                  {selectedGrnHistory.map((hist, index) => {
                    let evIcon = <Plus className="w-3.5 h-3.5 text-blue-400" />;
                    let evBg = "bg-blue-950/60 text-blue-300 border-blue-900";
                    
                    if (hist.event_type === "STATUS_CHANGE") {
                      evIcon = <RefreshCw className="w-3.5 h-3.5 text-amber-400" />;
                      evBg = "bg-amber-950/60 text-amber-300 border-amber-900";
                    } else if (hist.event_type === "INSPECTION") {
                      evIcon = <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />;
                      evBg = "bg-emerald-950/60 text-emerald-300 border-emerald-900";
                    } else if (hist.event_type === "CANCELLATION") {
                      evIcon = <XCircle className="w-3.5 h-3.5 text-rose-400" />;
                      evBg = "bg-rose-950/60 text-rose-300 border-rose-900";
                    }

                    return (
                      <div key={hist.id} className="relative">
                        {/* Bullet circle */}
                        <div className={`absolute -left-[31px] top-0.5 p-1 rounded-full border ${evBg}`}>
                          {evIcon}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {new Date(hist.timestamp).toLocaleString()}
                          </span>
                          <span className="font-bold text-white text-xs mt-0.5 block uppercase tracking-wide">
                            {hist.event_type} (From: {hist.status_from || "None"} &rarr; To: {hist.status_to})
                          </span>
                          <p className="text-slate-300 text-xs mt-1 bg-slate-950/30 p-2 rounded border border-slate-800/40">
                            {hist.remarks}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Logged By: <span className="font-mono">{hist.user_email}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                Draft Receipt from Purchase Order
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition-all text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400">
                Select an authorized, outstanding Purchase Order from the active procurement queue to load line items and start receiving.
              </p>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                  Select Purchase Order
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="">-- Choose PO Reference --</option>
                  {openPurchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.buyer} ({po.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPoId && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 space-y-2 text-[11px] text-slate-400">
                  <p className="text-white font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Source Sync Confirmed
                  </p>
                  <p>Line details will automatically populate with pending balances to avoid duplicate receipts.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800/80 bg-slate-950/30 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGrnFromPo}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
              >
                Create Receipt Draft
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
