import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Plus,
  Lock,
  History,
  Eye,
  X,
  Save,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  Database,
  Trash2,
  LockKeyhole,
  FileCode,
  ShieldCheck,
  Briefcase,
  Cpu,
  TrendingUp
} from "lucide-react";
import { AuthState } from "../types";

interface CostSheetsWorkspaceProps {
  authState: AuthState;
  apiFetch: (url: string, options?: any) => Promise<Response>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

interface CostSheetLine {
  id: string;
  bom_line_id: string;
  parent_cost_line_id: string | null;
  item_type: string;
  base_rate: number;
  raw_quantity: number;
  waste_modifier: number;
  calculated_subtotal: number;
  audit_trail_json: string | null;
}

interface CostSheetHeader {
  id: string;
  cost_sheet_number: string;
  bom_header_id: string;
  revision_number: number;
  status: "DRAFT" | "CALCULATED" | "LOCKED" | "SUPERSEDED";
  total_material_cost: number;
  total_process_cost: number;
  total_scrap_credit: number;
  total_overhead_cost: number;
  grand_total_cost: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: CostSheetLine[];
}

interface BOMHeader {
  id: string;
  part_number: string;
  revision_number: number;
  description: string | null;
}

interface BOMLine {
  id: string;
  line_type: string;
  description: string | null;
  sequence_number: number;
}

interface Snapshot {
  id: string;
  cost_sheet_header_id: string;
  formula_constants_snapshot_json: string;
  rate_card_snapshot_json: string;
  computational_log: string;
  created_at: string;
}

const TraceabilityTreeNode: React.FC<{ node: any; depth?: number }> = ({ node, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const paddingLeft = `${depth * 1.5}rem`;

  return (
    <div className="border-l border-slate-800 ml-2" style={{ paddingLeft }}>
      <div className="flex items-start gap-2 py-2 px-3 hover:bg-slate-900/30 rounded-lg transition-all">
        {node.children && node.children.length > 0 && (
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)} 
            className="text-slate-500 hover:text-white shrink-0 mt-0.5 text-[10px]"
          >
            {isOpen ? "▼" : "▶"}
          </button>
        )}
        <div className="flex-1 min-w-0 font-sans text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded font-mono ${
              node.item_type === "MATERIAL" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" :
              node.item_type === "PROCESS" ? "bg-purple-950/40 text-purple-400 border border-purple-900/40" :
              node.item_type === "SUB_ASSEMBLY" ? "bg-blue-950/40 text-blue-400 border border-blue-900/40" :
              node.item_type === "SCRAP_RECOVERY" ? "bg-amber-950/40 text-amber-400 border border-amber-900/40" :
              "bg-slate-900 text-slate-300 border border-slate-800"
            }`}>
              {node.item_type}
            </span>
            <span className="font-mono text-white font-bold">{node.code}</span>
            <span className="text-slate-400 truncate">{node.description}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1 flex gap-4 flex-wrap">
            <span>Qty: {node.quantity} {node.uom}</span>
            {node.waste_modifier !== 1 && <span>Waste: {node.waste_modifier}x</span>}
            <span>Rate: ₹{node.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-emerald-400 font-bold">Subtotal: ₹{node.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {node.explanation && (
            <p className="text-[10px] text-slate-500 mt-1 italic font-sans">{node.explanation}</p>
          )}
        </div>
      </div>
      {isOpen && node.children && node.children.map((child: any) => (
        <TraceabilityTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};

export const CostSheetsWorkspace: React.FC<CostSheetsWorkspaceProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  const [costSheets, setCostSheets] = useState<CostSheetHeader[]>([]);
  const [boms, setBoms] = useState<BOMHeader[]>([]);
  const [selectedBOMId, setSelectedBOMId] = useState<string>("");
  const [bomLines, setBomLines] = useState<BOMLine[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Form states for creating/editing
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState<boolean>(false);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    revision_number: 1,
    status: "DRAFT" as "DRAFT" | "CALCULATED" | "LOCKED" | "SUPERSEDED",
    total_material_cost: 0,
    total_process_cost: 0,
    total_scrap_credit: 0,
    total_overhead_cost: 0,
    grand_total_cost: 0
  });

  const [formLines, setFormLines] = useState<CostSheetLine[]>([]);

  // Snapshot modal states
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState<boolean>(false);

  // Sprint 2D-B Material Cost Engine states
  const [activeTab, setActiveTab] = useState<"database" | "preview" | "rollup">("database");
  const [previewType, setPreviewType] = useState<"material" | "process">("material");
  const [materials, setMaterials] = useState<any[]>([]);
  const [previewInput, setPreviewInput] = useState({
    material_id: "",
    quantity: 1,
    uom: "KG",
    waste_modifier: 1.0,
    effective_date: new Date().toISOString().slice(0, 10)
  });
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Sprint 2D-C Process Cost Engine states
  const [processes, setProcesses] = useState<any[]>([]);
  const [processPreviewInput, setProcessPreviewInput] = useState({
    process_id: "",
    quantity: 1.0,
    thickness: "" as string | number,
    sub_type: "",
    effective_date: new Date().toISOString().slice(0, 10)
  });
  const [processPreviewResult, setProcessPreviewResult] = useState<any | null>(null);
  const [processPreviewError, setProcessPreviewError] = useState<string | null>(null);
  const [processPreviewLoading, setProcessPreviewLoading] = useState<boolean>(false);

  // Sprint 2D-D Scrap Recovery Engine states
  const [scraps, setScraps] = useState<any[]>([]);
  const [scrapPreviewInput, setScrapPreviewInput] = useState({
    material_id: "",
    material_quantity: "" as string | number,
    effective_consumption: "" as string | number,
    scrap_quantity: 1.0,
    scrap_type: "",
    effective_date: new Date().toISOString().slice(0, 10)
  });
  const [scrapPreviewResult, setScrapPreviewResult] = useState<any | null>(null);
  const [scrapPreviewError, setScrapPreviewError] = useState<string | null>(null);
  const [scrapPreviewLoading, setScrapPreviewLoading] = useState<boolean>(false);

  // Sprint 2D-E Rollup and Finalization states
  const [rollupBOMId, setRollupBOMId] = useState<string>("");
  const [rollupEffectiveDate, setRollupEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [overheadFixed, setOverheadFixed] = useState<number>(0);
  const [overheadPercent, setOverheadPercent] = useState<number>(0);
  const [rollupScrapType, setRollupScrapType] = useState<string>("");
  const [rollupScrapQty, setRollupScrapQty] = useState<number>(0);

  const [rollupResult, setRollupResult] = useState<any | null>(null);
  const [rollupLoading, setRollupLoading] = useState<boolean>(false);
  const [rollupError, setRollupError] = useState<string | null>(null);

  const handleRunRollup = async (isFinalSave: boolean = false) => {
    setRollupLoading(true);
    setRollupError(null);
    if (!rollupBOMId) {
      setRollupError("Please select a target BOM first.");
      setRollupLoading(false);
      return;
    }

    try {
      const overheads_applied = [];
      if (overheadFixed > 0) {
        overheads_applied.push({ overhead_type: "FIXED", overhead_value: Number(overheadFixed) });
      }
      if (overheadPercent > 0) {
        overheads_applied.push({ overhead_type: "PERCENTAGE", overhead_value: Number(overheadPercent) });
      }

      const payload: any = {
        bom_header_id: rollupBOMId,
        effective_date: rollupEffectiveDate,
        overheads: overheads_applied,
        scrap_type_id: rollupScrapType || undefined,
        scrap_quantity: rollupScrapQty > 0 ? Number(rollupScrapQty) : undefined
      };

      // If they want to finalize a cost sheet, we can check if there's a draft cost sheet for this BOM or create a new one.
      // Let's find if we can link to an existing cost sheet or create a new cost sheet first.
      if (isFinalSave) {
        // Let's create/find cost sheet for this BOM
        const matchedDraft = costSheets.find(cs => cs.bom_header_id === rollupBOMId && cs.status === "DRAFT");
        if (matchedDraft) {
          payload.cost_sheet_id = matchedDraft.id;
        } else {
          // Let's create a draft cost sheet first!
          const createCSRes = await apiFetch("/api/v1/cost-sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bom_header_id: rollupBOMId,
              revision_number: 1,
              status: "DRAFT",
              total_material_cost: 0,
              total_process_cost: 0,
              total_scrap_credit: 0,
              total_overhead_cost: 0,
              grand_total_cost: 0,
              lines: []
            })
          });
          if (createCSRes.ok) {
            const freshCS = await createCSRes.json();
            payload.cost_sheet_id = freshCS.id;
          } else {
            const errData = await createCSRes.json();
            throw new Error(errData.message || "Failed to provision empty Cost Sheet draft.");
          }
        }
      }

      const endpoint = isFinalSave ? "/api/v1/cost-sheets/calculate-final" : "/api/v1/cost-sheets/rollup-preview";
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setRollupError(data.message || "Failed to resolve final rollup calculations.");
      } else {
        setRollupResult(data);
        if (isFinalSave) {
          setSuccessMsg(`Final manufacturing cost sheet updated and snapshot generated successfully!`);
          fetchCostSheets();
        }
      }
    } catch (e: any) {
      setRollupError(e.message || "Network error running final manufacturing cost engine.");
    } finally {
      setRollupLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await apiFetch("/api/v1/materials");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch {
      setErrorMsg("Failed to query Material Master list.");
    }
  };

  const fetchProcesses = async () => {
    try {
      const res = await apiFetch("/api/v1/processes");
      if (res.ok) {
        const data = await res.json();
        setProcesses(data.filter((p: any) => !p.is_deleted && p.is_active));
      }
    } catch {
      setErrorMsg("Failed to query Process Master list.");
    }
  };

  const fetchScraps = async () => {
    try {
      const res = await apiFetch("/api/v1/scrap");
      if (res.ok) {
        const data = await res.json();
        setScraps(data.filter((s: any) => !s.is_deleted && s.is_active));
      }
    } catch {
      setErrorMsg("Failed to query Scrap Type Master list.");
    }
  };

  const handleCalculateScrapPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrapPreviewError(null);
    setScrapPreviewResult(null);
    setScrapPreviewLoading(true);

    if (!scrapPreviewInput.scrap_type) {
      setScrapPreviewError("Please select a target Scrap Type Master first.");
      setScrapPreviewLoading(false);
      return;
    }

    try {
      const payload: any = {
        scrap_quantity: Number(scrapPreviewInput.scrap_quantity),
        scrap_type: scrapPreviewInput.scrap_type,
        effective_date: scrapPreviewInput.effective_date
      };
      if (scrapPreviewInput.material_id) {
        payload.material_id = scrapPreviewInput.material_id;
      }
      if (scrapPreviewInput.material_quantity !== "") {
        payload.material_quantity = Number(scrapPreviewInput.material_quantity);
      }
      if (scrapPreviewInput.effective_consumption !== "") {
        payload.effective_consumption = Number(scrapPreviewInput.effective_consumption);
      }

      const res = await apiFetch("/api/v1/cost-sheets/scrap-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setScrapPreviewError(data.message || "Failed to resolve scrap preview calculation.");
      } else {
        setScrapPreviewResult(data);
      }
    } catch {
      setScrapPreviewError("Network error occurred while testing engine calculations.");
    } finally {
      setScrapPreviewLoading(false);
    }
  };

  const handleCalculateProcessPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessPreviewError(null);
    setProcessPreviewResult(null);
    setProcessPreviewLoading(true);

    if (!processPreviewInput.process_id) {
      setProcessPreviewError("Please select a target Process Master first.");
      setProcessPreviewLoading(false);
      return;
    }

    try {
      const payload: any = {
        process_id: processPreviewInput.process_id,
        quantity: Number(processPreviewInput.quantity),
        effective_date: processPreviewInput.effective_date
      };
      if (processPreviewInput.thickness !== "") {
        payload.thickness = Number(processPreviewInput.thickness);
      }
      if (processPreviewInput.sub_type.trim() !== "") {
        payload.sub_type = processPreviewInput.sub_type.trim();
      }

      const res = await apiFetch("/api/v1/cost-sheets/process-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setProcessPreviewError(data.message || "Failed to resolve process preview calculation.");
      } else {
        setProcessPreviewResult(data);
      }
    } catch {
      setProcessPreviewError("Network error occurred while testing engine calculations.");
    } finally {
      setProcessPreviewLoading(false);
    }
  };


  const handleCalculatePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewError(null);
    setPreviewResult(null);
    setPreviewLoading(true);

    if (!previewInput.material_id) {
      setPreviewError("Please select a target Material Master first.");
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await apiFetch("/api/v1/cost-sheets/material-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: previewInput.material_id,
          quantity: Number(previewInput.quantity),
          uom: previewInput.uom,
          waste_modifier: Number(previewInput.waste_modifier),
          effective_date: previewInput.effective_date
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.message || "Failed to resolve material preview calculation.");
      } else {
        setPreviewResult(data);
      }
    } catch {
      setPreviewError("Network error occurred while testing engine calculations.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchCostSheets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/cost-sheets");
      if (res.ok) {
        const data = await res.json();
        setCostSheets(data);
      }
    } catch {
      setErrorMsg("Failed to query Cost Sheet foundation index.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBOMs = async () => {
    try {
      const res = await apiFetch("/api/v1/boms");
      if (res.ok) {
        const data = await res.json();
        setBoms(data);
      }
    } catch {
      setErrorMsg("Could not fetch BOM list.");
    }
  };

  const loadBOMLines = async (bomId: string) => {
    if (!bomId) {
      setBomLines([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/v1/boms/${bomId}`);
      if (res.ok) {
        const data = await res.json();
        setBomLines(data.lines || []);
      }
    } catch {
      setErrorMsg("Failed to resolve selected BOM details.");
    }
  };

  useEffect(() => {
    fetchCostSheets();
    fetchBOMs();
    fetchMaterials();
    fetchProcesses();
    fetchScraps();
  }, []);

  useEffect(() => {
    loadBOMLines(selectedBOMId);
  }, [selectedBOMId]);

  const handleOpenCreate = () => {
    setSelectedBOMId("");
    setEditModeId(null);
    setFormData({
      revision_number: 1,
      status: "DRAFT",
      total_material_cost: 0,
      total_process_cost: 0,
      total_scrap_credit: 0,
      total_overhead_cost: 0,
      grand_total_cost: 0
    });
    setFormLines([]);
    setIsWorkspaceOpen(true);
  };

  const handleOpenEdit = async (cs: CostSheetHeader) => {
    setSelectedBOMId(cs.bom_header_id);
    setEditModeId(cs.id);
    setFormData({
      revision_number: cs.revision_number,
      status: cs.status,
      total_material_cost: cs.total_material_cost,
      total_process_cost: cs.total_process_cost,
      total_scrap_credit: cs.total_scrap_credit,
      total_overhead_cost: cs.total_overhead_cost,
      grand_total_cost: cs.grand_total_cost
    });
    setFormLines(cs.lines || []);
    setIsWorkspaceOpen(true);
  };

  const handleAddLine = () => {
    const dummyLine: CostSheetLine = {
      id: "temp-" + Math.random().toString(36).substring(2, 9),
      bom_line_id: "",
      parent_cost_line_id: null,
      item_type: "MATERIAL",
      base_rate: 0,
      raw_quantity: 0,
      waste_modifier: 1.0,
      calculated_subtotal: 0,
      audit_trail_json: null
    };
    setFormLines([...formLines, dummyLine]);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines(formLines.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index: number, field: keyof CostSheetLine, value: any) => {
    const lines = [...formLines];
    lines[index] = { ...lines[index], [field]: value };
    setFormLines(lines);
  };

  const handleSaveCostSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedBOMId) {
      setErrorMsg("BOM Reference is a required parent key relation.");
      return;
    }

    try {
      const payload = {
        bom_header_id: selectedBOMId,
        revision_number: Number(formData.revision_number) || 1,
        status: formData.status,
        total_material_cost: Number(formData.total_material_cost) || 0,
        total_process_cost: Number(formData.total_process_cost) || 0,
        total_scrap_credit: Number(formData.total_scrap_credit) || 0,
        total_overhead_cost: Number(formData.total_overhead_cost) || 0,
        grand_total_cost: Number(formData.grand_total_cost) || 0,
        lines: formLines.map(line => ({
          id: line.id.startsWith("temp-") ? undefined : line.id,
          bom_line_id: line.bom_line_id,
          parent_cost_line_id: line.parent_cost_line_id || null,
          item_type: line.item_type,
          base_rate: Number(line.base_rate) || 0,
          raw_quantity: Number(line.raw_quantity) || 0,
          waste_modifier: Number(line.waste_modifier) || 1.0,
          calculated_subtotal: Number(line.calculated_subtotal) || 0,
          audit_trail_json: line.audit_trail_json
        }))
      };

      const endpoint = editModeId ? `/api/v1/cost-sheets/${editModeId}` : "/api/v1/cost-sheets";
      const method = editModeId ? "PUT" : "POST";

      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to persist cost structure.");
        return;
      }

      setSuccessMsg(`Cost Sheet saved successfully.`);
      setIsWorkspaceOpen(false);
      fetchCostSheets();
    } catch {
      setErrorMsg("Network error trying to submit Cost Sheet structure.");
    }
  };

  const handleLockCostSheet = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/v1/cost-sheets/${id}/lock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to lock cost sheet.");
        return;
      }
      setSuccessMsg("Cost Sheet successfully transitioned to LOCKED. Archive snapshot generated.");
      fetchCostSheets();
    } catch {
      setErrorMsg("Failed to communicate lock transition.");
    }
  };

  const handleSupersedeCostSheet = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/v1/cost-sheets/${id}/supersede`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to supersede cost sheet.");
        return;
      }
      setSuccessMsg("Cost Sheet status transitioned to SUPERSEDED.");
      fetchCostSheets();
    } catch {
      setErrorMsg("Failed to communicate supersede status change.");
    }
  };

  const handleViewSnapshot = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/v1/cost-sheets/${id}/snapshot`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Snapshot file missing or uninitialized.");
        return;
      }
      setActiveSnapshot(data);
      setShowSnapshotModal(true);
    } catch {
      setErrorMsg("Failed to fetch calculation snapshot from server.");
    }
  };

  const getBOMLabel = (bomId: string) => {
    const matched = boms.find(b => b.id === bomId);
    return matched ? `${matched.part_number} (Rev ${matched.revision_number})` : bomId;
  };

  const filteredSheets = costSheets.filter(cs => {
    const bomLabel = getBOMLabel(cs.bom_header_id).toLowerCase();
    const sheetNum = cs.cost_sheet_number.toLowerCase();
    const creator = (cs.created_by || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return sheetNum.includes(query) || bomLabel.includes(query) || creator.includes(query);
  });

  // Role gates
  const userRole = authState.user?.role || "PM";
  const canModify = ["L2-Admin", "L1-Estimator"].includes(userRole);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5.5 h-5.5 text-emerald-400" />
            Cost Sheets Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase font-mono tracking-wider">
            SPRINT 2D-A Foundation Data Layer
          </p>
        </div>

        {!isWorkspaceOpen && canModify && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/20"
          >
            <Plus className="w-4 h-4" />
            Create Cost Sheet Header
          </button>
        )}
      </div>

      {!isWorkspaceOpen ? (
        <div className="space-y-6">
          {/* Sprint 2D-B Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("database")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "database"
                  ? "border-emerald-500 text-emerald-400 font-extrabold bg-slate-900/20"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Cost Sheets Database
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "preview"
                  ? "border-emerald-500 text-emerald-400 font-extrabold bg-slate-900/20"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Material Cost Preview Tool
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rollup")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "rollup"
                  ? "border-emerald-500 text-emerald-400 font-extrabold bg-slate-900/20"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              BOM Rollup & Final Cost Engine
            </button>
          </div>

          {activeTab === "database" ? (
            <div className="space-y-4">
              <div className="flex bg-slate-950 border border-slate-850 rounded-xl p-3 items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by Sheet number, BOM Part Number, or Creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-2 font-sans text-xs font-medium text-slate-300 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-850 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                      <th className="p-4">Sheet Number</th>
                      <th className="p-4">BOM Reference</th>
                      <th className="p-4">Revision</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Grand Total Cost</th>
                      <th className="p-4">Created By</th>
                      <th className="p-4">Last Updated</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-sans text-xs">
                    {filteredSheets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                          No matching registered Cost Sheet Headers present in persistent storage database.
                        </td>
                      </tr>
                    ) : (
                      filteredSheets.map((cs) => (
                        <tr key={cs.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4 font-mono font-bold text-white tracking-tight">
                            {cs.cost_sheet_number}
                          </td>
                          <td className="p-4 text-slate-300 font-medium">
                            {getBOMLabel(cs.bom_header_id)}
                          </td>
                          <td className="p-4 text-slate-400 font-mono">
                            v{cs.revision_number}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-block px-2.5 py-1 text-[9px] font-extrabold uppercase rounded font-mono border ${
                                cs.status === "DRAFT"
                                  ? "bg-slate-900 border-slate-700 text-slate-400"
                                  : cs.status === "CALCULATED"
                                  ? "bg-blue-950/20 border-blue-900/60 text-blue-400"
                                  : cs.status === "LOCKED"
                                  ? "bg-emerald-950/20 border-emerald-900/60 text-emerald-400"
                                  : "bg-rose-950/20 border-rose-900/60 text-rose-400"
                              }`}
                            >
                              {cs.status}
                            </span>
                          </td>
                          <td className="p-4 text-emerald-400 font-bold font-mono">
                            ₹{(Number(cs.grand_total_cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-slate-400 font-medium max-w-[150px] truncate" title={cs.created_by || "System"}>
                            {cs.created_by || "System"}
                          </td>
                          <td className="p-4 text-slate-500 font-mono">
                            {new Date(cs.updated_at).toLocaleString()}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {cs.status === "DRAFT" && canModify && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(cs)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] font-bold uppercase text-slate-300 rounded border border-slate-800"
                              >
                                Edit
                              </button>
                            )}
                            {["DRAFT", "CALCULATED"].includes(cs.status) && canModify && (
                              <button
                                type="button"
                                onClick={() => handleLockCostSheet(cs.id)}
                                className="px-2.5 py-1.5 bg-emerald-900/20 hover:bg-emerald-900/40 text-[10px] font-bold uppercase text-emerald-400 rounded border border-emerald-900/50"
                                title="Lock this Sheet and trigger permanent snapshot freezing"
                              >
                                Lock
                              </button>
                            )}
                            {cs.status === "LOCKED" && canModify && (
                              <button
                                type="button"
                                onClick={() => handleSupersedeCostSheet(cs.id)}
                                className="px-2.5 py-1.5 bg-rose-900/20 hover:bg-rose-900/40 text-[10px] font-bold uppercase text-rose-400 rounded border border-rose-900/50"
                                title="Mark this sheet as superseded/historical"
                              >
                                Supersede
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleViewSnapshot(cs.id)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] font-bold uppercase text-slate-400 rounded border border-slate-800"
                              title="View system calculation logs snippet"
                            >
                              Snapshot
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* SPRINT 2D-C Interactive Cost Preview Panel */
            <div className="space-y-6">
              {/* Sub-tab Navigation */}
              <div className="flex border-b border-slate-800 gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setPreviewType("material")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    previewType === "material"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Material Cost Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewType("process")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    previewType === "process"
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Process Cost Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewType("scrap")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    previewType === "scrap"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Scrap Recovery Preview
                </button>
              </div>

              {previewType === "material" && (
                <div className="space-y-6">
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                    <div className="border-b border-slate-850 pb-4 mb-6">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        Interactive Material Cost Testing Engine
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono tracking-wide mt-1">
                        Sprint 2D-B Isolated Calculation Testing Sandbox
                      </p>
                    </div>

                    <form onSubmit={handleCalculatePreview} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Target Material Master
                        </label>
                        <select
                          value={previewInput.material_id}
                          onChange={(e) => setPreviewInput({ ...previewInput, material_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        >
                          <option value="">-- Select Material Master Record --</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.description} ({m.std_unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          BOM Line Raw Qty
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={previewInput.quantity}
                          onChange={(e) => setPreviewInput({ ...previewInput, quantity: Number(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          BOM Line UOM
                        </label>
                        <select
                          value={previewInput.uom}
                          onChange={(e) => setPreviewInput({ ...previewInput, uom: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        >
                          <option value="KG">KG (KiloGrams)</option>
                          <option value="G">G (Grams)</option>
                          <option value="M">M (Meters)</option>
                          <option value="MM">MM (Millimeters)</option>
                          <option value="SQM">SQM (Square Meters)</option>
                          <option value="SQMM">SQMM (Square Millimeters)</option>
                          <option value="HOURS">HOURS (Mismatched/Testing)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Waste Factor
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1.0"
                          value={previewInput.waste_modifier}
                          onChange={(e) => setPreviewInput({ ...previewInput, waste_modifier: Number(e.target.value) || 1.0 })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Effective date
                        </label>
                        <input
                          type="date"
                          value={previewInput.effective_date}
                          onChange={(e) => setPreviewInput({ ...previewInput, effective_date: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div className="md:col-span-5 flex justify-end mt-2">
                        <button
                          type="submit"
                          disabled={previewLoading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/20 disabled:opacity-50"
                        >
                          {previewLoading ? "Running calculations..." : "Calculate Cost Preview"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {previewError && (
                    <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-300 uppercase font-sans">
                          Engine Rule Failure Detected
                        </h4>
                        <p className="text-xs text-rose-400 mt-1 font-mono">
                          {previewError}
                        </p>
                      </div>
                    </div>
                  )}

                  {previewResult && (
                    <div className="space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Resolved Material
                          </p>
                          <p className="text-sm font-bold text-white mt-1">
                            {previewResult.material_code}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                            ID: {previewResult.material_id}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Input Quantity / UOM
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {previewResult.original_quantity} {previewResult.original_uom}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {previewResult.conversion_applied !== "None" ? "Conversion applied" : "No conversion needed"}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Converted Qty / std_unit
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {previewResult.resolved_quantity} {previewResult.resolved_uom}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {previewResult.conversion_applied}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-emerald-900/40 bg-emerald-950/5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                            Resolved Rate / unit
                          </p>
                          <p className="text-sm font-mono font-bold text-emerald-400 mt-1">
                            ₹{previewResult.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {previewResult.rate_unit}
                          </p>
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            Active Rate Card: {previewResult.rate_card_id.slice(0, 8)}...
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Waste Modifier Applied
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {(previewResult.waste_modifier * 100).toFixed(0)}% ({previewResult.waste_modifier}x)
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Waste qty: {previewResult.waste_quantity.toFixed(4)} {previewResult.resolved_uom}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Effective Quantity
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {previewResult.effective_quantity} {previewResult.resolved_uom}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            (Raw qty + waste)
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Effective Date Used
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {previewResult.effective_date_used}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Historical matching applied
                          </p>
                        </div>

                        <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            Material Cost Subtotal
                          </p>
                          <p className="text-base font-mono font-black text-emerald-400 mt-1">
                            ₹{previewResult.material_subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            Tax / Process / Overheads excluded
                          </p>
                        </div>
                      </div>

                      {/* Traceability Logs */}
                      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          Material Cost Engine Audit Trail
                        </h4>

                        <div className="space-y-4 font-mono text-xs">
                          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">
                              Explanation:
                            </span>
                            <p className="text-slate-300 font-sans text-xs">
                              {previewResult.calculation_explanation}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">
                              audit_trail_json Structure:
                            </span>
                            <pre className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl text-[10.5px] text-emerald-400 overflow-x-auto">
                              {JSON.stringify(JSON.parse(previewResult.audit_trail_json), null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previewType === "process" && (
                /* SPRINT 2D-C Process Cost Preview Panel */
                <div className="space-y-6">
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                    <div className="border-b border-slate-850 pb-4 mb-6">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-purple-400" />
                        Interactive Process Cost Testing Engine
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono tracking-wide mt-1">
                        Sprint 2D-C Isolated Process Calculation Testing Sandbox
                      </p>
                    </div>

                    <form onSubmit={handleCalculateProcessPreview} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Target Process Master
                        </label>
                        <select
                          value={processPreviewInput.process_id}
                          onChange={(e) => setProcessPreviewInput({ ...processPreviewInput, process_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        >
                          <option value="">-- Select Process Master Record --</option>
                          {processes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.driver_type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Driver Quantity
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          value={processPreviewInput.quantity}
                          onChange={(e) => setProcessPreviewInput({ ...processPreviewInput, quantity: Number(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Thickness (mm, optional)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 3.0"
                          value={processPreviewInput.thickness}
                          onChange={(e) => setProcessPreviewInput({ ...processPreviewInput, thickness: e.target.value !== "" ? Number(e.target.value) : "" })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Material Subtype (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MS, SS"
                          value={processPreviewInput.sub_type}
                          onChange={(e) => setProcessPreviewInput({ ...processPreviewInput, sub_type: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={processPreviewInput.effective_date}
                          onChange={(e) => setProcessPreviewInput({ ...processPreviewInput, effective_date: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div className="md:col-span-5 flex justify-end mt-2">
                        <button
                          type="submit"
                          disabled={processPreviewLoading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-950/20 disabled:opacity-50"
                        >
                          {processPreviewLoading ? "Running calculations..." : "Calculate Process Cost"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {processPreviewError && (
                    <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-300 uppercase font-sans">
                          Engine Rule Failure Detected
                        </h4>
                        <p className="text-xs text-rose-400 mt-1 font-mono">
                          {processPreviewError}
                        </p>
                      </div>
                    </div>
                  )}

                  {processPreviewResult && (
                    <div className="space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Process Name
                          </p>
                          <p className="text-sm font-bold text-white mt-1">
                            {processPreviewResult.process_code}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                            ID: {processPreviewResult.process_id}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Driver Type / Quantity
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {processPreviewResult.driver_quantity} ({processPreviewResult.resolved_driver_type})
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Standard billing unit driver
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Specifications Matching
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {processPreviewResult.resolved_subtype || "None"}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {processPreviewResult.resolved_thickness !== null ? `${processPreviewResult.resolved_thickness} mm` : "No thickness required"}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-purple-900/40 bg-purple-950/5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                            Resolved Rate / unit
                          </p>
                          <p className="text-sm font-mono font-bold text-purple-400 mt-1">
                            ₹{processPreviewResult.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {processPreviewResult.rate_unit}
                          </p>
                          <p className="text-[10px] text-purple-500 mt-0.5">
                            Active Rate Card: {processPreviewResult.rate_card_id.slice(0, 8)}...
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Effective Date Used
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {processPreviewResult.effective_date_used}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Historical matching applied
                          </p>
                        </div>

                        <div className="bg-purple-950/30 border border-purple-500/30 p-4 rounded-2xl md:col-span-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                            Process Cost Subtotal
                          </p>
                          <p className="text-base font-mono font-black text-purple-400 mt-1">
                            ₹{processPreviewResult.process_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-purple-500 mt-0.5">
                            Material / Scrap / Overheads excluded
                          </p>
                        </div>
                      </div>

                      {/* Traceability Logs */}
                      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-purple-500" />
                          Process Cost Engine Audit Trail
                        </h4>

                        <div className="space-y-4 font-mono text-xs">
                          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">
                              Explanation:
                            </span>
                            <p className="text-slate-300 font-sans text-xs">
                              {JSON.parse(processPreviewResult.audit_trail_json).explanation || `Calculated process cost for ${processPreviewResult.process_code}`}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">
                              audit_trail_json Structure:
                            </span>
                            <pre className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl text-[10.5px] text-purple-400 overflow-x-auto">
                              {JSON.stringify(JSON.parse(processPreviewResult.audit_trail_json), null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previewType === "scrap" && (
                /* SPRINT 2D-D Scrap Recovery Preview Panel */
                <div className="space-y-6">
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                    <div className="border-b border-slate-850 pb-4 mb-6">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-amber-400" />
                        Interactive Scrap Recovery Testing Engine
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono tracking-wide mt-1">
                        Sprint 2D-D Isolated Calculation Testing Sandbox
                      </p>
                    </div>

                    <form onSubmit={handleCalculateScrapPreview} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Target Scrap Type Master
                        </label>
                        <select
                          value={scrapPreviewInput.scrap_type}
                          onChange={(e) => setScrapPreviewInput({ ...scrapPreviewInput, scrap_type: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        >
                          <option value="">-- Select Scrap Type Master Record --</option>
                          {scraps.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Scrap Quantity (KG)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0"
                          value={scrapPreviewInput.scrap_quantity}
                          onChange={(e) => setScrapPreviewInput({ ...scrapPreviewInput, scrap_quantity: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Parent Material (Opt)
                        </label>
                        <select
                          value={scrapPreviewInput.material_id}
                          onChange={(e) => setScrapPreviewInput({ ...scrapPreviewInput, material_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        >
                          <option value="">-- Optional --</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Material Qty (Opt)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={scrapPreviewInput.material_quantity}
                          onChange={(e) => setScrapPreviewInput({ ...scrapPreviewInput, material_quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Eff. Date
                        </label>
                        <input
                          type="date"
                          value={scrapPreviewInput.effective_date}
                          onChange={(e) => setScrapPreviewInput({ ...scrapPreviewInput, effective_date: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        />
                      </div>

                      <div className="md:col-span-6 flex justify-end">
                        <button
                          type="submit"
                          disabled={scrapPreviewLoading}
                          className="bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          {scrapPreviewLoading ? "Computing..." : "Test Calculations"}
                        </button>
                      </div>
                    </form>

                    {scrapPreviewError && (
                      <div className="mt-4 p-4 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400 font-mono tracking-wide leading-relaxed">
                          {scrapPreviewError}
                        </p>
                      </div>
                    )}
                  </div>

                  {scrapPreviewResult && (
                    <div className="space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Scrap Type Name
                          </p>
                          <p className="text-sm font-bold text-white mt-1">
                            {scrapPreviewResult.scrap_type_name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                            Code: {scrapPreviewResult.scrap_type_code}
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Scrap Quantity
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {scrapPreviewResult.scrap_quantity} KG
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Measured scrap output
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-amber-900/40 bg-amber-950/5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                            Resolved Rate / unit
                          </p>
                          <p className="text-sm font-mono font-bold text-amber-400 mt-1">
                            ₹{scrapPreviewResult.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {scrapPreviewResult.rate_unit}
                          </p>
                          <p className="text-[10px] text-amber-500 mt-0.5">
                            Rate Card: {scrapPreviewResult.rate_card_id.slice(0, 8)}...
                          </p>
                        </div>

                        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Effective Date Used
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                            {scrapPreviewResult.effective_date_used}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Historical matching applied
                          </p>
                        </div>

                        <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-2xl md:col-span-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            Recovery Credit Subtotal
                          </p>
                          <p className="text-base font-mono font-black text-amber-400 mt-1">
                            ₹{scrapPreviewResult.recovery_credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-amber-500 mt-0.5">
                            Material and processing charges excluded
                          </p>
                        </div>
                      </div>

                      {/* Traceability Logs */}
                      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-amber-500" />
                          Scrap Recovery Engine Audit Trail
                        </h4>

                        <div className="space-y-4 font-mono text-xs">
                          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">
                              Explanation:
                            </span>
                            <p className="text-slate-300 font-sans text-xs">
                              {scrapPreviewResult.calculation_explanation || `Calculated scrap recovery for ${scrapPreviewResult.scrap_type_code}`}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">
                              audit_trail_json Structure:
                            </span>
                            <pre className="bg-slate-900/60 p-4 border border-slate-800 rounded-xl text-[10.5px] text-amber-400 overflow-x-auto">
                              {JSON.stringify(JSON.parse(scrapPreviewResult.audit_trail_json), null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rollup" && (
                <div className="space-y-6">
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                    <div className="border-b border-slate-850 pb-4 mb-6">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-purple-400" />
                        BOM Rollup & Final Manufacturing Cost Engine
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono tracking-wide mt-1">
                        Recursive BOM Rollup, Overhead Injection, Scrap Recovery, and Audit Trail Finalization
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Target BOM Master
                        </label>
                        <select
                          value={rollupBOMId}
                          onChange={(e) => setRollupBOMId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        >
                          <option value="">-- Choose BOM Master Record --</option>
                          {boms.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.part_number} (Rev {b.revision_number}) {b.description ? `- ${b.description}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Rate Effective Date
                        </label>
                        <input
                          type="date"
                          value={rollupEffectiveDate}
                          onChange={(e) => setRollupEffectiveDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Scrap Recovery Type
                        </label>
                        <select
                          value={rollupScrapType}
                          onChange={(e) => setRollupScrapType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        >
                          <option value="">-- Optional Scrap Type --</option>
                          {scraps.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Scrap Quantity (KG)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rollupScrapQty}
                          onChange={(e) => setRollupScrapQty(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Fixed Overhead Cost (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={overheadFixed}
                          onChange={(e) => setOverheadFixed(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Percentage Overhead Cost (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={overheadPercent}
                          onChange={(e) => setOverheadPercent(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => handleRunRollup(false)}
                          disabled={rollupLoading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                        >
                          Calculate Rollup Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunRollup(true)}
                          disabled={rollupLoading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-950/20 disabled:opacity-50"
                        >
                          {rollupLoading ? "Running..." : "Finalize & Save Cost Sheet"}
                        </button>
                      </div>
                    </div>

                    {rollupError && (
                      <div className="mt-4 p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-rose-300 uppercase font-sans">
                            Rollup Engine Error Detected
                          </h4>
                          <p className="text-xs text-rose-400 mt-1 font-mono">
                            {rollupError}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {rollupResult && (
                    <div className="space-y-6">
                      {/* Cost Summary Cards */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Final Cost Components</h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Material Cost
                            </p>
                            <p className="text-sm font-mono font-bold text-emerald-400 mt-1">
                              ₹{Number(rollupResult.total_material_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Process Cost
                            </p>
                            <p className="text-sm font-mono font-bold text-purple-400 mt-1">
                              ₹{Number(rollupResult.total_process_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Scrap Credit
                            </p>
                            <p className="text-sm font-mono font-bold text-amber-500 mt-1">
                              -₹{Number(rollupResult.total_scrap_credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Overhead Cost
                            </p>
                            <p className="text-sm font-mono font-bold text-slate-300 mt-1">
                              ₹{Number(rollupResult.total_overhead_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Sub Assembly Cost
                            </p>
                            <p className="text-sm font-mono font-bold text-blue-400 mt-1">
                              ₹{Number(rollupResult.sub_assembly_costs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div className="bg-purple-950/30 border border-purple-500/30 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                              Final Mfg Cost
                            </p>
                            <p className="text-sm font-mono font-bold text-purple-300 mt-1">
                              ₹{Number(rollupResult.grand_total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Cost Breakdown Visual percentage indicators */}
                      {rollupResult.breakdown_percentages && (
                        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Cost Breakdown Percentages
                          </h4>

                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-emerald-400">Material Cost</span>
                                <span className="text-slate-300">{Number(rollupResult.breakdown_percentages.material_percentage).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${rollupResult.breakdown_percentages.material_percentage}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-purple-400">Process Cost</span>
                                <span className="text-slate-300">{Number(rollupResult.breakdown_percentages.process_percentage).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${rollupResult.breakdown_percentages.process_percentage}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-amber-500">Scrap Credit (Offset)</span>
                                <span className="text-slate-300">{Number(rollupResult.breakdown_percentages.scrap_percentage).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${rollupResult.breakdown_percentages.scrap_percentage}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-slate-400">Overhead Cost</span>
                                <span className="text-slate-300">{Number(rollupResult.breakdown_percentages.overhead_percentage).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-slate-400 h-full rounded-full" style={{ width: `${rollupResult.breakdown_percentages.overhead_percentage}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-blue-400">Sub Assembly Cost</span>
                                <span className="text-slate-300">{Number(rollupResult.breakdown_percentages.sub_assembly_percentage || 0).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${rollupResult.breakdown_percentages.sub_assembly_percentage || 0}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Traceability Tree */}
                      {rollupResult.traceability_tree && (
                        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Calculation & Traceability Tree
                          </h4>
                          <p className="text-[11px] text-slate-500 font-sans">
                            Trace every raw quantity, base rate, waste modifier, and subtotal directly to its source.
                          </p>

                          <div className="border border-slate-850 rounded-xl p-4 bg-slate-900/40">
                            <TraceabilityTreeNode node={rollupResult.traceability_tree} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveCostSheet} className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-850 pb-4">
            <button
              type="button"
              onClick={() => setIsWorkspaceOpen(false)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Index
            </button>
            <span className="text-xs font-mono font-bold bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-slate-300">
              {editModeId ? "EDIT MODE" : "CREATE NEW COST REGISTER"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">BOM Source Header</label>
              <select
                disabled={editModeId !== null}
                value={selectedBOMId}
                onChange={(e) => setSelectedBOMId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-50"
              >
                <option value="">-- Choose BOM Master --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.part_number} (Rev {b.revision_number}) {b.description ? `- ${b.description}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Revision Control Number</label>
              <input
                type="number"
                min="1"
                value={formData.revision_number}
                onChange={(e) => setFormData({ ...formData, revision_number: Number(e.target.value) || 1 })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status Group</label>
              <select
                disabled={editModeId !== null && formData.status !== "DRAFT"}
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-50"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="CALCULATED">CALCULATED</option>
                {editModeId !== null && <option value="LOCKED">LOCKED</option>}
                {editModeId !== null && <option value="SUPERSEDED">SUPERSEDED</option>}
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Manual Cost Headers (Sprint 2D-A Persistence Layer Mock)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Total Material Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_material_cost}
                  onChange={(e) => setFormData({ ...formData, total_material_cost: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Total Process Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_process_cost}
                  onChange={(e) => setFormData({ ...formData, total_process_cost: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Total Scrap Credit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_scrap_credit}
                  onChange={(e) => setFormData({ ...formData, total_scrap_credit: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">Total Overhead Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_overhead_cost}
                  onChange={(e) => setFormData({ ...formData, total_overhead_cost: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1 font-bold">Grand Total Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.grand_total_cost}
                  onChange={(e) => setFormData({ ...formData, grand_total_cost: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-emerald-900 rounded-lg p-2 text-xs font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Embedded Line Items</h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10.5px] font-bold text-slate-300 rounded-lg transition-colors"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-3">
              {formLines.length === 0 ? (
                <p className="text-center py-6 border border-dashed border-slate-850 rounded-xl text-xs text-slate-500 font-mono">
                  No line items active. Click Add Line to construct persistent line records.
                </p>
              ) : (
                formLines.map((line, index) => (
                  <div key={line.id} className="grid grid-cols-1 md:grid-cols-8 gap-3 bg-slate-900/40 p-3 border border-slate-850 rounded-xl items-center">
                    <div className="md:col-span-2">
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Source BOM Line</label>
                      <select
                        value={line.bom_line_id}
                        onChange={(e) => handleLineChange(index, "bom_line_id", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300"
                      >
                        <option value="">-- Choose BOM Line --</option>
                        {bomLines.map(bl => (
                          <option key={bl.id} value={bl.id}>
                            [{bl.sequence_number}] {bl.line_type} {bl.description ? `- ${bl.description}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Item Type</label>
                      <select
                        value={line.item_type}
                        onChange={(e) => handleLineChange(index, "item_type", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300"
                      >
                        <option value="MATERIAL">MATERIAL</option>
                        <option value="PROCESS">PROCESS</option>
                        <option value="SUB_ASSEMBLY">SUB_ASSEMBLY</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Base Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.base_rate}
                        onChange={(e) => handleLineChange(index, "base_rate", Number(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Raw Quantity</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={line.raw_quantity}
                        onChange={(e) => handleLineChange(index, "raw_quantity", Number(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Waste Modifier</label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.waste_modifier}
                        onChange={(e) => handleLineChange(index, "waste_modifier", Number(e.target.value) || 1.0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-500 mb-0.5">Calculated Subtotal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.calculated_subtotal}
                        onChange={(e) => handleLineChange(index, "calculated_subtotal", Number(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px] text-slate-300 font-mono"
                      />
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove Line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-850 pt-4">
            <button
              type="button"
              onClick={() => setIsWorkspaceOpen(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Record
            </button>
          </div>
        </form>
      )}

      {/* Snapshot Modal */}
      {showSnapshotModal && activeSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center bg-slate-950 px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4.5 h-4.5 text-emerald-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-white">Calculation Snapshot Archive</h3>
              </div>
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-1 text-slate-400">
                <p><span className="text-slate-500">Snapshot ID:</span> {activeSnapshot.id}</p>
                <p><span className="text-slate-500">Cost Sheet ID:</span> {activeSnapshot.cost_sheet_header_id}</p>
                <p><span className="text-slate-500">Archived At:</span> {new Date(activeSnapshot.created_at).toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider block">Computational logs:</span>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] text-emerald-400 overflow-y-auto max-h-32">
                  {activeSnapshot.computational_log}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10.5px]">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider block">Constant Multipliers:</span>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(JSON.parse(activeSnapshot.formula_constants_snapshot_json || "{}"), null, 2)}
                  </pre>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider block">Rate Card Snapshot Logs:</span>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(JSON.parse(activeSnapshot.rate_card_snapshot_json || "[]"), null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 bg-slate-950 border-t border-slate-850">
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-300 font-sans text-xs font-bold uppercase tracking-widest border border-slate-800"
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
