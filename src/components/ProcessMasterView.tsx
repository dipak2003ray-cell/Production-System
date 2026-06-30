import React, { useState, useEffect } from "react";
import { Cpu, Plus, Edit2, Trash2, Search, RefreshCw, X } from "lucide-react";

interface Process {
  id: string;
  name: string;
  description: string | null;
  driver_type: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const ProcessMasterView: React.FC<Props> = ({ authState, apiFetch, setErrorMsg, setSuccessMsg }) => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    description: "",
    driver_type: "thickness",
    is_active: true
  });

  const isL2Admin = authState.user?.role === "L2-Admin";

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/processes");
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
      } else {
        setErrorMsg("Failed to retrieve processes from backend database.");
      }
    } catch {
      setErrorMsg("Network error connecting to processes database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  const handleOpenCreate = () => {
    setEditingProcess(null);
    setForm({
      name: "",
      description: "",
      driver_type: "thickness",
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proc: Process) => {
    setEditingProcess(proc);
    setForm({
      name: proc.name,
      description: proc.description || "",
      driver_type: proc.driver_type || "thickness",
      is_active: proc.is_active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin is authorized to rewrite operational parameters.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      name: form.name,
      description: form.description || null,
      driver_type: form.driver_type,
      is_active: form.is_active
    };

    try {
      const url = editingProcess ? `/api/v1/processes/${editingProcess.id}` : "/api/v1/processes";
      const method = editingProcess ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(editingProcess ? `Process updated: ${form.name}` : `Process created: ${form.name}`);
        setIsModalOpen(false);
        fetchProcesses();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to commit process variations.");
      }
    } catch {
      setErrorMsg("Network error trying to commit process definitions.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isL2Admin) {
      setErrorMsg("Unauthorized: Only L2-Admin is allowed to purge master registries.");
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to delete process ${name}?`)) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch(`/api/v1/processes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg(`Process template removed: ${name}`);
        fetchProcesses();
      } else {
        setErrorMsg("Failed to delete process definition.");
      }
    } catch {
      setErrorMsg("Network error trying to delete process definition.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = (processes || []).filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>Process Master Configurations</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">Configure formulas, scrap, and driver maps for manufacturing steps</p>
        </div>
        {isL2Admin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Process</span>
          </button>
        )}
      </div>

      {/* Filter interface */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search processes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none transition-all"
          />
        </div>
        <button
          onClick={fetchProcesses}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table grid */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3">Process Name</th>
                <th className="py-3">Narrative Description</th>
                <th className="py-3">Engine Driver Type</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No custom processes registered currently.
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40">
                    <td className="py-3.5 pr-2 font-bold text-white">{p.name}</td>
                    <td className="py-3.5 text-slate-400 max-w-xs truncate" title={p.description || ""}>{p.description || <span className="text-slate-700 italic">No notes</span>}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono leading-none border border-slate-800 bg-slate-900 text-slate-300">
                        {p.driver_type || "unmapped"}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {p.is_active ? (
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">ACTIVE</span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-400 font-mono">SUSPENDED</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      {isL2Admin ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-500 hover:text-amber-400 rounded-lg text-[10px] font-medium transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
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

      {/* Edit and create dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-emerald-400" />
                <span>{editingProcess ? `Modify Process [${editingProcess.name}]` : "Register Process Formula"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Process Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Laser Cutting"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Driver Logic Rule *</label>
                <select
                  value={form.driver_type}
                  onChange={(e) => setForm({ ...form, driver_type: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                >
                  <option value="thickness">length_thickness (Thickness lookup / cutting speed)</option>
                  <option value="strokes">strokes (Punches and forming strokes)</option>
                  <option value="passes">passes_weight (Structural Welding/Assembly passes)</option>
                  <option value="area">surface_area (Electrostatic Powder Coating sqm)</option>
                  <option value="hours">man_hours (Assembly overhead manual fitting)</option>
                  <option value="runs">flat_runs (Flat system runs tariff)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  The driver controls computational variables and restricts compatible Rate Card range attributes.
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Operational Narrative Notes</label>
                <textarea
                  placeholder="Operational parameters review narrative"
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
                <label htmlFor="is_active" className="text-xs text-slate-300 select-none">Mark process active for cost lookup engine</label>
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
                  <span>{editingProcess ? "Update Parameters" : "Register Process"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
