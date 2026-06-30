export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "L2-Admin" | "L1-Estimator" | "PM" | "Signatory";
  is_active: boolean;
  created_at?: string;
}

export interface CustomerParty {
  id: string;
  code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  state: string | null;
  created_at: string;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  user_email: string | null;
  action: string;
  details: string;
  status: "SUCCESS" | "FAILURE";
}

export interface BootstrapConfig {
  bootstrapped: boolean;
  config?: {
    company_state: string;
    roles_seeded: Array<{ id: string; name: string; permissions: string[] }>;
  };
}

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface ProcessMaster {
  id: string;
  name: string;
  description: string | null;
  driver_type: string | null;
  is_active: boolean;
}

export interface CostSheetLine {
  id: string;
  cost_sheet_header_id: string;
  bom_line_id: string;
  parent_cost_line_id: string | null;
  item_type: string;
  base_rate: number;
  raw_quantity: number;
  waste_modifier: number;
  calculated_subtotal: number;
  audit_trail_json: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CostSheetHeader {
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
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  lines?: CostSheetLine[];
}

export interface CostCalculationSnapshot {
  id: string;
  cost_sheet_header_id: string;
  formula_constants_snapshot_json: string | null;
  rate_card_snapshot_json: string | null;
  computational_log: string | null;
  created_at: string;
}

export interface Vendor {
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
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface VendorAddress {
  id: string;
  vendor_id: string;
  address_type: "Registered Office" | "Corporate Office" | "Factory" | "Warehouse" | "Dispatch Address";
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  is_deleted: boolean;
}

export interface VendorBank {
  id: string;
  vendor_id: string;
  bank_name: string;
  branch: string;
  account_number: string;
  ifsc: string;
  account_holder: string;
  is_deleted: boolean;
}

export interface VendorMaterialMapping {
  id: string;
  vendor_id: string;
  material_id: string;
  vendor_material_code: string;
  preferred_vendor_flag: boolean;
  last_purchase_rate: number;
  lead_time_days: number;
  moq: number;
  last_updated: string;
  is_deleted: boolean;
}

export interface VendorRating {
  id: string;
  vendor_id: string;
  quality_rating: number;
  delivery_rating: number;
  price_rating: number;
  service_rating: number;
  overall_rating: number;
  is_deleted: boolean;
}

export interface RFQHeader {
  id: string;
  rfq_number: string;
  rfq_date: string;
  purchase_requisition_id: string;
  department: string;
  project: string;
  buyer: string;
  closing_date: string;
  currency: string;
  remarks: string | null;
  status: "DRAFT" | "SENT" | "PARTIALLY_RESPONDED" | "FULLY_RESPONDED" | "UNDER_EVALUATION" | "COMPLETED" | "CANCELLED";
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface RFQLine {
  id: string;
  rfq_id: string;
  material_id: string;
  material_code: string;
  description: string;
  quantity: number;
  uom: string;
  required_date: string;
  remarks: string | null;
  is_deleted: boolean;
}

export interface RFQVendorAssignment {
  id: string;
  rfq_id: string;
  vendor_id: string;
  sent_date: string | null;
  response_due_date: string;
  response_status: "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "QUOTATION_RECEIVED" | "DECLINED";
  is_deleted: boolean;
}

export interface VendorQuotationHeader {
  id: string;
  vendor_id: string;
  rfq_id: string;
  quotation_number: string;
  quotation_date: string;
  valid_until: string;
  currency: string;
  payment_terms: string;
  delivery_terms: string;
  remarks: string | null;
  revision_number: number;
  created_at: string;
  is_deleted: boolean;
}

export interface VendorQuotationLine {
  id: string;
  vendor_quotation_id: string;
  material_id: string;
  material_code: string;
  description: string;
  quoted_unit_price: number;
  discount_percent: number;
  tax_percent: number;
  freight: number;
  lead_time_days: number;
  moq: number;
  total_amount: number;
  is_deleted: boolean;
}

export interface VendorComparisonHeader {
  id: string;
  comparison_number: string;
  rfq_id: string;
  comparison_date: string;
  buyer: string;
  status: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED";
  remarks: string | null;
  commercial_weight: number;
  technical_weight: number;
  quality_weight: number;
  delivery_weight: number;
  service_weight: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface VendorComparisonLine {
  id: string;
  vendor_comparison_id: string;
  material_id: string;
  vendor_id: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  freight: number;
  net_unit_cost: number;
  total_cost: number;
  lead_time_days: number;
  moq: number;
  valid_until: string;
  is_deleted: boolean;
}

export interface TechnicalEvaluation {
  id: string;
  vendor_comparison_id: string;
  vendor_id: string;
  quality_score: number;
  delivery_score: number;
  compliance_score: number;
  service_score: number;
  documentation_score: number;
  warranty_score: number;
  weighted_avg: number;
  is_deleted: boolean;
}

export interface VendorComparisonRecommendation {
  id: string;
  vendor_comparison_id: string;
  best_commercial_vendor_id: string;
  best_commercial_reason: string;
  best_technical_vendor_id: string;
  best_technical_reason: string;
  overall_best_vendor_id: string;
  overall_best_reason: string;
  savings_amount: number;
  price_variance_percent: number;
  notes: string;
  is_deleted: boolean;
}

export interface PurchaseOrderHeader {
  id: string;
  po_number: string;
  po_date: string;
  vendor_id: string;
  vendor_comparison_id: string;
  rfq_id: string;
  purchase_requisition_id: string | null;
  buyer: string;
  currency: string;
  payment_terms: string;
  delivery_terms: string;
  incoterms: string;
  delivery_address: string;
  billing_address: string;
  expected_delivery_date: string;
  total_amount: number;
  remarks: string | null;
  status: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ISSUED" | "ACKNOWLEDGED" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED";
  revision_number: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  material_id: string;
  material_code: string;
  description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  freight: number;
  net_unit_cost: number;
  total_amount: number;
  delivery_date: string;
  is_deleted: boolean;
  received_quantity?: number;
  pending_quantity?: number;
}

export interface VendorAcknowledgement {
  id: string;
  purchase_order_id: string;
  acknowledgement_status: "ACCEPTED" | "ACCEPTED_WITH_COMMENTS" | "CHANGES_REQUESTED" | "DECLINED";
  acknowledgement_date: string;
  comments: string | null;
  contact_person: string;
  is_deleted: boolean;
}

export interface PurchaseOrderRevision {
  id: string;
  purchase_order_id: string;
  revision_number: number;
  revised_by: string;
  revised_at: string;
  change_summary: string;
  snapshot_data: string; // stringified JSON of previous header & lines
  is_deleted: boolean;
}

export interface GoodsReceiptHeader {
  id: string;
  grn_number: string;
  grn_date: string;
  purchase_order_id: string;
  vendor_id: string;
  warehouse: string;
  vehicle_number: string;
  transporter: string;
  supplier_invoice_number: string;
  supplier_invoice_date: string;
  received_by: string;
  remarks: string | null;
  status: "DRAFT" | "UNDER_INSPECTION" | "PARTIALLY_RECEIVED" | "RECEIVED" | "REJECTED" | "CANCELLED";
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface GoodsReceiptLine {
  id: string;
  goods_receipt_id: string;
  purchase_order_line_id: string;
  material_id: string;
  material_code: string;
  description: string;
  ordered_quantity: number;
  previously_received_quantity: number;
  receiving_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  pending_quantity: number;
  uom: string;
  warehouse_location: string;
  batch_number?: string | null;
  serial_number?: string | null;
  inspection_status: "PENDING" | "PASSED" | "FAILED";
  is_deleted: boolean;
}

export interface GoodsReceiptHistory {
  id: string;
  goods_receipt_id: string;
  timestamp: string;
  event_type: "CREATION" | "STATUS_CHANGE" | "INSPECTION" | "CANCELLATION";
  status_from: string | null;
  status_to: string;
  user_email: string;
  remarks: string | null;
}




