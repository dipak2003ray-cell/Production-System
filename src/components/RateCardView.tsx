import React, { useState, useEffect } from "react";
import { Coins, Plus, Edit2, Trash2, Search, RefreshCw, X, Calendar, ArrowRight, ShieldCheck, Tag } from "lucide-react";

interface RateCard {
  id: string;
  material_id: string | null;
  process_id: string | null;
  scrap_id: string | null;
  sub_type: string | null;
  thickness_from: number | null;
  thickness_to: number | null;
  rate: number;
  rate_unit: string;
  effective_date: string;
  is_active: boolean;
  reason: string | null;
}

interface Material { id: string; code: string; description: string; std_unit: string; }
interface Process { id: string; name: string; driver_type: string | null; }
interface Scrap { id: string; code: string; name: string; }

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const RateCardView: React.FC<Props> = ({ authState, apiFetch, setErrorMsg, setSuccessMsg }) => {
  const [rates, setRates] = useState<RateCard[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTargetType, setFilterTargetType] = useState<"all" | "material" | "process" | "scrap">("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<RateCard | null>(null);

  // Form states
  const [targetType, setTargetType] = useState<"material" | "process" | "scrap">("material");
  const [form, setForm] = useState({
    material_id: "",
    process_id: "",
    scrap_id: "",
    sub_type: "",
    thickness_from: "",
    thickness_to: "",
    rate: "0",
    rate_unit: "Rs/kg",
    effective_date: new Date().toISOString().split("T")[0],
    is_active: true,
    reason: ""
  });

  const isL2Admin = authState.user?.role === "L2-Admin";

  const fetchRatesAndMasters = async () => {
    setLoading(true);
    try {
      // Rates
      const ratesRes = await apiFetch("/api/v1/rates");
      if (ratesRes.ok) setRates(await ratesRes.json());

      // Masters
      const matRes = await apiFetch("/api/v1/materials");
      if (matRes.ok) setMaterials(await matRes.json());

      const procRes = await apiFetch("/api/v1/processes");
      if (procRes.ok) setProcesses(await procRes.json());

      const scrapRes = await apiFetch("/api/v1/scrap");
      if (scrapRes.ok) setScraps(await scrapRes.json());

    } catch {
      setErrorMsg("Network error trying to fetch rate cards and dependency masters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatesAndMasters();
  }, []);

  const selectedProcess = processes.find(p => p.id === form.process_id);
  const isProcessAndNotThickness = targetType === "process" && selectedProcess && (selectedProcess.driver_type || "").trim().toLowerCase() !== "thickness";

  useEffect(() => {
    if (isProcessAndNotThickness) {
      setForm(prev => ({
        ...prev,
        thickness_from: "",
        thickness_to: ""
      }));
    }
  }, [isProcessAndNotThickness]);

  const handleOpenCreate = () => {
    setEditingRate(null);
    setTargetType("material");
    setForm({
      material_id: materials[0]?.id || "",
      process_id: "",
      scrap_id: "",
      sub_type: "",
      thickness_from: "",
      thickness_to: "",
      rate: "0",
      rate_unit: "Rs/kg",
      effective_date: new Date().toISOString().split("T")[0],
      is_active: true,
      reason: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rate: RateCard) => {
    setEditingRate(rate);
    const existingTargetType = rate.material_id ? "material" : (rate.process_id ? "process" : "scrap");
    setTargetType(existingTargetType);
    setForm({
      material_id: rate.material_id || "",
      process_id: rate.process_id || "",
      scrap_id: rate.scrap_id || "",
      sub_type: rate.sub_type || "",
      thickness_from: rate.thickness_from !== null ? String(rate.thickness_from) : "",
      thickness_to: rate.thickness_to !== null ? String(rate.thickness_to) : "",
      rate: String(rate.rate),
      rate_unit: rate.rate_unit,
      effective_date: rate.effective_date,
      is_active: rate.is_active,
      reason: rate.reason || ""
    });
    setIsModalOpen(true);
  };

  const handleTargetTypeChange = (type: "material" | "process" | "scrap") => {
    setTargetType(type);
    setForm({
      ...form,
      material_id: type === "material" ? (materials[0]?.id || "") : "",
      process_id: type === "process" ? (processes[0]?.id || "") : "",
      scrap_id: type === "scrap" ? (scraps[0]?.id || "") : "",
      rate_unit: type === "material" ? "Rs/kg" : (type === "process" ? "Rs/meter" : "Rs/kg")
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isL2Admin) {
      setErrorMsg("Unauthorized error: Only L2-Admin can update rate tariffs.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Build exclusive parameters based on form type
    const payload = {
      material_id: targetType === "material" ? form.material_id : null,
      process_id: targetType === "process" ? form.process_id : null,
      scrap_id: targetType === "scrap" ? form.scrap_id : null,
      sub_type: form.sub_type ? form.sub_type.trim() : null,
      thickness_from: form.thickness_from !== "" ? Number(form.thickness_from) : null,
      thickness_to: form.thickness_to !== "" ? Number(form.thickness_to) : null,
      rate: Number(form.rate || 0),
      rate_unit: form.rate_unit,
      effective_date: form.effective_date,
      is_active: form.is_active,
      reason: form.reason || null
    };

    try {
      const url = editingRate ? `/api/v1/rates/${editingRate.id}` : "/api/v1/rates";
      const method = editingRate ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(editingRate ? "Rate card updated successfully." : "New rate card compiled.");
        setIsModalOpen(false);
        fetchRatesAndMasters();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to commit rate modifications.");
      }
    } catch {
      setErrorMsg("Network error trying to commit rate card.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin can remove rate items.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this rate card item?")) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/rates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg("Rate card item purged successfully.");
        fetchRatesAndMasters();
      } else {
        setErrorMsg("Failed to remove designated rate card.");
      }
    } catch {
      setErrorMsg("Network connection error deleting rate card.");
    } finally {
      setLoading(false);
    }
  };

  // Helper resolvers to render labels in columns
  const getTargetName = (r: RateCard) => {
    if (r.material_id) {
      const m = materials.find(x => x.id === r.material_id);
      return m ? `Material: ${m.code}` : "Unknown Material";
    }
    if (r.process_id) {
      const p = processes.find(x => x.id === r.process_id);
      return p ? `Process: ${p.name}` : "Unknown Process";
    }
    if (r.scrap_id) {
      const s = scraps.find(x => x.id === r.scrap_id);
      return s ? `Scrap: ${s.code}` : "Unknown Scrap Category";
    }
    return "-";
  };

  const filteredRates = (rates || []).filter(r => {
    // Search Filter
    const targetLabel = getTargetName(r).toLowerCase();
    const subTypeMatch = r.sub_type ? r.sub_type.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const reasonMatch = r.reason ? r.reason.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = targetLabel.includes(searchTerm.toLowerCase()) || subTypeMatch || reasonMatch;

    if (!matchesSearch) return false;

    // Target Type Filter
    if (filterTargetType === "material" && !r.material_id) return false;
    if (filterTargetType === "process" && !r.process_id) return false;
    if (filterTargetType === "scrap" && !r.scrap_id) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <span>Rate Card Master Tariffs</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Centralised pricing table, versioning dates, and thickness lookup rules</p>
        </div>
        {isL2Admin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Configure Rate Card</span>
          </button>
        )}
      </div>

      {/* Query Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          {/* Target Type Selector */}
          <div className="flex bg-slate-900 border border-slate-800/80 rounded-lg p-0.5 w-full sm:w-auto">
            {(["all", "material", "process", "scrap"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTargetType(t)}
                className={`flex-1 sm:flex-none uppercase px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider transition-all select-none ${
                  filterTargetType === t ? "bg-slate-800 text-emerald-450" : "text-slate-500 hover:text-white"
                }`}
              >
                {t}s
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by code, specifier, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none transition-all"
            />
          </div>
        </div>

        <button
          onClick={fetchRatesAndMasters}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all self-end md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Rate Tariffs Grid Table */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 desktop:table-fixed">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3">Target Reference</th>
                <th className="py-3">Qualifying Spec</th>
                <th className="py-3">Thickness Range</th>
                <th className="py-3">Active Tariff Rate</th>
                <th className="py-3">Scale Unit</th>
                <th className="py-3">Effective Since</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No matching rates mapped to specifications in active records.
                  </td>
                </tr>
              ) : (
                filteredRates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 font-sans">
                    <td className="py-3.5 pr-2">
                      <div className="font-bold text-white max-w-[150px] truncate">{getTargetName(r)}</div>
                      {r.reason && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]" title={r.reason}>{r.reason}</div>
                      )}
                    </td>
                    <td className="py-3.5">
                      {r.sub_type ? (
                        <span className="px-1.5 py-0.5 font-mono text-[9px] font-extrabold bg-slate-900 text-slate-400 border border-slate-800 rounded uppercase">
                          {r.sub_type}
                        </span>
                      ) : (
                        <span className="text-slate-700 italic">Universal</span>
                      )}
                    </td>
                    <td className="py-3.5 font-mono">
                      {r.thickness_from !== null || r.thickness_to !== null ? (
                        <span>
                          {r.thickness_from || 0} - {r.thickness_to || "∞"} mm
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 font-mono font-extrabold text-emerald-400 text-sm">
                      Rs. {Number(r.rate).toFixed(2)}
                    </td>
                    <td className="py-3.5 font-mono text-slate-400">{r.rate_unit}</td>
                    <td className="py-3.5 font-mono text-slate-400">{r.effective_date}</td>
                    <td className="py-3.5">
                      {r.is_active ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-405 font-mono">APPROVED</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-slate-600 font-mono">STAND-BY</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      {isL2Admin ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-500 hover:text-amber-400 rounded-lg text-[10px] font-medium transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-red-950/45 text-red-500 hover:text-red-400 rounded-lg text-[10px] font-medium transition-all"
                          >
                            Purge
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-900/40 px-2 py-1 rounded">Read-Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit and create dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4.5 h-4.5 text-emerald-400" />
                <span>{editingRate ? "Revise Configuration" : "Establish Master Tariff"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Type Switch - Only if creating */}
              {!editingRate && (
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Exclusivity Rate Target *</label>
                  <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                    {(["material", "process", "scrap"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTargetTypeChange(t)}
                        className={`flex-1 py-1 text-center font-mono rounded text-[10px] uppercase tracking-wider font-bold transition-all ${
                          targetType === t ? "bg-slate-800 text-emerald-400 border border-slate-700/50" : "text-slate-500"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic list rendering */}
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Select Specific Target *</label>
                {targetType === "material" && (
                  <select
                    value={form.material_id}
                    onChange={(e) => setForm({ ...form, material_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                    disabled={!!editingRate}
                  >
                    {!editingRate && <option value="">-- Choose Material --</option>}
                    {materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.description}</option>)}
                  </select>
                )}

                {targetType === "process" && (
                  <select
                    value={form.process_id}
                    onChange={(e) => setForm({ ...form, process_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                    disabled={!!editingRate}
                  >
                    {!editingRate && <option value="">-- Choose Process --</option>}
                    {processes.map(p => <option key={p.id} value={p.id}>{p.name} (formula: {p.driver_type})</option>)}
                  </select>
                )}

                {targetType === "scrap" && (
                  <select
                    value={form.scrap_id}
                    onChange={(e) => setForm({ ...form, scrap_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                    disabled={!!editingRate}
                  >
                    {!editingRate && <option value="">-- Choose Scrap --</option>}
                    {scraps.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                  </select>
                )}
              </div>

              {/* Pricing detail rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Standard Rate Tariffs (Rs) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="0.0000"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Scale scale metric *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rs/kg, Rs/stroke, Rs/meter"
                    value={form.rate_unit}
                    onChange={(e) => setForm({ ...form, rate_unit: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Qualifying specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Qualifying Specifer</label>
                  <input
                    type="text"
                    placeholder="e.g. SS / MS / AL"
                    value={form.sub_type}
                    onChange={(e) => setForm({ ...form, sub_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Thick. Min (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 0"
                    value={form.thickness_from}
                    onChange={(e) => setForm({ ...form, thickness_from: e.target.value })}
                    disabled={isProcessAndNotThickness}
                    className={`w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none ${
                      isProcessAndNotThickness ? "opacity-40 cursor-not-allowed bg-slate-950" : ""
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Thick. Max (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 3.0"
                    value={form.thickness_to}
                    onChange={(e) => setForm({ ...form, thickness_to: e.target.value })}
                    disabled={isProcessAndNotThickness}
                    className={`w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none ${
                      isProcessAndNotThickness ? "opacity-40 cursor-not-allowed bg-slate-950" : ""
                    }`}
                  />
                </div>
              </div>

              {isProcessAndNotThickness && (
                <div className="text-[10px] text-amber-500 bg-amber-950/25 border border-amber-900/50 p-2.5 rounded-lg font-mono leading-relaxed">
                  INFO: Thickness inputs are deactivated because <strong>{selectedProcess?.name}</strong> uses the <strong>"{selectedProcess?.driver_type}"</strong> driver. Thickness specifications are limited strictly to processes with physical <strong>"thickness"</strong> driver configurations.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Effective Validation Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      required
                      value={form.effective_date}
                      onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg pl-10 pr-4 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Reason Narrative</label>
                  <input
                    type="text"
                    placeholder="Revision justification context"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="rate_is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                />
                <label htmlFor="rate_is_active" className="text-xs text-slate-300 select-none">Approve tariff for live system estimate lookup matches</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {loading && <RefreshCw className="w-3 animate-spin" />}
                  <span>{editingRate ? "Commit Revision" : "Authorize Tariff"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
