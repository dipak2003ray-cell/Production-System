import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  AlertCircle,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  Save,
  FileSpreadsheet,
  List,
  UserCheck
} from "lucide-react";
import { AuthState } from "../types";

interface BOMHubViewProps {
  authState: AuthState;
  apiFetch: (url: string, options?: any) => Promise<Response>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

interface BOMHeader {
  id: string;
  part_number: string;
  revision_number: number;
  customer_id: string | null;
  description: string | null;
  status: "DRAFT" | "RELEASED" | "SUPERSEDED";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BOMLine {
  id?: string;
  parent_bom_line_id: string | null;
  line_type: "MATERIAL" | "PROCESS" | "SUB_ASSEMBLY" | "NOTE";
  sequence_number: number;
  material_id: string | null;
  process_id: string | null;
  sub_assembly_bom_id: string | null;
  description: string | null;
  quantity: number;
  uom: string;
  remarks: string | null;
}

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface Material {
  id: string;
  code: string;
  description: string;
}

interface Process {
  id: string;
  name: string;
  is_active: boolean;
}

interface ValidationReport {
  is_valid: boolean;
  errors: Array<{ bom_line_id?: string; field: string; message: string }>;
  warnings: string[];
}

export const BOMHubView: React.FC<BOMHubViewProps> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  // Lists state
  const [boms, setBoms] = useState<BOMHeader[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);

  // Selection states
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [activeBom, setActiveBom] = useState<(BOMHeader & { lines: BOMLine[] }) | null>(null);
  const [bomTree, setBomTree] = useState<any[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // View States
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "tree" | "validation">("workspace");

  // Form Header State
  const [headerForm, setHeaderForm] = useState({
    part_number: "",
    customer_id: "",
    description: ""
  });

  // Lines builder state
  const [linesForm, setLinesForm] = useState<BOMLine[]>([]);

  // Load masters
  useEffect(() => {
    fetchMastersAndBOMs();
  }, []);

  const fetchMastersAndBOMs = async () => {
    try {
      const resBoms = await apiFetch("/api/v1/boms");
      if (resBoms.ok) {
        setBoms(await resBoms.json());
      }
      
      const resCust = await apiFetch("/api/v1/customers");
      if (resCust.ok) {
        setCustomers(await resCust.json());
      }

      const resMat = await apiFetch("/api/v1/materials");
      if (resMat.ok) {
        setMaterials(await resMat.json());
      }

      const resProc = await apiFetch("/api/v1/processes");
      if (resProc.ok) {
        setProcesses(await resProc.json());
      }
    } catch {
      setErrorMsg("Error connecting to server registers.");
    }
  };

  const loadBOMDetails = async (bomId: string) => {
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      setValidationReport(null);
      setSelectedBomId(bomId);
      setIsCreating(false);

      const res = await apiFetch(`/api/v1/boms/${bomId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveBom(data);
        setLinesForm(data.lines || []);
        setHeaderForm({
          part_number: data.part_number,
          customer_id: data.customer_id || "",
          description: data.description || ""
        });
        
        // Fetch matching tree structure
        const resTree = await apiFetch(`/api/v1/boms/${bomId}/tree`);
        if (resTree.ok) {
          setBomTree(await resTree.json());
        }
      } else {
        setErrorMsg("Failed loading requested BOM details.");
      }
    } catch {
      setErrorMsg("Error retrieval requested database items.");
    }
  };

  const handleStartCreate = () => {
    setActiveBom(null);
    setSelectedBomId(null);
    setValidationReport(null);
    setBomTree([]);
    setHeaderForm({ part_number: "", customer_id: "", description: "" });
    setLinesForm([]);
    setIsCreating(true);
    setActiveTab("workspace");
  };

  const handleAddLine = (type: "MATERIAL" | "PROCESS" | "SUB_ASSEMBLY" | "NOTE") => {
    const nextSeq = linesForm.length > 0 ? Math.max(...linesForm.map(l => l.sequence_number)) + 10 : 10;
    
    // Choose sensible default standard UOM
    let defaultUom = "Pcs";
    if (type === "MATERIAL") defaultUom = "kg";
    if (type === "PROCESS") defaultUom = "hours";

    setLinesForm([
      ...linesForm,
      {
        id: "temp-" + Math.random().toString(36).substring(2, 11),
        parent_bom_line_id: null,
        line_type: type,
        sequence_number: nextSeq,
        material_id: null,
        process_id: null,
        sub_assembly_bom_id: null,
        description: "",
        quantity: 1,
        uom: defaultUom,
        remarks: ""
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    const target = linesForm[index];
    let list = [...linesForm];
    list.splice(index, 1);
    
    // Cleanup parent pointers targeting this line if deleted
    if (target.id) {
      list = list.map(l => l.parent_bom_line_id === target.id ? { ...l, parent_bom_line_id: null } : l);
    }
    setLinesForm(list);
  };

  const handleLineChange = (index: number, field: keyof BOMLine, value: any) => {
    const list = [...linesForm];
    list[index] = { ...list[index], [field]: value };
    setLinesForm(list);
  };

  const handleSaveBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerForm.part_number.trim()) {
      setErrorMsg("The Part Number is a mandatory specification.");
      return;
    }

    try {
      setErrorMsg(null);
      setSuccessMsg(null);

      const url = isCreating ? "/api/v1/boms" : `/api/v1/boms/${selectedBomId}`;
      const method = isCreating ? "POST" : "PUT";

      const payload = {
        part_number: headerForm.part_number,
        customer_id: headerForm.customer_id || null,
        description: headerForm.description,
        lines: linesForm
      };

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`BOM Successfully Saved in DRAFT status!`);
        await fetchMastersAndBOMs();
        await loadBOMDetails(data.id);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed saving BOM configuration.");
      }
    } catch {
      setErrorMsg("Exception occurred while communicating with database.");
    }
  };

  const handleValidateBOM = async () => {
    if (!selectedBomId) return;
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiFetch(`/api/v1/boms/${selectedBomId}/validate`, { method: "POST" });
      if (res.ok) {
        const report: ValidationReport = await res.json();
        setValidationReport(report);
        setActiveTab("validation");
        if (report.is_valid) {
          setSuccessMsg("Programmatic validation clean! All integrity audits passed successfully.");
        } else {
          setErrorMsg("BOM Validation returned errors. Resolve flagged elements before release.");
        }
      }
    } catch {
      setErrorMsg("Error generating validation suite report.");
    }
  };

  const handleReleaseBOM = async () => {
    if (!selectedBomId) return;
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiFetch(`/api/v1/boms/${selectedBomId}/release`, { method: "POST" });
      if (res.ok) {
        setSuccessMsg("BOM has been successfully locked and RELEASED! Old active revisions are now SUPERSEDED.");
        await fetchMastersAndBOMs();
        await loadBOMDetails(selectedBomId);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "BOM Release failed. Make sure all validation audits are clean.");
      }
    } catch {
      setErrorMsg("Error locking BOM for release.");
    }
  };

  const handleCreateNewRevision = async () => {
    if (!selectedBomId) return;
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await apiFetch(`/api/v1/boms/${selectedBomId}/new-revision`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Revision increment generated! New version is DRAFT Rev ${data.revision_number}.`);
        await fetchMastersAndBOMs();
        await loadBOMDetails(data.id);
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Could not instantiate next revision.");
      }
    } catch {
      setErrorMsg("Error triggering revision cloning workflow.");
    }
  };

  // Recursive Tree Rendering Renderer node
  const renderTreeNode = (node: any, depth = 0) => {
    const isError = node.validation_status === "CIRCULAR_DEPENDENCY" || node.id.startsWith("err-");
    
    // Resolve labels
    let label = node.description || "";
    if (node.line_type === "MATERIAL") {
      const mat = materials.find(m => m.id === node.material_id);
      label = `[MAT] ${mat ? mat.code : node.material_id} • ${node.description || "Raw Material"}`;
    } else if (node.line_type === "PROCESS") {
      const proc = processes.find(p => p.id === node.process_id);
      label = `[PROC] ${proc ? proc.name : node.process_id} ${node.description ? `• ${node.description}` : ""}`;
    } else if (node.line_type === "SUB_ASSEMBLY") {
      const sub = boms.find(b => b.id === node.sub_assembly_bom_id);
      label = `[SUB-ASSY] ${sub ? `${sub.part_number} (Rev ${sub.revision_number})` : node.sub_assembly_bom_id}`;
    } else if (node.line_type === "NOTE") {
      label = `[NOTE] ${node.description || ""}`;
    }

    return (
      <div key={node.id} className="space-y-1.5" style={{ marginLeft: `${depth * 20}px` }}>
        <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
          isError 
            ? "bg-rose-950/40 border-rose-800 text-rose-200" 
            : node.line_type === "SUB_ASSEMBLY"
              ? "bg-indigo-950/40 border-indigo-800/80 text-indigo-100"
              : "bg-slate-900 border-slate-800/80 text-slate-300"
        }`}>
          <div className="flex items-center gap-2">
            {node.line_type === "SUB_ASSEMBLY" ? (
              <GitBranch className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className="font-mono text-slate-500 font-bold">Seq {node.sequence_number} •</span>
            <span>{label}</span>
          </div>
          {node.quantity > 0 && (
            <div className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-emerald-400 border border-slate-800">
              Q: {node.quantity} {node.uom}
            </div>
          )}
        </div>
        {node.children && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Bill of Materials (BOM) Foundation Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Establish, validate, and revision high-integrity hierarchical product architectures (Sprint 2C)
          </p>
        </div>
        <div>
          <button
            onClick={handleStartCreate}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg px-4 py-2 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Design New BOM Template</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Register Table lists of BOMs */}
        <div className="xl:col-span-4 bg-slate-950 border border-slate-800/85 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2.5 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Corporate BOM Index</span>
          </h3>

          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
            {boms.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-medium">
                No Bill of Materials designs found. Click Design New BOM above.
              </div>
            ) : (
              boms.map(b => (
                <button
                  key={b.id}
                  onClick={() => loadBOMDetails(b.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex items-center justify-between ${
                    selectedBomId === b.id
                      ? "bg-slate-900 border-emerald-500 shadow-emerald-500/10 shadow-md"
                      : "bg-slate-950 hover:bg-slate-900/60 border-slate-800/80 text-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span className="font-mono">{b.part_number}</span>
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold">
                        Rev {b.revision_number}
                      </span>
                    </div>
                    {b.description && (
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {b.description}
                      </p>
                    )}
                  </div>

                  <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    b.status === "RELEASED"
                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                      : b.status === "SUPERSEDED"
                        ? "bg-slate-900 text-slate-500 border border-slate-800"
                        : "bg-amber-950/80 text-amber-400 border border-amber-800/80"
                  }`}>
                    {b.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Workspace & Builder Desk */}
        <div className="xl:col-span-8 bg-slate-950 border border-slate-800/85 rounded-xl p-5 shadow-xl">
          {(!activeBom && !isCreating) ? (
            <div className="h-[450px] flex flex-col items-center justify-center text-center space-y-3">
              <Layers className="w-12 h-12 text-slate-700 animate-pulse" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-300">No BOM Template Active</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Select an existing corporate template on the left panel, or click Design New BOM to create a modular layout.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-xs text-white uppercase tracking-wider font-mono">
                    {isCreating ? "Design Workspace (New)" : `Editor Workspace (${headerForm.part_number})`}
                  </span>
                  {activeBom && (
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${
                      activeBom.status === "RELEASED"
                        ? "bg-emerald-950 text-emerald-400"
                        : activeBom.status === "SUPERSEDED"
                          ? "bg-slate-900 text-slate-500"
                          : "bg-amber-950 text-amber-400"
                    }`}>
                      {activeBom.status}
                    </span>
                  )}
                </div>

                {/* Operations */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("workspace")}
                    className={`px-3 py-1 text-xs font-semibold rounded ${
                      activeTab === "workspace" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Builder Desk
                  </button>
                  {selectedBomId && (
                    <>
                      <button
                        onClick={() => setActiveTab("tree")}
                        className={`px-3 py-1 text-xs font-semibold rounded ${
                          activeTab === "tree" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Visual Tree Node
                      </button>
                      <button
                        onClick={handleValidateBOM}
                        className={`px-3 py-1 text-xs font-semibold rounded ${
                          activeTab === "validation" ? "bg-rose-900 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Audit Validate
                      </button>

                      {activeBom?.status === "DRAFT" && (
                        <button
                          onClick={handleReleaseBOM}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded transition-colors"
                        >
                          Lock & Release BOM
                        </button>
                      )}

                      {activeBom?.status === "RELEASED" && (
                        <button
                          onClick={handleCreateNewRevision}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded transition-colors"
                        >
                          Increment Revision (Rev N+1)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* TAB DESK VIEWS */}
              {activeTab === "workspace" && (
                <form onSubmit={handleSaveBOM} className="space-y-6">
                  {/* Header metadata inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">
                        Product Part Number *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={activeBom && activeBom.status !== "DRAFT"}
                        placeholder="e.g. CCS-LSR-300-X"
                        value={headerForm.part_number}
                        onChange={(e) => setHeaderForm({ ...headerForm, part_number: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded px-3 py-1.5 text-xs text-white outline-none transition-all disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">
                        Associated Customer (Party)
                      </label>
                      <select
                        disabled={activeBom && activeBom.status !== "DRAFT"}
                        value={headerForm.customer_id}
                        onChange={(e) => setHeaderForm({ ...headerForm, customer_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded px-3 py-1.5 text-xs text-white outline-none transition-all disabled:opacity-50"
                      >
                        <option value="">-- Direct Template (Internal) --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            [{c.code}] {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">
                        BOM Brief Description
                      </label>
                      <input
                        type="text"
                        disabled={activeBom && activeBom.status !== "DRAFT"}
                        placeholder="Architectural structure details"
                        value={headerForm.description}
                        onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded px-3 py-1.5 text-xs text-white outline-none transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Lines definitions builder */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        BOM Line Items Configuration Listing
                      </span>

                      {(!activeBom || activeBom.status === "DRAFT") && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddLine("MATERIAL")}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded"
                          >
                            + Material Line
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddLine("PROCESS")}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded"
                          >
                            + Process Line
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddLine("SUB_ASSEMBLY")}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded"
                          >
                            + Sub-Assembly Pointer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddLine("NOTE")}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded"
                          >
                            + Custom Note
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 overflow-x-auto min-w-full">
                      {linesForm.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                          No lines mapped to this BOM structure. Add lines from the buttons above.
                        </div>
                      ) : (
                        <table className="w-full min-w-[700px] border-collapse text-left text-xs text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-widest h-8">
                              <th className="w-[6%]">Seq</th>
                              <th className="w-[11%]">Type</th>
                              <th className="w-[30%]">Source Mapping / Description</th>
                              <th className="w-[18%]">Parent Group Pointer</th>
                              <th className="w-[8%]">Quantity</th>
                              <th className="w-[8%]">UOM</th>
                              <th className="w-[12%]">Remarks</th>
                              {(!activeBom || activeBom.status === "DRAFT") && <th className="w-[5%]"></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {linesForm.map((line, idx) => {
                              const uniqueId = line.id || `temp-${idx}`;
                              
                              // Select parent potential targets (excluding self)
                              const parentCandidates = linesForm.filter((_, odidx) => odidx !== idx);

                              return (
                                <tr key={uniqueId} className="border-b border-slate-900/50 hover:bg-slate-900/20 h-11 align-middle">
                                  {/* sequence */}
                                  <td>
                                    <input
                                      type="number"
                                      required
                                      disabled={activeBom && activeBom.status !== "DRAFT"}
                                      value={line.sequence_number}
                                      onChange={(e) => handleLineChange(idx, "sequence_number", Number(e.target.value))}
                                      className="w-12 bg-slate-900/60 border border-slate-800 text-center rounded py-0.5 outline-none text-xs text-white disabled:opacity-50"
                                    />
                                  </td>

                                  {/* type */}
                                  <td>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      line.line_type === "MATERIAL"
                                        ? "bg-sky-950 text-sky-400"
                                        : line.line_type === "PROCESS"
                                          ? "bg-amber-950 text-amber-400"
                                          : line.line_type === "SUB_ASSEMBLY"
                                            ? "bg-indigo-950 text-indigo-400"
                                            : "bg-slate-800 text-slate-400"
                                    }`}>
                                      {line.line_type}
                                    </span>
                                  </td>

                                  {/* selector / description */}
                                  <td className="pr-2">
                                    {line.line_type === "MATERIAL" ? (
                                      <select
                                        disabled={activeBom && activeBom.status !== "DRAFT"}
                                        value={line.material_id || ""}
                                        required
                                        onChange={(e) => handleLineChange(idx, "material_id", e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-800 rounded py-0.5 outline-none disabled:opacity-50"
                                      >
                                        <option value="">-- Choose Material --</option>
                                        {materials.map(m => (
                                          <option key={m.id} value={m.id}>
                                            {m.code} ({m.description})
                                          </option>
                                        ))}
                                      </select>
                                    ) : line.line_type === "PROCESS" ? (
                                      <select
                                        disabled={activeBom && activeBom.status !== "DRAFT"}
                                        value={line.process_id || ""}
                                        required
                                        onChange={(e) => handleLineChange(idx, "process_id", e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-800 rounded py-0.5 outline-none disabled:opacity-50"
                                      >
                                        <option value="">-- Choose Process --</option>
                                        {processes.map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : line.line_type === "SUB_ASSEMBLY" ? (
                                      <select
                                        disabled={activeBom && activeBom.status !== "DRAFT"}
                                        value={line.sub_assembly_bom_id || ""}
                                        required
                                        onChange={(e) => handleLineChange(idx, "sub_assembly_bom_id", e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-800 rounded py-0.5 outline-none disabled:opacity-50 font-mono"
                                      >
                                        <option value="">-- Choose Sub BOM --</option>
                                        {boms.filter(b => b.id !== selectedBomId).map(b => (
                                          <option key={b.id} value={b.id}>
                                            {b.part_number} (Rev {b.revision_number} - {b.status})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        disabled={activeBom && activeBom.status !== "DRAFT"}
                                        required
                                        placeholder="Enter note detail text..."
                                        value={line.description || ""}
                                        onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                                        className="w-full bg-slate-900/60 border border-slate-805 text-white rounded px-2 py-0.5 outline-none text-xs disabled:opacity-50"
                                      />
                                    )}
                                  </td>

                                  {/* parent association dropdown */}
                                  <td className="pr-2">
                                    <select
                                      disabled={activeBom && activeBom.status !== "DRAFT"}
                                      value={line.parent_bom_line_id || ""}
                                      onChange={(e) => handleLineChange(idx, "parent_bom_line_id", e.target.value || null)}
                                      className="w-full bg-slate-900/60 border border-slate-800 rounded py-0.5 outline-none disabled:opacity-50"
                                    >
                                      <option value="">-- Top Level / No Parent --</option>
                                      {parentCandidates.map((pc, pidx) => (
                                        <option key={pc.id || `target-${pidx}`} value={pc.id || ""}>
                                          Seq {pc.sequence_number} ({pc.line_type})
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* quantity */}
                                  <td>
                                    <input
                                      type="number"
                                      step="any"
                                      required
                                      disabled={activeBom && activeBom.status !== "DRAFT"}
                                      value={line.quantity}
                                      onChange={(e) => handleLineChange(idx, "quantity", Number(e.target.value))}
                                      className="w-14 bg-slate-900/60 border border-slate-800 text-center rounded py-0.5 outline-none disabled:opacity-50"
                                    />
                                  </td>

                                  {/* UOM */}
                                  <td className="pr-1.5">
                                    <input
                                      type="text"
                                      required
                                      disabled={activeBom && activeBom.status !== "DRAFT"}
                                      placeholder="e.g. Nos"
                                      value={line.uom}
                                      onChange={(e) => handleLineChange(idx, "uom", e.target.value)}
                                      className="w-full bg-slate-900/60 border border-slate-800 rounded px-1 text-center py-0.5 outline-none text-xs text-white disabled:opacity-50"
                                    />
                                  </td>

                                  {/* Remarks */}
                                  <td>
                                    <input
                                      type="text"
                                      disabled={activeBom && activeBom.status !== "DRAFT"}
                                      value={line.remarks || ""}
                                      placeholder="Remarks"
                                      onChange={(e) => handleLineChange(idx, "remarks", e.target.value)}
                                      className="w-full bg-slate-900/60 border border-slate-800 rounded px-1 py-0.5 outline-none text-xs disabled:opacity-50"
                                    />
                                  </td>

                                  {/* Deletions operator */}
                                  {(!activeBom || activeBom.status === "DRAFT") && (
                                    <td className="text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLine(idx)}
                                        className="text-rose-400 hover:text-rose-500 hover:bg-rose-950/20 p-1.5 rounded"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  {(!activeBom || activeBom.status === "DRAFT") && (
                    <div className="flex justify-end pt-3">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg px-5 py-2 transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save BOM Drafting state</span>
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* TAB DESK VIEWS - RECURSIVE HIERARCHICAL TREE VIEWER */}
              {activeTab === "tree" && (
                <div className="space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 max-h-[550px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-none">
                      Traversals Structure Depth View
                    </span>
                  </div>

                  {bomTree.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No structural depth items found or lines empty.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {bomTree.map(node => renderTreeNode(node, 0))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB DESK VIEWS - VALIDATION CHECKS REPORT */}
              {activeTab === "validation" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5">
                    <UserCheck className="w-4.5 h-4.5 text-rose-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                      Validator Integrity Diagnostics Audit
                    </span>
                  </div>

                  {!validationReport ? (
                    <div className="text-center py-10">
                      <button
                        onClick={handleValidateBOM}
                        className="bg-rose-950/50 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold px-4 py-2 rounded-lg"
                      >
                        Trigger Validator Diagnostics Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Status Card Banner */}
                      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                        validationReport.is_valid
                          ? "bg-emerald-950/20 border-emerald-800 text-emerald-200"
                          : "bg-rose-950/20 border-rose-800 text-rose-200"
                      }`}>
                        {validationReport.is_valid ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs uppercase tracking-wider">
                            Verdict: {validationReport.is_valid ? "APPROVED & CLEAN PASS" : "BLOCKED - REJECTED"}
                          </h4>
                          <p className="text-[11px] opacity-80">
                            {validationReport.is_valid
                              ? "Programmatic audits found zero fatal blockers. Structure conformant, safe for RELEASE locking."
                              : " programmatically flagged critical integrity anomalies. Rectify structural blockers below before release."}
                          </p>
                        </div>
                      </div>

                      {/* Display Warnings */}
                      {validationReport.warnings && validationReport.warnings.length > 0 && (
                        <div className="bg-amber-950/15 border border-amber-900 text-amber-200 p-4 rounded-xl space-y-1">
                          <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400 flex items-center gap-1.5 mb-1.5">
                            <Info className="w-3.5 h-3.5" />
                            <span>Structural Warnings ({validationReport.warnings.length})</span>
                          </div>
                          <ul className="list-disc pl-5 text-[11px] space-y-1">
                            {validationReport.warnings.map((w, idx) => (
                              <li key={idx}><span className="opacity-90">{w}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Diagnostic Errors Grid */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                          Diagnostic Blocker Details ({validationReport.errors.length})
                        </span>

                        {validationReport.errors.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No fatal blockers flagged.</p>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {validationReport.errors.map((e, idx) => (
                              <div key={idx} className="bg-rose-950/30 border border-rose-900/40 p-3 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  {e.bom_line_id && (
                                    <span className="text-[9px] font-mono uppercase bg-rose-900/60 text-white px-1 py-0.5 rounded mr-2 font-bold select-none">
                                      Line Target Block
                                    </span>
                                  )}
                                  <span className="font-semibold text-slate-400 uppercase tracking-wide text-[10px] mr-1">
                                    [{e.field}]
                                  </span>
                                  <p className="inline">{e.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
