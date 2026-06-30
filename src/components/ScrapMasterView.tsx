import React, { useState, useEffect } from "react";
import { Recycle, Plus, Edit2, Trash2, Search, RefreshCw, X } from "lucide-react";

interface Scrap {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const ScrapMasterView: React.FC<Props> = ({ authState, apiFetch, setErrorMsg, setSuccessMsg }) => {
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScrap, setEditingScrap] = useState<Scrap | null>(null);

  // Form states
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    is_active: true
  });

  const isL2Admin = authState.user?.role === "L2-Admin";

  const fetchScrapTypes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/scrap");
      if (res.ok) {
        const data = await res.json();
        setScraps(data);
      } else {
        setErrorMsg("Failed to retrieve scrap categories from recovery server.");
      }
    } catch {
      setErrorMsg("Network error connecting to scrap index database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScrapTypes();
  }, []);

  const handleOpenCreate = () => {
    setEditingScrap(null);
    setForm({
      code: "",
      name: "",
      description: "",
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (scrap: Scrap) => {
    setEditingScrap(scrap);
    setForm({
      code: scrap.code,
      name: scrap.name,
      description: scrap.description || "",
      is_active: scrap.is_active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin is authorized to modify recovery factors.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      is_active: form.is_active
    };

    try {
      const url = editingScrap ? `/api/v1/scrap/${editingScrap.id}` : "/api/v1/scrap";
      const method = editingScrap ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(editingScrap ? `Scrap type updated: ${form.code}` : `Scrap type created: ${form.code}`);
        setIsModalOpen(false);
        fetchScrapTypes();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to edit scrap configuration.");
      }
    } catch {
      setErrorMsg("Network error connecting to recovery ledger.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin can delete material recovery rules.");
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to delete scrap index ${code}?`)) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/scrap/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg(`Scrap category deleted: ${code}`);
        fetchScrapTypes();
      } else {
        setErrorMsg("Failed to remove scrap specification.");
      }
    } catch {
      setErrorMsg("Network error purging scrap entry.");
    } finally {
      setLoading(false);
    }
  };

  const filteredScraps = (scraps || []).filter(s =>
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Recycle className="w-5 h-5 text-emerald-400" />
            <span>Scrap Type Recovery Index</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Configure recyclable offcuts, spot valuations, and recovery groups</p>
        </div>
        {isL2Admin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Scrap Type</span>
          </button>
        )}
      </div>

      {/* Filter and search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search scrap codes, category names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none transition-all"
          />
        </div>
        <button
          onClick={fetchScrapTypes}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scrap Index list table */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3">Scrap Code</th>
                <th className="py-3">Category Name</th>
                <th className="py-3">Description Context</th>
                <th className="py-3">Recovery State</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredScraps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No scrap categories registered or matched.
                  </td>
                </tr>
              ) : (
                filteredScraps.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40">
                    <td className="py-3.5 pr-2 font-mono font-bold text-white">{s.code}</td>
                    <td className="py-3.5 font-bold text-slate-300">{s.name}</td>
                    <td className="py-3.5 text-slate-400 max-w-xs truncate" title={s.description || ""}>{s.description || <span className="text-slate-700 italic">No description</span>}</td>
                    <td className="py-3.5">
                      {s.is_active ? (
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">RECOVERABLE</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 font-mono">INACTIVE</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      {isL2Admin ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-500 hover:text-amber-400 rounded-lg text-[10px] font-medium transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.code)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-red-950/45 text-red-500 hover:text-red-400 rounded-lg text-[10px] font-medium transition-all"
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

      {/* Edit and Create Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Recycle className="w-4.5 h-4.5 text-emerald-400" />
                <span>{editingScrap ? `Edit Scrap Type [${editingScrap.code}]` : "Register Remnant Scrap Material"}</span>
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
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Scrap Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingScrap}
                    placeholder="e.g. MS_SCRAP"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Friendly Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mild Steel Scrap"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Specification Context Details</label>
                <textarea
                  placeholder="e.g. MS Grade recovery offcuts and industrial scraps"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950 bg-slate-900"
                />
                <label htmlFor="is_active" className="text-xs text-slate-300 select-none">Active for calculations and yield credit recovery</label>
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
                  <span>{editingScrap ? "Apply Updates" : "Commit Recovery Type"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
