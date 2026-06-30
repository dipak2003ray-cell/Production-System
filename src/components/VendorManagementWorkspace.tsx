import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Ban,
  Archive,
  CreditCard,
  MapPin,
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
  Sparkles,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Vendor {
  id: string;
  vendor_code: string;
  vendor_name: string;
  legal_name: string;
  vendor_category: string;
  vendor_type: "Manufacturer" | "Trader" | "Service Provider" | "Transporter" | "Contractor" | "Other";
  gstin: string;
  pan: string;
  msme_status: boolean;
  cin?: string | null;
  contact_person: string;
  email: string;
  mobile: string;
  alternate_mobile?: string | null;
  website?: string | null;
  status: "DRAFT" | "ACTIVE" | "BLOCKED" | "INACTIVE" | "ARCHIVED";
  payment_terms: string;
  credit_days: number;
  currency: string;
  incoterms: string;
  delivery_terms: string;
  preferred_transport: string;
  created_at: string;
}

interface VendorAddress {
  id: string;
  vendor_id: string;
  address_type: "Registered Office" | "Corporate Office" | "Factory" | "Warehouse" | "Dispatch Address";
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  country: string;
  pin_code: string;
}

interface VendorBank {
  id: string;
  vendor_id: string;
  bank_name: string;
  branch: string;
  account_number: string;
  ifsc: string;
  account_holder: string;
}

interface VendorMaterialMapping {
  id: string;
  vendor_id: string;
  material_id: string;
  vendor_material_code: string;
  preferred_vendor_flag: boolean;
  last_purchase_rate: number;
  lead_time_days: number;
  moq: number;
  last_updated: string;
  
  // joined fields
  vendor_name?: string;
  vendor_code?: string;
  vendor_status?: string;
  material_code?: string;
  material_description?: string;
  material_unit?: string;
}

interface VendorRating {
  quality_rating: number;
  delivery_rating: number;
  price_rating: number;
  service_rating: number;
  overall_rating: number;
}

interface Props {
  authState: any;
  apiFetch: any;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const VendorManagementWorkspace: React.FC<Props> = ({
  authState,
  apiFetch,
  setErrorMsg,
  setSuccessMsg
}) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorMaterials, setVendorMaterials] = useState<VendorMaterialMapping[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [vendorDetail, setVendorDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  
  // Sub tab in vendor profile
  const [activeSubTab, setActiveSubTab] = useState<"general" | "addresses" | "banking" | "commercial" | "ratings" | "materials">("general");
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [showMapMaterialModal, setShowMapMaterialModal] = useState(false);

  // New Vendor Form
  const [vendorForm, setVendorForm] = useState({
    vendor_name: "",
    legal_name: "",
    vendor_category: "Standard",
    vendor_type: "Manufacturer" as any,
    gstin: "",
    pan: "",
    msme_status: false,
    cin: "",
    contact_person: "",
    email: "",
    mobile: "",
    alternate_mobile: "",
    website: "",
    payment_terms: "Net 30",
    credit_days: 30,
    currency: "INR",
    incoterms: "Ex Works",
    delivery_terms: "Within 14 days",
    preferred_transport: "Road",
    
    // Initial address (optional but helpful)
    address_type: "Registered Office" as any,
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    pin_code: "",
    
    // Initial bank (optional but helpful)
    bank_name: "",
    branch: "",
    account_number: "",
    ifsc: "",
    account_holder: ""
  });

  // Material Mapping Form
  const [mappingForm, setMappingForm] = useState({
    material_id: "",
    vendor_material_code: "",
    preferred_vendor_flag: false,
    last_purchase_rate: 0,
    lead_time_days: 0,
    moq: 1
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchVendorDetails(selectedVendorId);
    } else {
      setVendorDetail(null);
    }
  }, [selectedVendorId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [vRes, mRes, matRes] = await Promise.all([
        apiFetch("/api/v1/vendors"),
        apiFetch("/api/v1/vendor-materials"),
        apiFetch("/api/v1/materials")
      ]);

      if (vRes.ok) {
        const data = await vRes.json();
        setVendors(data);
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setVendorMaterials(data);
      }
      if (matRes.ok) {
        const data = await matRes.json();
        setMaterials(data);
      }
    } catch (err) {
      setErrorMsg("Failed to retrieve master database lists.");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/v1/vendors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVendorDetail(data);
      } else {
        setErrorMsg("Failed to load vendor record profile.");
      }
    } catch (err) {
      setErrorMsg("Network error trying to query vendor master profile.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (id: string, action: "activate" | "block" | "archive") => {
    try {
      const res = await apiFetch(`/api/v1/vendors/${id}/${action}`, {
        method: "POST"
      });
      if (res.ok) {
        const updated = await res.json();
        setSuccessMsg(`Vendor ${updated.vendor_code} successfully updated to ${updated.status}.`);
        setVendors(prev => prev.map(v => v.id === id ? { ...v, status: updated.status } : v));
        if (selectedVendorId === id) {
          fetchVendorDetails(id);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to update vendor workflow status.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to the administration server.");
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!vendorForm.vendor_name.trim()) errors.vendor_name = "Vendor Name is required.";
    if (!vendorForm.legal_name.trim()) errors.legal_name = "Legal Company Name is required.";
    
    // GSTIN format check
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!vendorForm.gstin.trim()) {
      errors.gstin = "GSTIN is required.";
    } else if (!gstinRegex.test(vendorForm.gstin.trim().toUpperCase())) {
      errors.gstin = "Invalid Indian GSTIN format (e.g. 27AAAAA1111A1Z1).";
    }

    // PAN format check
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!vendorForm.pan.trim()) {
      errors.pan = "PAN is required.";
    } else if (!panRegex.test(vendorForm.pan.trim().toUpperCase())) {
      errors.pan = "Invalid Indian PAN format (e.g. ABCDE1234F).";
    }

    // Email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!vendorForm.email.trim()) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(vendorForm.email.trim())) {
      errors.email = "Invalid Email address.";
    }

    // Mobile check
    const mobileRegex = /^\+?(\d[\s-]?){9,14}\d$/;
    if (!vendorForm.mobile.trim()) {
      errors.mobile = "Mobile number is required.";
    } else if (!mobileRegex.test(vendorForm.mobile.trim())) {
      errors.mobile = "Invalid Mobile number format (10-15 digits).";
    }

    if (!vendorForm.contact_person.trim()) errors.contact_person = "Contact Person is required.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOrUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const addresses = vendorForm.address_line_1.trim() ? [{
        address_type: vendorForm.address_type,
        address_line_1: vendorForm.address_line_1,
        address_line_2: vendorForm.address_line_2,
        city: vendorForm.city,
        state: vendorForm.state,
        pin_code: vendorForm.pin_code,
        country: "India"
      }] : [];

      const banks = vendorForm.account_number.trim() ? [{
        bank_name: vendorForm.bank_name,
        branch: vendorForm.branch,
        account_number: vendorForm.account_number,
        ifsc: vendorForm.ifsc,
        account_holder: vendorForm.account_holder
      }] : [];

      const payload = {
        ...vendorForm,
        addresses,
        banks,
        ratings: {
          quality_rating: 5,
          delivery_rating: 5,
          price_rating: 5,
          service_rating: 5,
          overall_rating: 5
        }
      };

      const url = editingVendorId ? `/api/v1/vendors/${editingVendorId}` : "/api/v1/vendors";
      const method = editingVendorId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(editingVendorId ? "Vendor profile updated successfully!" : "Vendor Master record created successfully!");
        if (data.warnings && data.warnings.length > 0) {
          setErrorMsg(data.warnings.join("\n"));
        }
        setShowCreateModal(false);
        setEditingVendorId(null);
        resetForm();
        fetchInitialData();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Failed to submit vendor master registration.");
      }
    } catch (err) {
      setErrorMsg("Network error submitting master form.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingForm.material_id || !mappingForm.vendor_material_code.trim()) {
      setErrorMsg("All mapping fields are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/vendor-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: selectedVendorId,
          ...mappingForm
        })
      });

      if (res.ok) {
        setSuccessMsg("Material-Vendor mapping registered successfully.");
        setShowMapMaterialModal(false);
        setMappingForm({
          material_id: "",
          vendor_material_code: "",
          preferred_vendor_flag: false,
          last_purchase_rate: 0,
          lead_time_days: 0,
          moq: 1
        });
        fetchInitialData();
        if (selectedVendorId) {
          fetchVendorDetails(selectedVendorId);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Validation failed: Could not map material.");
      }
    } catch (err) {
      setErrorMsg("Failed to record mapping in core services.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!window.confirm("Are you sure you want to delete this material supply mapping?")) return;
    try {
      const res = await apiFetch(`/api/v1/vendor-materials/${mappingId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMsg("Mapping successfully unassigned.");
        fetchInitialData();
        if (selectedVendorId) {
          fetchVendorDetails(selectedVendorId);
        }
      } else {
        setErrorMsg("Failed to delete mapping.");
      }
    } catch (err) {
      setErrorMsg("Network error trying to delete supplier connection.");
    }
  };

  const resetForm = () => {
    setVendorForm({
      vendor_name: "",
      legal_name: "",
      vendor_category: "Standard",
      vendor_type: "Manufacturer",
      gstin: "",
      pan: "",
      msme_status: false,
      cin: "",
      contact_person: "",
      email: "",
      mobile: "",
      alternate_mobile: "",
      website: "",
      payment_terms: "Net 30",
      credit_days: 30,
      currency: "INR",
      incoterms: "Ex Works",
      delivery_terms: "Within 14 days",
      preferred_transport: "Road",
      address_type: "Registered Office",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      pin_code: "",
      bank_name: "",
      branch: "",
      account_number: "",
      ifsc: "",
      account_holder: ""
    });
    setFormErrors({});
  };

  const handleEditClick = (vendor: any) => {
    setEditingVendorId(vendor.id);
    setVendorForm({
      vendor_name: vendor.vendor_name || "",
      legal_name: vendor.legal_name || "",
      vendor_category: vendor.vendor_category || "Standard",
      vendor_type: vendor.vendor_type || "Manufacturer",
      gstin: vendor.gstin || "",
      pan: vendor.pan || "",
      msme_status: !!vendor.msme_status,
      cin: vendor.cin || "",
      contact_person: vendor.contact_person || "",
      email: vendor.email || "",
      mobile: vendor.mobile || "",
      alternate_mobile: vendor.alternate_mobile || "",
      website: vendor.website || "",
      payment_terms: vendor.payment_terms || "Net 30",
      credit_days: vendor.credit_days || 30,
      currency: vendor.currency || "INR",
      incoterms: vendor.incoterms || "Ex Works",
      delivery_terms: vendor.delivery_terms || "Within 14 days",
      preferred_transport: vendor.preferred_transport || "Road",
      
      // Load first address/bank if they exist in detail, or reset
      address_type: vendor.addresses?.[0]?.address_type || "Registered Office",
      address_line_1: vendor.addresses?.[0]?.address_line_1 || "",
      address_line_2: vendor.addresses?.[0]?.address_line_2 || "",
      city: vendor.addresses?.[0]?.city || "",
      state: vendor.addresses?.[0]?.state || "",
      pin_code: vendor.addresses?.[0]?.pin_code || "",
      
      bank_name: vendor.banks?.[0]?.bank_name || "",
      branch: vendor.banks?.[0]?.branch || "",
      account_number: vendor.banks?.[0]?.account_number || "",
      ifsc: vendor.banks?.[0]?.ifsc || "",
      account_holder: vendor.banks?.[0]?.account_holder || ""
    });
    setShowCreateModal(true);
  };

  // Filter vendor list
  const filteredVendors = vendors.filter(v => {
    const matchesSearch = 
      v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = filterStatus === "ALL" || v.status === filterStatus;
    const matchesCategory = filterCategory === "ALL" || v.vendor_category === filterCategory;
    const matchesType = filterType === "ALL" || v.vendor_type === filterType;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesType;
  });

  // Calculate high-level metrics for dashboard
  const totalVendorsCount = vendors.length;
  const activeVendorsCount = vendors.filter(v => v.status === "ACTIVE").length;
  const blockedVendorsCount = vendors.filter(v => v.status === "BLOCKED").length;
  const preferredCount = vendorMaterials.filter(m => m.preferred_vendor_flag).length;
  const uniqueMappedMaterials = new Set(vendorMaterials.map(m => m.material_id)).size;
  const materialCoveragePercent = materials.length > 0 ? Math.round((uniqueMappedMaterials / materials.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-400" />
            Vendor Master & Supplier Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain suppliers, commercial profiles, quality ratings, and material mappings. Only ACTIVE vendors are available for procurement.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              resetForm();
              setEditingVendorId(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            Register Supplier
          </button>
          <button
            onClick={fetchInitialData}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DASHBOARD SUMMARY STATISTICS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Suppliers</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono">{totalVendorsCount}</span>
            <span className="text-[10px] text-slate-500">records</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">{activeVendorsCount}</span>
            <span className="text-[10px] text-slate-500">approved</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Blocked
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-amber-500 font-mono">{blockedVendorsCount}</span>
            <span className="text-[10px] text-slate-500">restricted</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Preferred
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-blue-400 font-mono">{preferredCount}</span>
            <span className="text-[10px] text-slate-500">materials</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Quality Rating</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono">4.8</span>
            <span className="text-[10px] text-slate-500">/ 5.0</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mat Coverage</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono">{materialCoveragePercent}%</span>
            <span className="text-[10px] text-slate-500">of masters</span>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN PANEL: LEFT REGISTER TABLE, RIGHT DETAILED PROFILE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: VENDOR LISTING TABLE (7 COLS) */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search code, name, contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-lg py-1.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500"
              />
            </div>

            <div className="sm:col-span-7 grid grid-cols-3 gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-900 border border-slate-800 focus:border-slate-700 text-slate-300 text-xs rounded-lg py-1.5 px-2 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="BLOCKED">Blocked</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 focus:border-slate-700 text-slate-300 text-xs rounded-lg py-1.5 px-2 outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
                <option value="Critical">Critical</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-900 border border-slate-800 focus:border-slate-700 text-slate-300 text-xs rounded-lg py-1.5 px-2 outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Trader">Trader</option>
                <option value="Service Provider">Service Provider</option>
                <option value="Transporter">Transporter</option>
                <option value="Contractor">Contractor</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* VENDOR TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-900/40">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-mono">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-400" />
                      Loading vendor directory...
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No suppliers registered matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      onClick={() => setSelectedVendorId(vendor.id)}
                      className={`hover:bg-slate-900/60 transition-all cursor-pointer ${
                        selectedVendorId === vendor.id ? "bg-slate-900" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">{vendor.vendor_code}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{vendor.vendor_name}</div>
                        <div className="text-[10px] text-slate-500">{vendor.legal_name}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          vendor.vendor_category === "Critical" 
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                            : vendor.vendor_category === "Premium" 
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                            : "bg-slate-800 text-slate-300"
                        }`}>
                          {vendor.vendor_category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{vendor.vendor_type}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          vendor.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : vendor.status === "BLOCKED"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : vendor.status === "DRAFT"
                            ? "bg-slate-800 text-slate-400 border border-slate-700"
                            : "bg-slate-900 text-slate-500 border border-slate-800"
                        }`}>
                          {vendor.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditClick(vendor)}
                          className="p-1 text-slate-400 hover:text-emerald-400 transition-all"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL PROFILE TABS (5 COLS) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[500px]">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-mono">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-emerald-400" />
              Loading supplier profile...
            </div>
          ) : !vendorDetail ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 border border-dashed border-slate-800/80 rounded-xl">
              <Building className="w-10 h-10 text-slate-700 mb-3" />
              <h3 className="text-sm font-semibold text-slate-400">No Supplier Selected</h3>
              <p className="text-[11px] text-slate-500 max-w-[250px] mt-1">
                Select a vendor from the register on the left to view complete contact directory, address books, bank credentials, and supply mappings.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Profile Card Header */}
              <div className="flex justify-between items-start border-b border-slate-900 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500 uppercase">Supplier Workspace</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      vendorDetail.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}>
                      {vendorDetail.status}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-100 mt-1">{vendorDetail.vendor_name}</h2>
                  <p className="text-[11px] text-slate-400">{vendorDetail.legal_name}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">{vendorDetail.vendor_code}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{vendorDetail.vendor_type}</div>
                </div>
              </div>

              {/* Status Action Row */}
              <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl flex flex-wrap gap-2 items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lifecycle Controls:</span>
                <div className="flex gap-1">
                  {vendorDetail.status !== "ACTIVE" && (
                    <button
                      onClick={() => handleStatusChange(vendorDetail.id, "activate")}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-extrabold cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Activate
                    </button>
                  )}
                  {vendorDetail.status === "ACTIVE" && (
                    <button
                      onClick={() => handleStatusChange(vendorDetail.id, "block")}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-[10px] font-extrabold cursor-pointer transition-all"
                    >
                      <Ban className="w-3 h-3" />
                      Block
                    </button>
                  )}
                  {vendorDetail.status !== "ARCHIVED" && (
                    <button
                      onClick={() => handleStatusChange(vendorDetail.id, "archive")}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[10px] font-extrabold cursor-pointer transition-all"
                    >
                      <Archive className="w-3 h-3" />
                      Archive
                    </button>
                  )}
                </div>
              </div>

              {/* PROFILE DETAILS TABS */}
              <div className="flex border-b border-slate-900 overflow-x-auto text-[11px] font-bold text-slate-400 scrollbar-none">
                <button
                  onClick={() => setActiveSubTab("general")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "general" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  General & Contacts
                </button>
                <button
                  onClick={() => setActiveSubTab("addresses")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "addresses" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  Addresses ({vendorDetail.addresses?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab("banking")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "banking" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  Banking ({vendorDetail.banks?.length || 0})
                </button>
                <button
                  onClick={() => setActiveSubTab("commercial")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "commercial" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  Commercial Terms
                </button>
                <button
                  onClick={() => setActiveSubTab("ratings")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "ratings" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  Rating Card
                </button>
                <button
                  onClick={() => setActiveSubTab("materials")}
                  className={`py-2 px-3 border-b-2 shrink-0 transition-all ${
                    activeSubTab === "materials" ? "border-emerald-500 text-emerald-400" : "border-transparent hover:text-slate-100"
                  }`}
                >
                  Materials Supplied ({vendorDetail.materials?.length || 0})
                </button>
              </div>

              {/* SUB TAB RENDER CONTENT */}
              <div className="pt-2 text-xs text-slate-300 space-y-3">
                {/* GENERAL & CONTACTS */}
                {activeSubTab === "general" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30 p-3 rounded-lg border border-slate-900">
                    <div className="space-y-2">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Tax Registry</div>
                      <div>
                        <span className="text-slate-400">GSTIN:</span> <span className="font-mono text-emerald-400 font-bold uppercase">{vendorDetail.gstin}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">PAN:</span> <span className="font-mono text-slate-200 font-bold uppercase">{vendorDetail.pan}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">CIN:</span> <span className="font-mono text-slate-400">{vendorDetail.cin || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">MSME Status:</span>{" "}
                        <span className={`font-semibold ${vendorDetail.msme_status ? "text-emerald-400" : "text-slate-500"}`}>
                          {vendorDetail.msme_status ? "Registered MSME" : "Non-MSME"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-900 pt-2 md:pt-0 md:pl-4">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Contacts</div>
                      <div>
                        <span className="text-slate-400">Officer:</span> <span className="font-semibold text-slate-200">{vendorDetail.contact_person}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Email:</span> <a href={`mailto:${vendorDetail.email}`} className="text-emerald-400 hover:underline">{vendorDetail.email}</a>
                      </div>
                      <div>
                        <span className="text-slate-400">Mobile:</span> <span className="font-mono text-slate-200">{vendorDetail.mobile}</span>
                      </div>
                      {vendorDetail.website && (
                        <div>
                          <span className="text-slate-400">Website:</span> <a href={vendorDetail.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">{vendorDetail.website}</a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ADDRESS DIRECTORY */}
                {activeSubTab === "addresses" && (
                  <div className="space-y-2.5">
                    {(!vendorDetail.addresses || vendorDetail.addresses.length === 0) ? (
                      <div className="text-slate-500 text-center py-4">No registered addresses.</div>
                    ) : (
                      vendorDetail.addresses.map((addr: any) => (
                        <div key={addr.id} className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-lg flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{addr.address_type}</div>
                            <div className="text-slate-200 mt-1">{addr.address_line_1}</div>
                            {addr.address_line_2 && <div className="text-slate-400">{addr.address_line_2}</div>}
                            <div className="text-slate-400 mt-0.5">
                              {addr.city}, {addr.state}, PIN {addr.pin_code}, {addr.country}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* BANKING CREDENTIALS */}
                {activeSubTab === "banking" && (
                  <div className="space-y-2.5">
                    {(!vendorDetail.banks || vendorDetail.banks.length === 0) ? (
                      <div className="text-slate-500 text-center py-4">No registered bank details.</div>
                    ) : (
                      vendorDetail.banks.map((b: any) => (
                        <div key={b.id} className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-lg flex items-start gap-2.5">
                          <CreditCard className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div className="w-full">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Primary Settlement Bank</div>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div>
                                <span className="text-slate-500">Bank Name:</span> <div className="font-semibold text-slate-200">{b.bank_name}</div>
                              </div>
                              <div>
                                <span className="text-slate-500">Branch Name:</span> <div className="font-semibold text-slate-200">{b.branch}</div>
                              </div>
                              <div>
                                <span className="text-slate-500">Holder Name:</span> <div className="font-semibold text-slate-200">{b.account_holder}</div>
                              </div>
                              <div>
                                <span className="text-slate-500">IFSC Code:</span> <div className="font-mono text-emerald-400 font-bold uppercase">{b.ifsc}</div>
                              </div>
                              <div className="col-span-2 border-t border-slate-900 pt-1.5 mt-1">
                                <span className="text-slate-500">Account Number:</span>
                                <div className="font-mono text-slate-200 font-semibold tracking-wider bg-slate-950 px-2 py-1 rounded border border-slate-900 mt-0.5 text-center">
                                  {b.account_number}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* COMMERCIAL TERMS */}
                {activeSubTab === "commercial" && (
                  <div className="grid grid-cols-2 gap-3 bg-slate-900/30 p-3.5 rounded-lg border border-slate-900">
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Payment Terms</div>
                      <div className="font-bold text-slate-200 mt-0.5">{vendorDetail.payment_terms || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Credit Days Limit</div>
                      <div className="font-bold text-slate-200 mt-0.5">{vendorDetail.credit_days || 0} Days</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Trading Currency</div>
                      <div className="font-bold text-emerald-400 font-mono mt-0.5">{vendorDetail.currency || "INR"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Incoterms Agreement</div>
                      <div className="font-bold text-slate-200 mt-0.5">{vendorDetail.incoterms || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Delivery Terms</div>
                      <div className="font-bold text-slate-200 mt-0.5">{vendorDetail.delivery_terms || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase text-[9px] font-bold">Preferred Transport Mode</div>
                      <div className="font-bold text-slate-200 mt-0.5">{vendorDetail.preferred_transport || "N/A"}</div>
                    </div>
                  </div>
                )}

                {/* RATING CARD */}
                {activeSubTab === "ratings" && (
                  <div className="space-y-3 bg-slate-900/30 p-3.5 rounded-lg border border-slate-900">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Supplier Scorecard</span>
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span className="text-xs font-black font-mono text-emerald-400">
                          {vendorDetail.ratings?.overall_rating || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500">Quality Rating</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-sm font-bold text-slate-100 font-mono">
                          {vendorDetail.ratings?.quality_rating || 0} / 5
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Delivery Schedule Rating</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-sm font-bold text-slate-100 font-mono">
                          {vendorDetail.ratings?.delivery_rating || 0} / 5
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Price Competitiveness</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-sm font-bold text-slate-100 font-mono">
                          {vendorDetail.ratings?.price_rating || 0} / 5
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Customer Support Service</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-sm font-bold text-slate-100 font-mono">
                          {vendorDetail.ratings?.service_rating || 0} / 5
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MATERIAL MAPPINGS */}
                {activeSubTab === "materials" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Linked Materials</span>
                      <button
                        onClick={() => {
                          if (vendorDetail.status !== "ACTIVE") {
                            setErrorMsg("Inactive vendors cannot be mapped to materials. Please activate the vendor first.");
                            return;
                          }
                          setMappingForm({
                            material_id: "",
                            vendor_material_code: "",
                            preferred_vendor_flag: false,
                            last_purchase_rate: 0,
                            lead_time_days: 0,
                            moq: 1
                          });
                          setShowMapMaterialModal(true);
                        }}
                        disabled={vendorDetail.status !== "ACTIVE"}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                          vendorDetail.status === "ACTIVE"
                            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                            : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                        Link Material
                      </button>
                    </div>

                    {(!vendorDetail.materials || vendorDetail.materials.length === 0) ? (
                      <div className="text-slate-500 text-center py-6 border border-dashed border-slate-900 rounded-lg">
                        No materials supply mappings configured for this vendor.
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-[300px]">
                        {vendorDetail.materials.map((m: any) => (
                          <div key={m.id} className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-2.5 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-emerald-400">{m.material_code}</span>
                                {m.preferred_vendor_flag && (
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.2 rounded text-[8px] font-black uppercase">
                                    PREFERRED
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-slate-200 mt-1">{m.material_description}</div>
                              <div className="grid grid-cols-3 gap-x-3 text-[10px] text-slate-500 mt-1 font-mono">
                                <div>Code: {m.vendor_material_code}</div>
                                <div>Rate: ₹{m.last_purchase_rate}</div>
                                <div>Lead: {m.lead_time_days}d</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteMapping(m.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                              title="Remove connection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: REGISTER/EDIT VENDOR */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-400" />
                  {editingVendorId ? "Modify Supplier Profile" : "Register Master Supplier Record"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Provide company records, tax identification numbers, banking details, and default commercial agreements.
                </p>
              </div>

              <form onSubmit={handleCreateOrUpdateVendor} className="space-y-4">
                {/* General Information Group */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                    1. Identity & Classification
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Name *</label>
                      <input
                        type="text"
                        value={vendorForm.vendor_name}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="e.g. Acme Industrial Solutions"
                        required
                      />
                      {formErrors.vendor_name && <span className="text-[10px] text-rose-400 mt-1">{formErrors.vendor_name}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Legal Name *</label>
                      <input
                        type="text"
                        value={vendorForm.legal_name}
                        onChange={(e) => setVendorForm({ ...vendorForm, legal_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="e.g. Acme Supplies Private Limited"
                        required
                      />
                      {formErrors.legal_name && <span className="text-[10px] text-rose-400 mt-1">{formErrors.legal_name}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Type *</label>
                      <select
                        value={vendorForm.vendor_type}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendor_type: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        required
                      >
                        <option value="Manufacturer">Manufacturer</option>
                        <option value="Trader">Trader</option>
                        <option value="Service Provider">Service Provider</option>
                        <option value="Transporter">Transporter</option>
                        <option value="Contractor">Contractor</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Supplier Category</label>
                      <select
                        value={vendorForm.vendor_category}
                        onChange={(e) => setVendorForm({ ...vendorForm, vendor_category: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                      >
                        <option value="Standard">Standard (Regular supplier)</option>
                        <option value="Premium">Premium (Strategic partner)</option>
                        <option value="Critical">Critical (High-risk supplier)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Taxation Details */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                    2. Taxation & Registration
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">GSTIN (15 chars) *</label>
                      <input
                        type="text"
                        value={vendorForm.gstin}
                        onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                        maxLength={15}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono uppercase"
                        placeholder="27AAAAA1111A1Z1"
                        required
                      />
                      {formErrors.gstin && <span className="text-[10px] text-rose-400 mt-1">{formErrors.gstin}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">PAN (10 chars) *</label>
                      <input
                        type="text"
                        value={vendorForm.pan}
                        onChange={(e) => setVendorForm({ ...vendorForm, pan: e.target.value })}
                        maxLength={10}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono uppercase"
                        placeholder="AAAAA1111A"
                        required
                      />
                      {formErrors.pan && <span className="text-[10px] text-rose-400 mt-1">{formErrors.pan}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Corporate ID (CIN)</label>
                      <input
                        type="text"
                        value={vendorForm.cin}
                        onChange={(e) => setVendorForm({ ...vendorForm, cin: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono uppercase"
                        placeholder="CIN number (Optional)"
                      />
                    </div>

                    <div className="sm:col-span-3 flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        id="msme_status_chk"
                        checked={vendorForm.msme_status}
                        onChange={(e) => setVendorForm({ ...vendorForm, msme_status: e.target.checked })}
                        className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900 focus:outline-none"
                      />
                      <label htmlFor="msme_status_chk" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                        Registered MSME (Micro, Small and Medium Enterprises) Supplier status
                      </label>
                    </div>
                  </div>
                </div>

                {/* Primary Contacts */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                    3. Contact Officer Directory
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Contact Person Name *</label>
                      <input
                        type="text"
                        value={vendorForm.contact_person}
                        onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="Primary Sales Officer"
                        required
                      />
                      {formErrors.contact_person && <span className="text-[10px] text-rose-400 mt-1">{formErrors.contact_person}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email *</label>
                      <input
                        type="email"
                        value={vendorForm.email}
                        onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="corporate@domain.com"
                        required
                      />
                      {formErrors.email && <span className="text-[10px] text-rose-400 mt-1">{formErrors.email}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mobile Contact *</label>
                      <input
                        type="text"
                        value={vendorForm.mobile}
                        onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="10-digit mobile phone"
                        required
                      />
                      {formErrors.mobile && <span className="text-[10px] text-rose-400 mt-1">{formErrors.mobile}</span>}
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Alternate Contact</label>
                      <input
                        type="text"
                        value={vendorForm.alternate_mobile}
                        onChange={(e) => setVendorForm({ ...vendorForm, alternate_mobile: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="Optional backup phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Address (Initial creation helper) */}
                {!editingVendorId && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                        4. Address Directory Setup
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Address Type</label>
                          <select
                            value={vendorForm.address_type}
                            onChange={(e) => setVendorForm({ ...vendorForm, address_type: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                          >
                            <option value="Registered Office">Registered Office</option>
                            <option value="Corporate Office">Corporate Office</option>
                            <option value="Factory">Factory</option>
                            <option value="Warehouse">Warehouse</option>
                            <option value="Dispatch Address">Dispatch Address</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Address Line 1</label>
                          <input
                            type="text"
                            value={vendorForm.address_line_1}
                            onChange={(e) => setVendorForm({ ...vendorForm, address_line_1: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="Plot, Street name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">City</label>
                          <input
                            type="text"
                            value={vendorForm.city}
                            onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="City"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">State</label>
                          <input
                            type="text"
                            value={vendorForm.state}
                            onChange={(e) => setVendorForm({ ...vendorForm, state: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="State"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">PIN Code</label>
                          <input
                            type="text"
                            value={vendorForm.pin_code}
                            onChange={(e) => setVendorForm({ ...vendorForm, pin_code: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                            placeholder="6-digit ZIP code"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bank Settlement Account */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                        5. Primary Banking Settlement Credentials
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={vendorForm.bank_name}
                            onChange={(e) => setVendorForm({ ...vendorForm, bank_name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="Bank Name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Branch Name</label>
                          <input
                            type="text"
                            value={vendorForm.branch}
                            onChange={(e) => setVendorForm({ ...vendorForm, branch: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="Branch"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">IFSC Code</label>
                          <input
                            type="text"
                            value={vendorForm.ifsc}
                            onChange={(e) => setVendorForm({ ...vendorForm, ifsc: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono uppercase"
                            placeholder="IFSC code"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Account Number</label>
                          <input
                            type="text"
                            value={vendorForm.account_number}
                            onChange={(e) => setVendorForm({ ...vendorForm, account_number: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                            placeholder="Full settlement account number"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            value={vendorForm.account_holder}
                            onChange={(e) => setVendorForm({ ...vendorForm, account_holder: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                            placeholder="As printed on bank records"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Form Commercial Defaults Group */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                    {editingVendorId ? "4" : "6"}. Commercial Default Agreements
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Terms</label>
                      <input
                        type="text"
                        value={vendorForm.payment_terms}
                        onChange={(e) => setVendorForm({ ...vendorForm, payment_terms: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="Net 30, Cash, COD"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Credit Days Limit</label>
                      <input
                        type="number"
                        value={vendorForm.credit_days}
                        onChange={(e) => setVendorForm({ ...vendorForm, credit_days: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Incoterms Agreement</label>
                      <input
                        type="text"
                        value={vendorForm.incoterms}
                        onChange={(e) => setVendorForm({ ...vendorForm, incoterms: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100"
                        placeholder="Ex Works, FOB, CIF"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
                  >
                    {editingVendorId ? "Update Record" : "Register Supplier"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: LINK/MAP MATERIAL */}
      <AnimatePresence>
        {showMapMaterialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  Map Supply Material Connection
                </h2>
                <p className="text-[11px] text-slate-400">
                  Select a material from our catalog, and define supplier-specific part codes, delivery speeds, and MOQ specifications.
                </p>
              </div>

              <form onSubmit={handleMapMaterial} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Select Material Catalog Item *</label>
                  <select
                    value={mappingForm.material_id}
                    onChange={(e) => setMappingForm({ ...mappingForm, material_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2.5 outline-none text-slate-100"
                    required
                  >
                    <option value="">-- Choose Material item --</option>
                    {(materials || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Supplier Part Code *</label>
                    <input
                      type="text"
                      value={mappingForm.vendor_material_code}
                      onChange={(e) => setMappingForm({ ...mappingForm, vendor_material_code: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                      placeholder="e.g. PART-99128"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Last Purchase Rate (₹) *</label>
                    <input
                      type="number"
                      value={mappingForm.last_purchase_rate}
                      onChange={(e) => setMappingForm({ ...mappingForm, last_purchase_rate: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Lead Time (Days)</label>
                    <input
                      type="number"
                      value={mappingForm.lead_time_days}
                      onChange={(e) => setMappingForm({ ...mappingForm, lead_time_days: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">MOQ (Min Order Qty)</label>
                    <input
                      type="number"
                      value={mappingForm.moq}
                      onChange={(e) => setMappingForm({ ...mappingForm, moq: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 text-xs rounded-lg p-2 outline-none text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <input
                    type="checkbox"
                    id="preferred_flag_chk"
                    checked={mappingForm.preferred_vendor_flag}
                    onChange={(e) => setMappingForm({ ...mappingForm, preferred_vendor_flag: e.target.checked })}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900 focus:outline-none"
                  />
                  <label htmlFor="preferred_flag_chk" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                    Preferred Vendor for this Material item
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowMapMaterialModal(false)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-lg shadow-emerald-500/10 transition-all cursor-pointer"
                  >
                    Establish Supply Link
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
