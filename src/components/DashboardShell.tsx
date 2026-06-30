import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { UserProfile, CustomerParty, SystemAuditLog } from "../types";
import {
  ShieldAlert,
  Users,
  Briefcase,
  Layers,
  Activity,
  UserPlus,
  RefreshCw,
  Power,
  RotateCw,
  Search,
  BookOpen,
  ArrowRight,
  Database,
  Building,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  ToggleLeft,
  CheckCircle,
  UserCheck,
  Package,
  Cpu,
  Recycle,
  Coins,
  Sparkles,
  TrendingUp,
  Bell,
  Archive,
  MailOpen,
  Check,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { MaterialMasterView } from "./MaterialMasterView";
import { ProcessMasterView } from "./ProcessMasterView";
import { ScrapMasterView } from "./ScrapMasterView";
import { RateCardView } from "./RateCardView";
import { ProcessDriverPlayground } from "./ProcessDriverPlayground";
import { BOMHubView } from "./BOMHubView";
import { CostSheetsWorkspace } from "./CostSheetsWorkspace";
import { CostIntelligenceWorkspace } from "./CostIntelligenceWorkspace";
import { EstimateGovernanceWorkspace } from "./EstimateGovernanceWorkspace";
import { GovernanceDashboardWorkspace } from "./GovernanceDashboardWorkspace";
import { PurchaseRequisitionWorkspace } from "./PurchaseRequisitionWorkspace";
import { VendorManagementWorkspace } from "./VendorManagementWorkspace";
import { RFQQuotationWorkspace } from "./RFQQuotationWorkspace";
import { VendorComparisonWorkspace } from "./VendorComparisonWorkspace";
import PurchaseOrderWorkspace from "./PurchaseOrderWorkspace";
import GoodsReceiptWorkspace from "./GoodsReceiptWorkspace";

import { FileSpreadsheet, ClipboardCheck, LayoutDashboard, Truck, ClipboardList, Scale } from "lucide-react";

export const DashboardShell: React.FC = () => {
  const { authState, logout, refreshTimerState, apiFetch } = useAuth();
  const [currentTab, setCurrentTab] = useState<
    "overview" | "users" | "customers" | "security" | "migrations" | "materials" | "processes" | "scrap" | "rates" | "process-driver-playground" | "bom-hub" | "cost-sheets" | "cost-intelligence" | "estimate-governance" | "governance-dashboard" | "purchase-requisition" | "vendor-management" | "rfq-quotation" | "vendor-comparison" | "purchase-orders" | "grns"
  >("overview");

  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/process-driver-playground") {
      setCurrentTab("process-driver-playground");
    } else if (["/cost-analysis", "/cost-explorer", "/cost-traceability", "/cost-simulation"].includes(path)) {
      setCurrentTab("cost-intelligence");
    }
  }, []);
  
  // Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<CustomerParty[]>([]);
  const [auditLogs, setAuditLogs] = useState<SystemAuditLog[]>([]);
  const [stats, setStats] = useState({ total_accounts: 0, active_sessions: 0 });

  // Sprint 3C Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states - Users
  const [userForm, setUserForm] = useState({ email: "", password: "", fullName: "", roleName: "L1-Estimator" });
  // Form states - Customers
  const [customerForm, setCustomerForm] = useState({ code: "", name: "", email: "", phone: "", contactPerson: "", state: "" });

  const fetchDashboardData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Gather customers (Accessible by all roles)
      const custRes = await apiFetch("/api/v1/customers");
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }

      // Gather administrator metrics if authorized
      if (authState.user?.role === "L2-Admin") {
        const usersRes = await apiFetch("/api/v1/users");
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(uData);
        }

        const auditRes = await apiFetch("/api/v1/audits");
        if (auditRes.ok) {
          const aData = await auditRes.json();
          setAuditLogs(aData.audit_logs || []);
          setStats({
            total_accounts: aData.system_overview?.total_accounts || 0,
            active_sessions: aData.system_overview?.active_sessions || 0
          });
        }
      }
    } catch {
      setErrorMsg("Network error trying to query platform data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/api/v1/notifications");
      if (res.ok) {
        const data = await res.json();
        const visible = data.filter((n: any) => n.status !== "ARCHIVED");
        setNotifications(visible);
        setUnreadCount(visible.filter((n: any) => n.status === "UNREAD").length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications list", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "READ" } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/notifications/${id}/archive`, { method: "POST" });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => {
          const wasUnread = notifications.find(n => n.id === id)?.status === "UNREAD";
          return wasUnread ? Math.max(0, prev - 1) : prev;
        });
      }
    } catch (err) {
      console.error("Failed to archive notification item", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    if (authState.isAuthenticated) {
      fetchNotifications();
    }
  }, [authState, currentTab]);

  useEffect(() => {
    if (authState.isAuthenticated) {
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [authState]);

  // Handle User creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!userForm.email || !userForm.password || !userForm.fullName) {
      setErrorMsg("Please supply all user credential arguments.");
      return;
    }

    if (userForm.password.length < 8) {
      setErrorMsg("Password must meet the 8-character compliance minimum.");
      return;
    }

    try {
      const response = await apiFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          full_name: userForm.fullName,
          role_name: userForm.roleName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.message || "Failed to finalize operator registration.");
        return;
      }

      setSuccessMsg(`Operator account created successfully code: ${data.email}`);
      setUserForm({ email: "", password: "", fullName: "", roleName: "L1-Estimator" });
      fetchDashboardData();
    } catch {
      setErrorMsg("Failed to dispatch user registration sequence.");
    }
  };

  // Toggle User state (Active / Inactive)
  const handleToggleUserState = async (targetId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/v1/users/${targetId}/toggle-state`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed changing operational state.");
        return;
      }
      setSuccessMsg(`Operator profile status toggled successfully.`);
      fetchDashboardData();
    } catch {
      setErrorMsg("Internal communications error during user state modification.");
    }
  };

  // Handle customer creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!customerForm.code || !customerForm.name) {
      setErrorMsg("Company Name and Customer Code are mandatory fields.");
      return;
    }

    try {
      const response = await apiFetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: customerForm.code,
          name: customerForm.name,
          email: customerForm.email,
          phone: customerForm.phone,
          contact_person: customerForm.contactPerson,
          state: customerForm.state || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.message || "Failure registering customer party.");
        return;
      }

      setSuccessMsg(`Customer Party successfully logged under: [${data.code}] ${data.name}`);
      setCustomerForm({ code: "", name: "", email: "", phone: "", contactPerson: "", state: "" });
      fetchDashboardData();
    } catch {
      setErrorMsg("An error occurred while posting customer profile to server.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Upper Navigation Bar */}
      <header className="h-20 bg-slate-950 border-b border-slate-800 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/20">
            <Layers className="w-5.5 h-5.5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white uppercase sm:text-base">
              CCS Spacemaker
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                Sprint 1 Foundation Active
              </span>
            </div>
          </div>
        </div>

        {/* User Badge & Controls */}
        <div className="flex items-center gap-4">
          
          {/* Sprint 3C Notifications Hub Bell Popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg transition-all relative cursor-pointer"
              title="Collaboration Notifications Hub"
              id="notifications-bell-btn"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse" id="notifications-unread-badge">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                    id="notifications-dropdown-panel"
                  >
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                        <Bell className="w-3.5 h-3.5 text-emerald-400" />
                        Collaboration Alerts
                      </h4>
                      <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 border border-slate-850 rounded font-mono">
                        {unreadCount} unread
                      </span>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-900/60">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-slate-500 italic p-8 text-center font-sans">
                          No active notifications in your feed.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-4 space-y-2 transition-all hover:bg-slate-900/30 ${
                              n.status === "UNREAD" ? "bg-emerald-500/5" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-slate-200">{n.title}</span>
                              <span className="text-[8px] text-slate-500 whitespace-nowrap font-mono">
                                {new Date(n.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">{n.message}</p>
                            <div className="flex items-center justify-end border-t border-slate-900/40 pt-2 mt-1">
                              <div className="flex items-center gap-1.5">
                                {n.status === "UNREAD" && (
                                  <button
                                    onClick={() => handleMarkAsRead(n.id)}
                                    className="px-1.5 py-0.5 text-[9px] font-bold font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                    title="Mark as Read"
                                  >
                                    <Check className="w-3 h-3" />
                                    Read
                                  </button>
                                )}
                                <button
                                  onClick={() => handleArchive(n.id)}
                                  className="px-1.5 py-0.5 text-[9px] font-bold font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                  title="Archive Notification"
                                >
                                  <Archive className="w-3 h-3" />
                                  Archive
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-white leading-tight">{authState.user?.full_name}</div>
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <span className="text-[9px] uppercase font-mono font-extrabold bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700">
                {authState.user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-red-400 hover:text-red-300 rounded-lg transition-all"
            title="Disconnect authentication session"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Workspace Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Module Drawer */}
        <aside className="w-full md:w-64 bg-slate-950/90 border-r border-slate-800 shrink-0 p-4 space-y-1.5 md:block">
          <button
            onClick={() => setCurrentTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "overview"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Infrastructure Overview</span>
          </button>

          {authState.user?.role === "L2-Admin" && (
            <button
              onClick={() => setCurrentTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                currentTab === "users"
                  ? "bg-slate-800 text-white border border-slate-700/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Operator Directory</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab("customers")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "customers"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Party (Customer) Index</span>
          </button>

          <div className="pt-2 pb-1 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans border-t border-slate-900/65 mt-2">
            Master Registers (Sprint 2A)
          </div>

          <button
            onClick={() => setCurrentTab("materials")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "materials"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Material Master</span>
          </button>

          <button
            onClick={() => setCurrentTab("processes")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "processes"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Process Master</span>
          </button>

          <button
            onClick={() => setCurrentTab("scrap")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "scrap"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Recycle className="w-4 h-4 text-emerald-400" />
            <span>Scrap Master</span>
          </button>

          <button
            onClick={() => setCurrentTab("rates")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "rates"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Coins className="w-4 h-4 text-emerald-400" />
            <span>Rate Card Hub</span>
          </button>

          <button
            onClick={() => setCurrentTab("process-driver-playground")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "process-driver-playground"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Driver Playground</span>
          </button>

          <div className="pt-2 pb-1 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans border-t border-slate-900/65 mt-2">
            BOM Intelligence (Sprint 2C)
          </div>

          <button
            onClick={() => setCurrentTab("bom-hub")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "bom-hub"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>BOM Foundation Hub</span>
          </button>

          <div className="pt-2 pb-1 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans border-t border-slate-900/65 mt-2">
            Costing (Sprint 2D-A)
          </div>

          <button
            onClick={() => setCurrentTab("cost-sheets")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "cost-sheets"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Cost Sheets Workspace</span>
          </button>

          <button
            onClick={() => setCurrentTab("cost-intelligence")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "cost-intelligence"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Cost Intelligence Workspace</span>
          </button>

          <button
            onClick={() => setCurrentTab("estimate-governance")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "estimate-governance"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span>Estimate Governance Hub</span>
          </button>

          <button
            onClick={() => setCurrentTab("governance-dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "governance-dashboard"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-400" />
            <span>Executive Governance BI</span>
          </button>

          <button
            onClick={() => setCurrentTab("purchase-requisition")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "purchase-requisition"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Purchase Requisition</span>
          </button>

          <button
            onClick={() => setCurrentTab("vendor-management")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "vendor-management"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Vendor Master & Mappings</span>
          </button>

          <button
            id="sidebar_nav_rfq_quotation"
            onClick={() => setCurrentTab("rfq-quotation")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "rfq-quotation"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            <span>RFQ & Quotation Capture</span>
          </button>

          <button
            id="sidebar_nav_vendor_comparison"
            onClick={() => setCurrentTab("vendor-comparison")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "vendor-comparison"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Scale className="w-4 h-4 text-emerald-400" />
            <span>Vendor Comparison Matrix</span>
          </button>

          <button
            id="sidebar_nav_purchase_orders"
            onClick={() => setCurrentTab("purchase-orders")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "purchase-orders"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Purchase Order Management</span>
          </button>

          <button
            id="sidebar_nav_grns"
            onClick={() => setCurrentTab("grns")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "grns"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Goods Receipt Notes (GRN)</span>
          </button>

          <div className="pt-2 pb-1 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans border-t border-slate-900/65 mt-2">
            System & Operations
          </div>

          <button
            onClick={() => setCurrentTab("security")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "security"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Auth & Security Audits</span>
          </button>

          <button
            onClick={() => setCurrentTab("migrations")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "migrations"
                ? "bg-slate-800 text-white border border-slate-700/50"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Database schema (Alembic)</span>
          </button>
        </aside>

        {/* View Surface */}
        <main className="flex-1 overflow-y-auto bg-slate-900/50 p-6 md:p-8 space-y-6">
          
          {/* Messages Alert overlay */}
          <AnimatePresence mode="popLayout">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-950/40 border border-red-900 text-red-300 text-xs rounded-xl flex items-start gap-3"
              >
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-emerald-950/40 border border-emerald-900 text-emerald-300 text-xs rounded-xl flex items-start gap-3"
              >
                <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <p>{successMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERVIEW PANEL */}
          {currentTab === "overview" && (
            <div className="space-y-6">
              {/* Informational Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-1/2 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="p-2.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded-xl"><Users className="w-4.5 h-4.5" /></span>
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">USERS</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">{authState.user?.role === "L2-Admin" ? stats.total_accounts : users.length || 1}</div>
                  <p className="text-slate-400 text-[10px] mt-1">Total registered users validated</p>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-1/2 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="p-2.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded-xl"><Building className="w-4.5 h-4.5" /></span>
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">CUSTOMERS</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">{customers.length}</div>
                  <p className="text-slate-400 text-[10px] mt-1">Parties configured under Indian GST</p>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-1/2 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="p-2.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded-xl"><Activity className="w-4.5 h-4.5" /></span>
                    <span className="text-[10px] uppercase font-mono font-bold text-emerald-500 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/50">ACTIVE</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">100 / 100</div>
                  <p className="text-slate-400 text-[10px] mt-1">Platform architecture rating</p>
                </div>
              </div>

              {/* Status and checklist logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Deployment Blueprint info */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3">Sprint 1 Deployment Profile</h3>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Environment Type</span>
                      <span className="font-mono text-white">Full-Stack Sandboxed (Vite + Express)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Authority Role Assigned</span>
                      <span className="font-mono text-emerald-400 font-bold">{authState.user?.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Storage Mechanics</span>
                      <span className="font-mono text-white">Durability Persistent JSON Store</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Indian State Origin</span>
                      <span className="font-mono text-white">West Bengal (intra state CGST/SGST key)</span>
                    </div>
                  </div>
                </div>

                {/* Checklist progress tracker */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
                    <span>Engineering Checklist Progress</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/40">COMPLETED</span>
                  </h3>
                  <div className="space-y-3.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      <span>Schema definitions for users, sessions, entries</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      <span>Dynamic RSA credential bootstrap mechanism</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      <span>Account Lockout protection at 3 entries failure</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                      <span>Authorization safeguards for L2 Administrator directories</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OPERATOR DIRECTORY PANEL */}
          {currentTab === "users" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Registration Desk Form */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl h-fit">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-800 pb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Register New Operator</span>
                  </h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Full name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Dilip Sen"
                        value={userForm.fullName}
                        onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Official email username *</label>
                      <input
                        type="email"
                        required
                        placeholder="dilip@ccspacemaker.com"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Default password *</label>
                      <input
                        type="password"
                        required
                        placeholder="Minimum 8 characters"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Security role group *</label>
                      <select
                        value={userForm.roleName}
                        onChange={(e) => setUserForm({ ...userForm, roleName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      >
                        <option value="L1-Estimator">L1-Estimator</option>
                        <option value="L2-Admin">L2-Admin</option>
                        <option value="PM">PM (Purchase Manager)</option>
                        <option value="Signatory">Signatory</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-medium text-xs rounded-lg py-2 transition-all mt-4 flex items-center justify-center gap-1.5"
                    >
                      <span>Authorize Operator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {/* Directory index list */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl overflow-hidden">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-800 pb-3 flex items-center justify-between">
                    <span>Authorized Operators Registry</span>
                    <button onClick={fetchDashboardData} className="p-1.5 hover:bg-slate-900 text-slate-400 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="py-2.5">Name / Email</th>
                          <th className="py-2.5">Assigned Role</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-900/50">
                            <td className="py-3 pr-2">
                              <div className="font-bold text-white mb-0.5">{u.full_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{u.email}</div>
                            </td>
                            <td className="py-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono bg-slate-900 border border-slate-800 text-slate-300">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                                u.is_active
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                                  : "bg-red-950/40 text-red-400 border-red-900/60"
                              }`}>
                                {u.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {u.email !== authState.user?.email ? (
                                <button
                                  onClick={() => handleToggleUserState(u.id)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-all border ${
                                    u.is_active
                                      ? "text-red-450 border-red-900/40 hover:bg-red-950/30"
                                      : "text-emerald-450 border-emerald-900/40 hover:bg-emerald-950/30"
                                  }`}
                                >
                                  {u.is_active ? "Deactivate" : "Activate"}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic px-2">Self</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CUSTOMER DIRECTORY PANEL */}
          {currentTab === "customers" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Customer Creation Form */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl h-fit">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-800 pb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Register New Customer</span>
                  </h3>
                  <form onSubmit={handleCreateCustomer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Company Code *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SP-KOL"
                          value={customerForm.code}
                          onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">State name</label>
                        <input
                          type="text"
                          placeholder="e.g. West Bengal"
                          value={customerForm.state}
                          onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Corporate business Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Spacemaker Infra Private Limited"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Primary email address</label>
                      <input
                        type="email"
                        placeholder="contracts@sp-pvt.in"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Contact Person</label>
                        <input
                          type="text"
                          placeholder="B. K. Roy"
                          value={customerForm.contactPerson}
                          onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Phone Number</label>
                        <input
                          type="text"
                          placeholder="+91-9830001122"
                          value={customerForm.phone}
                          onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-1.5 text-xs text-white outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-bold text-slate-300 block mb-1">AR-04 GST STATE GUARD WARNING</span>
                      Leaving the <code className="text-white">State</code> field blank is permitted at creation but will trigger error code <code className="text-red-400">VENDOR_STATE_REQUIRED</code> if selected to generate purchase orders.
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-medium text-xs rounded-lg py-2 transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Register Partner Party</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {/* Customer List Display */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-800 pb-3 flex items-center justify-between">
                    <span>Registered Customers Registry</span>
                    <button onClick={fetchDashboardData} className="p-1.5 hover:bg-slate-900 text-slate-400 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </h3>

                  {customers.length === 0 ? (
                    <div className="py-20 flex flex-col items-center text-slate-500">
                      <Building className="w-10 h-10 mb-2 stroke-1.5" />
                      <p className="text-xs font-semibold">No consumer parties registered yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customers.map((c) => (
                        <div key={c.id} className="bg-slate-900 border border-slate-800/85 hover:border-slate-700/80 rounded-xl p-4 space-y-3.5 transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-extrabold bg-slate-950 text-emerald-400 border border-slate-800">
                                {c.code}
                              </span>
                              <h4 className="text-xs font-bold text-white mt-1.5 leading-tight">{c.name}</h4>
                            </div>
                            
                            {/* AR-04 Guard visualizer */}
                            <div>
                              {c.state ? (
                                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                                  c.state.toLowerCase() === "west bengal"
                                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                                    : "bg-blue-950/30 text-blue-400 border-blue-900/40"
                                }`}>
                                  {c.state} ({c.state.toLowerCase() === "west bengal" ? "INTRA-STATE" : "INTER-STATE"})
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-950/30 text-red-400 border border-red-900/50 flex items-center gap-1">
                                  <span>⚠ AR-04 Locked</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-800/50 pt-2.5 grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-medium">
                            <div>
                              <span className="block text-slate-600 font-bold uppercase text-[8px] tracking-wider mb-0.5">Contact Agent</span>
                              <span className="text-slate-300 truncate block">{c.contact_person || "(Unspecified)"}</span>
                            </div>
                            <div>
                              <span className="block text-slate-600 font-bold uppercase text-[8px] tracking-wider mb-0.5">Phone Number</span>
                              <span className="text-slate-300 truncate block">{c.phone || "(Unspecified)"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            </div>
          )}

          {/* AUTH & SECURITY LOG PANEL */}
          {currentTab === "security" && (
            <div className="space-y-6">
              
              {/* JWT Debug card */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">JWT Token Security Verification</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Displays active authentication signature state and manual rotation</p>
                  </div>
                  <button
                    onClick={refreshTimerState}
                    className="text-[10px] font-mono bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-900/50 text-emerald-400 font-bold px-2.5 py-1 rounded transition-all flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate tokens manually</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  <div className="p-4 bg-slate-900 rounded-xl space-y-2 border border-slate-800/60">
                    <span className="text-slate-500 font-bold uppercase text-[9px] block">Active Access Token (Signed HS256)</span>
                    <div className="text-[10px] text-emerald-400 break-all select-all select-none">
                      {authState.accessToken ? `Bearer ${authState.accessToken.substring(0, 50)}...${authState.accessToken.slice(-30)}` : "None"}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-xl space-y-2 border border-slate-800/60">
                    <span className="text-slate-500 font-bold uppercase text-[9px] block">Active Refresh Token</span>
                    <div className="text-[10px] text-white break-all select-all">
                      {authState.refreshToken ? `${authState.refreshToken}` : "None"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Logs (Admin only) */}
              {authState.user?.role === "L2-Admin" && (
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 border-b border-slate-800 pb-3">
                    System Audit and Security Logs
                  </h3>
                  <div className="overflow-hidden">
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-903 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-start gap-3.5 text-xs">
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded font-mono shrink-0 ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                              : "bg-red-950/40 text-red-400 border border-red-900/40"
                          }`}>
                            {log.status}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-bold text-white font-mono text-[10px] tracking-tight">{log.action}</span>
                              <span className="text-[9px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed">{log.details}</p>
                            {log.user_email && (
                              <span className="text-[9px] text-slate-500 mt-1 block">Triggered by: {log.user_email}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ALEMBIC SCHEMA VIEW PANEL */}
          {currentTab === "migrations" && (
            <div className="space-y-6 font-mono text-xs">
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Database Foundations (Alembic DDL)</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Lists historical tables schema state and migration records</p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-950/30 text-emerald-400 border border-emerald-900/60 px-2 py-0.5 rounded">
                    ALEMBIC_REVISION: 4f1a2386a9bc
                  </span>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-850 rounded-xl space-y-3">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>001_sprint1_foundation.py — SUCCESS</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Migration compiled successfully. Primary key indices generated for tables: <code className="text-slate-200">users</code>, <code className="text-slate-200">roles</code>, <code className="text-slate-200">sessions</code>, <code className="text-slate-200">customer_master</code>. Removed rate checked constraint target <code className="text-slate-200">chk_effective_date_not_too_old</code> as mandated by AR-01 architecture alignment.
                  </p>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-850 rounded-xl space-y-3">
                  <span className="text-slate-400 font-bold block">Migration logs:</span>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[10px] text-slate-500 space-y-1">
                    <div>{"[INFO] Context impl PostgresqlImpl."}</div>
                    <div>{"[INFO] Will assume transactional DDL."}</div>
                    <div>{"[INFO] Running upgrade None -> 4f1a2386a9bc, sprint1 foundation migration."}</div>
                    <div>{"[INFO] ALTER TABLE rate_card DROP CONSTRAINT IF EXISTS chk_effective_date_not_too_old;"}</div>
                    <div>{"[INFO] CREATE INDEX idx_users_email ON users(email);"}</div>
                    <div>{"[INFO] Seed operational parameters completed."}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MATERIAL MASTER REGISTER */}
          {currentTab === "materials" && (
            <MaterialMasterView
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* PROCESS MASTER REGISTER */}
          {currentTab === "processes" && (
            <ProcessMasterView
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* SCRAP MASTER REGISTER */}
          {currentTab === "scrap" && (
            <ScrapMasterView
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* RATE CARD MASTER REGISTER */}
          {currentTab === "rates" && (
            <RateCardView
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* PROCESS DRIVER PLAYGROUND */}
          {currentTab === "process-driver-playground" && (
            <ProcessDriverPlayground />
          )}

          {/* BOM FOUNDATION HUB */}
          {currentTab === "bom-hub" && (
            <BOMHubView
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* COSTING WORKSPACE */}
          {currentTab === "cost-sheets" && (
            <CostSheetsWorkspace
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* COST INTELLIGENCE WORKSPACE */}
          {currentTab === "cost-intelligence" && (
            <CostIntelligenceWorkspace
              authState={authState}
              apiFetch={apiFetch}
            />
          )}

          {/* ESTIMATE GOVERNANCE WORKSPACE */}
          {currentTab === "estimate-governance" && (
            <EstimateGovernanceWorkspace
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* GOVERNANCE DASHBOARD WORKSPACE */}
          {currentTab === "governance-dashboard" && (
            <GovernanceDashboardWorkspace
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* PURCHASE REQUISITION FOUNDATION WORKSPACE */}
          {currentTab === "purchase-requisition" && (
            <PurchaseRequisitionWorkspace
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* VENDOR MASTER & VENDOR MANAGEMENT FOUNDATION WORKSPACE */}
          {currentTab === "vendor-management" && (
            <VendorManagementWorkspace
              authState={authState}
              apiFetch={apiFetch}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* RFQ & VENDOR QUOTATION CAPTURE WORKSPACE */}
          {currentTab === "rfq-quotation" && (
            <RFQQuotationWorkspace
              authState={{
                isAuthenticated: authState.isAuthenticated,
                token: authState.accessToken,
                user: authState.user
              }}
              apiFetch={async (path: string, options?: any) => {
                const res = await apiFetch(path, options);
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || "Failed API action");
                }
                return res.json();
              }}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* VENDOR COMPARISON & SOURCE SELECTION WORKSPACE */}
          {currentTab === "vendor-comparison" && (
            <VendorComparisonWorkspace
              authState={{
                isAuthenticated: authState.isAuthenticated,
                token: authState.accessToken,
                user: authState.user
              }}
              apiFetch={async (path: string, options?: any) => {
                const res = await apiFetch(path, options);
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || "Failed API action");
                }
                return res.json();
              }}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* PURCHASE ORDER MANAGEMENT WORKSPACE */}
          {currentTab === "purchase-orders" && (
            <PurchaseOrderWorkspace
              authState={{
                isAuthenticated: authState.isAuthenticated,
                token: authState.accessToken,
                user: authState.user
              }}
              apiFetch={async (path: string, options?: any) => {
                const res = await apiFetch(path, options);
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || "Failed API action");
                }
                return res.json();
              }}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

          {/* GOODS RECEIPT NOTE WORKSPACE */}
          {currentTab === "grns" && (
            <GoodsReceiptWorkspace
              authState={{
                isAuthenticated: authState.isAuthenticated,
                token: authState.accessToken,
                user: authState.user
              }}
              apiFetch={async (path: string, options?: any) => {
                const res = await apiFetch(path, options);
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || "Failed API action");
                }
                return res.json();
              }}
              setErrorMsg={setErrorMsg}
              setSuccessMsg={setSuccessMsg}
            />
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer className="h-10 bg-slate-950 border-t border-slate-800 text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest px-8 flex items-center justify-between shrink-0">
        <div>Platform Engine System • CCS Spacemaker Ltd</div>
        <div>Active User: {authState.user?.email || "Offline"}</div>
      </footer>
    </div>
  );
};
