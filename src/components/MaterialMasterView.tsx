import React, { useState, useEffect } from "react";
import { Package, Plus, Edit2, Trash2, Search, RefreshCw, X, Check, Eye } from "lucide-react";

interface Material {
  id: string;
  code: string;
  description: string;
  grade_spec: string | null;
  profile_size: string | null;
  std_unit: string;
  last_rate: number;
  created_at: string;
}

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const MaterialMasterView: React.FC<Props> = ({ authState, apiFetch, setErrorMsg, setSuccessMsg }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  
  // Form states
  const [form, setForm] = useState({
    code: "",
    description: "",
    grade_spec: "",
    profile_size: "",
    std_unit: "kg",
    last_rate: "0"
  });

  const isL2Admin = authState.user?.role === "L2-Admin";

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/materials");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      } else {
        setErrorMsg("Failed to retrieve materials from backend inventory.");
      }
    } catch {
      setErrorMsg("Network error connecting to materials repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleOpenCreate = () => {
    setEditingMaterial(null);
    setForm({
      code: "",
      description: "",
      grade_spec: "",
      profile_size: "",
      std_unit: "kg",
      last_rate: "0"
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (material: Material) => {
    setEditingMaterial(material);
    setForm({
      code: material.code,
      description: material.description,
      grade_spec: material.grade_spec || "",
      profile_size: material.profile_size || "",
      std_unit: material.std_unit,
      last_rate: String(material.last_rate)
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin is authorized to commit master mutations.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      code: form.code,
      description: form.description,
      grade_spec: form.grade_spec || null,
      profile_size: form.profile_size || null,
      std_unit: form.std_unit,
      last_rate: Number(form.last_rate || 0)
    };

    try {
      const url = editingMaterial ? `/api/v1/materials/${editingMaterial.id}` : "/api/v1/materials";
      const method = editingMaterial ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(editingMaterial ? `Material updated: ${form.code}` : `Material created: ${form.code}`);
        setIsModalOpen(false);
        fetchMaterials();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to commit material changes.");
      }
    } catch {
      setErrorMsg("Network error during material storage commit.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin is permitted to delete inventory templates.");
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to delete material ${code}?`)) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/materials/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg(`Material master entry removed: ${code}`);
        fetchMaterials();
      } else {
        setErrorMsg("Failed to delete designated material.");
      }
    } catch {
      setErrorMsg("Network error trying to purge material target.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = (materials || []).filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.grade_spec && m.grade_spec.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>Material Master Specifications</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Core register for standard industrial sheet material templates</p>
        </div>
        {isL2Admin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-550 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Material</span>
          </button>
        )}
      </div>

      {/* Filter and search block */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search material code, desc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none transition-all"
          />
        </div>
        <button
          onClick={fetchMaterials}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          title="Reload registry"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Materials Table */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3">Code</th>
                <th className="py-3">Description</th>
                <th className="py-3">Grade Specs</th>
                <th className="py-3">Profile Size</th>
                <th className="py-3">Std Unit</th>
                <th className="py-3">Last Rate (Rs)</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No materials registered matching specifications.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/40">
                    <td className="py-3.5 pr-2 font-mono font-bold text-white">{m.code}</td>
                    <td className="py-3.5 text-slate-300 max-w-xs truncate" title={m.description}>{m.description}</td>
                    <td className="py-3.5">{m.grade_spec || <span className="text-slate-600 font-mono">-</span>}</td>
                    <td className="py-3.5 font-mono">{m.profile_size || <span className="text-slate-600">-</span>}</td>
                    <td className="py-3.5"><span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-mono">{m.std_unit}</span></td>
                    <td className="py-3.5 font-mono font-semibold text-emerald-400">{Number(m.last_rate).toFixed(2)}</td>
                    <td className="py-3.5 text-right space-x-2">
                      {isL2Admin ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-500 hover:text-amber-400 rounded-lg text-[10px] font-medium transition-all"
                            title="Edit specifications"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.code)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-red-950/40 text-red-500 hover:text-red-400 rounded-lg text-[10px] font-medium transition-all"
                            title="Purge master templates"
                          >
                            Delete
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

      {/* Creation and Modification dialog overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4.5 h-4.5 text-emerald-400" />
                <span>{editingMaterial ? `Edit Material [${editingMaterial.code}]` : "Create Material Master Entry"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Material Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMaterial}
                    placeholder="e.g. MAT_MS_2.0"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Standard Pricing Unit *</label>
                  <select
                    value={form.std_unit}
                    onChange={(e) => setForm({ ...form, std_unit: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="meter">meter (Meters)</option>
                    <option value="mm">mm (Millimeters)</option>
                    <option value="sq_meter">sq_meter (Square Meters)</option>
                    <option value="hour">hour (Hours)</option>
                    <option value="piece">piece (Pieces)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Factual Description Profile *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mild Steel Structural Sheet 2.0mm thickness cold rolled"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Grade Specs</label>
                  <input
                    type="text"
                    placeholder="e.g. IS 2062 / SS304"
                    value={form.grade_spec}
                    onChange={(e) => setForm({ ...form, grade_spec: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Standard Profile Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 1250x2500"
                    value={form.profile_size}
                    onChange={(e) => setForm({ ...form, profile_size: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Default unit rate value (Rs)*</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={form.last_rate}
                  onChange={(e) => setForm({ ...form, last_rate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                />
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
                  className="bg-emerald-600 hover:bg-emerald-550 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {loading && <RefreshCw className="w-3 animate-spin" />}
                  <span>{editingMaterial ? "Apply Changes" : "Commit Material"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
