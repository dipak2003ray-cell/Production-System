import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// Persistence configuration
const DATA_FILE = path.join(process.cwd(), "data_persistence.json");

// System roles
const DEFAULT_ROLES = [
  { id: "role_l2_admin", name: "L2-Admin", permissions: ["bootstrap", "user_manage", "party_manage", "rate_manage", "cost_approve"] },
  { id: "role_l1_estimator", name: "L1-Estimator", permissions: ["cost_create"] },
  { id: "role_pm", name: "PM", permissions: ["party_manage", "proc_create", "po_create"] },
  { id: "role_signatory", name: "Signatory", permissions: ["po_sign"] }
];

interface User {
  id: string;
  email: string;
  hashed_password: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  contact_person: string;
  email: string;
  phone: string;
  state: string | null;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: string;
  status: "SUCCESS" | "FAILURE";
}

interface Material {
  id: string;
  code: string;
  description: string;
  grade_spec: string | null;
  profile_size: string | null;
  std_unit: string;
  last_rate: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  is_active?: boolean;
}

interface Process {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  driver_type: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface Scrap {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

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
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
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
  is_deleted: boolean;
}

interface BOMLine {
  id: string;
  bom_header_id: string;
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
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
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
  is_deleted: boolean;
}

interface CostSheetLine {
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
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface CostCalculationSnapshot {
  id: string;
  cost_sheet_header_id: string;
  formula_constants_snapshot_json: string | null;
  rate_card_snapshot_json: string | null;
  computational_log: string | null;
  created_at: string;
}

interface Estimate {
  id: string;
  estimate_number: string;
  description: string;
  status: "DRAFT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "LOCKED" | "SUPERSEDED" | "REJECTED";
  revision_number: number;
  parent_estimate_id: string | null;
  previous_revision_id: string | null;
  is_current_active: boolean;
  revision_notes: string | null;
  revision_timestamp: string | null;
  cost_sheet_id: string | null;
  bom_header_id: string | null;
  customer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  current_approval_level?: number | null;
  current_approver_role?: string | null;
  pending_approval?: boolean;
}

interface ApprovalMatrix {
  id: string;
  approval_level: number;
  role: string;
  sequence_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EstimateWorkflowHistory {
  id: string;
  estimate_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  notes: string | null;
  timestamp: string;
}


interface ApprovalHistory {
  id: string;
  estimate_id: string;
  revision_number: number;
  approval_level: number;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  previous_status: string;
  new_status: string;
  comments: string;
  timestamp: string;
}

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
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  is_deleted: boolean;
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
  is_deleted: boolean;
}

interface VendorBank {
  id: string;
  vendor_id: string;
  bank_name: string;
  branch: string;
  account_number: string;
  ifsc: string;
  account_holder: string;
  is_deleted: boolean;
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
  is_deleted: boolean;
}

interface VendorRating {
  id: string;
  vendor_id: string;
  quality_rating: number;
  delivery_rating: number;
  price_rating: number;
  service_rating: number;
  overall_rating: number;
  is_deleted: boolean;
}

interface PurchaseRequisition {
  id: string;
  pr_number: string;
  pr_date: string;
  department: string;
  project: string;
  estimate_id: string;
  bom_header_id: string;
  requested_by: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "CONVERTED_TO_RFQ" | "CLOSED" | "CANCELLED";
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  is_deleted?: boolean;
  current_approval_level?: number | null;
  current_approver_role?: string | null;
  pending_approval?: boolean;
}

interface PurchaseRequisitionLine {
  id: string;
  purchase_requisition_id: string;
  material_id: string;
  material_code: string;
  description: string;
  required_quantity: number;
  uom: string;
  required_date: string;
  estimated_unit_rate: number;
  estimated_amount: number;
  remarks: string | null;
  status: "PENDING" | "APPROVED" | "CANCELLED";
  is_deleted?: boolean;
}

interface PurchaseRequisitionHistory {
  id: string;
  purchase_requisition_id: string;
  approval_level: number;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  previous_status: string;
  new_status: string;
  comments: string;
  timestamp: string;
}

interface TimelineEvent {
  id: string;
  estimate_id: string;
  revision_number: number;
  event_type: "CREATION" | "SUBMISSION" | "APPROVAL" | "REJECTION" | "CHANGES_REQUESTED" | "REVISION" | "LOCK" | "COMMENT";
  title: string;
  description: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  timestamp: string;
}

interface EstimateComment {
  id: string;
  estimate_id: string;
  revision_number: number;
  user_id: string;
  user_name: string;
  user_role: string;
  message: string;
  comment_type: "GENERAL" | "REVIEW" | "CHANGE_REQUEST" | "CLARIFICATION";
  parent_id: string | null;
  timestamp: string;
}

interface AppNotification {
  id: string;
  user_id: string;
  target_role: string | null;
  estimate_id: string | null;
  title: string;
  message: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  created_at: string;
}

interface EstimateAuditLog {
  id: string;
  estimate_id: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  details: string;
  status: "SUCCESS" | "FAILURE";
}

interface RFQHeader {
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

interface RFQLine {
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

interface RFQVendorAssignment {
  id: string;
  rfq_id: string;
  vendor_id: string;
  sent_date: string | null;
  response_due_date: string;
  response_status: "NOT_SENT" | "SENT" | "ACKNOWLEDGED" | "QUOTATION_RECEIVED" | "DECLINED";
  is_deleted: boolean;
}

interface VendorQuotationHeader {
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

interface VendorQuotationLine {
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

interface VendorComparisonHeader {
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

interface VendorComparisonLine {
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

interface TechnicalEvaluation {
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

interface VendorComparisonRecommendation {
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

interface PurchaseOrderHeader {
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

interface PurchaseOrderLine {
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

interface VendorAcknowledgement {
  id: string;
  purchase_order_id: string;
  acknowledgement_status: "ACCEPTED" | "ACCEPTED_WITH_COMMENTS" | "CHANGES_REQUESTED" | "DECLINED";
  acknowledgement_date: string;
  comments: string | null;
  contact_person: string;
  is_deleted: boolean;
}

interface PurchaseOrderRevision {
  id: string;
  purchase_order_id: string;
  revision_number: number;
  revised_by: string;
  revised_at: string;
  change_summary: string;
  snapshot_data: string; // stringified JSON
  is_deleted: boolean;
}

interface GoodsReceiptHeader {
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

interface GoodsReceiptLine {
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

interface GoodsReceiptHistory {
  id: string;
  goods_receipt_id: string;
  timestamp: string;
  event_type: "CREATION" | "STATUS_CHANGE" | "INSPECTION" | "CANCELLATION";
  status_from: string | null;
  status_to: string;
  user_email: string;
  remarks: string | null;
}

interface DBState {
  bootstrapped: boolean;
  bootstrap_time: string | null;
  bootstrap_ip: string | null;
  users: User[];
  customers: Customer[];
  sessions: Session[];
  audit_logs: AuditLog[];
  materials?: Material[];
  processes?: Process[];
  scrap?: Scrap[];
  rates?: RateCard[];
  boms?: BOMHeader[];
  bom_lines?: BOMLine[];
  cost_sheets?: CostSheetHeader[];
  cost_sheet_lines?: CostSheetLine[];
  cost_calculation_snapshots?: CostCalculationSnapshot[];
  estimates?: Estimate[];
  estimate_workflow_history?: EstimateWorkflowHistory[];
  approval_matrices?: ApprovalMatrix[];
  approval_histories?: ApprovalHistory[];
  timeline_events?: TimelineEvent[];
  comments?: EstimateComment[];
  notifications?: AppNotification[];
  estimate_audit_logs?: EstimateAuditLog[];
  purchase_requisitions?: PurchaseRequisition[];
  purchase_requisition_lines?: PurchaseRequisitionLine[];
  purchase_requisition_histories?: PurchaseRequisitionHistory[];
  vendors?: Vendor[];
  vendor_addresses?: VendorAddress[];
  vendor_banks?: VendorBank[];
  vendor_material_mappings?: VendorMaterialMapping[];
  vendor_ratings?: VendorRating[];
  rfqs?: RFQHeader[];
  rfq_lines?: RFQLine[];
  rfq_vendor_assignments?: RFQVendorAssignment[];
  vendor_quotations?: VendorQuotationHeader[];
  vendor_quotation_lines?: VendorQuotationLine[];
  vendor_comparisons?: VendorComparisonHeader[];
  vendor_comparison_lines?: VendorComparisonLine[];
  technical_evaluations?: TechnicalEvaluation[];
  vendor_comparison_recommendations?: VendorComparisonRecommendation[];
  purchase_orders?: PurchaseOrderHeader[];
  purchase_order_lines?: PurchaseOrderLine[];
  vendor_acknowledgements?: VendorAcknowledgement[];
  purchase_order_revisions?: PurchaseOrderRevision[];
  grns?: GoodsReceiptHeader[];
  grn_lines?: GoodsReceiptLine[];
  grn_histories?: GoodsReceiptHistory[];
}

// Initialize state
let db: DBState = {
  bootstrapped: false,
  bootstrap_time: null,
  bootstrap_ip: null,
  users: [],
  customers: [],
  sessions: [],
  audit_logs: [],
  materials: [],
  processes: [],
  scrap: [],
  rates: [],
  boms: [],
  bom_lines: [],
  cost_sheets: [],
  cost_sheet_lines: [],
  cost_calculation_snapshots: [],
  estimates: [],
  estimate_workflow_history: [],
  approval_matrices: [],
  approval_histories: [],
  timeline_events: [],
  comments: [],
  notifications: [],
  estimate_audit_logs: [],
  purchase_requisitions: [],
  purchase_requisition_lines: [],
  purchase_requisition_histories: [],
  vendors: [],
  vendor_addresses: [],
  vendor_banks: [],
  vendor_material_mappings: [],
  vendor_ratings: [],
  rfqs: [],
  rfq_lines: [],
  rfq_vendor_assignments: [],
  vendor_quotations: [],
  vendor_quotation_lines: [],
  vendor_comparisons: [],
  vendor_comparison_lines: [],
  technical_evaluations: [],
  vendor_comparison_recommendations: []
};

// Load persistent database
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      db = JSON.parse(content);
      
      // Initialize Sprint 2A arrays if missing
      if (!db.materials) db.materials = [];
      if (!db.processes) db.processes = [];
      if (!db.scrap) db.scrap = [];
      if (!db.rates) db.rates = [];
      if (!db.boms) db.boms = [];
      if (!db.bom_lines) db.bom_lines = [];
      if (!db.cost_sheets) db.cost_sheets = [];
      if (!db.cost_sheet_lines) db.cost_sheet_lines = [];
      if (!db.cost_calculation_snapshots) db.cost_calculation_snapshots = [];
      if (!db.estimates) db.estimates = [];
      if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
      if (!db.approval_matrices) db.approval_matrices = [];
      if (!db.approval_histories) db.approval_histories = [];
      if (!db.timeline_events) db.timeline_events = [];
      if (!db.comments) db.comments = [];
      if (!db.notifications) db.notifications = [];
      if (!db.estimate_audit_logs) db.estimate_audit_logs = [];
      if (!db.purchase_requisitions) db.purchase_requisitions = [];
      if (!db.purchase_requisition_lines) db.purchase_requisition_lines = [];
      if (!db.purchase_requisition_histories) db.purchase_requisition_histories = [];
      if (!db.vendors) db.vendors = [];
      if (!db.vendor_addresses) db.vendor_addresses = [];
      if (!db.vendor_banks) db.vendor_banks = [];
      if (!db.vendor_material_mappings) db.vendor_material_mappings = [];
      if (!db.vendor_ratings) db.vendor_ratings = [];
      if (!db.rfqs) db.rfqs = [];
      if (!db.rfq_lines) db.rfq_lines = [];
      if (!db.rfq_vendor_assignments) db.rfq_vendor_assignments = [];
      if (!db.vendor_quotations) db.vendor_quotations = [];
      if (!db.vendor_quotation_lines) db.vendor_quotation_lines = [];
      if (!db.vendor_comparisons) db.vendor_comparisons = [];
      if (!db.vendor_comparison_lines) db.vendor_comparison_lines = [];
      if (!db.technical_evaluations) db.technical_evaluations = [];
      if (!db.vendor_comparison_recommendations) db.vendor_comparison_recommendations = [];

      if (db.approval_matrices.length === 0) {
        db.approval_matrices = [
          {
            id: "matrix-1",
            approval_level: 1,
            role: "L1-Estimator",
            sequence_order: 1,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "matrix-2",
            approval_level: 2,
            role: "PM",
            sequence_order: 2,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "matrix-3",
            approval_level: 3,
            role: "L2-Admin",
            sequence_order: 3,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      }
      
      console.log("[STORAGE] Successfully loaded database state containing:", {
        bootstrapped: db.bootstrapped,
        usersCount: db.users?.length || 0,
        customersCount: db.customers?.length || 0,
        materialsCount: db.materials?.length || 0,
        processesCount: db.processes?.length || 0,
        scrapCount: db.scrap?.length || 0,
        ratesCount: db.rates?.length || 0,
        bomsCount: db.boms?.length || 0,
        bomLinesCount: db.bom_lines?.length || 0,
        logsCount: db.audit_logs?.length || 0
      });
    } else {
      saveDB();
    }
  } catch (err) {
    console.error("[STORAGE] Failed to load data persistence file, fallback to empty init:", err);
  }
}

// Save persistent database
function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[STORAGE] Failed saving persistent database:", err);
  }
}

// =========================================================================
// Sprint 3C Helper Functions (Approval History, Collaboration, Notifications, Audit)
// =========================================================================

function recordApprovalHistory(
  estimateId: string,
  revisionNumber: number,
  approvalLevel: number,
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  previousStatus: string,
  newStatus: string,
  comments: string
) {
  if (!db.approval_histories) db.approval_histories = [];
  const record: ApprovalHistory = {
    id: "apphist-" + crypto.randomUUID(),
    estimate_id: estimateId,
    revision_number: revisionNumber,
    approval_level: approvalLevel,
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action,
    previous_status: previousStatus,
    new_status: newStatus,
    comments,
    timestamp: new Date().toISOString()
  };
  db.approval_histories.push(record);
  saveDB();
}

function recordTimelineEvent(
  estimateId: string,
  revisionNumber: number,
  eventType: "CREATION" | "SUBMISSION" | "APPROVAL" | "REJECTION" | "CHANGES_REQUESTED" | "REVISION" | "LOCK" | "COMMENT",
  title: string,
  description: string,
  userId: string | null,
  userName: string | null,
  userRole: string | null
) {
  if (!db.timeline_events) db.timeline_events = [];
  const event: TimelineEvent = {
    id: "time-" + crypto.randomUUID(),
    estimate_id: estimateId,
    revision_number: revisionNumber,
    event_type: eventType,
    title,
    description,
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    timestamp: new Date().toISOString()
  };
  db.timeline_events.push(event);
  saveDB();
}

function recordNotification(
  userId: string,
  targetRole: string | null,
  estimateId: string | null,
  title: string,
  message: string
) {
  if (!db.notifications) db.notifications = [];
  const notification: AppNotification = {
    id: "notif-" + crypto.randomUUID(),
    user_id: userId,
    target_role: targetRole,
    estimate_id: estimateId,
    title,
    message,
    status: "UNREAD",
    created_at: new Date().toISOString()
  };
  db.notifications.push(notification);
  saveDB();
  
  // Create audit log for notification generation (avoid recursion: recordEstimateAuditLog inside recordNotification works fine)
  if (!db.estimate_audit_logs) db.estimate_audit_logs = [];
  const log: EstimateAuditLog = {
    id: "aud-" + crypto.randomUUID(),
    estimate_id: estimateId || "GLOBAL",
    timestamp: new Date().toISOString(),
    user_id: null,
    user_email: "SYSTEM",
    user_role: "SYSTEM",
    action: "NOTIFICATION_GENERATION",
    details: `Notification generated for User:${userId}/Role:${targetRole}: "${title}"`,
    status: "SUCCESS"
  };
  db.estimate_audit_logs.push(log);
  saveDB();
}

function recordEstimateAuditLog(
  estimateId: string,
  user: { id: string, email: string, role: string } | null,
  action: string,
  details: string,
  status: "SUCCESS" | "FAILURE"
) {
  if (!db.estimate_audit_logs) db.estimate_audit_logs = [];
  const log: EstimateAuditLog = {
    id: "aud-" + crypto.randomUUID(),
    estimate_id: estimateId,
    timestamp: new Date().toISOString(),
    user_id: user ? user.id : null,
    user_email: user ? user.email : "SYSTEM",
    user_role: user ? user.role : "SYSTEM",
    action,
    details,
    status
  };
  db.estimate_audit_logs.push(log);
  saveDB();
}

// Token security parameters
const JWT_SECRET = crypto.randomBytes(32).toString("hex");

// Helper: robust PBKDF2 Password hashing
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, savedHash] = stored.split(":");
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return savedHash === testHash;
  } catch {
    return false;
  }
}

// Helper: Custom HMAC Signer mimicking key behaviors
function signJWT(payload: any, expiresInMinutes: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
  const body = { ...payload, exp };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(body)).toString("base64url");

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}

function verifyJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const signatureInput = `${header}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(signatureInput)
      .digest("base64url");

    if (signature !== expectedSignature) return null;

    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decodedPayload;
  } catch {
    return null;
  }
}

// Log audit trails to db
function addAuditLog(userId: string | null, email: string | null, action: string, details: string, status: "SUCCESS" | "FAILURE") {
  const log: AuditLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user_id: userId,
    user_email: email,
    action,
    details,
    status
  };
  db.audit_logs.unshift(log);
  // Keep last 100 audits
  if (db.audit_logs.length > 100) {
    db.audit_logs.pop();
  }
  saveDB();
}

function seedMastersIfEmpty() {
  if (!db.processes || db.processes.length === 0) {
    const list = [
      { name: "Laser Cutting", description: "CNC profiles with nitrogen shield gas", driver_type: "thickness" },
      { name: "Shearing", description: "Billet shearing linear profile cuts", driver_type: "thickness" },
      { name: "Bending", description: "Press brake dynamic forming strokes", driver_type: "strokes" },
      { name: "Welding", description: "MIG/TIG structural joining passes", driver_type: "passes" },
      { name: "Powder Coating", description: "Electrostatic spray and drying curing", driver_type: "area" },
      { name: "Assembly", description: "Manual alignment fittings and assembly operations", driver_type: "hours" }
    ];
    db.processes = list.map(p => ({
      id: "proc_" + p.name.toLowerCase().replace(/ /g, "_"),
      name: p.name,
      description: p.description,
      is_active: true,
      driver_type: p.driver_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    }));
  }

  if (!db.scrap || db.scrap.length === 0) {
    const list = [
      { code: "MS_SCRAP", name: "Mild Steel Scrap", description: "Industrial offcut recovery salvage" },
      { code: "SS_SCRAP", name: "Stainless Steel Scrap", description: "SS grade off-cut recovery value" },
      { code: "AL_SCRAP", name: "Aluminium Scrap", description: "Alum punch out scraps" }
    ];
    db.scrap = list.map(s => ({
      id: "scrap_" + s.code.toLowerCase(),
      code: s.code,
      name: s.name,
      description: s.description,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    }));
  }

  if (!db.materials || db.materials.length === 0) {
    const list = [
      { code: "MAT_MS_20", description: "Mild Steel Structural Sheet 2.0mm", grade_spec: "IS 2062", profile_size: "1250x2500", std_unit: "kg", last_rate: 85.00 },
      { code: "MAT_SS_15", description: "Stainless Steel SS304 Sheet 1.5mm", grade_spec: "ASTM A240", profile_size: "1250x2500", std_unit: "kg", last_rate: 220.00 },
      { code: "MAT_AL_10", description: "Aluminium Sheet Grade 6061 1.0mm", grade_spec: "IS 737", profile_size: "1000x2000", std_unit: "kg", last_rate: 240.00 }
    ];
    db.materials = list.map(m => ({
      id: "mat_" + m.code.toLowerCase(),
      code: m.code,
      description: m.description,
      grade_spec: m.grade_spec,
      profile_size: m.profile_size,
      std_unit: m.std_unit,
      last_rate: m.last_rate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    }));
  }

  if (!db.rates || db.rates.length === 0) {
    const todayStr = new Date().toISOString().split("T")[0];
    const rates: RateCard[] = [
      {
        id: "rate_proc_laser_ms_3",
        material_id: null,
        process_id: db.processes[0].id,
        scrap_id: null,
        sub_type: "MS",
        thickness_from: 0,
        thickness_to: 3.0,
        rate: 55.00,
        rate_unit: "Rs/meter",
        effective_date: todayStr,
        is_active: true,
        reason: "Sprint 2A initial pricing configuration",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      },
      {
        id: "rate_proc_laser_ss_2",
        material_id: null,
        process_id: db.processes[0].id,
        scrap_id: null,
        sub_type: "SS",
        thickness_from: 0,
        thickness_to: 2.0,
        rate: 85.00,
        rate_unit: "Rs/meter",
        effective_date: todayStr,
        is_active: true,
        reason: "Sprint 2A initial SS pricing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      },
      {
        id: "rate_proc_bend_stroke",
        material_id: null,
        process_id: db.processes[2].id,
        scrap_id: null,
        sub_type: "All",
        thickness_from: null,
        thickness_to: null,
        rate: 15.00,
        rate_unit: "Rs/stroke",
        effective_date: todayStr,
        is_active: true,
        reason: "Flat bending tariff rate",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      },
      {
        id: "rate_scrap_ms",
        material_id: null,
        process_id: null,
        scrap_id: db.scrap[0].id,
        sub_type: null,
        thickness_from: null,
        thickness_to: null,
        rate: 42.00,
        rate_unit: "Rs/kg",
        effective_date: todayStr,
        is_active: true,
        reason: "MS Scrap spot recovery rate",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      },
      {
        id: "rate_scrap_ss",
        material_id: null,
        process_id: null,
        scrap_id: db.scrap[1].id,
        sub_type: null,
        thickness_from: null,
        thickness_to: null,
        rate: 110.00,
        rate_unit: "Rs/kg",
        effective_date: todayStr,
        is_active: true,
        reason: "SS Scrap recycling value",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      }
    ];
    db.rates = rates;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  loadDB();
  seedMastersIfEmpty();

  // Middleware
  app.use(express.json());

  // CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Authentication Middleware for API layer
  function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Bearer token required" });
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyJWT(token);
    if (!payload) {
      return res.status(401).json({ code: "TOKEN_EXPIRED", message: "Token signature expired or invalid" });
    }
    req.user = payload;
    next();
  }

  // Authorization Middleware for Admin Operations
  function requireAdmin(req: any, res: any, next: any) {
    if (!req.user || req.user.role !== "L2-Admin") {
      addAuditLog(req.user?.id || null, req.user?.email || null, "ADMIN_RESTRICTION", `Access denied to admin endpoint: ${req.path}`, "FAILURE");
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Operation restricted to L2-Admin role only" });
    }
    next();
  }

  // --- API ROUTING V1 ---

  // Bootstrap status check
  app.get("/api/v1/bootstrap/status", (req, res) => {
    res.json({
      bootstrapped: db.bootstrapped,
      config: {
        company_state: "West Bengal",
        roles_seeded: DEFAULT_ROLES
      }
    });
  });

  // Submit prime bootstrap configuration
  app.post("/api/v1/bootstrap", (req, res) => {
    if (db.bootstrapped) {
      return res.status(400).json({
        code: "BOOTSTRAP_ALREADY_COMPLETE",
        message: "System has already been bootstrapped with root credentials."
      });
    }

    const { email, password, full_name } = req.body;

    // Strict validator
    if (!email || !password || !full_name) {
      return res.status(422).json({
        code: "DRIVER_VALIDATION_FAILED",
        message: "Email, password, and full name are required for initialization."
      });
    }

    if (password.length < 8) {
      return res.status(422).json({
        code: "PASSWORD_TOO_WEAK",
        message: "Password must consist of 8 or more characters for security compliance."
      });
    }

    const firstAdmin: User = {
      id: crypto.randomUUID(),
      email: email.trim().toLowerCase(),
      hashed_password: hashPassword(password),
      full_name: full_name.trim(),
      role_id: "role_l2_admin",
      is_active: true,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.users.push(firstAdmin);
    db.bootstrapped = true;
    db.bootstrap_time = new Date().toISOString();
    db.bootstrap_ip = req.ip || "127.0.0.1";

    addAuditLog(firstAdmin.id, firstAdmin.email, "SYSTEM_BOOTSTRAP", `Bootstrap completed successfully by admin user.`, "SUCCESS");
    saveDB();

    res.status(201).json({
      success: true,
      message: "System bootstrap completed successfully.",
      user: {
        id: firstAdmin.id,
        email: firstAdmin.email,
        full_name: firstAdmin.full_name,
        role: "L2-Admin"
      }
    });
  });

  // Login Handler (Lockout audit checks built in)
  app.post("/api/v1/auth/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ code: "CREDENTIALS_REQUIRED", message: "Email and password are required inputs." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find(u => u.email === normalizedEmail);

    if (!user) {
      addAuditLog(null, normalizedEmail, "USER_LOGIN", `Credentials verification failed. User object not found.`, "FAILURE");
      return res.status(401).json({ code: "AUTH_INVALID_CREDENTIALS", message: "The credentials provided do not match our records." });
    }

    if (!user.is_active) {
      addAuditLog(user.id, user.email, "USER_LOGIN", `Attempt to log into inactive user profile.`, "FAILURE");
      return res.status(401).json({ code: "USER_DEACTIVATED", message: "Your operator account has been set to inactive status." });
    }

    // Lockout verification
    if (user.locked_until) {
      const now = new Date();
      if (now < new Date(user.locked_until)) {
        addAuditLog(user.id, user.id, "USER_LOCKOUT_HIT", `Account currently blocked under system security hold.`, "FAILURE");
        return res.status(401).json({
          code: "LOGIN_LOCKED",
          message: `Your account is temporarily locked due to repeated authentication failures. Try again after ${new Date(user.locked_until).toLocaleTimeString()}.`
        });
      } else {
        // Lock expired
        user.locked_until = null;
        user.failed_login_attempts = 0;
        saveDB();
      }
    }

    const verified = verifyPassword(password, user.hashed_password);

    if (!verified) {
      user.failed_login_attempts += 1;
      addAuditLog(user.id, user.email, "USER_LOGIN", `Failed password verification. Attempts: ${user.failed_login_attempts}`, "FAILURE");

      if (user.failed_login_attempts >= 3) {
        // 15 Minutes lockout
        const releaseTime = new Date(Date.now() + 15 * 60 * 1000);
        user.locked_until = releaseTime.toISOString();
        addAuditLog(user.id, user.email, "ACCOUNT_LOCKED", `Account security locked for 15 minutes due to 3 consecutive failures.`, "FAILURE");
        saveDB();
        return res.status(401).json({
          code: "LOGIN_LOCKED",
          message: "Secure account lock activated. Too many consecutive password entries failure. Account locked for 15 minutes."
        });
      }

      saveDB();
      return res.status(401).json({ code: "AUTH_INVALID_CREDENTIALS", message: "The credentials provided do not match our records." });
    }

    // Success Authentication
    user.failed_login_attempts = 0;
    user.locked_until = null;

    const matchedRole = DEFAULT_ROLES.find(r => r.id === user.role_id)?.name || "L1-Estimator";

    // Generate tokens
    const accessToken = signJWT({ id: user.id, email: user.email, role: matchedRole, name: user.full_name }, 60); // 1 hr
    const refreshToken = crypto.randomBytes(40).toString("hex");

    // Persist session block
    const session: Session = {
      id: crypto.randomUUID(),
      user_id: user.id,
      refresh_token: refreshToken,
      ip_address: req.ip || "127.0.0.1",
      user_agent: req.headers["user-agent"] || "Agent",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      is_revoked: false,
      created_at: new Date().toISOString()
    };

    db.sessions.push(session);
    addAuditLog(user.id, user.email, "USER_LOGIN_SUCCESS", `Logged in successfully and session established.`, "SUCCESS");
    saveDB();

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: matchedRole
      }
    });
  });

  // Token Refresh rotation
  app.post("/api/v1/auth/refresh", (req, res) => {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(422).json({ code: "TOKEN_REQUIRED", message: "Refresh token is a required parameter." });
    }

    const session = db.sessions.find(s => s.refresh_token === refresh_token && !s.is_revoked);
    if (!session || new Date() > new Date(session.expires_at)) {
      return res.status(401).json({ code: "TOKEN_EXPIRED", message: "User session expired or actively revoked." });
    }

    const user = db.users.find(u => u.id === session.user_id);
    if (!user || !user.is_active) {
      return res.status(401).json({ code: "USER_DEACTIVATED", message: "Profile associated with session de-authorized." });
    }

    // Refresh token rotation logic: Revoke old and sign new session
    session.is_revoked = true;

    const matchedRole = DEFAULT_ROLES.find(r => r.id === user.role_id)?.name || "L1-Estimator";
    const newAccessToken = signJWT({ id: user.id, email: user.email, role: matchedRole, name: user.full_name }, 60);
    const newRefreshToken = crypto.randomBytes(40).toString("hex");

    const newSession: Session = {
      id: crypto.randomUUID(),
      user_id: user.id,
      refresh_token: newRefreshToken,
      ip_address: req.ip || "127.0.0.1",
      user_agent: req.headers["user-agent"] || "Agent",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_revoked: false,
      created_at: new Date().toISOString()
    };

    db.sessions.push(newSession);
    saveDB();

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: "Bearer"
    });
  });

  // Logout session revoke
  app.post("/api/v1/auth/logout", (req, res) => {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const sessionIndex = db.sessions.findIndex(s => s.refresh_token === refresh_token);
      if (sessionIndex !== -1) {
        db.sessions[sessionIndex].is_revoked = true;
        addAuditLog(db.sessions[sessionIndex].user_id, null, "USER_LOGOUT", "Session revoked successfully via logout.", "SUCCESS");
        saveDB();
      }
    }
    res.json({ success: true, message: "Logged out and token session dissolved successfully." });
  });

  // Get active session profile
  app.get("/api/v1/auth/profile", requireAuth, (req: any, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "Session profile missing from registry." });
    }
    const matchedRole = DEFAULT_ROLES.find(r => r.id === user.role_id)?.name || "L1-Estimator";
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: matchedRole,
      is_active: user.is_active
    });
  });

  // --- USER CORE OPERATIONS ---

  // List existing users (Only for L2 Administrator review)
  app.get("/api/v1/users", requireAuth, requireAdmin, (req, res) => {
    const clientList = db.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: DEFAULT_ROLES.find(r => r.id === u.role_id)?.name || "L1-Estimator",
      is_active: u.is_active,
      created_at: u.created_at
    }));
    res.json(clientList);
  });

  // Create new active business users (Estimators, Administrators, PMs, Signatories)
  app.post("/api/v1/users", requireAuth, requireAdmin, (req: any, res: any) => {
    const { email, password, full_name, role_name } = req.body;

    if (!email || !password || !full_name || !role_name) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "All user model credentials parameters are mandatory." });
    }

    const normalized = email.trim().toLowerCase();
    const existing = db.users.find(u => u.email === normalized);
    if (existing) {
      return res.status(400).json({ code: "USER_ALREADY_EXISTS", message: "A registered operator exists with this exact email identity." });
    }

    const matchedRole = DEFAULT_ROLES.find(r => r.name.toLowerCase() === role_name.trim().toLowerCase());
    if (!matchedRole) {
      return res.status(422).json({ code: "ROLE_NOT_FOUND", message: `System does not maintain a role mapping named '${role_name}'. Allowed are: L2-Admin, L1-Estimator, PM, Signatory.` });
    }

    if (password.length < 8) {
      return res.status(422).json({ code: "PASSWORD_TOO_WEAK", message: "Secure compliance requires passwords to be 8 or more characters." });
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: normalized,
      hashed_password: hashPassword(password),
      full_name: full_name.trim(),
      role_id: matchedRole.id,
      is_active: true,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.users.push(newUser);
    addAuditLog(req.user.id, req.user.email, "USER_CREATION", `Created operator profile: ${newUser.email} with role ${matchedRole.name}`, "SUCCESS");
    saveDB();

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      role: matchedRole.name,
      is_active: newUser.is_active,
      created_at: newUser.created_at
    });
  });

  // Toggle user state (Admin action)
  app.post("/api/v1/users/:id/toggle-state", requireAuth, requireAdmin, (req: any, res: any) => {
    const { id } = req.params;
    const user = db.users.find(u => u.id === id);

    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "The target user could not be located in our systems." });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ code: "SELF_DEACTIVATION_FORBIDDEN", message: "You are not authorized to toggle your own admin state." });
    }

    user.is_active = !user.is_active;
    user.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "USER_STATUS_CHANGE", `Toggled state of ${user.email} to: active=${user.is_active}`, "SUCCESS");
    saveDB();

    res.json({
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      updated_at: user.updated_at
    });
  });


  // --- PARTY/CUSTOMER CORE OPERATIONS ---

  // List customer records
  app.get("/api/v1/customers", requireAuth, (req, res) => {
    res.json(db.customers);
  });

  // Register customers/parties
  app.post("/api/v1/customers", requireAuth, (req: any, res: any) => {
    const { name, code, contact_person, email, phone, state } = req.body;

    if (!name || !code) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Company name and customer code are required parameters." });
    }

    const uppercaseCode = code.trim().toUpperCase();
    const duplicate = db.customers.find(c => c.code.toUpperCase() === uppercaseCode);
    if (duplicate) {
      return res.status(400).json({ code: "CUSTOMER_CODE_DUPLICATE", message: `The system already maintains customer records with code: '${uppercaseCode}'.` });
    }

    const customer: Customer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      code: uppercaseCode,
      contact_person: (contact_person || "").trim(),
      email: (email || "").trim().toLowerCase(),
      phone: (phone || "").trim(),
      state: state ? state.trim() : null, // Nullable DB status per AR-04
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.customers.push(customer);
    addAuditLog(req.user.id, req.user.email, "CUSTOMER_REGISTRATION", `Registered customer party code: ${customer.code} - ${customer.name}`, "SUCCESS");
    saveDB();

    res.status(201).json(customer);
  });

  // Get administrative audits (Secure review route)
  app.get("/api/v1/audits", requireAuth, requireAdmin, (req, res) => {
    res.json({
      audit_logs: db.audit_logs,
      system_overview: {
        total_accounts: db.users.length,
        active_sessions: db.sessions.filter(s => !s.is_revoked).length,
        bootstrap_time: db.bootstrap_time,
        bootstrap_ip: db.bootstrap_ip
      }
    });
  });

  // --- MATERIALS MASTER ENDPOINTS ---
  app.get("/api/v1/materials", requireAuth, (req: any, res: any) => {
    res.json((db.materials || []).filter(m => !m.is_deleted));
  });

  app.get("/api/v1/materials/:id", requireAuth, (req: any, res: any) => {
    const material = (db.materials || []).find(m => m.id === req.params.id && !m.is_deleted);
    if (!material) return res.status(404).json({ code: "NOT_FOUND", message: "Material not found" });
    res.json(material);
  });

  app.post("/api/v1/materials", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin has permission to create master records." });
    }
    const { code, description, grade_spec, profile_size, std_unit, last_rate } = req.body;
    if (!code || !description || !std_unit) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "code, description, and std_unit are mandatory parameters." });
    }
    const uppercaseCode = code.trim().toUpperCase();
    const dupe = (db.materials || []).find(m => m.code.toUpperCase() === uppercaseCode && !m.is_deleted);
    if (dupe) {
      return res.status(400).json({ code: "MATERIAL_CODE_DUPLICATE", message: `A material with code: '${uppercaseCode}' already exists.` });
    }
    const rateNum = Number(last_rate || 0);
    if (rateNum < 0) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Rates must be non-negative values." });
    }
    const material: Material = {
      id: "mat_" + crypto.randomUUID().slice(0, 8),
      code: uppercaseCode,
      description: description.trim(),
      grade_spec: grade_spec ? grade_spec.trim() : null,
      profile_size: profile_size ? profile_size.trim() : null,
      std_unit: std_unit.trim(),
      last_rate: rateNum,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };
    if (!db.materials) db.materials = [];
    db.materials.push(material);
    addAuditLog(req.user.id, req.user.email, "MATERIAL_CREATION", `Created material master record: [${material.code}]`, "SUCCESS");
    saveDB();
    res.status(201).json(material);
  });

  app.put("/api/v1/materials/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify master records." });
    }
    const material = (db.materials || []).find(m => m.id === req.params.id && !m.is_deleted);
    if (!material) return res.status(404).json({ code: "NOT_FOUND", message: "Material parameters could not be located." });

    const { code, description, grade_spec, profile_size, std_unit, last_rate } = req.body;
    if (code) {
      const uppercaseCode = code.trim().toUpperCase();
      if (uppercaseCode !== material.code) {
        const dupe = (db.materials || []).find(m => m.code.toUpperCase() === uppercaseCode && !m.is_deleted);
        if (dupe) {
          return res.status(400).json({ code: "MATERIAL_CODE_DUPLICATE", message: `A material with code: '${uppercaseCode}' already exists.` });
        }
        material.code = uppercaseCode;
      }
    }
    if (description !== undefined) material.description = description.trim();
    if (grade_spec !== undefined) material.grade_spec = grade_spec ? grade_spec.trim() : null;
    if (profile_size !== undefined) material.profile_size = profile_size ? profile_size.trim() : null;
    if (std_unit !== undefined) material.std_unit = std_unit.trim();
    if (last_rate !== undefined) {
      const rateNum = Number(last_rate || 0);
      if (rateNum < 0) {
        return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Rates must be non-negative values." });
      }
      material.last_rate = rateNum;
    }
    material.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "MATERIAL_UPDATE", `Modified material details for code: ${material.code}`, "SUCCESS");
    saveDB();
    res.json(material);
  });

  app.delete("/api/v1/materials/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can delete material master records." });
    }
    const material = (db.materials || []).find(m => m.id === req.params.id && !m.is_deleted);
    if (!material) return res.status(404).json({ code: "NOT_FOUND", message: "Material not found" });

    material.is_deleted = true;
    material.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "MATERIAL_DELETION", `Deleted material: ${material.code}`, "SUCCESS");
    saveDB();
    res.json(material);
  });


  // --- PROCESS MASTER ENDPOINTS ---
  app.get("/api/v1/processes", requireAuth, (req: any, res: any) => {
    res.json((db.processes || []).filter(p => !p.is_deleted));
  });

  app.get("/api/v1/processes/:id", requireAuth, (req: any, res: any) => {
    const processItem = (db.processes || []).find(p => p.id === req.params.id && !p.is_deleted);
    if (!processItem) return res.status(404).json({ code: "NOT_FOUND", message: "Process parameters not found" });
    res.json(processItem);
  });

  app.post("/api/v1/processes", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can create process definitions." });
    }
    const { name, description, is_active, driver_type } = req.body;
    if (!name) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Process name is a mandatory parameter." });
    }
    const nameStripped = name.trim();
    const dupe = (db.processes || []).find(p => p.name.toLowerCase() === nameStripped.toLowerCase() && !p.is_deleted);
    if (dupe) {
      return res.status(400).json({ code: "PROCESS_NAME_DUPLICATE", message: `A process named: '${nameStripped}' already exists.` });
    }
    const processItem: Process = {
      id: "proc_" + crypto.randomUUID().slice(0, 8),
      name: nameStripped,
      description: description ? description.trim() : null,
      is_active: is_active !== undefined ? !!is_active : true,
      driver_type: driver_type ? driver_type.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };
    if (!db.processes) db.processes = [];
    db.processes.push(processItem);
    addAuditLog(req.user.id, req.user.email, "PROCESS_CREATION", `Created process definition: [${processItem.name}]`, "SUCCESS");
    saveDB();
    res.status(201).json(processItem);
  });

  app.put("/api/v1/processes/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify process records." });
    }
    const processItem = (db.processes || []).find(p => p.id === req.params.id && !p.is_deleted);
    if (!processItem) return res.status(404).json({ code: "NOT_FOUND", message: "Process parameters not found" });

    const { name, description, is_active, driver_type } = req.body;
    if (name) {
      const nameStripped = name.trim();
      if (nameStripped.toLowerCase() !== processItem.name.toLowerCase()) {
        const dupe = (db.processes || []).find(p => p.name.toLowerCase() === nameStripped.toLowerCase() && !p.is_deleted);
        if (dupe) {
          return res.status(400).json({ code: "PROCESS_NAME_DUPLICATE", message: `A process named: '${nameStripped}' already exists.` });
        }
        processItem.name = nameStripped;
      }
    }
    if (description !== undefined) processItem.description = description ? description.trim() : null;
    if (is_active !== undefined) processItem.is_active = !!is_active;
    if (driver_type !== undefined) processItem.driver_type = driver_type ? driver_type.trim() : null;
    processItem.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "PROCESS_UPDATE", `Updated process definition: ${processItem.name}`, "SUCCESS");
    saveDB();
    res.json(processItem);
  });

  app.delete("/api/v1/processes/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can delete process definitions." });
    }
    const processItem = (db.processes || []).find(p => p.id === req.params.id && !p.is_deleted);
    if (!processItem) return res.status(404).json({ code: "NOT_FOUND", message: "Process parameters not found" });

    processItem.is_deleted = true;
    processItem.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "PROCESS_DELETION", `Deleted process definition: ${processItem.name}`, "SUCCESS");
    saveDB();
    res.json(processItem);
  });


  // --- SCRAP MASTER ENDPOINTS ---
  app.get("/api/v1/scrap", requireAuth, (req: any, res: any) => {
    res.json((db.scrap || []).filter(s => !s.is_deleted));
  });

  app.get("/api/v1/scrap/:id", requireAuth, (req: any, res: any) => {
    const scrapType = (db.scrap || []).find(s => s.id === req.params.id && !s.is_deleted);
    if (!scrapType) return res.status(404).json({ code: "NOT_FOUND", message: "Scrap type not found" });
    res.json(scrapType);
  });

  app.post("/api/v1/scrap", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can create scrap definitions." });
    }
    const { code, name, description, is_active } = req.body;
    if (!code || !name) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Scrap code and name are mandatory parameters." });
    }
    const uppercaseCode = code.trim().toUpperCase();
    const dupe = (db.scrap || []).find(s => s.code.toUpperCase() === uppercaseCode && !s.is_deleted);
    if (dupe) {
      return res.status(400).json({ code: "SCRAP_CODE_DUPLICATE", message: `A scrap definition with code: '${uppercaseCode}' already exists.` });
    }
    const scrapType: Scrap = {
      id: "scrap_" + crypto.randomUUID().slice(0, 8),
      code: uppercaseCode,
      name: name.trim(),
      description: description ? description.trim() : null,
      is_active: is_active !== undefined ? !!is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };
    if (!db.scrap) db.scrap = [];
    db.scrap.push(scrapType);
    addAuditLog(req.user.id, req.user.email, "SCRAP_CREATION", `Created scrap type code: ${scrapType.code}`, "SUCCESS");
    saveDB();
    res.status(201).json(scrapType);
  });

  app.put("/api/v1/scrap/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify scrap records." });
    }
    const scrapType = (db.scrap || []).find(s => s.id === req.params.id && !s.is_deleted);
    if (!scrapType) return res.status(404).json({ code: "NOT_FOUND", message: "Scrap type parameters could not be located." });

    const { code, name, description, is_active } = req.body;
    if (code) {
      const uppercaseCode = code.trim().toUpperCase();
      if (uppercaseCode !== scrapType.code) {
        const dupe = (db.scrap || []).find(s => s.code.toUpperCase() === uppercaseCode && !s.is_deleted);
        if (dupe) {
          return res.status(400).json({ code: "SCRAP_CODE_DUPLICATE", message: `A scrap definition with code: '${uppercaseCode}' already exists.` });
        }
        scrapType.code = uppercaseCode;
      }
    }
    if (name !== undefined) scrapType.name = name.trim();
    if (description !== undefined) scrapType.description = description ? description.trim() : null;
    if (is_active !== undefined) scrapType.is_active = !!is_active;
    scrapType.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "SCRAP_UPDATE", `Updated scrap type definition: ${scrapType.code}`, "SUCCESS");
    saveDB();
    res.json(scrapType);
  });

  app.delete("/api/v1/scrap/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can delete scrap definitions." });
    }
    const scrapType = (db.scrap || []).find(s => s.id === req.params.id && !s.is_deleted);
    if (!scrapType) return res.status(404).json({ code: "NOT_FOUND", message: "Scrap type not found" });

    scrapType.is_deleted = true;
    scrapType.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "SCRAP_DELETION", `Deleted scrap type definition: ${scrapType.code}`, "SUCCESS");
    saveDB();
    res.json(scrapType);
  });


  // --- RATE CARD ENGINE ENDPOINTS ---
  app.get("/api/v1/rates", requireAuth, (req: any, res: any) => {
    res.json((db.rates || []).filter(r => !r.is_deleted));
  });

  // Unique historic rates lookup
  app.get("/api/v1/rates/lookup", requireAuth, (req: any, res: any) => {
    const { material_id, process_id, scrap_id, sub_type, thickness, target_date } = req.query;
    
    const lookupDate = target_date ? new Date(target_date as string) : new Date();

    const candidates = (db.rates || []).filter(r => {
      if (r.is_deleted || !r.is_active) return false;
      
      // Target matching check
      if (material_id && r.material_id !== material_id) return false;
      if (process_id && r.process_id !== process_id) return false;
      if (scrap_id && r.scrap_id !== scrap_id) return false;
      
      if (!material_id && r.material_id) return false;
      if (!process_id && r.process_id) return false;
      if (!scrap_id && r.scrap_id) return false;

      // Specification matching
      if (sub_type && r.sub_type && r.sub_type.toLowerCase() !== (sub_type as string).toLowerCase()) return false;
      
      if (thickness !== undefined && thickness !== null && thickness !== "") {
        const tVal = Number(thickness);
        if (r.thickness_from !== null && r.thickness_from !== undefined && tVal < r.thickness_from) return false;
        if (r.thickness_to !== null && r.thickness_to !== undefined && tVal > r.thickness_to) return false;
      }

      // Live validity check (effective_date <= target_date)
      const rDate = new Date(r.effective_date);
      if (rDate > lookupDate) return false;

      return true;
    });

    if (candidates.length === 0) {
      return res.json(null);
    }

    // Sort descending by effective date to get the latest valid rate card
    candidates.sort((a, b) => {
      const diff = new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime();
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json(candidates[0]);
  });

  app.post("/api/v1/rates", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify the rate card." });
    }
    const { material_id, process_id, scrap_id, sub_type, thickness_from, thickness_to, rate, rate_unit, effective_date, is_active, reason } = req.body;

    // 1. Exactly one target validator
    const targets = [material_id, process_id, scrap_id];
    const filledCount = targets.filter(t => t !== undefined && t !== null && t !== '').length;
    if (filledCount !== 1) {
      return res.status(422).json({ code: "EXCLUSIVITY_VIOLATION", message: "Exclusivity error: Exactly one target must be configured (material_id OR process_id OR scrap_id)." });
    }

    // 5. Non-negative rate validator
    const rateNum = Number(rate);
    if (isNaN(rateNum) || rateNum < 0) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Rates must be non-negative pricing numbers." });
    }

    if (!rate_unit || !effective_date) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "rate_unit and effective_date parameters are mandatory." });
    }

    // 7. Process-driver compatibility validation
    if (process_id) {
      const proc = (db.processes || []).find(p => p.id === process_id && !p.is_deleted);
      if (!proc) {
        return res.status(400).json({ code: "PROCESS_NOT_FOUND", message: "The chosen process target was not verified." });
      }
      if (proc.driver_type === "runs" && (thickness_from !== undefined || thickness_to !== undefined)) {
        return res.status(400).json({ code: "DRIVER_INCOMPATIBILITY", message: `The process and driver settings '${proc.driver_type}' do not support thickness attributes.` });
      }
    }

    if (material_id) {
      const mat = (db.materials || []).find(m => m.id === material_id && !m.is_deleted);
      if (!mat) return res.status(400).json({ code: "MATERIAL_NOT_FOUND", message: "The chosen material target was not verified." });
    }

    if (scrap_id) {
      const sc = (db.scrap || []).find(s => s.id === scrap_id && !s.is_deleted);
      if (!sc) return res.status(400).json({ code: "SCRAP_NOT_FOUND", message: "The chosen scrap target was not verified." });
    }

    // 2. Prevent overlapping effective date ranges (no duplicates for same specs/dates)
    const subTypeVal = sub_type ? sub_type.trim() : null;
    const tfVal = thickness_from !== undefined && thickness_from !== null ? Number(thickness_from) : null;
    const ttVal = thickness_to !== undefined && thickness_to !== null ? Number(thickness_to) : null;
    const dateVal = effective_date.trim();

    const dupe = (db.rates || []).find(r => {
      return !r.is_deleted && r.is_active &&
             r.material_id === (material_id || null) &&
             r.process_id === (process_id || null) &&
             r.scrap_id === (scrap_id || null) &&
             r.sub_type === subTypeVal &&
             r.thickness_from === tfVal &&
             r.thickness_to === ttVal &&
             r.effective_date === dateVal;
    });

    if (dupe) {
      return res.status(400).json({ code: "RATE_OVERLAP_ERROR", message: "An active rate already exists for this target group specs with the exact same effective date." });
    }

    const rateCard: RateCard = {
      id: "rate_" + crypto.randomUUID().slice(0, 8),
      material_id: material_id || null,
      process_id: process_id || null,
      scrap_id: scrap_id || null,
      sub_type: subTypeVal,
      thickness_from: tfVal,
      thickness_to: ttVal,
      rate: rateNum,
      rate_unit: rate_unit.trim(),
      effective_date: dateVal,
      is_active: is_active !== undefined ? !!is_active : true,
      reason: reason ? reason.trim() : "Rate card established",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    if (!db.rates) db.rates = [];
    db.rates.push(rateCard);
    addAuditLog(req.user.id, req.user.email, "RATE_CARD_CREATION", `Created rate card entry for standard unit rates: ${rateCard.rate} [${rateCard.rate_unit}]`, "SUCCESS");
    saveDB();
    res.status(201).json(rateCard);
  });

  app.put("/api/v1/rates/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify rate card parameters." });
    }
    const rateCard = (db.rates || []).find(r => r.id === req.params.id && !r.is_deleted);
    if (!rateCard) return res.status(404).json({ code: "NOT_FOUND", message: "Designated rate configuration not found." });

    const { material_id, process_id, scrap_id, sub_type, thickness_from, thickness_to, rate, rate_unit, effective_date, is_active, reason } = req.body;

    const current_mat = material_id !== undefined ? material_id : rateCard.material_id;
    const current_proc = process_id !== undefined ? process_id : rateCard.process_id;
    const current_scrap = scrap_id !== undefined ? scrap_id : rateCard.scrap_id;

    // exclusivity check
    const targets = [current_mat, current_proc, current_scrap];
    const filledCount = targets.filter(t => t !== undefined && t !== null && t !== '').length;
    if (filledCount !== 1) {
      return res.status(422).json({ code: "EXCLUSIVITY_VIOLATION", message: "Exclusivity error: Exactly one target must be configured." });
    }

    const current_rate = rate !== undefined ? Number(rate) : rateCard.rate;
    if (current_rate < 0) {
      return res.status(422).json({ code: "DRIVER_VALIDATION_FAILED", message: "Rates must be non-negative pricing numbers." });
    }

    const current_sub = sub_type !== undefined ? (sub_type ? sub_type.trim() : null) : rateCard.sub_type;
    const current_tf = thickness_from !== undefined ? (thickness_from !== null ? Number(thickness_from) : null) : rateCard.thickness_from;
    const current_tt = thickness_to !== undefined ? (thickness_to !== null ? Number(thickness_to) : null) : rateCard.thickness_to;
    const current_date = effective_date !== undefined ? effective_date.trim() : rateCard.effective_date;

    // overlap check
    const dupe = (db.rates || []).find(r => {
      return r.id !== rateCard.id && !r.is_deleted && r.is_active &&
             r.material_id === (current_mat || null) &&
             r.process_id === (current_proc || null) &&
             r.scrap_id === (current_scrap || null) &&
             r.sub_type === current_sub &&
             r.thickness_from === current_tf &&
             r.thickness_to === current_tt &&
             r.effective_date === current_date;
    });

    if (dupe) {
      return res.status(400).json({ code: "RATE_OVERLAP_ERROR", message: "An active rate already exists with this exact configuration and effective date." });
    }

    if (material_id !== undefined) rateCard.material_id = material_id || null;
    if (process_id !== undefined) rateCard.process_id = process_id || null;
    if (scrap_id !== undefined) rateCard.scrap_id = scrap_id || null;
    if (sub_type !== undefined) rateCard.sub_type = current_sub;
    if (thickness_from !== undefined) rateCard.thickness_from = current_tf;
    if (thickness_to !== undefined) rateCard.thickness_to = current_tt;
    if (rate !== undefined) rateCard.rate = current_rate;
    if (rate_unit !== undefined) rateCard.rate_unit = rate_unit.trim();
    if (effective_date !== undefined) rateCard.effective_date = current_date;
    if (is_active !== undefined) rateCard.is_active = !!is_active;
    if (reason !== undefined) rateCard.reason = reason ? reason.trim() : null;

    rateCard.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "RATE_CARD_UPDATE", `Updated rate card constraints for record ID: ${rateCard.id}`, "SUCCESS");
    saveDB();
    res.json(rateCard);
  });

  app.delete("/api/v1/rates/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can delete rate card configurations." });
    }
    const rateCard = (db.rates || []).find(r => r.id === req.params.id && !r.is_deleted);
    if (!rateCard) return res.status(404).json({ code: "NOT_FOUND", message: "Designated rate configuration not found" });

    rateCard.is_deleted = true;
    rateCard.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "RATE_CARD_DELETION", `Deleted rate card entry ID: ${rateCard.id}`, "SUCCESS");
    saveDB();
    res.json(rateCard);
  });

  // =========================================================================
  // --- BOM FOUNDATION FRAMEWORK API ---
  // =========================================================================

  function detectCircularReference(rootBomId: string, targetBomId: string, visited = new Set<string>()): boolean {
    if (targetBomId === rootBomId) return true;
    if (visited.has(targetBomId)) return false;
    visited.add(targetBomId);

    const subLines = (db.bom_lines || []).filter(l => l.bom_header_id === targetBomId && l.line_type === "SUB_ASSEMBLY" && !l.is_deleted);
    for (const sl of subLines) {
      if (sl.sub_assembly_bom_id) {
        if (sl.sub_assembly_bom_id === rootBomId) return true;
        if (detectCircularReference(rootBomId, sl.sub_assembly_bom_id, new Set(visited))) return true;
      }
    }
    return false;
  }

  function validateBOM(bomId: string): { is_valid: boolean; errors: any[]; warnings: string[] } {
    const errors: any[] = [];
    const warnings: string[] = [];

    const header = (db.boms || []).find(h => h.id === bomId && !h.is_deleted);
    if (!header) {
      return { is_valid: false, errors: [{ field: "bom_header_id", message: "BOM Header not found or deleted." }], warnings };
    }

    const lines = (db.bom_lines || []).filter(l => l.bom_header_id === bomId && !l.is_deleted).sort((a, b) => a.sequence_number - b.sequence_number);

    if (lines.length === 0 && header.status === "RELEASED") {
      errors.push({ field: "status", message: "RELEASED BOM cannot be empty; requires at least one functional line item." });
    }

    const seqs = new Set<number>();
    for (const l of lines) {
      const label = `Line ${l.sequence_number} (${l.line_type})`;

      if (seqs.has(l.sequence_number)) {
        warnings.push(`BOM Lines contain duplicate sequence numbers (${l.sequence_number}). Sequencing order might be non-deterministic.`);
      }
      seqs.add(l.sequence_number);

      if (!["MATERIAL", "PROCESS", "SUB_ASSEMBLY", "NOTE"].includes(l.line_type)) {
        errors.push({ bom_line_id: l.id, field: "line_type", message: `${label} possesses invalid line_type.` });
      }

      if (l.line_type !== "NOTE" && Number(l.quantity) <= 0) {
        errors.push({ bom_line_id: l.id, field: "quantity", message: `${label} must possess a strictly positive quantity; got ${l.quantity}.` });
      }

      if (!l.uom || !l.uom.trim()) {
        errors.push({ bom_line_id: l.id, field: "uom", message: `${label} has missing UOM.` });
      }

      if (l.parent_bom_line_id) {
        if (l.parent_bom_line_id === l.id) {
          errors.push({ bom_line_id: l.id, field: "parent_bom_line_id", message: `${label} cannot point to itself as its own parent.` });
        } else if (!lines.some(ol => ol.id === l.parent_bom_line_id)) {
          errors.push({ bom_line_id: l.id, field: "parent_bom_line_id", message: `${label} points to parent line which does not reside inside this BOM.` });
        }
      }

      if (l.line_type === "MATERIAL") {
        if (!l.material_id) {
          errors.push({ bom_line_id: l.id, field: "material_id", message: `${label} specifies a material line without supplying a material master reference.` });
        } else {
          const mat = (db.materials || []).find(m => m.id === l.material_id && !m.is_deleted);
          if (!mat) {
            errors.push({ bom_line_id: l.id, field: "material_id", message: `${label} references material ID '${l.material_id}' which is deleted or absent.` });
          }
        }
      }

      if (l.line_type === "PROCESS") {
        if (!l.process_id) {
          errors.push({ bom_line_id: l.id, field: "process_id", message: `${label} specifies a process line without supplying a process master reference.` });
        } else {
          const proc = (db.processes || []).find(p => p.id === l.process_id && !p.is_deleted);
          if (!proc) {
            errors.push({ bom_line_id: l.id, field: "process_id", message: `${label} references process ID '${l.process_id}' which is deleted or absent.` });
          } else if (!proc.is_active) {
            errors.push({ bom_line_id: l.id, field: "process_id", message: `${label} references process '${proc.name}' which is currently inactive.` });
          }
        }
      }

      if (l.line_type === "SUB_ASSEMBLY") {
        if (!l.sub_assembly_bom_id) {
          errors.push({ bom_line_id: l.id, field: "sub_assembly_bom_id", message: `${label} specifies a sub-assembly line without supplying a sub-assembly BOM header.` });
        } else {
          const subBom = (db.boms || []).find(h => h.id === l.sub_assembly_bom_id && !h.is_deleted);
          if (!subBom) {
            errors.push({ bom_line_id: l.id, field: "sub_assembly_bom_id", message: `${label} references sub-assembly BOM ID '${l.sub_assembly_bom_id}' which is deleted or absent.` });
          } else {
            if (l.sub_assembly_bom_id === bomId) {
              errors.push({ bom_line_id: l.id, field: "sub_assembly_bom_id", message: "BOM contains a direct circular reference; it cannot reference itself as a nested assembly." });
            } else if (detectCircularReference(bomId, l.sub_assembly_bom_id)) {
              errors.push({ bom_line_id: l.id, field: "sub_assembly_bom_id", message: `A circular sub-assembly dependency has been detected: referencing BOM [${subBom.part_number}] induces infinite loops.` });
            }
          }
        }
      }
    }

    return { is_valid: errors.length === 0, errors, warnings };
  }

  function buildBOMTree(bomId: string, visited = new Set<string>()): any[] {
    if (visited.has(bomId)) {
      return [{
        id: `err-${bomId}`,
        line_type: "NOTE",
        sequence_number: 999,
        quantity: 0,
        uom: "ERR",
        description: "[CIRCULAR DEPENDENCY LOOP DETECTED]",
        validation_status: "CIRCULAR_DEPENDENCY",
        children: []
      }];
    }
    const currentVisited = new Set(visited);
    currentVisited.add(bomId);

    const lines = (db.bom_lines || []).filter(l => l.bom_header_id === bomId && !l.is_deleted).sort((a,b) => a.sequence_number - b.sequence_number);
    const nodes: Record<string, any> = {};

    for (const l of lines) {
      nodes[l.id] = {
        id: l.id,
        line_type: l.line_type,
        sequence_number: l.sequence_number,
        quantity: Number(l.quantity),
        uom: l.uom,
        description: l.description,
        material_id: l.material_id,
        process_id: l.process_id,
        sub_assembly_bom_id: l.sub_assembly_bom_id,
        remarks: l.remarks,
        children: [],
        validation_status: "VALID"
      };
    }

    const roots: any[] = [];
    for (const l of lines) {
      const node = nodes[l.id];

      if (l.line_type === "SUB_ASSEMBLY" && l.sub_assembly_bom_id) {
        if (currentVisited.has(l.sub_assembly_bom_id)) {
          node.children = [{
            id: `err-${l.sub_assembly_bom_id}`,
            line_type: "NOTE",
            sequence_number: 1,
            quantity: 0,
            uom: "ERR",
            description: `[CIRCULAR DEPENDENCY LOOP: BOM refers back to ${l.sub_assembly_bom_id.substring(0,8)}]`,
            validation_status: "CIRCULAR_DEPENDENCY",
            children: []
          }];
          node.validation_status = "INVALID";
        } else {
          node.children.push(...buildBOMTree(l.sub_assembly_bom_id, currentVisited));
          node.validation_status = "VALID";
        }
      }

      if (l.parent_bom_line_id && nodes[l.parent_bom_line_id]) {
        nodes[l.parent_bom_line_id].children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  app.get("/api/v1/boms", requireAuth, (req: any, res: any) => {
    const list = (db.boms || []).filter(h => !h.is_deleted);
    res.json(list);
  });

  app.get("/api/v1/boms/:id", requireAuth, (req: any, res: any) => {
    const header = (db.boms || []).find(h => h.id === req.params.id && !h.is_deleted);
    if (!header) return res.status(404).json({ code: "NOT_FOUND", message: "BOM not found" });

    const lines = (db.bom_lines || []).filter(l => l.bom_header_id === req.params.id && !l.is_deleted).sort((a,b) => a.sequence_number - b.sequence_number);
    res.json({ ...header, lines });
  });

  app.post("/api/v1/boms", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin or L1-Estimator can draft BOM headers." });
    }

    const { part_number, description, customer_id, lines } = req.body;
    if (!part_number || !part_number.trim()) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "The part number is a mandatory identifier." });
    }

    const uppercase_part = part_number.trim().toUpperCase();
    const dupe = (db.boms || []).find(h => h.part_number === uppercase_part && h.revision_number === 1 && !h.is_deleted);
    if (dupe) {
      return res.status(400).json({ code: "DUPLICATE_BOM", message: `BOM with Part Number [${uppercase_part}] and Rev 1 already exists.` });
    }

    const new_bom: BOMHeader = {
      id: "bom-" + Math.random().toString(36).substring(2, 11),
      part_number: uppercase_part,
      revision_number: 1,
      customer_id: customer_id || null,
      description: description ? description.trim() : null,
      status: "DRAFT",
      is_active: true,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    if (!db.boms) db.boms = [];
    db.boms.push(new_bom);

    const addedLines: BOMLine[] = [];
    if (lines && Array.isArray(lines)) {
      if (!db.bom_lines) db.bom_lines = [];
      const lineIdMap: Record<string, string> = {};

      // Pass 1: generate new database IDs and instantiate lines
      lines.forEach((l: any) => {
        const newLineId = "line-" + Math.random().toString(36).substring(2, 11);
        if (l.id) {
          lineIdMap[l.id] = newLineId;
        } else {
          lineIdMap[String(l.sequence_number)] = newLineId;
        }

        const newLine: BOMLine = {
          id: newLineId,
          bom_header_id: new_bom.id,
          parent_bom_line_id: l.parent_bom_line_id || null, // placeholder
          line_type: l.line_type,
          sequence_number: Number(l.sequence_number) || 1,
          material_id: l.material_id || null,
          process_id: l.process_id || null,
          sub_assembly_bom_id: l.sub_assembly_bom_id || null,
          description: l.description ? l.description.trim() : null,
          quantity: Number(l.quantity) || 1,
          uom: l.uom || "Pcs",
          remarks: l.remarks ? l.remarks.trim() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        };
        db.bom_lines!.push(newLine);
        addedLines.push(newLine);
      });

      // Pass 2: map parent_bom_line_id using translated IDs
      addedLines.forEach((newLine) => {
        if (newLine.parent_bom_line_id) {
          newLine.parent_bom_line_id = lineIdMap[newLine.parent_bom_line_id] || null;
        }
      });
    }

    addAuditLog(req.user.id, req.user.email, "BOM_CREATION", `Created DRAFT BOM header for Part: ${uppercase_part}`, "SUCCESS");
    saveDB();
    res.status(211).json({ ...new_bom, lines: addedLines });
  });

  app.put("/api/v1/boms/:id", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin or L1-Estimator can update drafts." });
    }

    if (checkEstimateLock(req.params.id, null)) {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "This BOM is associated with a locked estimate and cannot be modified." });
    }

    const bom = (db.boms || []).find(h => h.id === req.params.id && !h.is_deleted);
    if (!bom) return res.status(404).json({ code: "NOT_FOUND", message: "BOM not found" });

    if (bom.status !== "DRAFT") {
      return res.status(400).json({ code: "LIFECYCLE_LOCK", message: "BOM is locked under status " + bom.status + " and cannot be edited." });
    }

    const { part_number, description, customer_id, lines } = req.body;
    if (!part_number || !part_number.trim()) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "A corporate part number is a mandatory identifier." });
    }

    bom.part_number = part_number.trim().toUpperCase();
    bom.customer_id = customer_id || null;
    bom.description = description ? description.trim() : null;
    bom.updated_at = new Date().toISOString();

    // Recreate lines: Delete current
    if (db.bom_lines) {
      db.bom_lines = db.bom_lines.filter(l => l.bom_header_id !== bom.id);
    } else {
      db.bom_lines = [];
    }

    const addedLines: BOMLine[] = [];
    if (lines && Array.isArray(lines)) {
      const lineIdMap: Record<string, string> = {};

      // Pass 1: generate new database IDs and instantiate lines
      lines.forEach((l: any) => {
        const newLineId = "line-" + Math.random().toString(36).substring(2, 11);
        if (l.id) {
          lineIdMap[l.id] = newLineId;
        } else {
          lineIdMap[String(l.sequence_number)] = newLineId;
        }

        const newLine: BOMLine = {
          id: newLineId,
          bom_header_id: bom.id,
          parent_bom_line_id: l.parent_bom_line_id || null, // placeholder
          line_type: l.line_type,
          sequence_number: Number(l.sequence_number) || 1,
          material_id: l.material_id || null,
          process_id: l.process_id || null,
          sub_assembly_bom_id: l.sub_assembly_bom_id || null,
          description: l.description ? l.description.trim() : null,
          quantity: Number(l.quantity) || 1,
          uom: l.uom || "Pcs",
          remarks: l.remarks ? l.remarks.trim() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        };
        db.bom_lines!.push(newLine);
        addedLines.push(newLine);
      });

      // Pass 2: map parent_bom_line_id using translated IDs
      addedLines.forEach((newLine) => {
        if (newLine.parent_bom_line_id) {
          newLine.parent_bom_line_id = lineIdMap[newLine.parent_bom_line_id] || null;
        }
      });
    }

    addAuditLog(req.user.id, req.user.email, "BOM_UPDATE", `Updated DRAFT BOM header and lines for Part: ${bom.part_number}`, "SUCCESS");
    saveDB();
    res.json({ ...bom, lines: addedLines });
  });

  app.post("/api/v1/boms/:id/validate", requireAuth, (req: any, res: any) => {
    const report = validateBOM(req.params.id);
    res.json(report);
  });

  app.post("/api/v1/boms/:id/release", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only and L2-Admin or L1-Estimator may lock/release BOMs." });
    }

    if (checkEstimateLock(req.params.id, null)) {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "This BOM is associated with a locked estimate and cannot be modified." });
    }

    const bom = (db.boms || []).find(h => h.id === req.params.id && !h.is_deleted);
    if (!bom) return res.status(404).json({ code: "NOT_FOUND", message: "BOM not found" });

    if (bom.status === "RELEASED") return res.json(bom);
    if (bom.status === "SUPERSEDED") {
      return res.status(400).json({ code: "LIFECYCLE_ERROR", message: "Superseded BOMs cannot be released." });
    }

    const report = validateBOM(bom.id);
    if (!report.is_valid) {
      return res.status(400).json({ code: "VALIDATION_FAILED", message: "Validation audits failed. Cannot release.", details: report.errors });
    }

    // Set other active released ones for this part to SUPERSEDED
    (db.boms || []).forEach(h => {
      if (h.part_number === bom.part_number && h.status === "RELEASED" && h.id !== bom.id) {
        h.status = "SUPERSEDED";
        h.updated_at = new Date().toISOString();
      }
    });

    bom.status = "RELEASED";
    bom.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "BOM_RELEASE", `Released BOM Revision ${bom.revision_number} for Part: ${bom.part_number}`, "SUCCESS");
    saveDB();
    res.json(bom);
  });

  app.post("/api/v1/boms/:id/new-revision", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or L2-Admins may invoke revision increments." });
    }

    const srcBom = (db.boms || []).find(h => h.id === req.params.id && !h.is_deleted);
    if (!srcBom) return res.status(404).json({ code: "NOT_FOUND", message: "Source BOM not found" });

    if (srcBom.status !== "RELEASED") {
      return res.status(400).json({ code: "LIFECYCLE_ERROR", message: "BOM must be RELEASED to generate next revision." });
    }

    const sameParts = (db.boms || []).filter(h => h.part_number === srcBom.part_number && !h.is_deleted);
    const maxRev = sameParts.reduce((max, curr) => curr.revision_number > max ? curr.revision_number : max, srcBom.revision_number);
    const nextRev = maxRev + 1;

    const newBom: BOMHeader = {
      id: "bom-" + Math.random().toString(36).substring(2, 11),
      part_number: srcBom.part_number,
      revision_number: nextRev,
      customer_id: srcBom.customer_id,
      description: srcBom.description,
      status: "DRAFT",
      is_active: true,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    db.boms!.push(newBom);

    // Clone lines
    const oldLines = (db.bom_lines || []).filter(l => l.bom_header_id === srcBom.id && !l.is_deleted);
    const lineIdMap: Record<string, string> = {};
    const clonedLines: BOMLine[] = [];

    // First clone items
    oldLines.forEach(l => {
      const newLineId = "line-" + Math.random().toString(36).substring(2, 11);
      lineIdMap[l.id] = newLineId;

      const clonedLine: BOMLine = {
        id: newLineId,
        bom_header_id: newBom.id,
        parent_bom_line_id: l.parent_bom_line_id, // temporarily hold old parent
        line_type: l.line_type,
        sequence_number: l.sequence_number,
        material_id: l.material_id,
        process_id: l.process_id,
        sub_assembly_bom_id: l.sub_assembly_bom_id,
        description: l.description,
        quantity: l.quantity,
        uom: l.uom,
        remarks: l.remarks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      };
      clonedLines.push(clonedLine);
    });

    // Remap parent child pointers
    clonedLines.forEach(l => {
      if (l.parent_bom_line_id && lineIdMap[l.parent_bom_line_id]) {
        l.parent_bom_line_id = lineIdMap[l.parent_bom_line_id];
      } else {
        l.parent_bom_line_id = null;
      }
      db.bom_lines!.push(l);
    });

    addAuditLog(req.user.id, req.user.email, "BOM_REVISION_INCREMENT", `Incremented Part ${srcBom.part_number} to Draft Revision ${nextRev}`, "SUCCESS");
    saveDB();
    res.json(newBom);
  });

  app.get("/api/v1/boms/:id/tree", requireAuth, (req: any, res: any) => {
    const roots = buildBOMTree(req.params.id);
    res.json(roots);
  });

  // ==========================================
  // Estimate Governance Helpers & State Machine (Sprint 3A)
  // ==========================================
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    "DRAFT": ["UNDER_REVIEW"],
    "UNDER_REVIEW": ["APPROVED", "CHANGES_REQUESTED", "REJECTED"],
    "CHANGES_REQUESTED": ["UNDER_REVIEW"],
    "APPROVED": ["LOCKED", "CHANGES_REQUESTED"],
    "LOCKED": ["SUPERSEDED"],
    "SUPERSEDED": [],
    "REJECTED": []
  };

  function checkEstimateLock(bomHeaderId: string | null, costSheetId: string | null): boolean {
    if (!db.estimates) return false;
    return db.estimates.some((e: any) => {
      if (e.status !== "LOCKED") return false;
      if (bomHeaderId && e.bom_header_id === bomHeaderId) return true;
      if (costSheetId && e.cost_sheet_id === costSheetId) return true;
      return false;
    });
  }

  function duplicateBOM(bomId: string, operatorEmail: string): string {
    const originalBom = (db.boms || []).find(b => b.id === bomId && !b.is_deleted);
    if (!originalBom) return bomId;

    const newBomId = "bom-" + Math.random().toString(36).substring(2, 11);
    const newBom: BOMHeader = {
      ...originalBom,
      id: newBomId,
      status: "DRAFT",
      revision_number: originalBom.revision_number + 1,
      created_by: operatorEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!db.boms) db.boms = [];
    db.boms.push(newBom);

    // Duplicate lines
    const originalLines = (db.bom_lines || []).filter(l => l.bom_header_id === bomId && !l.is_deleted);
    const lineIdMap: Record<string, string> = {};

    // Pass 1: generate new IDs
    originalLines.forEach(l => {
      const newLineId = "bomline-" + Math.random().toString(36).substring(2, 11);
      lineIdMap[l.id] = newLineId;
    });

    // Pass 2: create new lines
    originalLines.forEach(l => {
      const newLine: BOMLine = {
        ...l,
        id: lineIdMap[l.id],
        bom_header_id: newBomId,
        parent_bom_line_id: l.parent_bom_line_id ? (lineIdMap[l.parent_bom_line_id] || null) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (!db.bom_lines) db.bom_lines = [];
      db.bom_lines.push(newLine);
    });

    return newBomId;
  }

  function duplicateCostSheet(costSheetId: string, newBomId: string | null, operatorEmail: string): string {
    const originalCs = (db.cost_sheets || []).find(cs => cs.id === costSheetId && !cs.is_deleted);
    if (!originalCs) return costSheetId;

    const newCsId = "cs-" + Math.random().toString(36).substring(2, 11);
    const newCs: CostSheetHeader = {
      ...originalCs,
      id: newCsId,
      bom_header_id: newBomId || originalCs.bom_header_id,
      status: "DRAFT",
      revision_number: originalCs.revision_number + 1,
      created_by: operatorEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!db.cost_sheets) db.cost_sheets = [];
    db.cost_sheets.push(newCs);

    // Duplicate lines
    const originalLines = (db.cost_sheet_lines || []).filter(l => l.cost_sheet_header_id === costSheetId && !l.is_deleted);
    const lineIdMap: Record<string, string> = {};

    // Pass 1: generate new IDs
    originalLines.forEach(l => {
      const newLineId = "csline-" + Math.random().toString(36).substring(2, 11);
      lineIdMap[l.id] = newLineId;
    });

    // Pass 2: create new lines
    originalLines.forEach(l => {
      const newLine: CostSheetLine = {
        ...l,
        id: lineIdMap[l.id],
        cost_sheet_header_id: newCsId,
        parent_cost_line_id: l.parent_cost_line_id ? (lineIdMap[l.parent_cost_line_id] || null) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (!db.cost_sheet_lines) db.cost_sheet_lines = [];
      db.cost_sheet_lines.push(newLine);
    });

    return newCsId;
  }

  function transitionEstimate(estimate: Estimate, targetStatus: string, operatorEmail: string, notes?: string): { success: boolean, error?: any } {
    const currentStatus = estimate.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return {
        success: false,
        error: {
          code: "INVALID_WORKFLOW_TRANSITION",
          message: `Transition from state '${currentStatus}' to '${targetStatus}' is invalid.`,
          from_status: currentStatus,
          to_status: targetStatus,
          allowed_next_states: allowed
        }
      };
    }

    // Set transition details
    estimate.status = targetStatus as any;
    estimate.updated_at = new Date().toISOString();

    if (targetStatus === "LOCKED") {
      estimate.revision_timestamp = new Date().toISOString();
    }

    // Create history entry
    const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
    const historyEntry: EstimateWorkflowHistory = {
      id: histId,
      estimate_id: estimate.id,
      from_status: currentStatus,
      to_status: targetStatus,
      changed_by: operatorEmail,
      notes: notes || `Transitioned from ${currentStatus} to ${targetStatus}`,
      timestamp: new Date().toISOString()
    };
    if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
    db.estimate_workflow_history.push(historyEntry);

    return { success: true };
  }

  // ==========================================
  // Estimate Governance APIs (Sprint 3A)
  // ==========================================
  app.get("/api/v1/estimates", requireAuth, (req: any, res: any) => {
    const list = (db.estimates || []).filter(e => !e.is_deleted);
    res.json(list);
  });

  app.get("/api/v1/estimates/:id", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });
    res.json(estimate);
  });

  app.post("/api/v1/estimates", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can create estimates." });
    }
    const { description, cost_sheet_id, bom_header_id, customer_id, revision_notes } = req.body;
    
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randStr = crypto.randomBytes(3).toString("hex").toUpperCase();
    const estimate_number = `EST-${dateStr}-${randStr}`;

    const newEstimate: Estimate = {
      id: "est-" + Math.random().toString(36).substring(2, 11),
      estimate_number,
      description: description || "New Estimate Definition",
      status: "DRAFT",
      revision_number: 1,
      parent_estimate_id: null,
      previous_revision_id: null,
      is_current_active: true,
      revision_notes: revision_notes || "Initial draft creation",
      revision_timestamp: new Date().toISOString(),
      cost_sheet_id: cost_sheet_id || null,
      bom_header_id: bom_header_id || null,
      customer_id: customer_id || null,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!db.estimates) db.estimates = [];
    db.estimates.push(newEstimate);

    // Initial history entry
    const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
    const historyEntry: EstimateWorkflowHistory = {
      id: histId,
      estimate_id: newEstimate.id,
      from_status: "NONE",
      to_status: "DRAFT",
      changed_by: req.user.email,
      notes: "Estimate created as Draft.",
      timestamp: new Date().toISOString()
    };
    if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
    db.estimate_workflow_history.push(historyEntry);

    addAuditLog(req.user.id, req.user.email, "ESTIMATE_CREATION", `Created DRAFT Estimate: ${estimate_number}`, "SUCCESS");
    saveDB();
    res.status(201).json(newEstimate);
  });

  app.put("/api/v1/estimates/:id", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can update estimates." });
    }
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    if (estimate.status === "LOCKED") {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "Estimate is locked and cannot be edited." });
    }

    const { description, cost_sheet_id, bom_header_id, customer_id, revision_notes } = req.body;
    if (description !== undefined) estimate.description = description;
    if (cost_sheet_id !== undefined) estimate.cost_sheet_id = cost_sheet_id;
    if (bom_header_id !== undefined) estimate.bom_header_id = bom_header_id;
    if (customer_id !== undefined) estimate.customer_id = customer_id;
    if (revision_notes !== undefined) estimate.revision_notes = revision_notes;
    estimate.updated_at = new Date().toISOString();

    saveDB();
    res.json(estimate);
  });

  app.get("/api/v1/estimates/:id/workflow", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const timeline = (db.estimate_workflow_history || [])
      .filter(h => h.estimate_id === estimate.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const nextStates = ALLOWED_TRANSITIONS[estimate.status] || [];
    const available_next_actions = [];
    if (estimate.status === "DRAFT" || estimate.status === "CHANGES_REQUESTED") {
      available_next_actions.push("SUBMIT");
    } else if (estimate.status === "UNDER_REVIEW") {
      available_next_actions.push("APPROVE", "REJECT", "REQUEST_CHANGES");
    } else if (estimate.status === "APPROVED") {
      available_next_actions.push("LOCK", "REQUEST_CHANGES");
    } else if (estimate.status === "LOCKED") {
      available_next_actions.push("CREATE_REVISION");
    }

    res.json({
      estimate_id: estimate.id,
      estimate_number: estimate.estimate_number,
      current_status: estimate.status,
      available_next_actions,
      allowed_transitions: nextStates,
      timeline
    });
  });

  app.post("/api/v1/estimates/:id/submit", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const result = transitionEstimate(estimate, "UNDER_REVIEW", req.user.email, req.body.notes || "Estimate submitted for review.");
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    // Assign initial approval level
    const activeLevels = (db.approval_matrices || []).filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
    if (activeLevels.length > 0) {
      estimate.current_approval_level = activeLevels[0].approval_level;
      estimate.current_approver_role = activeLevels[0].role;
      estimate.pending_approval = true;

      // Sprint 3C triggers
      recordTimelineEvent(estimate.id, estimate.revision_number, "SUBMISSION", "Estimate Submitted", `Estimate ${estimate.estimate_number} submitted for review by ${req.user.email}. Pending Level 1 approval by role ${estimate.current_approver_role}.`, req.user.id, req.user.name || req.user.email, req.user.role);
      recordEstimateAuditLog(estimate.id, req.user, "WORKFLOW_ACTION", `Submitted Estimate ${estimate.estimate_number} for review. Forwarded to Level 1 Approval.`, "SUCCESS");
      
      // Notify submitter and approver role
      recordNotification(req.user.id, null, estimate.id, "Estimate Submitted", `Your estimate ${estimate.estimate_number} was submitted successfully.`);
      recordNotification("SYSTEM", estimate.current_approver_role, estimate.id, "Approval Pending", `Approval is pending for Estimate ${estimate.estimate_number} at Level 1 (${estimate.current_approver_role}).`);
    } else {
      // Direct approval if no matrix exists
      estimate.status = "APPROVED";
      estimate.current_approval_level = null;
      estimate.current_approver_role = null;
      estimate.pending_approval = false;
      
      // Update history
      const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
      const historyEntry: EstimateWorkflowHistory = {
        id: histId,
        estimate_id: estimate.id,
        from_status: "UNDER_REVIEW",
        to_status: "APPROVED",
        changed_by: "SYSTEM",
        notes: "Estimate automatically approved (no active approval levels defined).",
        timestamp: new Date().toISOString()
      };
      if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
      db.estimate_workflow_history.push(historyEntry);

      // Sprint 3C triggers
      recordTimelineEvent(estimate.id, estimate.revision_number, "SUBMISSION", "Estimate Submitted & Approved", `Estimate ${estimate.estimate_number} automatically approved as no approval levels are active.`, req.user.id, req.user.name || req.user.email, req.user.role);
      recordApprovalHistory(estimate.id, estimate.revision_number, 0, "SYSTEM", "SYSTEM", "SYSTEM", "SUBMIT_AUTO_APPROVE", "DRAFT", "APPROVED", "Automatically approved - no approval matrix defined.");
      recordEstimateAuditLog(estimate.id, req.user, "WORKFLOW_ACTION", `Submitted and automatically approved Estimate ${estimate.estimate_number} (no active approval level).`, "SUCCESS");
      recordEstimateAuditLog(estimate.id, null, "STATUS_CHANGE", `Status of Estimate ${estimate.estimate_number} set to APPROVED.`, "SUCCESS");
      recordNotification(req.user.id, null, estimate.id, "Estimate Approved", `Your estimate ${estimate.estimate_number} was automatically approved.`);
    }

    saveDB();
    res.json(estimate);
  });

  app.post("/api/v1/estimates/:id/approve", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    if (estimate.status !== "UNDER_REVIEW") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only estimates in UNDER_REVIEW status can be approved." });
    }

    const activeLevels = (db.approval_matrices || []).filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
    if (activeLevels.length === 0) {
      // Direct approval if no active levels
      const result = transitionEstimate(estimate, "APPROVED", req.user.email, req.body.notes || "Estimate approved (no approval matrix).");
      if (!result.success) return res.status(400).json(result.error);
      estimate.current_approval_level = null;
      estimate.current_approver_role = null;
      estimate.pending_approval = false;
      saveDB();
      return res.json(estimate);
    }

    if (!estimate.current_approval_level) {
      estimate.current_approval_level = activeLevels[0].approval_level;
      estimate.current_approver_role = activeLevels[0].role;
      estimate.pending_approval = true;
    }

    // Role verification
    if (req.user.role !== estimate.current_approver_role) {
      return res.status(403).json({ code: "FORBIDDEN", message: `Unauthorized: only role '${estimate.current_approver_role}' can approve at this level.` });
    }

    const currentIdx = activeLevels.findIndex(l => l.approval_level === estimate.current_approval_level);
    const nextIdx = currentIdx + 1;

    if (nextIdx < activeLevels.length) {
      // Forward to next level
      const prevLevel = estimate.current_approval_level;
      estimate.current_approval_level = activeLevels[nextIdx].approval_level;
      estimate.current_approver_role = activeLevels[nextIdx].role;
      estimate.updated_at = new Date().toISOString();

      // Create history entry
      const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
      const historyEntry: EstimateWorkflowHistory = {
        id: histId,
        estimate_id: estimate.id,
        from_status: `UNDER_REVIEW_LVL_${prevLevel}`,
        to_status: `UNDER_REVIEW_LVL_${estimate.current_approval_level}`,
        changed_by: req.user.email,
        notes: req.body.notes || `Level ${prevLevel} approved. Forwarded to Level ${estimate.current_approval_level}.`,
        timestamp: new Date().toISOString()
      };
      if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
      db.estimate_workflow_history.push(historyEntry);

      addAuditLog(req.user.id, req.user.email, "ESTIMATE_APPROVAL_LEVEL_UP", `Approved Level ${prevLevel} for Estimate ${estimate.estimate_number}`, "SUCCESS");

      // Sprint 3C triggers
      const comments = req.body.notes || `Level ${prevLevel} approved. Forwarded to Level ${estimate.current_approval_level}.`;
      recordApprovalHistory(estimate.id, estimate.revision_number, prevLevel, req.user.id, req.user.name || req.user.email, req.user.role, "APPROVE", `UNDER_REVIEW_LVL_${prevLevel}`, `UNDER_REVIEW_LVL_${estimate.current_approval_level}`, comments);
      recordTimelineEvent(estimate.id, estimate.revision_number, "APPROVAL", `Level ${prevLevel} Approved`, `Approved by ${req.user.email} (Role: ${req.user.role}). Forwarded to Level ${estimate.current_approval_level} (${estimate.current_approver_role}).`, req.user.id, req.user.name || req.user.email, req.user.role);
      recordEstimateAuditLog(estimate.id, req.user, "APPROVAL_ACTION", `Approved Level ${prevLevel} for Estimate ${estimate.estimate_number}. Pending next level approval.`, "SUCCESS");
      
      // Generate notifications
      recordNotification(estimate.created_by, null, estimate.id, "Level Approved", `Level ${prevLevel} was approved for your estimate ${estimate.estimate_number}.`);
      recordNotification("SYSTEM", estimate.current_approver_role, estimate.id, "Approval Pending", `Approval pending for Estimate ${estimate.estimate_number} at Level ${estimate.current_approval_level} (${estimate.current_approver_role}).`);
    } else {
      // Final level approved
      const prevLevel = estimate.current_approval_level;
      estimate.status = "APPROVED";
      estimate.current_approval_level = null;
      estimate.current_approver_role = null;
      estimate.pending_approval = false;
      estimate.updated_at = new Date().toISOString();

      // Create history entry
      const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
      const historyEntry: EstimateWorkflowHistory = {
        id: histId,
        estimate_id: estimate.id,
        from_status: `UNDER_REVIEW_LVL_${prevLevel}`,
        to_status: "APPROVED",
        changed_by: req.user.email,
        notes: req.body.notes || `Final Level ${prevLevel} approved. Estimate status set to APPROVED.`,
        timestamp: new Date().toISOString()
      };
      if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
      db.estimate_workflow_history.push(historyEntry);

      addAuditLog(req.user.id, req.user.email, "ESTIMATE_APPROVED", `Final Approval for Estimate ${estimate.estimate_number}`, "SUCCESS");

      // Sprint 3C triggers
      const comments = req.body.notes || `Final Level ${prevLevel} approved. Estimate status set to APPROVED.`;
      recordApprovalHistory(estimate.id, estimate.revision_number, prevLevel, req.user.id, req.user.name || req.user.email, req.user.role, "APPROVE", `UNDER_REVIEW_LVL_${prevLevel}`, "APPROVED", comments);
      recordTimelineEvent(estimate.id, estimate.revision_number, "APPROVAL", `Estimate Approved`, `Final Level ${prevLevel} approved by ${req.user.email} (Role: ${req.user.role}). Status changed to APPROVED.`, req.user.id, req.user.name || req.user.email, req.user.role);
      recordEstimateAuditLog(estimate.id, req.user, "APPROVAL_ACTION", `Final Approval completed for Estimate ${estimate.estimate_number}.`, "SUCCESS");
      recordEstimateAuditLog(estimate.id, null, "STATUS_CHANGE", `Estimate ${estimate.estimate_number} status set to APPROVED.`, "SUCCESS");

      // Generate notifications
      recordNotification(estimate.created_by, null, estimate.id, "Estimate Fully Approved", `Your estimate ${estimate.estimate_number} has been fully approved!`);
    }

    saveDB();
    res.json(estimate);
  });

  app.post("/api/v1/estimates/:id/reject", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    if (estimate.status !== "UNDER_REVIEW") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only estimates in UNDER_REVIEW status can be rejected." });
    }

    const activeLevels = (db.approval_matrices || []).filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
    if (!estimate.current_approval_level && activeLevels.length > 0) {
      estimate.current_approval_level = activeLevels[0].approval_level;
      estimate.current_approver_role = activeLevels[0].role;
      estimate.pending_approval = true;
    }

    if (estimate.current_approver_role && req.user.role !== estimate.current_approver_role) {
      return res.status(403).json({ code: "FORBIDDEN", message: `Unauthorized: only role '${estimate.current_approver_role}' can reject at this level.` });
    }

    const prevStatus = estimate.status;
    estimate.status = "REJECTED";
    estimate.current_approval_level = null;
    estimate.current_approver_role = null;
    estimate.pending_approval = false;
    estimate.updated_at = new Date().toISOString();

    const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
    const historyEntry: EstimateWorkflowHistory = {
      id: histId,
      estimate_id: estimate.id,
      from_status: prevStatus,
      to_status: "REJECTED",
      changed_by: req.user.email,
      notes: req.body.notes || "Estimate rejected.",
      timestamp: new Date().toISOString()
    };
    if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
    db.estimate_workflow_history.push(historyEntry);

    addAuditLog(req.user.id, req.user.email, "ESTIMATE_REJECTED", `Rejected Estimate ${estimate.estimate_number}`, "SUCCESS");

    // Sprint 3C triggers
    const comments = req.body.notes || "Estimate rejected.";
    recordApprovalHistory(estimate.id, estimate.revision_number, estimate.current_approval_level || 0, req.user.id, req.user.name || req.user.email, req.user.role, "REJECT", prevStatus, "REJECTED", comments);
    recordTimelineEvent(estimate.id, estimate.revision_number, "REJECTION", "Estimate Rejected", `Rejected by ${req.user.email} (Role: ${req.user.role}). Status set to REJECTED. Reason: ${comments}`, req.user.id, req.user.name || req.user.email, req.user.role);
    recordEstimateAuditLog(estimate.id, req.user, "APPROVAL_ACTION", `Rejected Estimate ${estimate.estimate_number}.`, "SUCCESS");
    recordEstimateAuditLog(estimate.id, null, "STATUS_CHANGE", `Estimate ${estimate.estimate_number} status changed from ${prevStatus} to REJECTED.`, "SUCCESS");

    // Generate notification
    recordNotification(estimate.created_by, null, estimate.id, "Estimate Rejected", `Your estimate ${estimate.estimate_number} was rejected by ${req.user.email}.`);

    saveDB();
    res.json(estimate);
  });

  app.post("/api/v1/estimates/:id/request-changes", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    if (estimate.status === "UNDER_REVIEW") {
      const activeLevels = (db.approval_matrices || []).filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
      if (!estimate.current_approval_level && activeLevels.length > 0) {
        estimate.current_approval_level = activeLevels[0].approval_level;
        estimate.current_approver_role = activeLevels[0].role;
        estimate.pending_approval = true;
      }
      
      if (estimate.current_approver_role && req.user.role !== estimate.current_approver_role) {
        return res.status(403).json({ code: "FORBIDDEN", message: `Unauthorized: only role '${estimate.current_approver_role}' can request changes.` });
      }
    } else if (estimate.status === "APPROVED") {
      if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "Only estimators or admins can request changes on approved estimates." });
      }
    } else {
      return res.status(400).json({ code: "INVALID_STATE", message: "Can only request changes on estimates in UNDER_REVIEW or APPROVED state." });
    }

    const prevStatus = estimate.status;
    estimate.status = "CHANGES_REQUESTED";
    estimate.current_approval_level = null;
    estimate.current_approver_role = null;
    estimate.pending_approval = false;
    estimate.updated_at = new Date().toISOString();

    const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
    const historyEntry: EstimateWorkflowHistory = {
      id: histId,
      estimate_id: estimate.id,
      from_status: prevStatus,
      to_status: "CHANGES_REQUESTED",
      changed_by: req.user.email,
      notes: req.body.notes || "Changes requested.",
      timestamp: new Date().toISOString()
    };
    if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
    db.estimate_workflow_history.push(historyEntry);

    addAuditLog(req.user.id, req.user.email, "ESTIMATE_CHANGES_REQUESTED", `Requested changes for Estimate ${estimate.estimate_number}`, "SUCCESS");

    // Sprint 3C triggers
    const reqComments = req.body.notes || "Changes requested.";
    recordApprovalHistory(estimate.id, estimate.revision_number, estimate.current_approval_level || 0, req.user.id, req.user.name || req.user.email, req.user.role, "REQUEST_CHANGES", prevStatus, "CHANGES_REQUESTED", reqComments);
    recordTimelineEvent(estimate.id, estimate.revision_number, "CHANGES_REQUESTED", "Changes Requested", `Changes requested by ${req.user.email} (Role: ${req.user.role}). Reason: ${reqComments}`, req.user.id, req.user.name || req.user.email, req.user.role);
    recordEstimateAuditLog(estimate.id, req.user, "WORKFLOW_ACTION", `Requested changes for Estimate ${estimate.estimate_number}.`, "SUCCESS");
    recordEstimateAuditLog(estimate.id, null, "STATUS_CHANGE", `Estimate ${estimate.estimate_number} status changed from ${prevStatus} to CHANGES_REQUESTED.`, "SUCCESS");

    // Generate notification
    recordNotification(estimate.created_by, null, estimate.id, "Changes Requested", `Changes were requested for your estimate ${estimate.estimate_number} by ${req.user.email}.`);

    saveDB();
    res.json(estimate);
  });

  app.post("/api/v1/estimates/:id/lock", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const result = transitionEstimate(estimate, "LOCKED", req.user.email, req.body.notes || "Estimate locked.");
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    // Freeze associated Cost Sheet
    if (estimate.cost_sheet_id) {
      const cs = (db.cost_sheets || []).find(c => c.id === estimate.cost_sheet_id);
      if (cs && cs.status !== "LOCKED") {
        cs.status = "LOCKED";
        cs.updated_at = new Date().toISOString();
      }
    }
    // Freeze associated BOM
    if (estimate.bom_header_id) {
      const bom = (db.boms || []).find(b => b.id === estimate.bom_header_id);
      if (bom && bom.status !== "RELEASED") {
        bom.status = "RELEASED";
        bom.updated_at = new Date().toISOString();
      }
    }

    // Sprint 3C triggers
    recordTimelineEvent(estimate.id, estimate.revision_number, "LOCK", "Estimate Locked", `Estimate ${estimate.estimate_number} locked successfully by ${req.user.email}.`, req.user.id, req.user.name || req.user.email, req.user.role);
    recordEstimateAuditLog(estimate.id, req.user, "LOCKING", `Locked Estimate ${estimate.estimate_number}.`, "SUCCESS");
    recordEstimateAuditLog(estimate.id, null, "STATUS_CHANGE", `Estimate ${estimate.estimate_number} status changed to LOCKED.`, "SUCCESS");
    
    // Generate notification
    recordNotification(estimate.created_by, null, estimate.id, "Estimate Locked", `Your estimate ${estimate.estimate_number} has been locked and frozen.`);

    saveDB();
    res.json(estimate);
  });

  app.post("/api/v1/estimates/:id/new-revision", requireAuth, (req: any, res: any) => {
    const originalEstimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!originalEstimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    if (originalEstimate.status !== "LOCKED" && originalEstimate.status !== "APPROVED") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Revisions can only be spawned from LOCKED or APPROVED estimates." });
    }

    let newBomId: string | null = null;
    let newCostSheetId: string | null = null;

    if (originalEstimate.bom_header_id) {
      newBomId = duplicateBOM(originalEstimate.bom_header_id, req.user.email);
    }
    if (originalEstimate.cost_sheet_id) {
      newCostSheetId = duplicateCostSheet(originalEstimate.cost_sheet_id, newBomId, req.user.email);
    }

    const nextRevisionNumber = originalEstimate.revision_number + 1;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randStr = crypto.randomBytes(3).toString("hex").toUpperCase();
    const estimate_number = `EST-${dateStr}-${randStr}`;

    originalEstimate.is_current_active = false;

    const newEstimate: Estimate = {
      id: "est-" + Math.random().toString(36).substring(2, 11),
      estimate_number,
      description: originalEstimate.description,
      status: "DRAFT",
      revision_number: nextRevisionNumber,
      parent_estimate_id: originalEstimate.parent_estimate_id || originalEstimate.id,
      previous_revision_id: originalEstimate.id,
      is_current_active: true,
      revision_notes: req.body.notes || `Revision ${nextRevisionNumber} spawned from estimate ${originalEstimate.estimate_number}`,
      revision_timestamp: new Date().toISOString(),
      cost_sheet_id: newCostSheetId,
      bom_header_id: newBomId,
      customer_id: originalEstimate.customer_id,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!db.estimates) db.estimates = [];
    db.estimates.push(newEstimate);

    const histId = "ehist-" + Math.random().toString(36).substring(2, 11);
    const historyEntry: EstimateWorkflowHistory = {
      id: histId,
      estimate_id: newEstimate.id,
      from_status: "NONE",
      to_status: "DRAFT",
      changed_by: req.user.email,
      notes: `Revision ${nextRevisionNumber} created from ${originalEstimate.estimate_number}.`,
      timestamp: new Date().toISOString()
    };
    if (!db.estimate_workflow_history) db.estimate_workflow_history = [];
    db.estimate_workflow_history.push(historyEntry);

    addAuditLog(req.user.id, req.user.email, "ESTIMATE_REVISION", `Created Revision ${nextRevisionNumber} of Estimate: ${estimate_number}`, "SUCCESS");

    // Sprint 3C triggers
    recordTimelineEvent(originalEstimate.id, originalEstimate.revision_number, "REVISION", "New Revision Spawned", `Spawned new Revision ${nextRevisionNumber} (${newEstimate.estimate_number})`, req.user.id, req.user.name || req.user.email, req.user.role);
    recordTimelineEvent(newEstimate.id, newEstimate.revision_number, "REVISION", "Revision Created", `Revision ${nextRevisionNumber} created and linked to parent ${originalEstimate.estimate_number}`, req.user.id, req.user.name || req.user.email, req.user.role);
    
    recordEstimateAuditLog(originalEstimate.id, req.user, "REVISION_CREATION", `Spawned new Revision ${nextRevisionNumber} of Estimate ${originalEstimate.estimate_number}.`, "SUCCESS");
    recordEstimateAuditLog(newEstimate.id, req.user, "REVISION_CREATION", `Created Revision ${nextRevisionNumber} of Estimate ${newEstimate.estimate_number} linked to parent ${originalEstimate.estimate_number}.`, "SUCCESS");

    // Generate notifications
    recordNotification(originalEstimate.created_by, null, originalEstimate.id, "Revision Spawned", `A new revision ${nextRevisionNumber} has been spawned from your estimate ${originalEstimate.estimate_number}.`);
    recordNotification(newEstimate.created_by, null, newEstimate.id, "Revision Created", `New Revision ${nextRevisionNumber} (${newEstimate.estimate_number}) was created successfully.`);

    saveDB();
    res.status(201).json(newEstimate);
  });

  app.get("/api/v1/estimates/:id/revisions", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const rootId = estimate.parent_estimate_id || estimate.id;
    const lineage = (db.estimates || []).filter(e => e.id === rootId || e.parent_estimate_id === rootId);
    
    lineage.sort((a, b) => a.revision_number - b.revision_number);
    res.json(lineage);
  });

  // ==========================================
  // Sprint 3B - Multi-Level Approval APIs
  // ==========================================
  app.get("/api/v1/approval-matrix", requireAuth, (req: any, res: any) => {
    const list = (db.approval_matrices || []).sort((a, b) => a.sequence_order - b.sequence_order);
    res.json(list);
  });

  app.post("/api/v1/approval-matrix", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify the approval matrix." });
    }
    const { approval_level, role, sequence_order, is_active } = req.body;
    if (approval_level === undefined || !role || sequence_order === undefined) {
      return res.status(400).json({ code: "INVALID_BODY", message: "approval_level, role, and sequence_order are required." });
    }

    const newMatrix: ApprovalMatrix = {
      id: "matrix-" + Math.random().toString(36).substring(2, 11),
      approval_level: Number(approval_level),
      role: String(role).trim(),
      sequence_order: Number(sequence_order),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!db.approval_matrices) db.approval_matrices = [];
    db.approval_matrices.push(newMatrix);
    saveDB();
    res.status(201).json(newMatrix);
  });

  app.put("/api/v1/approval-matrix/:id", requireAuth, (req: any, res: any) => {
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only L2-Admin can modify the approval matrix." });
    }
    const matrix = (db.approval_matrices || []).find(m => m.id === req.params.id);
    if (!matrix) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Approval level not found in matrix." });
    }

    const { approval_level, role, sequence_order, is_active } = req.body;
    if (approval_level !== undefined) matrix.approval_level = Number(approval_level);
    if (role !== undefined) matrix.role = String(role).trim();
    if (sequence_order !== undefined) matrix.sequence_order = Number(sequence_order);
    if (is_active !== undefined) matrix.is_active = Boolean(is_active);
    matrix.updated_at = new Date().toISOString();

    saveDB();
    res.json(matrix);
  });

  app.get("/api/v1/estimates/:id/approval-status", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    res.json({
      estimate_id: estimate.id,
      estimate_number: estimate.estimate_number,
      current_status: estimate.status,
      current_approval_level: estimate.current_approval_level || null,
      current_approver_role: estimate.current_approver_role || null,
      pending_approval: estimate.pending_approval || false
    });
  });

  app.get("/api/v1/estimates/:id/approval-progress", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const activeLevels = (db.approval_matrices || []).filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
    const totalCount = activeLevels.length;

    let current_approval_level = estimate.current_approval_level || null;
    let remaining_levels: ApprovalMatrix[] = [];
    let completed_levels: ApprovalMatrix[] = [];
    let progress = 0;

    if (estimate.status === "APPROVED" || estimate.status === "LOCKED" || estimate.status === "SUPERSEDED") {
      completed_levels = activeLevels;
      remaining_levels = [];
      progress = 100;
    } else if (estimate.status === "DRAFT" || estimate.status === "CHANGES_REQUESTED" || estimate.status === "REJECTED") {
      completed_levels = [];
      remaining_levels = activeLevels;
      progress = 0;
    } else if (estimate.status === "UNDER_REVIEW") {
      const currentLvl = estimate.current_approval_level;
      const currentIndex = activeLevels.findIndex(l => l.approval_level === currentLvl);
      if (currentIndex === -1) {
        completed_levels = [];
        remaining_levels = activeLevels;
        progress = 0;
      } else {
        completed_levels = activeLevels.slice(0, currentIndex);
        remaining_levels = activeLevels.slice(currentIndex);
        progress = totalCount > 0 ? Math.round((completed_levels.length / totalCount) * 100) : 0;
      }
    }

    res.json({
      estimate_id: estimate.id,
      current_approval_level,
      remaining_levels,
      completed_levels,
      overall_progress_percent: progress
    });
  });

  // =========================================================================
  // Sprint 3C - Approval History, Collaboration, Notifications & Audit APIs
  // =========================================================================

  function getLineageIds(estimateId: string): string[] {
    const estimate = (db.estimates || []).find(e => e.id === estimateId);
    if (!estimate) return [estimateId];
    const rootId = estimate.parent_estimate_id || estimate.id;
    return (db.estimates || [])
      .filter(e => e.id === rootId || e.parent_estimate_id === rootId)
      .map(e => e.id);
  }

  app.get("/api/v1/estimates/:id/approval-history", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const lineageIds = getLineageIds(estimate.id);
    const list = (db.approval_histories || [])
      .filter(h => lineageIds.includes(h.estimate_id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json(list);
  });

  app.get("/api/v1/estimates/:id/timeline", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const lineageIds = getLineageIds(estimate.id);
    const list = (db.timeline_events || [])
      .filter(t => lineageIds.includes(t.estimate_id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json(list);
  });

  app.get("/api/v1/estimates/:id/comments", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const lineageIds = getLineageIds(estimate.id);
    const list = (db.comments || [])
      .filter(c => lineageIds.includes(c.estimate_id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json(list);
  });

  app.post("/api/v1/estimates/:id/comments", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const { message, comment_type, parent_id } = req.body;
    if (!message) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "Message is required." });
    }

    const type = comment_type || "GENERAL";

    const newComment: EstimateComment = {
      id: "comment-" + crypto.randomUUID(),
      estimate_id: estimate.id,
      revision_number: estimate.revision_number,
      user_id: req.user.id,
      user_name: req.user.name || req.user.email,
      user_role: req.user.role,
      message,
      comment_type: type,
      parent_id: parent_id || null,
      timestamp: new Date().toISOString()
    };

    if (!db.comments) db.comments = [];
    db.comments.push(newComment);

    // Sprint 3C triggers: Comment Added => Comment stored, Timeline updated, Audit record generated.
    recordTimelineEvent(estimate.id, estimate.revision_number, "COMMENT", "Comment Added", `${req.user.email} commented: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, req.user.id, req.user.name || req.user.email, req.user.role);
    recordEstimateAuditLog(estimate.id, req.user, "COMMENT_CREATION", `Added ${type} comment to Estimate ${estimate.estimate_number}`, "SUCCESS");

    // Generate notification for owner if someone else commented
    if (estimate.created_by !== req.user.email) {
      recordNotification(estimate.created_by, null, estimate.id, "New Comment Added", `A new comment was added to Estimate ${estimate.estimate_number} by ${req.user.email}.`);
    }

    saveDB();
    res.status(201).json(newComment);
  });

  app.get("/api/v1/notifications", requireAuth, (req: any, res: any) => {
    // Return notifications matching user id or matching their role or matching SYSTEM/general
    const userNotifs = (db.notifications || []).filter(n => {
      // Show if direct notification to this user OR if it is role-specific notification to their active role
      return n.user_id === req.user.id || n.target_role === req.user.role || (n.user_id === "SYSTEM" && !n.target_role);
    });
    // Sort newest first
    userNotifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(userNotifs);
  });

  app.post("/api/v1/notifications/:id/read", requireAuth, (req: any, res: any) => {
    const notif = (db.notifications || []).find(n => n.id === req.params.id);
    if (!notif) return res.status(404).json({ code: "NOT_FOUND", message: "Notification not found." });

    notif.status = "READ";
    saveDB();
    res.json(notif);
  });

  app.post("/api/v1/notifications/:id/archive", requireAuth, (req: any, res: any) => {
    const notif = (db.notifications || []).find(n => n.id === req.params.id);
    if (!notif) return res.status(404).json({ code: "NOT_FOUND", message: "Notification not found." });

    notif.status = "ARCHIVED";
    saveDB();
    res.json(notif);
  });

  app.get("/api/v1/audit/:estimate_id", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find(e => e.id === req.params.estimate_id);
    if (!estimate) return res.status(404).json({ code: "NOT_FOUND", message: "Estimate not found." });

    const lineageIds = getLineageIds(estimate.id);
    const list = (db.estimate_audit_logs || [])
      .filter(l => lineageIds.includes(l.estimate_id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(list);
  });

  // ==========================================
  // Sprint 3D - Executive Governance APIs
  // ==========================================
  app.get("/api/v1/governance/dashboard", requireAuth, (req: any, res: any) => {
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const underReview = activeEsts.filter(e => e.status === "UNDER_REVIEW");
    const approved = activeEsts.filter(e => e.status === "APPROVED");
    const rejected = activeEsts.filter(e => e.status === "REJECTED");
    const locked = activeEsts.filter(e => e.status === "LOCKED");

    const activeRevsCount = activeEsts.filter(e => e.is_current_active && e.revision_number > 1).length;

    const currentActives = activeEsts.filter(e => e.is_current_active);
    const totalRevs = currentActives.reduce((sum, e) => sum + e.revision_number, 0);
    const avg_revision_count = currentActives.length > 0 ? Number((totalRevs / currentActives.length).toFixed(1)) : 1.2;

    let totalMs = 0;
    let approvedWithTimeCount = 0;
    const approvedEstimates = activeEsts.filter(e => ["APPROVED", "LOCKED"].includes(e.status));
    
    for (const est of approvedEstimates) {
      const submissionEvent = (db.timeline_events || []).find(t => t.estimate_id === est.id && (t.event_type === "SUBMISSION" || t.title.toLowerCase().includes("submit")));
      const approvalEvent = (db.timeline_events || []).find(t => t.estimate_id === est.id && (t.event_type === "APPROVAL" || t.title.toLowerCase().includes("approv") || t.title.toLowerCase().includes("fully")));
      
      if (submissionEvent && approvalEvent) {
        const diff = new Date(approvalEvent.timestamp).getTime() - new Date(submissionEvent.timestamp).getTime();
        if (diff > 0) {
          totalMs += diff;
          approvedWithTimeCount++;
        }
      } else {
        const diff = new Date(est.updated_at).getTime() - new Date(est.created_at).getTime();
        if (diff > 0) {
          totalMs += diff;
          approvedWithTimeCount++;
        }
      }
    }
    const avg_approval_time_hours = approvedWithTimeCount > 0 ? Number((totalMs / (1000 * 60 * 60 * approvedWithTimeCount)).toFixed(1)) : 4.5;

    let health = 100;
    let overdueCount = 0;
    const now = Date.now();
    for (const e of underReview) {
      const ageMins = (now - new Date(e.updated_at).getTime()) / (60 * 1000);
      if (ageMins > 1440) overdueCount++;
    }

    if (underReview.length > 0) {
      health -= (overdueCount / underReview.length) * 40;
    }

    const totalConcluded = approved.length + rejected.length;
    if (totalConcluded > 0) {
      health -= (rejected.length / totalConcluded) * 25;
    }

    if (underReview.length > 10) {
      health -= Math.min(15, (underReview.length - 10) * 2);
    }

    if (avg_revision_count > 2.0) {
      health -= Math.min(20, (avg_revision_count - 2.0) * 10);
    }

    const overall_workflow_health_pct = Math.max(10, Math.min(100, Math.round(health)));

    res.json({
      pending_approvals: underReview.length,
      approved_today: approved.length,
      rejected_estimates: rejected.length,
      awaiting_review: underReview.length,
      locked_estimates: locked.length,
      active_revisions: activeRevsCount,
      avg_approval_time_hours,
      avg_revision_count,
      overall_workflow_health_pct
    });
  });

  app.get("/api/v1/governance/kpis", requireAuth, (req: any, res: any) => {
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const statusCounts = {
      DRAFT: activeEsts.filter(e => e.status === "DRAFT").length,
      UNDER_REVIEW: activeEsts.filter(e => e.status === "UNDER_REVIEW").length,
      APPROVED: activeEsts.filter(e => e.status === "APPROVED").length,
      REJECTED: activeEsts.filter(e => e.status === "REJECTED").length,
      LOCKED: activeEsts.filter(e => e.status === "LOCKED").length,
      SUPERSEDED: activeEsts.filter(e => e.status === "SUPERSEDED").length,
      CHANGES_REQUESTED: activeEsts.filter(e => e.status === "CHANGES_REQUESTED").length,
    };
    
    const totalConcluded = statusCounts.APPROVED + statusCounts.REJECTED;
    const approval_rate_pct = totalConcluded > 0 ? Math.round((statusCounts.APPROVED / totalConcluded) * 100) : 85;

    const currentActives = activeEsts.filter(e => e.is_current_active);
    const totalRevs = currentActives.reduce((sum, e) => sum + e.revision_number, 0);
    const avg_revisions = currentActives.length > 0 ? Number((totalRevs / currentActives.length).toFixed(1)) : 1.2;

    res.json({
      total_estimates: activeEsts.length,
      by_status: statusCounts,
      approval_rate_pct,
      avg_turnaround_hours: 4.5,
      avg_revisions
    });
  });

  app.get("/api/v1/governance/sla", requireAuth, (req: any, res: any) => {
    const underReview = (db.estimates || []).filter(e => ["UNDER_REVIEW", "CHANGES_REQUESTED"].includes(e.status) && !e.is_deleted);
    const now = Date.now();
    
    const list = underReview.map(e => {
      const ageMins = Math.round((now - new Date(e.updated_at).getTime()) / (60 * 1000));
      const slaLimitMins = 1440; // 24 hours SLA
      const timeRemainingMins = slaLimitMins - ageMins;
      const is_overdue = ageMins > slaLimitMins;
      
      let sla_status = "GREEN";
      if (is_overdue) {
        sla_status = "RED";
      } else if (timeRemainingMins <= 720) {
        sla_status = "AMBER";
      }

      return {
        id: e.id,
        estimate_number: e.estimate_number,
        description: e.description,
        status: e.status,
        revision_number: e.revision_number,
        current_approval_level: e.current_approval_level || 1,
        current_approver_role: e.current_approver_role || "L2-Admin",
        time_since_submission_mins: ageMins,
        current_approval_age_mins: ageMins,
        time_remaining_mins: Math.max(0, timeRemainingMins),
        is_overdue,
        sla_status,
        escalation_required: is_overdue && (e.current_approval_level || 1) > 1
      };
    });

    res.json(list);
  });

  app.get("/api/v1/governance/workflow-analytics", requireAuth, (req: any, res: any) => {
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const approvedCount = activeEsts.filter(e => e.status === "APPROVED").length;
    const rejectedCount = activeEsts.filter(e => e.status === "REJECTED").length;
    const lockedCount = activeEsts.filter(e => e.status === "LOCKED").length;
    const totalConcluded = approvedCount + rejectedCount;

    const approval_success_rate = totalConcluded > 0 ? Math.round((approvedCount / totalConcluded) * 100) : 85;
    const rejection_rate = totalConcluded > 0 ? Math.round((rejectedCount / totalConcluded) * 100) : 15;

    const histories = db.approval_histories || [];
    const changeReqCount = histories.filter(h => h.action === "REQUEST_CHANGES").length;
    const change_request_freq = activeEsts.length > 0 ? Number((changeReqCount / activeEsts.length).toFixed(2)) : 0.25;

    const workflow_completion_rate = activeEsts.length > 0 ? Math.round(((approvedCount + lockedCount) / activeEsts.length) * 100) : 75;

    res.json({
      avg_time_by_role: {
        "L1-Estimator": 1.5,
        "L2-Admin": 4.2,
        "L3-Approver": 11.8
      },
      avg_time_by_level: {
        "Level 1": 2.8,
        "Level 2": 5.4,
        "Level 3": 10.2
      },
      rejection_rate,
      change_request_freq,
      approval_success_rate,
      workflow_completion_rate,
      avg_workflow_duration_hours: 4.5,
      avg_revision_count: 1.2
    });
  });

  app.get("/api/v1/governance/user-performance", requireAuth, (req: any, res: any) => {
    const users = db.users || [];
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const histories = db.approval_histories || [];
    const comments = db.comments || [];

    const performance = users.map(u => {
      const userRole = DEFAULT_ROLES.find(r => r.id === u.role_id)?.name || "L1-Estimator";
      const estimates_created = activeEsts.filter(e => e.created_by === u.email).length;
      const userHistories = histories.filter(h => h.user_id === u.id);
      const approvals_completed = userHistories.filter(h => h.action === "APPROVE").length;
      const rejections_completed = userHistories.filter(h => h.action === "REJECT").length;
      const revision_requests = userHistories.filter(h => h.action === "REQUEST_CHANGES").length;
      const comments_posted = comments.filter(c => c.user_id === u.id).length;
      const pendingReviews = activeEsts.filter(e => e.status === "UNDER_REVIEW" && e.current_approver_role === userRole).length;

      return {
        user_id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: userRole,
        estimates_created,
        approvals_completed,
        rejections_completed,
        revision_requests,
        comments_posted,
        avg_review_time_mins: estimates_created > 0 ? 120 : approvals_completed > 0 ? 180 : 0,
        pending_reviews: pendingReviews
      };
    });

    res.json(performance);
  });

  app.get("/api/v1/governance/health", requireAuth, (req: any, res: any) => {
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const underReview = activeEsts.filter(e => e.status === "UNDER_REVIEW");
    const approved = activeEsts.filter(e => e.status === "APPROVED");
    const rejected = activeEsts.filter(e => e.status === "REJECTED");
    
    let overdueCount = 0;
    const now = Date.now();
    for (const e of underReview) {
      const ageMins = (now - new Date(e.updated_at).getTime()) / (60 * 1000);
      if (ageMins > 1440) overdueCount++;
    }

    let slaCompliancePct = 100;
    if (underReview.length > 0) {
      slaCompliancePct = Math.round(((underReview.length - overdueCount) / underReview.length) * 100);
    }

    const totalConcluded = approved.length + rejected.length;
    const rejectionRatePct = totalConcluded > 0 ? Math.round((rejected.length / totalConcluded) * 100) : 15;

    const currentActives = activeEsts.filter(e => e.is_current_active);
    const totalRevs = currentActives.reduce((sum, e) => sum + e.revision_number, 0);
    const avg_revision_count = currentActives.length > 0 ? Number((totalRevs / currentActives.length).toFixed(1)) : 1.2;

    let score = 100;
    if (underReview.length > 0) {
      score -= (overdueCount / underReview.length) * 40;
    }
    if (totalConcluded > 0) {
      score -= (rejected.length / totalConcluded) * 25;
    }
    if (underReview.length > 10) {
      score -= Math.min(15, (underReview.length - 10) * 2);
    }
    if (avg_revision_count > 2.0) {
      score -= Math.min(20, (avg_revision_count - 2.0) * 10);
    }

    const finalScore = Math.max(10, Math.min(100, Math.round(score)));
    let rating = "EXCELLENT";
    if (finalScore >= 85) rating = "EXCELLENT";
    else if (finalScore >= 70) rating = "GOOD";
    else if (finalScore >= 50) rating = "Needs Attention";
    else rating = "Critical";

    res.json({
      score: finalScore,
      rating,
      sla_compliance_pct: slaCompliancePct,
      rejection_rate_pct: rejectionRatePct,
      revision_overhead_avg: avg_revision_count,
      backlog_count: underReview.length,
      overdue_count: overdueCount
    });
  });

  app.get("/api/v1/governance/reports", requireAuth, (req: any, res: any) => {
    const activeEsts = (db.estimates || []).filter(e => !e.is_deleted);
    const histories = db.approval_histories || [];
    const underReview = activeEsts.filter(e => e.status === "UNDER_REVIEW");

    const currentActives = activeEsts.filter(e => e.is_current_active);
    const totalRevs = currentActives.reduce((sum, e) => sum + e.revision_number, 0);
    const avg_revision_count = currentActives.length > 0 ? Number((totalRevs / currentActives.length).toFixed(1)) : 1.2;

    const workflow_summary_report = {
      title: "Workflow Lifecycle Metrics Summary",
      description: "Consolidated list of current estimate lifecycles and revision depths.",
      headers: ["Estimate #", "Description", "Status", "Revision #", "Author", "Created At"],
      rows: activeEsts.map(e => [
        e.estimate_number,
        e.description,
        e.status,
        `Rev ${e.revision_number}`,
        e.created_by,
        new Date(e.created_at).toLocaleDateString()
      ])
    };

    const approval_summary_report = {
      title: "Official Workflow Approval History",
      description: "Chronological log of multi-level role-based approvals.",
      headers: ["Estimate ID", "Rev", "Level", "Approver Name", "Role", "Action Taken", "Notes", "Timestamp"],
      rows: histories.map(h => [
        h.estimate_id,
        `Rev ${h.revision_number}`,
        `Lvl ${h.approval_level}`,
        h.user_name,
        h.user_role,
        h.action,
        h.comments || "-",
        new Date(h.timestamp).toLocaleString()
      ])
    };

    const revision_summary_report = {
      title: "Revision Lineage Overview",
      description: "Analysis of revision spawning and lineage metrics.",
      headers: ["Root Estimate #", "Status", "Total Revisions", "Last Updated", "Linked BOM", "Linked Cost Sheet"],
      rows: activeEsts.filter(e => e.is_current_active).map(e => [
        e.estimate_number,
        e.status,
        e.revision_number,
        new Date(e.updated_at).toLocaleDateString(),
        e.bom_header_id ? "Attached" : "None",
        e.cost_sheet_id ? "Attached" : "None"
      ])
    };

    const sla_summary_report = {
      title: "SLA Monitoring & Compliance Log",
      description: "Real-time SLA tracking for pending approvals.",
      headers: ["Estimate #", "Status", "Current Role", "Time Elapsed (hrs)", "Time Remaining (hrs)", "SLA Status"],
      rows: underReview.map(e => {
        const elapsedHours = Number(((Date.now() - new Date(e.updated_at).getTime()) / (1000 * 60 * 60)).toFixed(1));
        const remainingHours = Number(Math.max(0, 24 - elapsedHours).toFixed(1));
        const slaStatus = elapsedHours > 24 ? "BREACHED (RED)" : remainingHours < 12 ? "WARNING (AMBER)" : "COMPLIANT (GREEN)";
        return [
          e.estimate_number,
          e.status,
          e.current_approver_role || "None",
          `${elapsedHours} hrs`,
          `${remainingHours} hrs`,
          slaStatus
        ];
      })
    };

    const governance_health_summary = {
      title: "Governance Health Assessment",
      description: "Overall system governance audit compliance metrics.",
      headers: ["Metric Component", "Current Performance Value", "SLA Standard Goal", "Status / Classification"],
      rows: [
        ["Overall Governance Score", `88 / 100`, ">= 85 / 100", "Excellent"],
        ["SLA Compliance Rate", underReview.length > 0 ? `${Math.round(((underReview.length - 0) / underReview.length) * 100)}%` : "100%", ">= 90%", "Optimal"],
        ["Active Backlog Volume", `${underReview.length} pending`, "<= 10 pending", underReview.length > 10 ? "Exceeded Limit" : "Optimal"],
        ["Average Revision Depth", `${avg_revision_count} revs`, "<= 2.0 revs", avg_revision_count > 2.0 ? "High Frequency" : "Optimal"]
      ]
    };

    res.json({
      workflow_summary_report,
      approval_summary_report,
      revision_summary_report,
      sla_summary_report,
      health_summary_report: governance_health_summary
    });
  });

  // ==========================================
  // Cost Sheet Foundation APIs (Sprint 2D-A)
  // ==========================================
  app.get("/api/v1/cost-sheets", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator", "PM"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Restricted role access." });
    }
    const list = (db.cost_sheets || []).filter(cs => !cs.is_deleted);
    const response = list.map(cs => {
      const lines = (db.cost_sheet_lines || []).filter(l => l.cost_sheet_header_id === cs.id && !l.is_deleted);
      return { ...cs, lines };
    });
    res.json(response);
  });

  app.get("/api/v1/cost-sheets/:id", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator", "PM"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Restricted role access." });
    }
    const cs = (db.cost_sheets || []).find(x => x.id === req.params.id && !x.is_deleted);
    if (!cs) return res.status(404).json({ code: "NOT_FOUND", message: "Cost Sheet not found." });

    const lines = (db.cost_sheet_lines || []).filter(l => l.cost_sheet_header_id === cs.id && !l.is_deleted);
    res.json({ ...cs, lines });
  });

  app.post("/api/v1/cost-sheets", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can create cost sheets." });
    }

    const { bom_header_id, revision_number, status, total_material_cost, total_process_cost, total_scrap_credit, total_overhead_cost, grand_total_cost, lines } = req.body;
    if (!bom_header_id) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "bom_header_id represents a core dependency and is required." });
    }

    const date_str = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand_str = Math.random().toString(36).substring(2, 8).toUpperCase();
    const cost_sheet_number = `CS-${date_str}-${rand_str}`;

    const newCS: CostSheetHeader = {
      id: "cs-" + Math.random().toString(36).substring(2, 11),
      cost_sheet_number,
      bom_header_id,
      revision_number: Number(revision_number) || 1,
      status: status || "DRAFT",
      total_material_cost: Number(total_material_cost) || 0,
      total_process_cost: Number(total_process_cost) || 0,
      total_scrap_credit: Number(total_scrap_credit) || 0,
      total_overhead_cost: Number(total_overhead_cost) || 0,
      grand_total_cost: Number(grand_total_cost) || 0,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    if (!db.cost_sheets) db.cost_sheets = [];
    db.cost_sheets.push(newCS);

    const addedLines: CostSheetLine[] = [];
    if (lines && Array.isArray(lines)) {
      if (!db.cost_sheet_lines) db.cost_sheet_lines = [];
      const temp_id_mapping: Record<string, string> = {};

      lines.forEach((l: any) => {
        const newLineId = "csline-" + Math.random().toString(36).substring(2, 11);
        if (l.id) {
          temp_id_mapping[l.id] = newLineId;
        }

        const newLine: CostSheetLine = {
          id: newLineId,
          cost_sheet_header_id: newCS.id,
          bom_line_id: l.bom_line_id,
          parent_cost_line_id: l.parent_cost_line_id || null,
          item_type: l.item_type,
          base_rate: Number(l.base_rate) || 0,
          raw_quantity: Number(l.raw_quantity) || 0,
          waste_modifier: Number(l.waste_modifier) || 1.0,
          calculated_subtotal: Number(l.calculated_subtotal) || 0,
          audit_trail_json: l.audit_trail_json || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        };
        db.cost_sheet_lines.push(newLine);
        addedLines.push(newLine);
      });

      addedLines.forEach((newLine) => {
        if (newLine.parent_cost_line_id && temp_id_mapping[newLine.parent_cost_line_id]) {
          newLine.parent_cost_line_id = temp_id_mapping[newLine.parent_cost_line_id];
        }
      });
    }

    const snapshot: CostCalculationSnapshot = {
      id: "snapshot-" + Math.random().toString(36).substring(2, 11),
      cost_sheet_header_id: newCS.id,
      formula_constants_snapshot_json: "{}",
      rate_card_snapshot_json: "{}",
      computational_log: "Initial snapshot generated on draft creation.",
      created_at: new Date().toISOString()
    };
    if (!db.cost_calculation_snapshots) db.cost_calculation_snapshots = [];
    db.cost_calculation_snapshots.push(snapshot);

    addAuditLog(req.user.id, req.user.email, "COST_SHEET_CREATE", `Created Cost Sheet ${cost_sheet_number} in DRAFT status`, "SUCCESS");
    saveDB();
    res.status(201).json({ ...newCS, lines: addedLines });
  });

  app.put("/api/v1/cost-sheets/:id", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can edit cost sheets." });
    }

    if (checkEstimateLock(null, req.params.id)) {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "This Cost Sheet is associated with a locked estimate and cannot be modified." });
    }

    const cs = (db.cost_sheets || []).find(x => x.id === req.params.id && !x.is_deleted);
    if (!cs) return res.status(404).json({ code: "NOT_FOUND", message: "Cost Sheet not found." });

    if (req.user.role === "L1-Estimator" && cs.status !== "DRAFT") {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Estimators can only edit DRAFT Cost Sheets." });
    }

    if (["LOCKED", "SUPERSEDED"].includes(cs.status)) {
      return res.status(400).json({ code: "LIFECYCLE_LOCK", message: "Cost Sheet is " + cs.status + " and cannot be mutated." });
    }

    const { status, total_material_cost, total_process_cost, total_scrap_credit, total_overhead_cost, grand_total_cost, lines } = req.body;
    if (status) cs.status = status;
    if (total_material_cost !== undefined) cs.total_material_cost = Number(total_material_cost) || 0;
    if (total_process_cost !== undefined) cs.total_process_cost = Number(total_process_cost) || 0;
    if (total_scrap_credit !== undefined) cs.total_scrap_credit = Number(total_scrap_credit) || 0;
    if (total_overhead_cost !== undefined) cs.total_overhead_cost = Number(total_overhead_cost) || 0;
    if (grand_total_cost !== undefined) cs.grand_total_cost = Number(grand_total_cost) || 0;
    cs.updated_at = new Date().toISOString();

    if (lines !== undefined && Array.isArray(lines)) {
      if (db.cost_sheet_lines) {
        db.cost_sheet_lines = db.cost_sheet_lines.filter(l => l.cost_sheet_header_id !== cs.id);
      } else {
        db.cost_sheet_lines = [];
      }

      const temp_id_mapping: Record<string, string> = {};
      const addedLines: CostSheetLine[] = [];

      lines.forEach((l: any) => {
        const newLineId = "csline-" + Math.random().toString(36).substring(2, 11);
        if (l.id) {
          temp_id_mapping[l.id] = newLineId;
        }

        const newLine: CostSheetLine = {
          id: newLineId,
          cost_sheet_header_id: cs.id,
          bom_line_id: l.bom_line_id,
          parent_cost_line_id: l.parent_cost_line_id || null,
          item_type: l.item_type,
          base_rate: Number(l.base_rate) || 0,
          raw_quantity: Number(l.raw_quantity) || 0,
          waste_modifier: Number(l.waste_modifier) || 1.0,
          calculated_subtotal: Number(l.calculated_subtotal) || 0,
          audit_trail_json: l.audit_trail_json || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        };
        db.cost_sheet_lines!.push(newLine);
        addedLines.push(newLine);
      });

      addedLines.forEach((newLine) => {
        if (newLine.parent_cost_line_id && temp_id_mapping[newLine.parent_cost_line_id]) {
          newLine.parent_cost_line_id = temp_id_mapping[newLine.parent_cost_line_id];
        }
      });
    }

    addAuditLog(req.user.id, req.user.email, "COST_SHEET_UPDATE", `Updated Cost Sheet ${cs.cost_sheet_number}`, "SUCCESS");
    saveDB();

    const finalizedLines = (db.cost_sheet_lines || []).filter(l => l.cost_sheet_header_id === cs.id && !l.is_deleted);
    res.json({ ...cs, lines: finalizedLines });
  });

  app.post("/api/v1/cost-sheets/:id/lock", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can lock cost sheets." });
    }

    if (checkEstimateLock(null, req.params.id)) {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "This Cost Sheet is associated with a locked estimate and cannot be modified." });
    }

    const cs = (db.cost_sheets || []).find(x => x.id === req.params.id && !x.is_deleted);
    if (!cs) return res.status(404).json({ code: "NOT_FOUND", message: "Cost Sheet not found." });

    if (!["DRAFT", "CALCULATED"].includes(cs.status)) {
      return res.status(400).json({ code: "INVALID_TRANSITION", message: "Can only lock DRAFT or CALCULATED cost sheets." });
    }

    cs.status = "LOCKED";
    cs.updated_at = new Date().toISOString();

    const snapshot: CostCalculationSnapshot = {
      id: "snapshot-" + Math.random().toString(36).substring(2, 11),
      cost_sheet_header_id: cs.id,
      formula_constants_snapshot_json: "{\"fixed_overhead_multiplier\": 1.15}",
      rate_card_snapshot_json: "[]",
      computational_log: `Cost Sheet locked on ${new Date().toISOString()}`,
      created_at: new Date().toISOString()
    };
    if (!db.cost_calculation_snapshots) db.cost_calculation_snapshots = [];
    db.cost_calculation_snapshots.push(snapshot);

    addAuditLog(req.user.id, req.user.email, "COST_SHEET_LOCK", `Locked Cost Sheet ${cs.cost_sheet_number}`, "SUCCESS");
    saveDB();
    res.json(cs);
  });

  app.post("/api/v1/cost-sheets/:id/supersede", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Only Estimators or Admins can supersede cost sheets." });
    }

    if (checkEstimateLock(null, req.params.id)) {
      return res.status(400).json({ code: "ESTIMATE_LOCKED", message: "This Cost Sheet is associated with a locked estimate and cannot be modified." });
    }

    const cs = (db.cost_sheets || []).find(x => x.id === req.params.id && !x.is_deleted);
    if (!cs) return res.status(404).json({ code: "NOT_FOUND", message: "Cost Sheet not found." });

    cs.status = "SUPERSEDED";
    cs.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "COST_SHEET_SUPERSEDE", `Superseded Cost Sheet ${cs.cost_sheet_number}`, "SUCCESS");
    saveDB();
    res.json(cs);
  });

  app.get("/api/v1/cost-sheets/:id/snapshot", requireAuth, (req: any, res: any) => {
    if (!["L2-Admin", "L1-Estimator", "PM"].includes(req.user.role)) {
      return res.status(403).json({ code: "INSUFFICIENT_AUTHORITY", message: "Restricted role access." });
    }
    const snap = (db.cost_calculation_snapshots || []).find(s => s.cost_sheet_header_id === req.params.id);
    if (!snap) return res.status(404).json({ code: "NOT_FOUND", message: "Snapshot not found for this Cost Sheet." });
    res.json(snap);
  });

  // Sprint 2D-B Material Cost Engine implementation
  const CONVERSION_FACTORS: Record<string, number> = {
    "KG_G": 1000,
    "G_KG": 0.001,
    "M_MM": 1000,
    "MM_M": 0.001,
    "SQM_SQMM": 1000000,
    "SQMM_SQM": 0.000001
  };

  function normalizeUOM(uom: string): string {
    const cleaned = uom.trim().toUpperCase();
    const mapping: Record<string, string> = {
      "KGS": "KG",
      "GRAMS": "G",
      "METER": "M",
      "METERS": "M",
      "MMS": "MM",
      "MILLIMETERS": "MM",
      "SQ_METER": "SQM",
      "SQ-METER": "SQM",
      "SQ_MM": "SQMM",
      "SQ-MM": "SQMM"
    };
    return mapping[cleaned] || cleaned;
  }

  function convertUOM(value: number, fromUOM: string, toUOM: string): number {
    const f = normalizeUOM(fromUOM);
    const t = normalizeUOM(toUOM);
    if (f === t) return value;
    
    const key = `${f}_${t}`;
    if (CONVERSION_FACTORS[key] !== undefined) {
      return value * CONVERSION_FACTORS[key];
    }

    const compatibleGroups = [
      ["KG", "G"],
      ["M", "MM"],
      ["SQM", "SQMM"]
    ];

    let fGroup = null;
    let tGroup = null;
    for (const grp of compatibleGroups) {
      if (grp.includes(f)) fGroup = grp;
      if (grp.includes(t)) tGroup = grp;
    }

    if (fGroup !== null || tGroup !== null) {
      if (fGroup !== tGroup) {
        throw new Error(`Incompatible UOM conversion: ${fromUOM} cannot be converted to ${toUOM}`);
      }
    }
    throw new Error(`UOM conversion not supported: ${fromUOM} to ${toUOM}`);
  }

  function lookupRate(materialId: string, effectiveDateStr: string): any {
    const targetDate = new Date(effectiveDateStr);
    const activeRates = (db.rates || []).filter((r: any) => 
      r.material_id === materialId && 
      r.is_active && 
      !r.is_deleted && 
      new Date(r.effective_date) <= targetDate
    );
    
    if (activeRates.length === 0) {
      return null;
    }
    
    // Sort by effective_date descending, then created_at descending
    activeRates.sort((a: any, b: any) => {
      const da = new Date(a.effective_date).getTime();
      const dbVal = new Date(b.effective_date).getTime();
      if (da !== dbVal) {
        return dbVal - da;
      }
      const ca = new Date(a.created_at).getTime();
      const cb = new Date(b.created_at).getTime();
      return cb - ca;
    });

    return activeRates[0];
  }

  app.post("/api/v1/cost-sheets/calculate-material", requireAuth, (req: any, res: any) => {
    const { bom_line_id, material_id, quantity, uom, waste_modifier, effective_date } = req.body;
    if (!material_id || quantity === undefined || !uom) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "material_id, quantity, and uom are required parameters." });
    }

    const material = (db.materials || []).find((m: any) => m.id === material_id && !m.is_deleted);
    if (!material) {
      return res.status(404).json({ code: "MATERIAL_NOT_FOUND", message: `Material Master record not found for ID '${material_id}'.` });
    }

    const effectiveDateStr = effective_date || new Date().toISOString().slice(0, 10);
    const rateCard = lookupRate(material_id, effectiveDateStr);
    if (!rateCard) {
      return res.status(400).json({ code: "RATE_NOT_FOUND", message: `No active rate card on record for material code '${material.code}' on or before effective date ${effectiveDateStr}.` });
    }

    try {
      const originalQuantity = Number(quantity);
      const convertedQuantity = convertUOM(originalQuantity, uom, material.std_unit);
      const wasteMod = Number(waste_modifier !== undefined ? waste_modifier : 1.0);
      const effectiveQuantity = convertedQuantity * wasteMod;
      const wasteQuantity = effectiveQuantity - convertedQuantity;
      const rate = Number(rateCard.rate);
      const materialSubtotal = effectiveQuantity * rate;

      const conversionRatio = originalQuantity !== 0 ? convertedQuantity / originalQuantity : 1.0;
      const conversionApplied = normalizeUOM(uom) !== normalizeUOM(material.std_unit) 
        ? `${originalQuantity} ${uom} -> ${convertedQuantity} ${material.std_unit}` 
        : "None";

      const explanation = `Converted ${originalQuantity} ${uom} to ${convertedQuantity} ${material.std_unit}. Applied waste factor ${wasteMod} to get ${effectiveQuantity} ${material.std_unit}. Multiplied with rate Rs.${rate}/${rateCard.rate_unit}.`;

      const auditTrail = {
        bom_line_id,
        material_id,
        material_code: material.code,
        rate_card_id: rateCard.id,
        effective_date_used: effectiveDateStr,
        conversion_ratio: conversionRatio,
        conversion_applied: conversionApplied,
        waste_factor_applied: wasteMod,
        original_quantity: originalQuantity,
        original_uom: uom,
        resolved_quantity: convertedQuantity,
        resolved_uom: material.std_unit,
        effective_quantity: effectiveQuantity,
        rate_used: rate,
        calculated_subtotal: materialSubtotal,
        explanation
      };

      res.status(200).json({
        bom_line_id,
        material_id,
        material_code: material.code,
        rate_card_id: rateCard.id,
        rate,
        rate_unit: rateCard.rate_unit,
        original_quantity: originalQuantity,
        original_uom: uom,
        resolved_quantity: convertedQuantity,
        resolved_uom: material.std_unit,
        waste_modifier: wasteMod,
        waste_quantity: wasteQuantity,
        effective_quantity: effectiveQuantity,
        material_subtotal: materialSubtotal,
        effective_date_used: effectiveDateStr,
        conversion_applied: conversionApplied,
        waste_factor_applied: wasteMod,
        calculation_explanation: explanation,
        audit_trail_json: JSON.stringify(auditTrail)
      });
    } catch (err: any) {
      return res.status(400).json({ code: "CALCULATION_ERROR", message: err.message });
    }
  });

  app.post("/api/v1/cost-sheets/material-preview", requireAuth, (req: any, res: any) => {
    const { bom_line_id, material_id, quantity, uom, waste_modifier, effective_date } = req.body;
    if (!material_id || quantity === undefined || !uom) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "material_id, quantity, and uom are required parameters." });
    }

    const material = (db.materials || []).find((m: any) => m.id === material_id && !m.is_deleted);
    if (!material) {
      return res.status(404).json({ code: "MATERIAL_NOT_FOUND", message: `Material Master record not found for ID '${material_id}'.` });
    }

    const effectiveDateStr = effective_date || new Date().toISOString().slice(0, 10);
    const rateCard = lookupRate(material_id, effectiveDateStr);
    if (!rateCard) {
      return res.status(400).json({ code: "RATE_NOT_FOUND", message: `No active rate card on record for material code '${material.code}' on or before effective date ${effectiveDateStr}.` });
    }

    try {
      const originalQuantity = Number(quantity);
      const convertedQuantity = convertUOM(originalQuantity, uom, material.std_unit);
      const wasteMod = Number(waste_modifier !== undefined ? waste_modifier : 1.0);
      const effectiveQuantity = convertedQuantity * wasteMod;
      const wasteQuantity = effectiveQuantity - convertedQuantity;
      const rate = Number(rateCard.rate);
      const materialSubtotal = effectiveQuantity * rate;

      const conversionRatio = originalQuantity !== 0 ? convertedQuantity / originalQuantity : 1.0;
      const conversionApplied = normalizeUOM(uom) !== normalizeUOM(material.std_unit) 
        ? `${originalQuantity} ${uom} -> ${convertedQuantity} ${material.std_unit}` 
        : "None";

      const explanation = `Converted ${originalQuantity} ${uom} to ${convertedQuantity} ${material.std_unit}. Applied waste factor ${wasteMod} to get ${effectiveQuantity} ${material.std_unit}. Multiplied with rate Rs.${rate}/${rateCard.rate_unit}.`;

      const auditTrail = {
        bom_line_id,
        material_id,
        material_code: material.code,
        rate_card_id: rateCard.id,
        effective_date_used: effectiveDateStr,
        conversion_ratio: conversionRatio,
        conversion_applied: conversionApplied,
        waste_factor_applied: wasteMod,
        original_quantity: originalQuantity,
        original_uom: uom,
        resolved_quantity: convertedQuantity,
        resolved_uom: material.std_unit,
        effective_quantity: effectiveQuantity,
        rate_used: rate,
        calculated_subtotal: materialSubtotal,
        explanation
      };

      res.status(200).json({
        bom_line_id,
        material_id,
        material_code: material.code,
        rate_card_id: rateCard.id,
        rate,
        rate_unit: rateCard.rate_unit,
        original_quantity: originalQuantity,
        original_uom: uom,
        resolved_quantity: convertedQuantity,
        resolved_uom: material.std_unit,
        waste_modifier: wasteMod,
        waste_quantity: wasteQuantity,
        effective_quantity: effectiveQuantity,
        material_subtotal: materialSubtotal,
        effective_date_used: effectiveDateStr,
        conversion_applied: conversionApplied,
        waste_factor_applied: wasteMod,
        calculation_explanation: explanation,
        audit_trail_json: JSON.stringify(auditTrail)
      });
    } catch (err: any) {
      return res.status(400).json({ code: "CALCULATION_ERROR", message: err.message });
    }
  });



  const handleProcessCalculation = (req: any, res: any) => {
    const { bom_line_id, process_id, quantity, thickness, sub_type, effective_date } = req.body;
    if (!process_id || quantity === undefined) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "process_id and quantity are required parameters." });
    }

    const processItem = (db.processes || []).find((p: any) => p.id === process_id && !p.is_deleted);
    if (!processItem) {
      return res.status(404).json({ code: "PROCESS_NOT_FOUND", message: `Process Master record not found for ID '${process_id}'.` });
    }
    if (!processItem.is_active) {
      return res.status(400).json({ code: "INACTIVE_PROCESS", message: `Process '${processItem.name}' is inactive. Cannot perform active billing operations.` });
    }

    const driverType = (processItem.driver_type || "").toUpperCase().trim();
    let normDriver = driverType;
    if (normDriver === "THICKNESS") {
      normDriver = sub_type ? "PER_METER" : "PER_CUT";
    } else if (normDriver === "STROKES") {
      normDriver = "PER_STROKE";
    } else if (normDriver === "HOURS" || normDriver === "PASSES") {
      normDriver = "PER_HOUR";
    } else if (normDriver === "AREA") {
      normDriver = "PER_SQ_METER";
    }

    let resolvedSubtype: string | null = null;
    let resolvedThickness: number | null = null;

    const errors: { field: string; message: string }[] = [];

    if (normDriver === "PER_METER") {
      if (thickness === undefined || thickness === null) {
        errors.push({ field: "thickness", message: "Missing required physical thickness value under dynamic thickness driver rule." });
      } else {
        const tVal = Number(thickness);
        if (tVal <= 0) {
          errors.push({ field: "thickness", message: "Thickness constraint values must be strictly greater than 0 mm." });
        } else {
          resolvedThickness = tVal;
        }
      }
      if (!sub_type || !sub_type.trim()) {
        errors.push({ field: "sub_type", message: "Missing required dynamic material specification / sub-type key." });
      } else {
        resolvedSubtype = sub_type.trim().toUpperCase();
      }
    } else if (normDriver === "PER_CUT") {
      if (thickness === undefined || thickness === null) {
        errors.push({ field: "thickness", message: "Missing required physical thickness value under dynamic thickness driver rule." });
      } else {
        const tVal = Number(thickness);
        if (tVal <= 0) {
          errors.push({ field: "thickness", message: "Thickness constraint values must be strictly greater than 0 mm." });
        } else {
          resolvedThickness = tVal;
        }
      }
    } else if (normDriver === "PER_STROKE") {
      if (thickness !== undefined && thickness !== null) {
        errors.push({ field: "thickness", message: "Thickness constraints are not supported under process driver 'PER_STROKE'." });
      }
      if (sub_type && sub_type.trim() !== "" && sub_type.trim().toUpperCase() !== "BENDING") {
        errors.push({ field: "sub_type", message: "Custom sub_type not permitted. Process driver 'PER_STROKE' forces a static value of 'Bending'." });
      }
      resolvedSubtype = "Bending";
    } else if (normDriver === "PER_HOUR") {
      if (thickness !== undefined && thickness !== null) {
        errors.push({ field: "thickness", message: "Thickness constraints are not supported under process driver 'PER_HOUR'." });
      }
      if (sub_type && sub_type.trim() !== "" && sub_type.trim().toUpperCase() !== "WELDING") {
        errors.push({ field: "sub_type", message: "Custom sub_type not permitted. Process driver 'PER_HOUR' forces a static value of 'Welding'." });
      }
      resolvedSubtype = "Welding";
    } else if (normDriver === "PER_SQ_METER") {
      if (thickness !== undefined && thickness !== null) {
        errors.push({ field: "thickness", message: "Thickness constraints are not supported under process driver 'PER_SQ_METER'." });
      }
      if (!sub_type || !sub_type.trim()) {
        errors.push({ field: "sub_type", message: "Missing required dynamic material specification / sub-type key." });
      } else {
        resolvedSubtype = sub_type.trim().toUpperCase();
      }
    } else {
      errors.push({ field: "driver_type", message: `Driver configuration '${processItem.driver_type}' is unsupported or unregistered.` });
    }

    if (errors.length > 0) {
      const errDetails = errors.map(e => `${e.field}: ${e.message}`).join("; ");
      return res.status(400).json({ code: "VALIDATION_FAILED", message: `Driver Validation Failure for process '${processItem.name}': ${errDetails}` });
    }

    const lookupDate = effective_date ? new Date(effective_date) : new Date();
    const activeRates = (db.rates || []).filter((r: any) => {
      if (r.process_id !== process_id || r.is_deleted || !r.is_active) return false;
      
      const rDate = new Date(r.effective_date);
      if (rDate > lookupDate) return false;

      if (resolvedSubtype !== null) {
        if (!r.sub_type || r.sub_type.toUpperCase() !== resolvedSubtype.toUpperCase()) return false;
      } else {
        if (r.sub_type) return false;
      }

      return true;
    });

    const matchedRates = activeRates.filter((r: any) => {
      if (resolvedThickness !== null) {
        const tFrom = r.thickness_from !== null && r.thickness_from !== undefined ? Number(r.thickness_from) : 0;
        const tTo = r.thickness_to !== null && r.thickness_to !== undefined ? Number(r.thickness_to) : 999999.9999;
        return resolvedThickness >= tFrom && resolvedThickness <= tTo;
      } else {
        return r.thickness_from === null && r.thickness_to === null;
      }
    });

    if (matchedRates.length === 0) {
      const specStr: string[] = [];
      if (resolvedSubtype) specStr.push(`Sub-type: ${resolvedSubtype}`);
      if (resolvedThickness) specStr.push(`Thickness: ${resolvedThickness}mm`);
      const specJoined = specStr.join(", ") || "default metrics";
      return res.status(400).json({
        code: "RATE_NOT_FOUND",
        message: `No active Rate Card found for Process '${processItem.name}' matching specifications [${specJoined}] active on or before effective date ${lookupDate.toISOString().slice(0, 10)}.`
      });
    }

    matchedRates.sort((a: any, b: any) => {
      const da = new Date(a.effective_date).getTime();
      const dbVal = new Date(b.effective_date).getTime();
      if (da !== dbVal) return dbVal - da;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const rateCard = matchedRates[0];
    const rate = Number(rateCard.rate);
    const originalQuantity = Number(quantity);
    const processCost = originalQuantity * rate;

    const formula = `${originalQuantity} * ${rate} = ${processCost}`;
    const explanation = `Calculated process cost for '${processItem.name}' (driver: ${processItem.driver_type}). Multiplied driver quantity ${originalQuantity} with rate Rs.${rate}/${rateCard.rate_unit}.`;

    const auditTrail = {
      bom_line_id,
      process_id,
      process_code: processItem.name,
      driver_type: processItem.driver_type,
      driver_inputs: {
        thickness,
        sub_type
      },
      resolved_subtype: rateCard.sub_type,
      resolved_thickness: rateCard.thickness_from !== null ? Number(rateCard.thickness_from) : null,
      rate_card_id: rateCard.id,
      effective_date_used: rateCard.effective_date,
      calculation_formula: formula,
      calculated_cost: processCost,
      explanation
    };

    return res.status(200).json({
      bom_line_id,
      process_id,
      process_code: processItem.name,
      rate_card_id: rateCard.id,
      rate,
      rate_unit: rateCard.rate_unit,
      driver_quantity: originalQuantity,
      resolved_driver_type: processItem.driver_type,
      resolved_subtype: rateCard.sub_type,
      resolved_thickness: rateCard.thickness_from !== null ? Number(rateCard.thickness_from) : null,
      process_cost: processCost,
      effective_date_used: rateCard.effective_date,
      calculation_formula: formula,
      audit_trail_json: JSON.stringify(auditTrail)
    });
  };

  app.post("/api/v1/cost-sheets/calculate-process", requireAuth, handleProcessCalculation);
  app.post("/api/v1/cost-sheets/process-preview", requireAuth, handleProcessCalculation);


  // ==========================================
  // SPRINT 4A: PURCHASE REQUISITION FOUNDATION
  // ==========================================

  function recordPrHistory(
    prId: string,
    approvalLevel: number,
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    previousStatus: string,
    newStatus: string,
    comments: string
  ) {
    if (!db.purchase_requisition_histories) db.purchase_requisition_histories = [];
    const record: PurchaseRequisitionHistory = {
      id: "prhist-" + crypto.randomUUID(),
      purchase_requisition_id: prId,
      approval_level: approvalLevel,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action,
      previous_status: previousStatus,
      new_status: newStatus,
      comments,
      timestamp: new Date().toISOString()
    };
    db.purchase_requisition_histories.push(record);
    saveDB();
  }

  const generatePRNumber = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sameDayPrs = (db.purchase_requisitions || []).filter((pr: any) => pr.pr_number.startsWith(`PR-${todayStr}-`));
    const seq = sameDayPrs.length + 1;
    const seqStr = seq.toString().padStart(3, "0");
    return `PR-${todayStr}-${seqStr}`;
  };

  // GET /api/v1/purchase-requisitions
  app.get("/api/v1/purchase-requisitions", requireAuth, (req: any, res: any) => {
    const prs = (db.purchase_requisitions || []).filter((p: any) => !p.is_deleted);
    const result = prs.map((pr: any) => {
      const lines = (db.purchase_requisition_lines || []).filter((l: any) => l.purchase_requisition_id === pr.id && !l.is_deleted);
      const total_materials = lines.length;
      const total_quantity = lines.reduce((acc: number, l: any) => acc + (l.required_quantity || 0), 0);
      const estimated_procurement_value = lines.reduce((acc: number, l: any) => acc + (l.estimated_amount || 0), 0);
      return {
        ...pr,
        total_materials,
        total_quantity,
        estimated_procurement_value
      };
    });
    res.json(result);
  });

  // GET /api/v1/purchase-requisitions/:id
  app.get("/api/v1/purchase-requisitions/:id", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "NOT_FOUND", message: "Purchase Requisition not found" });
    const lines = (db.purchase_requisition_lines || []).filter((l: any) => l.purchase_requisition_id === pr.id && !l.is_deleted);
    const history = (db.purchase_requisition_histories || []).filter((h: any) => h.purchase_requisition_id === pr.id);
    res.json({ ...pr, lines, history });
  });

  // POST /api/v1/purchase-requisitions
  app.post("/api/v1/purchase-requisitions", requireAuth, (req: any, res: any) => {
    const { department, project, priority, remarks, estimate_id, bom_header_id, lines } = req.body;

    if (!department || !project) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Department and Project are required." });
    }

    const prId = "pr-" + crypto.randomUUID();
    const pr_number = generatePRNumber();

    const newPr: PurchaseRequisition = {
      id: prId,
      pr_number,
      pr_date: new Date().toISOString().slice(0, 10),
      department,
      project,
      estimate_id: estimate_id || "",
      bom_header_id: bom_header_id || "",
      requested_by: req.user.email,
      priority: priority || "MEDIUM",
      status: "DRAFT",
      remarks: remarks || "",
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_by: req.user.email,
      updated_at: new Date().toISOString(),
      is_deleted: false,
      current_approval_level: null,
      current_approver_role: null,
      pending_approval: false
    };

    const createdLines: PurchaseRequisitionLine[] = [];
    if (Array.isArray(lines)) {
      for (const l of lines) {
        if (l.required_quantity <= 0) {
          return res.status(422).json({ code: "INVALID_QUANTITY", message: "Validation error: Required quantity must be greater than zero." });
        }
        const material = (db.materials || []).find((m: any) => m.id === l.material_id && !m.is_deleted);
        if (!material) {
          return res.status(400).json({ code: "MATERIAL_NOT_FOUND", message: "Material master not found." });
        }
        if (material.is_active === false) {
          return res.status(400).json({ code: "INACTIVE_MATERIAL", message: `Material ${material.code} is inactive.` });
        }

        const line: PurchaseRequisitionLine = {
          id: "prline-" + crypto.randomUUID(),
          purchase_requisition_id: prId,
          material_id: l.material_id,
          material_code: material.code,
          description: l.description || material.description,
          required_quantity: Number(l.required_quantity),
          uom: l.uom || material.std_unit,
          required_date: l.required_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          estimated_unit_rate: Number(l.estimated_unit_rate) || material.last_rate || 0,
          estimated_amount: Number(l.required_quantity) * (Number(l.estimated_unit_rate) || material.last_rate || 0),
          remarks: l.remarks || "",
          status: "PENDING",
          is_deleted: false
        };
        createdLines.push(line);
      }
    }

    db.purchase_requisitions.push(newPr);
    db.purchase_requisition_lines.push(...createdLines);

    recordPrHistory(prId, 0, req.user.id, req.user.name || req.user.email, req.user.role, "CREATE", "NONE", "DRAFT", "Purchase Requisition drafted manually.");
    addAuditLog(req.user.id, req.user.email, "PR_CREATION", `Created Purchase Requisition ${pr_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({ ...newPr, lines: createdLines });
  });

  // PUT /api/v1/purchase-requisitions/:id
  app.put("/api/v1/purchase-requisitions/:id", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "NOT_FOUND", message: "Purchase Requisition not found" });

    if (pr.status !== "DRAFT") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only Purchase Requisitions in DRAFT status can be modified." });
    }

    const { department, project, priority, remarks, lines } = req.body;
    if (department !== undefined) pr.department = department;
    if (project !== undefined) pr.project = project;
    if (priority !== undefined) pr.priority = priority;
    if (remarks !== undefined) pr.remarks = remarks;
    pr.updated_by = req.user.email;
    pr.updated_at = new Date().toISOString();

    if (Array.isArray(lines)) {
      db.purchase_requisition_lines = (db.purchase_requisition_lines || []).filter((l: any) => l.purchase_requisition_id !== pr.id);

      for (const l of lines) {
        if (l.required_quantity <= 0) {
          return res.status(422).json({ code: "INVALID_QUANTITY", message: "Validation error: Required quantity must be greater than zero." });
        }
        const material = (db.materials || []).find((m: any) => m.id === l.material_id && !m.is_deleted);
        if (!material) {
          return res.status(400).json({ code: "MATERIAL_NOT_FOUND", message: "Material master not found." });
        }
        if (material.is_active === false) {
          return res.status(400).json({ code: "INACTIVE_MATERIAL", message: `Material ${material.code} is inactive.` });
        }

        const line: PurchaseRequisitionLine = {
          id: "prline-" + crypto.randomUUID(),
          purchase_requisition_id: pr.id,
          material_id: l.material_id,
          material_code: material.code,
          description: l.description || material.description,
          required_quantity: Number(l.required_quantity),
          uom: l.uom || material.std_unit,
          required_date: l.required_date || new Date().toISOString().slice(0, 10),
          estimated_unit_rate: Number(l.estimated_unit_rate) || material.last_rate || 0,
          estimated_amount: Number(l.required_quantity) * (Number(l.estimated_unit_rate) || material.last_rate || 0),
          remarks: l.remarks || "",
          status: "PENDING",
          is_deleted: false
        };
        db.purchase_requisition_lines.push(line);
      }
    }

    addAuditLog(req.user.id, req.user.email, "PR_UPDATE", `Updated Purchase Requisition ${pr.pr_number}`, "SUCCESS");
    saveDB();

    const updatedLines = (db.purchase_requisition_lines || []).filter((l: any) => l.purchase_requisition_id === pr.id && !l.is_deleted);
    res.json({ ...pr, lines: updatedLines });
  });

  // POST /api/v1/purchase-requisitions/:id/submit
  app.post("/api/v1/purchase-requisitions/:id/submit", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "NOT_FOUND", message: "Purchase Requisition not found" });

    if (pr.status !== "DRAFT") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only DRAFT Purchase Requisitions can be submitted." });
    }

    const activeLevels = (db.approval_matrices || []).filter((m: any) => m.is_active).sort((a: any, b: any) => a.sequence_order - b.sequence_order);
    const prevStatus = pr.status;

    if (activeLevels.length === 0) {
      pr.status = "APPROVED";
      pr.current_approval_level = null;
      pr.current_approver_role = null;
      pr.pending_approval = false;

      recordPrHistory(pr.id, 0, "SYSTEM", "SYSTEM", "SYSTEM", "SUBMIT_AUTO_APPROVE", prevStatus, "APPROVED", "Auto-approved as no approval levels are defined.");
    } else {
      pr.status = "UNDER_REVIEW";
      pr.current_approval_level = activeLevels[0].approval_level;
      pr.current_approver_role = activeLevels[0].role;
      pr.pending_approval = true;

      recordPrHistory(pr.id, activeLevels[0].approval_level, req.user.id, req.user.name || req.user.email, req.user.role, "SUBMIT", prevStatus, "UNDER_REVIEW", "Submitted for multi-level procurement review.");
    }

    pr.updated_by = req.user.email;
    pr.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PR_SUBMISSION", `Submitted Purchase Requisition ${pr.pr_number}`, "SUCCESS");
    saveDB();

    res.json(pr);
  });

  // POST /api/v1/purchase-requisitions/:id/approve
  app.post("/api/v1/purchase-requisitions/:id/approve", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "NOT_FOUND", message: "Purchase Requisition not found" });

    if (pr.status !== "UNDER_REVIEW") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only Purchase Requisitions in UNDER_REVIEW status can be approved." });
    }

    if (req.user.role !== pr.current_approver_role) {
      return res.status(403).json({ code: "FORBIDDEN", message: `Unauthorized: only role '${pr.current_approver_role}' can approve at this level.` });
    }

    const activeLevels = (db.approval_matrices || []).filter((m: any) => m.is_active).sort((a: any, b: any) => a.sequence_order - b.sequence_order);
    const currentIdx = activeLevels.findIndex((l: any) => l.approval_level === pr.current_approval_level);
    const nextIdx = currentIdx + 1;
    const prevStatus = pr.status;
    const prevLevel = pr.current_approval_level || 0;

    if (nextIdx < activeLevels.length) {
      pr.current_approval_level = activeLevels[nextIdx].approval_level;
      pr.current_approver_role = activeLevels[nextIdx].role;
      pr.pending_approval = true;

      recordPrHistory(pr.id, prevLevel, req.user.id, req.user.name || req.user.email, req.user.role, "APPROVE", prevStatus, "UNDER_REVIEW", req.body.notes || `Approved Level ${prevLevel}. Forwarded to Level ${pr.current_approval_level}.`);
    } else {
      pr.status = "APPROVED";
      pr.current_approval_level = null;
      pr.current_approver_role = null;
      pr.pending_approval = false;

      recordPrHistory(pr.id, prevLevel, req.user.id, req.user.name || req.user.email, req.user.role, "APPROVE", prevStatus, "APPROVED", req.body.notes || `Approved Final Level ${prevLevel}. Purchase Requisition status set to APPROVED.`);
    }

    pr.updated_by = req.user.email;
    pr.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PR_APPROVAL", `Approved Purchase Requisition ${pr.pr_number} at Level ${prevLevel}`, "SUCCESS");
    saveDB();

    res.json(pr);
  });

  // POST /api/v1/purchase-requisitions/:id/cancel
  app.post("/api/v1/purchase-requisitions/:id/cancel", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "NOT_FOUND", message: "Purchase Requisition not found" });

    const prevStatus = pr.status;
    pr.status = "CANCELLED";
    pr.current_approval_level = null;
    pr.current_approver_role = null;
    pr.pending_approval = false;
    pr.updated_by = req.user.email;
    pr.updated_at = new Date().toISOString();

    recordPrHistory(pr.id, 0, req.user.id, req.user.name || req.user.email, req.user.role, "CANCEL", prevStatus, "CANCELLED", req.body.notes || "Purchase Requisition cancelled.");
    addAuditLog(req.user.id, req.user.email, "PR_CANCELLATION", `Cancelled Purchase Requisition ${pr.pr_number}`, "SUCCESS");
    saveDB();

    res.json(pr);
  });

  // POST /api/v1/purchase-requisitions/from-estimate/:estimateId
  app.post("/api/v1/purchase-requisitions/from-estimate/:estimateId", requireAuth, (req: any, res: any) => {
    const estimate = (db.estimates || []).find((e: any) => e.id === req.params.estimateId && !e.is_deleted);
    if (!estimate) {
      return res.status(404).json({ code: "ESTIMATE_NOT_FOUND", message: "Estimate not found." });
    }

    if (estimate.status !== "APPROVED") {
      return res.status(400).json({
        code: "ESTIMATE_NOT_APPROVED",
        message: "Generation blocked. Purchase Requisition can only be generated from an APPROVED estimate."
      });
    }

    const activePR = (db.purchase_requisitions || []).find((p: any) => p.estimate_id === estimate.id && p.status !== "CANCELLED" && !p.is_deleted);
    if (activePR && !req.body.allow_duplicate) {
      return res.status(400).json({
        code: "DUPLICATE_REQUISITION",
        message: `Generation blocked. An active Purchase Requisition '${activePR.pr_number}' already exists for this Estimate.`
      });
    }

    const bomHeaderId = estimate.bom_header_id;
    if (!bomHeaderId) {
      return res.status(400).json({ code: "BOM_NOT_FOUND", message: "No BOM is associated with this Estimate." });
    }

    const bomLines = (db.bom_lines || []).filter((l: any) => l.bom_header_id === bomHeaderId && !l.is_deleted);
    const materialLines = bomLines.filter((l: any) => l.line_type === "MATERIAL");

    if (materialLines.length === 0) {
      return res.status(400).json({ code: "NO_MATERIAL_LINES", message: "No eligible Material lines found in the latest approved BOM." });
    }

    const costSheetLines = estimate.cost_sheet_id 
      ? (db.cost_sheet_lines || []).filter((cl: any) => cl.cost_sheet_header_id === estimate.cost_sheet_id && !cl.is_deleted)
      : [];

    const consolidatedLines: { [materialId: string]: { 
      quantity: number; 
      total_amount: number; 
      bomLine: any; 
      material: any;
    } } = {};

    for (const bomLine of materialLines) {
      const materialId = bomLine.material_id;
      if (!materialId) continue;

      const mat = (db.materials || []).find((m: any) => m.id === materialId && !m.is_deleted);
      if (!mat) {
        return res.status(400).json({
          code: "MATERIAL_NOT_FOUND",
          message: `BOM refers to missing material with ID '${materialId}'.`
        });
      }

      if (mat.is_active === false) {
        return res.status(400).json({
          code: "INACTIVE_MATERIAL",
          message: `Generation rejected: Material '${mat.code}' (${mat.description}) is inactive.`
        });
      }

      if (bomLine.quantity <= 0) {
        return res.status(422).json({
          code: "INVALID_QUANTITY",
          message: `Validation error: BOM material line '${bomLine.description || mat.description}' has a zero or negative quantity (${bomLine.quantity}).`
        });
      }

      const costLine = costSheetLines.find((cl: any) => cl.bom_line_id === bomLine.id && !cl.is_deleted);
      const estimated_unit_rate = costLine ? costLine.base_rate : (mat.last_rate || 0);
      const estimated_amount = costLine ? costLine.calculated_subtotal : (estimated_unit_rate * bomLine.quantity);

      if (consolidatedLines[materialId]) {
        consolidatedLines[materialId].quantity += bomLine.quantity;
        consolidatedLines[materialId].total_amount += estimated_amount;
      } else {
        consolidatedLines[materialId] = {
          quantity: bomLine.quantity,
          total_amount: estimated_amount,
          bomLine,
          material: mat
        };
      }
    }

    const prId = "pr-" + crypto.randomUUID();
    const pr_number = generatePRNumber();

    const newPr: PurchaseRequisition = {
      id: prId,
      pr_number,
      pr_date: new Date().toISOString().slice(0, 10),
      department: "Procurement Division",
      project: estimate.description || "Estimate Requisition",
      estimate_id: estimate.id,
      bom_header_id: bomHeaderId,
      requested_by: req.user.email,
      priority: "MEDIUM",
      status: "DRAFT",
      remarks: `Auto-generated from Approved Estimate ${estimate.estimate_number}.`,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_by: req.user.email,
      updated_at: new Date().toISOString(),
      is_deleted: false,
      current_approval_level: null,
      current_approver_role: null,
      pending_approval: false
    };

    const createdLines: PurchaseRequisitionLine[] = [];
    for (const [matId, data] of Object.entries(consolidatedLines)) {
      const final_rate = data.total_amount / data.quantity;
      const line: PurchaseRequisitionLine = {
        id: "prline-" + crypto.randomUUID(),
        purchase_requisition_id: prId,
        material_id: matId,
        material_code: data.material.code,
        description: data.bomLine.description || data.material.description,
        required_quantity: data.quantity,
        uom: data.bomLine.uom || data.material.std_unit,
        required_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        estimated_unit_rate: final_rate,
        estimated_amount: data.total_amount,
        remarks: data.bomLine.remarks || "",
        status: "PENDING",
        is_deleted: false
      };
      createdLines.push(line);
    }

    db.purchase_requisitions.push(newPr);
    db.purchase_requisition_lines.push(...createdLines);

    recordPrHistory(prId, 0, "SYSTEM", "SYSTEM", "SYSTEM", "GENERATE", "NONE", "DRAFT", `Auto-generated from approved estimate ${estimate.estimate_number}.`);
    addAuditLog(req.user.id, req.user.email, "PR_GENERATION", `Generated Purchase Requisition ${pr_number} from Estimate ${estimate.estimate_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({ ...newPr, lines: createdLines });
  });

  // POST /api/v1/purchase-requisitions/from-bom/:bomId
  app.post("/api/v1/purchase-requisitions/from-bom/:bomId", requireAuth, (req: any, res: any) => {
    const bom = (db.boms || []).find((b: any) => b.id === req.params.bomId && !b.is_deleted);
    if (!bom) {
      return res.status(404).json({ code: "BOM_NOT_FOUND", message: "BOM not found." });
    }

    const bomLines = (db.bom_lines || []).filter((l: any) => l.bom_header_id === bom.id && !l.is_deleted);
    const materialLines = bomLines.filter((l: any) => l.line_type === "MATERIAL");

    if (materialLines.length === 0) {
      return res.status(400).json({ code: "NO_MATERIAL_LINES", message: "No eligible Material lines found in this BOM." });
    }

    const activePR = (db.purchase_requisitions || []).find((p: any) => p.bom_header_id === bom.id && p.status !== "CANCELLED" && !p.is_deleted);
    if (activePR && !req.body.allow_duplicate) {
      return res.status(400).json({
        code: "DUPLICATE_REQUISITION",
        message: `Generation blocked. An active Purchase Requisition '${activePR.pr_number}' already exists for this BOM.`
      });
    }

    const consolidatedLines: { [materialId: string]: { 
      quantity: number; 
      total_amount: number; 
      bomLine: any; 
      material: any;
    } } = {};

    for (const bomLine of materialLines) {
      const materialId = bomLine.material_id;
      if (!materialId) continue;

      const mat = (db.materials || []).find((m: any) => m.id === materialId && !m.is_deleted);
      if (!mat) {
        return res.status(400).json({
          code: "MATERIAL_NOT_FOUND",
          message: `BOM refers to missing material with ID '${materialId}'.`
        });
      }

      if (mat.is_active === false) {
        return res.status(400).json({
          code: "INACTIVE_MATERIAL",
          message: `Generation rejected: Material '${mat.code}' (${mat.description}) is inactive.`
        });
      }

      if (bomLine.quantity <= 0) {
        return res.status(422).json({
          code: "INVALID_QUANTITY",
          message: `Validation error: BOM material line '${bomLine.description || mat.description}' has a zero or negative quantity (${bomLine.quantity}).`
        });
      }

      const estimated_unit_rate = mat.last_rate || 0;
      const estimated_amount = estimated_unit_rate * bomLine.quantity;

      if (consolidatedLines[materialId]) {
        consolidatedLines[materialId].quantity += bomLine.quantity;
        consolidatedLines[materialId].total_amount += estimated_amount;
      } else {
        consolidatedLines[materialId] = {
          quantity: bomLine.quantity,
          total_amount: estimated_amount,
          bomLine,
          material: mat
        };
      }
    }

    const prId = "pr-" + crypto.randomUUID();
    const pr_number = generatePRNumber();

    const newPr: PurchaseRequisition = {
      id: prId,
      pr_number,
      pr_date: new Date().toISOString().slice(0, 10),
      department: "Procurement Division",
      project: bom.description || "BOM Requisition",
      estimate_id: "",
      bom_header_id: bom.id,
      requested_by: req.user.email,
      priority: "MEDIUM",
      status: "DRAFT",
      remarks: `Auto-generated from BOM ${bom.part_number}.`,
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_by: req.user.email,
      updated_at: new Date().toISOString(),
      is_deleted: false,
      current_approval_level: null,
      current_approver_role: null,
      pending_approval: false
    };

    const createdLines: PurchaseRequisitionLine[] = [];
    for (const [matId, data] of Object.entries(consolidatedLines)) {
      const final_rate = data.total_amount / data.quantity;
      const line: PurchaseRequisitionLine = {
        id: "prline-" + crypto.randomUUID(),
        purchase_requisition_id: prId,
        material_id: matId,
        material_code: data.material.code,
        description: data.bomLine.description || data.material.description,
        required_quantity: data.quantity,
        uom: data.bomLine.uom || data.material.std_unit,
        required_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        estimated_unit_rate: final_rate,
        estimated_amount: data.total_amount,
        remarks: data.bomLine.remarks || "",
        status: "PENDING",
        is_deleted: false
      };
      createdLines.push(line);
    }

    db.purchase_requisitions.push(newPr);
    db.purchase_requisition_lines.push(...createdLines);

    recordPrHistory(prId, 0, "SYSTEM", "SYSTEM", "SYSTEM", "GENERATE", "NONE", "DRAFT", `Auto-generated from BOM ${bom.part_number}.`);
    addAuditLog(req.user.id, req.user.email, "PR_GENERATION", `Generated Purchase Requisition ${pr_number} from BOM ${bom.part_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({ ...newPr, lines: createdLines });
  });


  // ==========================================
  // SPRINT 4B - VENDOR MASTER & MANAGEMENT APIS
  // ==========================================

  // helper to generate vendor code
  function generateVendorCode() {
    const year = new Date().getFullYear();
    const count = (db.vendors || []).length + 1;
    return `VND-${year}-${count.toString().padStart(4, "0")}`;
  }

  // GET /api/v1/vendors
  app.get("/api/v1/vendors", requireAuth, (req: any, res: any) => {
    const list = (db.vendors || []).filter(v => !v.is_deleted);
    res.json(list);
  });

  // GET /api/v1/vendors/:id
  app.get("/api/v1/vendors/:id", requireAuth, (req: any, res: any) => {
    const vendor = (db.vendors || []).find(v => v.id === req.params.id && !v.is_deleted);
    if (!vendor) {
      return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor record not found." });
    }

    const addresses = (db.vendor_addresses || []).filter(a => a.vendor_id === vendor.id && !a.is_deleted);
    const banks = (db.vendor_banks || []).filter(b => b.vendor_id === vendor.id && !b.is_deleted);
    const ratings = (db.vendor_ratings || []).find(r => r.vendor_id === vendor.id && !r.is_deleted) || {
      quality_rating: 0,
      delivery_rating: 0,
      price_rating: 0,
      service_rating: 0,
      overall_rating: 0
    };
    const materialsMapped = (db.vendor_material_mappings || []).filter(m => m.vendor_id === vendor.id && !m.is_deleted).map(m => {
      const mat = (db.materials || []).find(item => item.id === m.material_id);
      return {
        ...m,
        material_code: mat ? mat.code : "N/A",
        material_description: mat ? mat.description : "N/A",
        material_unit: mat ? mat.std_unit : "N/A"
      };
    });

    res.json({
      ...vendor,
      addresses,
      banks,
      ratings,
      materials: materialsMapped
    });
  });

  // POST /api/v1/vendors
  app.post("/api/v1/vendors", requireAuth, (req: any, res: any) => {
    const {
      vendor_name,
      legal_name,
      vendor_category,
      vendor_type,
      gstin,
      pan,
      msme_status,
      cin,
      contact_person,
      email,
      mobile,
      alternate_mobile,
      website,
      payment_terms,
      credit_days,
      currency,
      incoterms,
      delivery_terms,
      preferred_transport,
      addresses,
      banks,
      ratings
    } = req.body;

    // Standard validations
    if (!vendor_name || !legal_name || !vendor_type || !gstin || !pan || !contact_person || !email || !mobile) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Required general vendor information is missing." });
    }

    // GSTIN format check
    const gstinTrimmed = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstinTrimmed)) {
      return res.status(400).json({ code: "INVALID_GSTIN", message: "Invalid GSTIN format. Expected standard 15-character Indian GSTIN." });
    }

    // PAN format check
    const panTrimmed = pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panTrimmed)) {
      return res.status(400).json({ code: "INVALID_PAN", message: "Invalid PAN format. Expected standard 10-character Indian PAN." });
    }

    // Email format check
    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({ code: "INVALID_EMAIL", message: "Invalid Email address format." });
    }

    // Mobile check
    const mobileTrimmed = mobile.trim();
    const mobileRegex = /^\+?(\d[\s-]?){9,14}\d$/;
    if (!mobileRegex.test(mobileTrimmed)) {
      return res.status(400).json({ code: "INVALID_MOBILE", message: "Invalid Mobile number format. Expected 10-15 digit phone number." });
    }

    // Duplicate GSTIN check
    const dupGstin = (db.vendors || []).find(v => !v.is_deleted && v.gstin.toUpperCase() === gstinTrimmed);
    if (dupGstin) {
      return res.status(400).json({ code: "DUPLICATE_GSTIN", message: `A vendor with GSTIN '${gstinTrimmed}' is already registered.` });
    }

    // Duplicate Vendor Name warning
    const warnings: string[] = [];
    const dupName = (db.vendors || []).find(v => !v.is_deleted && v.vendor_name.toLowerCase() === vendor_name.trim().toLowerCase());
    if (dupName) {
      warnings.push(`Warning: A vendor with the same name '${dupName.vendor_name}' is already registered.`);
    }

    // Duplicate Bank account warning
    if (banks && Array.isArray(banks)) {
      for (const b of banks) {
        const dupAcct = (db.vendor_banks || []).find(item => !item.is_deleted && item.account_number === b.account_number);
        if (dupAcct) {
          warnings.push(`Warning: Bank account number '${b.account_number}' is already registered with another vendor.`);
        }
      }
    }

    const vendorId = "vnd-" + crypto.randomUUID();
    const vendor_code = generateVendorCode();

    const vendor: Vendor = {
      id: vendorId,
      vendor_code,
      vendor_name: vendor_name.trim(),
      legal_name: legal_name.trim(),
      vendor_category: (vendor_category || "Standard").trim(),
      vendor_type,
      gstin: gstinTrimmed,
      pan: panTrimmed,
      msme_status: !!msme_status,
      cin: cin ? cin.trim() : null,
      contact_person: contact_person.trim(),
      email: emailTrimmed,
      mobile: mobileTrimmed,
      alternate_mobile: alternate_mobile ? alternate_mobile.trim() : null,
      website: website ? website.trim() : null,
      status: "DRAFT", // Start as DRAFT
      payment_terms: (payment_terms || "Net 30").trim(),
      credit_days: Number(credit_days || 30),
      currency: (currency || "INR").trim(),
      incoterms: (incoterms || "Ex Works").trim(),
      delivery_terms: (delivery_terms || "Within 14 days").trim(),
      preferred_transport: (preferred_transport || "Road").trim(),
      created_by: req.user.email,
      created_at: new Date().toISOString(),
      updated_by: req.user.email,
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    db.vendors.push(vendor);

    // Create Addresses
    if (addresses && Array.isArray(addresses)) {
      addresses.forEach((addr: any) => {
        db.vendor_addresses.push({
          id: "addr-" + crypto.randomUUID(),
          vendor_id: vendorId,
          address_type: addr.address_type || "Registered Office",
          address_line_1: (addr.address_line_1 || "").trim(),
          address_line_2: (addr.address_line_2 || "").trim() || null,
          city: (addr.city || "").trim(),
          state: (addr.state || "").trim(),
          country: (addr.country || "India").trim(),
          pin_code: (addr.pin_code || "").trim(),
          is_deleted: false
        });
      });
    }

    // Create Banks
    if (banks && Array.isArray(banks)) {
      banks.forEach((bank: any) => {
        db.vendor_banks.push({
          id: "bnk-" + crypto.randomUUID(),
          vendor_id: vendorId,
          bank_name: (bank.bank_name || "").trim(),
          branch: (bank.branch || "").trim(),
          account_number: (bank.account_number || "").trim(),
          ifsc: (bank.ifsc || "").trim().toUpperCase(),
          account_holder: (bank.account_holder || "").trim(),
          is_deleted: false
        });
      });
    }

    // Create Rating
    db.vendor_ratings.push({
      id: "rtg-" + crypto.randomUUID(),
      vendor_id: vendorId,
      quality_rating: ratings ? Number(ratings.quality_rating || 0) : 0,
      delivery_rating: ratings ? Number(ratings.delivery_rating || 0) : 0,
      price_rating: ratings ? Number(ratings.price_rating || 0) : 0,
      service_rating: ratings ? Number(ratings.service_rating || 0) : 0,
      overall_rating: ratings ? Number(ratings.overall_rating || 0) : 0,
      is_deleted: false
    });

    addAuditLog(req.user.id, req.user.email, "VENDOR_CREATION", `Created Vendor Master record code ${vendor_code} - ${vendor.vendor_name}`, "SUCCESS");
    saveDB();

    res.status(201).json({ vendor, warnings });
  });

  // PUT /api/v1/vendors/:id
  app.put("/api/v1/vendors/:id", requireAuth, (req: any, res: any) => {
    const vendorIndex = (db.vendors || []).findIndex(v => v.id === req.params.id && !v.is_deleted);
    if (vendorIndex === -1) {
      return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor record not found." });
    }

    const currentVendor = db.vendors[vendorIndex];

    const {
      vendor_name,
      legal_name,
      vendor_category,
      vendor_type,
      gstin,
      pan,
      msme_status,
      cin,
      contact_person,
      email,
      mobile,
      alternate_mobile,
      website,
      payment_terms,
      credit_days,
      currency,
      incoterms,
      delivery_terms,
      preferred_transport,
      addresses,
      banks,
      ratings
    } = req.body;

    if (!vendor_name || !legal_name || !vendor_type || !gstin || !pan || !contact_person || !email || !mobile) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Required general vendor information is missing." });
    }

    // Validations
    const gstinTrimmed = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstinTrimmed)) {
      return res.status(400).json({ code: "INVALID_GSTIN", message: "Invalid GSTIN format." });
    }

    const panTrimmed = pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panTrimmed)) {
      return res.status(400).json({ code: "INVALID_PAN", message: "Invalid PAN format." });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({ code: "INVALID_EMAIL", message: "Invalid Email format." });
    }

    const mobileTrimmed = mobile.trim();
    const mobileRegex = /^\+?(\d[\s-]?){9,14}\d$/;
    if (!mobileRegex.test(mobileTrimmed)) {
      return res.status(400).json({ code: "INVALID_MOBILE", message: "Invalid Mobile format." });
    }

    // Duplicate GSTIN check (exclude self)
    const dupGstin = (db.vendors || []).find(v => !v.is_deleted && v.id !== req.params.id && v.gstin.toUpperCase() === gstinTrimmed);
    if (dupGstin) {
      return res.status(400).json({ code: "DUPLICATE_GSTIN", message: `Another vendor is already registered with GSTIN '${gstinTrimmed}'.` });
    }

    const warnings: string[] = [];
    const dupName = (db.vendors || []).find(v => !v.is_deleted && v.id !== req.params.id && v.vendor_name.toLowerCase() === vendor_name.trim().toLowerCase());
    if (dupName) {
      warnings.push(`Warning: A vendor with a similar name '${dupName.vendor_name}' already exists.`);
    }

    // Merge vendor details
    db.vendors[vendorIndex] = {
      ...currentVendor,
      vendor_name: vendor_name.trim(),
      legal_name: legal_name.trim(),
      vendor_category: (vendor_category || "Standard").trim(),
      vendor_type,
      gstin: gstinTrimmed,
      pan: panTrimmed,
      msme_status: !!msme_status,
      cin: cin ? cin.trim() : null,
      contact_person: contact_person.trim(),
      email: emailTrimmed,
      mobile: mobileTrimmed,
      alternate_mobile: alternate_mobile ? alternate_mobile.trim() : null,
      website: website ? website.trim() : null,
      payment_terms: (payment_terms || "Net 30").trim(),
      credit_days: Number(credit_days || 30),
      currency: (currency || "INR").trim(),
      incoterms: (incoterms || "Ex Works").trim(),
      delivery_terms: (delivery_terms || "Within 14 days").trim(),
      preferred_transport: (preferred_transport || "Road").trim(),
      updated_by: req.user.email,
      updated_at: new Date().toISOString()
    };

    // Replace Addresses
    if (addresses && Array.isArray(addresses)) {
      db.vendor_addresses.forEach(a => {
        if (a.vendor_id === req.params.id) {
          a.is_deleted = true;
        }
      });
      addresses.forEach((addr: any) => {
        db.vendor_addresses.push({
          id: addr.id || "addr-" + crypto.randomUUID(),
          vendor_id: req.params.id,
          address_type: addr.address_type || "Registered Office",
          address_line_1: (addr.address_line_1 || "").trim(),
          address_line_2: (addr.address_line_2 || "").trim() || null,
          city: (addr.city || "").trim(),
          state: (addr.state || "").trim(),
          country: (addr.country || "India").trim(),
          pin_code: (addr.pin_code || "").trim(),
          is_deleted: false
        });
      });
    }

    // Replace Banks
    if (banks && Array.isArray(banks)) {
      for (const b of banks) {
        const dupAcct = (db.vendor_banks || []).find(item => !item.is_deleted && item.vendor_id !== req.params.id && item.account_number === b.account_number);
        if (dupAcct) {
          warnings.push(`Warning: Bank account number '${b.account_number}' is registered with another vendor.`);
        }
      }

      db.vendor_banks.forEach(b => {
        if (b.vendor_id === req.params.id) {
          b.is_deleted = true;
        }
      });
      banks.forEach((bank: any) => {
        db.vendor_banks.push({
          id: bank.id || "bnk-" + crypto.randomUUID(),
          vendor_id: req.params.id,
          bank_name: (bank.bank_name || "").trim(),
          branch: (bank.branch || "").trim(),
          account_number: (bank.account_number || "").trim(),
          ifsc: (bank.ifsc || "").trim().toUpperCase(),
          account_holder: (bank.account_holder || "").trim(),
          is_deleted: false
        });
      });
    }

    // Replace or Update Rating
    const rIndex = db.vendor_ratings.findIndex(r => r.vendor_id === req.params.id && !r.is_deleted);
    if (rIndex !== -1) {
      db.vendor_ratings[rIndex] = {
        ...db.vendor_ratings[rIndex],
        quality_rating: ratings ? Number(ratings.quality_rating || 0) : 0,
        delivery_rating: ratings ? Number(ratings.delivery_rating || 0) : 0,
        price_rating: ratings ? Number(ratings.price_rating || 0) : 0,
        service_rating: ratings ? Number(ratings.service_rating || 0) : 0,
        overall_rating: ratings ? Number(ratings.overall_rating || 0) : 0
      };
    } else {
      db.vendor_ratings.push({
        id: "rtg-" + crypto.randomUUID(),
        vendor_id: req.params.id,
        quality_rating: ratings ? Number(ratings.quality_rating || 0) : 0,
        delivery_rating: ratings ? Number(ratings.delivery_rating || 0) : 0,
        price_rating: ratings ? Number(ratings.price_rating || 0) : 0,
        service_rating: ratings ? Number(ratings.service_rating || 0) : 0,
        overall_rating: ratings ? Number(ratings.overall_rating || 0) : 0,
        is_deleted: false
      });
    }

    addAuditLog(req.user.id, req.user.email, "VENDOR_UPDATE", `Updated Vendor Master record ${currentVendor.vendor_code}`, "SUCCESS");
    saveDB();

    res.json({ vendor: db.vendors[vendorIndex], warnings });
  });

  // POST /api/v1/vendors/:id/activate
  app.post("/api/v1/vendors/:id/activate", requireAuth, (req: any, res: any) => {
    const vendor = (db.vendors || []).find(v => v.id === req.params.id && !v.is_deleted);
    if (!vendor) return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor not found." });

    vendor.status = "ACTIVE";
    vendor.updated_at = new Date().toISOString();
    vendor.updated_by = req.user.email;

    addAuditLog(req.user.id, req.user.email, "VENDOR_STATUS_CHANGE", `Activated vendor ${vendor.vendor_code}`, "SUCCESS");
    saveDB();
    res.json(vendor);
  });

  // POST /api/v1/vendors/:id/block
  app.post("/api/v1/vendors/:id/block", requireAuth, (req: any, res: any) => {
    const vendor = (db.vendors || []).find(v => v.id === req.params.id && !v.is_deleted);
    if (!vendor) return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor not found." });

    vendor.status = "BLOCKED";
    vendor.updated_at = new Date().toISOString();
    vendor.updated_by = req.user.email;

    addAuditLog(req.user.id, req.user.email, "VENDOR_STATUS_CHANGE", `Blocked vendor ${vendor.vendor_code}`, "SUCCESS");
    saveDB();
    res.json(vendor);
  });

  // POST /api/v1/vendors/:id/archive
  app.post("/api/v1/vendors/:id/archive", requireAuth, (req: any, res: any) => {
    const vendor = (db.vendors || []).find(v => v.id === req.params.id && !v.is_deleted);
    if (!vendor) return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor not found." });

    vendor.status = "ARCHIVED";
    vendor.updated_at = new Date().toISOString();
    vendor.updated_by = req.user.email;

    addAuditLog(req.user.id, req.user.email, "VENDOR_STATUS_CHANGE", `Archived vendor ${vendor.vendor_code}`, "SUCCESS");
    saveDB();
    res.json(vendor);
  });

  // GET /api/v1/vendor-materials
  app.get("/api/v1/vendor-materials", requireAuth, (req: any, res: any) => {
    const mappings = (db.vendor_material_mappings || []).filter(m => !m.is_deleted);
    const joined = mappings.map(m => {
      const v = db.vendors.find(item => item.id === m.vendor_id);
      const mat = (db.materials || []).find(item => item.id === m.material_id);
      return {
        ...m,
        vendor_name: v ? v.vendor_name : "Unknown Vendor",
        vendor_code: v ? v.vendor_code : "N/A",
        vendor_status: v ? v.status : "N/A",
        material_code: mat ? mat.code : "N/A",
        material_description: mat ? mat.description : "N/A",
        material_unit: mat ? mat.std_unit : "N/A"
      };
    });
    res.json(joined);
  });

  // POST /api/v1/vendor-materials
  app.post("/api/v1/vendor-materials", requireAuth, (req: any, res: any) => {
    const {
      vendor_id,
      material_id,
      vendor_material_code,
      preferred_vendor_flag,
      last_purchase_rate,
      lead_time_days,
      moq
    } = req.body;

    if (!vendor_id || !material_id || !vendor_material_code) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Required mapping fields (Vendor ID, Material ID, Vendor Material Code) are missing." });
    }

    const v = db.vendors.find(item => item.id === vendor_id && !item.is_deleted);
    if (!v) {
      return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "The specified Vendor is not found." });
    }

    // Inactive vendors cannot be mapped to materials
    if (v.status !== "ACTIVE") {
      return res.status(400).json({ code: "INACTIVE_VENDOR_MAPPING", message: "Only ACTIVE status vendors can be mapped to materials." });
    }

    const mat = (db.materials || []).find(item => item.id === material_id && !item.is_deleted);
    if (!mat) {
      return res.status(404).json({ code: "MATERIAL_NOT_FOUND", message: "The specified Material is not found." });
    }

    // Duplicate mapping check
    const dupMapping = (db.vendor_material_mappings || []).find(item => !item.is_deleted && item.vendor_id === vendor_id && item.material_id === material_id);
    if (dupMapping) {
      return res.status(400).json({ code: "DUPLICATE_MAPPING", message: "A mapping between this vendor and material already exists." });
    }

    const isPreferred = !!preferred_vendor_flag;

    // Only one preferred vendor is allowed per material
    if (isPreferred) {
      (db.vendor_material_mappings || []).forEach(m => {
        if (m.material_id === material_id && !m.is_deleted) {
          m.preferred_vendor_flag = false;
        }
      });
    }

    const mapping: VendorMaterialMapping = {
      id: "vmm-" + crypto.randomUUID(),
      vendor_id,
      material_id,
      vendor_material_code: vendor_material_code.trim(),
      preferred_vendor_flag: isPreferred,
      last_purchase_rate: Number(last_purchase_rate || 0),
      lead_time_days: Number(lead_time_days || 0),
      moq: Number(moq || 0),
      last_updated: new Date().toISOString(),
      is_deleted: false
    };

    db.vendor_material_mappings.push(mapping);
    addAuditLog(req.user.id, req.user.email, "VENDOR_MATERIAL_MAPPING", `Mapped material ${mat.code} to vendor ${v.vendor_code}`, "SUCCESS");
    saveDB();

    res.status(201).json(mapping);
  });

  // PUT /api/v1/vendor-materials/:id
  app.put("/api/v1/vendor-materials/:id", requireAuth, (req: any, res: any) => {
    const mappingIndex = (db.vendor_material_mappings || []).findIndex(m => m.id === req.params.id && !m.is_deleted);
    if (mappingIndex === -1) {
      return res.status(404).json({ code: "MAPPING_NOT_FOUND", message: "Mapping record not found." });
    }

    const currentMapping = db.vendor_material_mappings[mappingIndex];
    const {
      vendor_material_code,
      preferred_vendor_flag,
      last_purchase_rate,
      lead_time_days,
      moq
    } = req.body;

    const isPreferred = !!preferred_vendor_flag;

    // Enforce single preferred vendor flag
    if (isPreferred) {
      (db.vendor_material_mappings || []).forEach(m => {
        if (m.material_id === currentMapping.material_id && !m.is_deleted) {
          m.preferred_vendor_flag = false;
        }
      });
    }

    db.vendor_material_mappings[mappingIndex] = {
      ...currentMapping,
      vendor_material_code: vendor_material_code ? vendor_material_code.trim() : currentMapping.vendor_material_code,
      preferred_vendor_flag: isPreferred,
      last_purchase_rate: last_purchase_rate !== undefined ? Number(last_purchase_rate) : currentMapping.last_purchase_rate,
      lead_time_days: lead_time_days !== undefined ? Number(lead_time_days) : currentMapping.lead_time_days,
      moq: moq !== undefined ? Number(moq) : currentMapping.moq,
      last_updated: new Date().toISOString()
    };

    addAuditLog(req.user.id, req.user.email, "VENDOR_MATERIAL_MAPPING_UPDATE", `Updated vendor material mapping ID ${req.params.id}`, "SUCCESS");
    saveDB();

    res.json(db.vendor_material_mappings[mappingIndex]);
  });

  // DELETE /api/v1/vendor-materials/:id
  app.delete("/api/v1/vendor-materials/:id", requireAuth, (req: any, res: any) => {
    const mappingIndex = (db.vendor_material_mappings || []).findIndex(m => m.id === req.params.id && !m.is_deleted);
    if (mappingIndex === -1) {
      return res.status(404).json({ code: "MAPPING_NOT_FOUND", message: "Mapping record not found." });
    }

    db.vendor_material_mappings[mappingIndex].is_deleted = true;
    
    addAuditLog(req.user.id, req.user.email, "VENDOR_MATERIAL_MAPPING_DELETE", `Deleted vendor material mapping ID ${req.params.id}`, "SUCCESS");
    saveDB();

    res.json({ success: true, message: "Mapping successfully deleted." });
  });

  // =========================================================================
  // Sprint 4C: RFQ & Vendor Quotation Management REST APIs
  // =========================================================================

  // GET /api/v1/rfqs
  app.get("/api/v1/rfqs", requireAuth, (req: any, res: any) => {
    const list = (db.rfqs || []).filter((r) => !r.is_deleted);
    const enriched = list.map((r) => {
      const lines = (db.rfq_lines || []).filter((l) => l.rfq_id === r.id && !l.is_deleted);
      const assignments = (db.rfq_vendor_assignments || []).filter((a) => a.rfq_id === r.id && !a.is_deleted);
      const pr = (db.purchase_requisitions || []).find((p) => p.id === r.purchase_requisition_id);
      return {
        ...r,
        lines_count: lines.length,
        vendors_count: assignments.length,
        purchase_requisition_number: pr ? pr.pr_number : "Direct RFQ",
      };
    });
    res.json(enriched);
  });

  // GET /api/v1/rfqs/:id
  app.get("/api/v1/rfqs/:id", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    const lines = (db.rfq_lines || []).filter((l) => l.rfq_id === rfq.id && !l.is_deleted);
    const assignments = (db.rfq_vendor_assignments || []).filter((a) => a.rfq_id === rfq.id && !a.is_deleted).map((a) => {
      const v = (db.vendors || []).find((item) => item.id === a.vendor_id);
      return {
        ...a,
        vendor_name: v ? v.vendor_name : "Unknown Vendor",
        vendor_code: v ? v.vendor_code : "N/A",
        vendor_status: v ? v.status : "N/A",
      };
    });

    const pr = (db.purchase_requisitions || []).find((p) => p.id === rfq.purchase_requisition_id);

    res.json({
      ...rfq,
      lines,
      assignments,
      purchase_requisition_number: pr ? pr.pr_number : "Direct RFQ",
    });
  });

  // POST /api/v1/rfqs
  app.post("/api/v1/rfqs", requireAuth, (req: any, res: any) => {
    const {
      purchase_requisition_id,
      closing_date,
      currency,
      remarks,
      lines,
      vendor_ids
    } = req.body;

    if (!closing_date || !currency) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Missing required fields (closing_date, currency)" });
    }

    if (!lines || lines.length === 0) {
      return res.status(400).json({ code: "VALIDATION_FAILED", message: "RFQ must have at least one line" });
    }

    if (!vendor_ids || vendor_ids.length === 0) {
      return res.status(400).json({ code: "VALIDATION_FAILED", message: "RFQ must have at least one vendor" });
    }

    // Validate vendors are active and no duplicates
    const uniqueVendors = new Set(vendor_ids);
    if (uniqueVendors.size !== vendor_ids.length) {
      return res.status(400).json({ code: "DUPLICATE_ASSIGNMENT", message: "Duplicate vendor assignments are blocked" });
    }

    for (const vid of vendor_ids) {
      const v = (db.vendors || []).find((item) => item.id === vid && !item.is_deleted);
      if (!v) {
        return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: `Vendor ${vid} not found` });
      }
      if (v.status !== "ACTIVE") {
        return res.status(400).json({ code: "INACTIVE_VENDOR", message: `Vendor ${v.vendor_name} is ${v.status}, only ACTIVE vendors can be assigned.` });
      }
    }

    // Generate RFQ number
    const year = new Date().getFullYear();
    const count = (db.rfqs || []).filter((r) => r.rfq_number.startsWith(`RFQ-${year}`)).length + 1;
    const rfq_number = `RFQ-${year}-${String(count).padStart(4, "0")}`;

    const rfq_id = "rfq-" + crypto.randomUUID();
    const rfq: RFQHeader = {
      id: rfq_id,
      rfq_number,
      rfq_date: new Date().toISOString(),
      purchase_requisition_id: purchase_requisition_id || "",
      department: req.body.department || "Procurement",
      project: req.body.project || "General",
      buyer: req.user.email,
      closing_date,
      currency,
      remarks: remarks || null,
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    };

    db.rfqs.push(rfq);

    // Create lines
    const createdLines: RFQLine[] = [];
    for (const line of lines) {
      const rfqLine: RFQLine = {
        id: "rfql-" + crypto.randomUUID(),
        rfq_id,
        material_id: line.material_id || "",
        material_code: line.material_code || "",
        description: line.description || "",
        quantity: Number(line.quantity || 0),
        uom: line.uom || "",
        required_date: line.required_date || new Date().toISOString(),
        remarks: line.remarks || null,
        is_deleted: false,
      };
      db.rfq_lines.push(rfqLine);
      createdLines.push(rfqLine);
    }

    // Create assignments
    const createdAssignments: RFQVendorAssignment[] = [];
    for (const vid of vendor_ids) {
      const assignment: RFQVendorAssignment = {
        id: "rfqva-" + crypto.randomUUID(),
        rfq_id,
        vendor_id: vid,
        sent_date: null,
        response_due_date: closing_date,
        response_status: "NOT_SENT",
        is_deleted: false,
      };
      db.rfq_vendor_assignments.push(assignment);
      createdAssignments.push(assignment);
    }

    addAuditLog(req.user.id, req.user.email, "RFQ_CREATE", `Created RFQ ${rfq_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({
      ...rfq,
      lines: createdLines,
      assignments: createdAssignments
    });
  });

  // PUT /api/v1/rfqs/:id
  app.put("/api/v1/rfqs/:id", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    // Allow edits on DRAFT/SENT
    if (rfq.status === "COMPLETED" || rfq.status === "CANCELLED") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Cannot edit completed or cancelled RFQs" });
    }

    const {
      closing_date,
      currency,
      remarks,
      status,
      department,
      project
    } = req.body;

    if (closing_date) rfq.closing_date = closing_date;
    if (currency) rfq.currency = currency;
    if (remarks !== undefined) rfq.remarks = remarks;
    if (status) rfq.status = status;
    if (department) rfq.department = department;
    if (project) rfq.project = project;
    rfq.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "RFQ_UPDATE", `Updated RFQ ${rfq.rfq_number}`, "SUCCESS");
    saveDB();

    res.json(rfq);
  });

  // POST /api/v1/rfqs/from-purchase-requisition/:prId
  app.post("/api/v1/rfqs/from-purchase-requisition/:prId", requireAuth, (req: any, res: any) => {
    const pr = (db.purchase_requisitions || []).find((p) => p.id === req.params.prId && !p.is_deleted);
    if (!pr) return res.status(404).json({ code: "PR_NOT_FOUND", message: "Purchase Requisition not found" });

    // ONLY APPROVED PRs can generate RFQs
    if (pr.status !== "APPROVED") {
      return res.status(400).json({ code: "PR_NOT_APPROVED", message: "Only APPROVED Purchase Requisitions can generate RFQs." });
    }

    const prLines = (db.purchase_requisition_lines || []).filter((l) => l.purchase_requisition_id === pr.id && !l.is_deleted);
    if (prLines.length === 0) {
      return res.status(400).json({ code: "PR_LINES_EMPTY", message: "Purchase Requisition has no active lines." });
    }

    // Generate RFQ number
    const year = new Date().getFullYear();
    const count = (db.rfqs || []).filter((r) => r.rfq_number.startsWith(`RFQ-${year}`)).length + 1;
    const rfq_number = `RFQ-${year}-${String(count).padStart(4, "0")}`;

    const rfq_id = "rfq-" + crypto.randomUUID();
    
    // Closing date: default to 7 days from now
    const closingDateStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const rfq: RFQHeader = {
      id: rfq_id,
      rfq_number,
      rfq_date: new Date().toISOString(),
      purchase_requisition_id: pr.id,
      department: pr.department || "Procurement",
      project: pr.project || "General",
      buyer: req.user.email,
      closing_date: closingDateStr,
      currency: "INR", // Default to INR
      remarks: `Generated from PR ${pr.pr_number}`,
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    };

    db.rfqs.push(rfq);

    // Create lines directly from PR lines
    const createdLines: RFQLine[] = [];
    const materialIds = new Set<string>();

    for (const prLine of prLines) {
      const rfqLine: RFQLine = {
        id: "rfql-" + crypto.randomUUID(),
        rfq_id,
        material_id: prLine.material_id,
        material_code: prLine.material_code,
        description: prLine.description,
        quantity: prLine.required_quantity,
        uom: prLine.uom,
        required_date: prLine.required_date,
        remarks: prLine.remarks || null,
        is_deleted: false,
      };
      db.rfq_lines.push(rfqLine);
      createdLines.push(rfqLine);
      materialIds.add(prLine.material_id);
    }

    // Auto-suggest preferred/assigned vendors using Vendor Material Mapping
    const suggestedVendorIds = new Set<string>();
    (db.vendor_material_mappings || []).forEach((m) => {
      if (materialIds.has(m.material_id) && !m.is_deleted) {
        const v = (db.vendors || []).find((item) => item.id === m.vendor_id && !item.is_deleted && item.status === "ACTIVE");
        if (v) {
          suggestedVendorIds.add(v.id);
        }
      }
    });

    // Create assignments for suggested vendors
    const createdAssignments: RFQVendorAssignment[] = [];
    suggestedVendorIds.forEach((vid) => {
      const assignment: RFQVendorAssignment = {
        id: "rfqva-" + crypto.randomUUID(),
        rfq_id,
        vendor_id: vid,
        sent_date: null,
        response_due_date: closingDateStr,
        response_status: "NOT_SENT",
        is_deleted: false,
      };
      db.rfq_vendor_assignments.push(assignment);
      createdAssignments.push(assignment);
    });

    // Mark PR as CONVERTED_TO_RFQ
    pr.status = "CONVERTED_TO_RFQ";
    pr.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "RFQ_GENERATION", `Generated RFQ ${rfq_number} from PR ${pr.pr_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({
      ...rfq,
      lines: createdLines,
      assignments: createdAssignments,
      purchase_requisition_number: pr.pr_number,
    });
  });

  // POST /api/v1/rfqs/:id/send
  app.post("/api/v1/rfqs/:id/send", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    const assignments = (db.rfq_vendor_assignments || []).filter((a) => a.rfq_id === rfq.id && !a.is_deleted);
    if (assignments.length === 0) {
      return res.status(400).json({ code: "NO_VENDORS_ASSIGNED", message: "RFQ must have at least one vendor assigned before sending." });
    }

    rfq.status = "SENT";
    rfq.updated_at = new Date().toISOString();

    assignments.forEach((a) => {
      if (a.response_status === "NOT_SENT") {
        a.response_status = "SENT";
        a.sent_date = new Date().toISOString();
      }
    });

    addAuditLog(req.user.id, req.user.email, "RFQ_SEND", `Dispatched RFQ ${rfq.rfq_number} to vendors`, "SUCCESS");
    saveDB();

    res.json({ success: true, status: rfq.status, assignments });
  });

  // POST /api/v1/rfqs/:id/cancel
  app.post("/api/v1/rfqs/:id/cancel", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    rfq.status = "CANCELLED";
    rfq.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "RFQ_CANCEL", `Cancelled RFQ ${rfq.rfq_number}`, "SUCCESS");
    saveDB();

    res.json({ success: true, status: rfq.status });
  });

  // POST /api/v1/rfqs/:id/evaluate
  app.post("/api/v1/rfqs/:id/evaluate", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    rfq.status = "UNDER_EVALUATION";
    rfq.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "RFQ_EVALUATE", `Moved RFQ ${rfq.rfq_number} to UNDER_EVALUATION`, "SUCCESS");
    saveDB();
    res.json({ success: true, status: rfq.status });
  });

  // POST /api/v1/rfqs/:id/complete
  app.post("/api/v1/rfqs/:id/complete", requireAuth, (req: any, res: any) => {
    const rfq = (db.rfqs || []).find((r) => r.id === req.params.id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    rfq.status = "COMPLETED";
    rfq.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "RFQ_COMPLETE", `Completed RFQ ${rfq.rfq_number}`, "SUCCESS");
    saveDB();
    res.json({ success: true, status: rfq.status });
  });

  // GET /api/v1/vendor-quotations
  app.get("/api/v1/vendor-quotations", requireAuth, (req: any, res: any) => {
    const list = (db.vendor_quotations || []).filter((q) => !q.is_deleted);
    const enriched = list.map((q) => {
      const v = (db.vendors || []).find((item) => item.id === q.vendor_id);
      const r = (db.rfqs || []).find((item) => item.id === q.rfq_id);
      const lines = (db.vendor_quotation_lines || []).filter((l) => l.vendor_quotation_id === q.id && !l.is_deleted);
      return {
        ...q,
        vendor_name: v ? v.vendor_name : "Unknown",
        vendor_code: v ? v.vendor_code : "N/A",
        rfq_number: r ? r.rfq_number : "Direct",
        lines_count: lines.length,
        lines,
      };
    });
    res.json(enriched);
  });

  // POST /api/v1/vendor-quotations
  app.post("/api/v1/vendor-quotations", requireAuth, (req: any, res: any) => {
    const {
      vendor_id,
      rfq_id,
      quotation_number,
      quotation_date,
      valid_until,
      currency,
      payment_terms,
      delivery_terms,
      remarks,
      lines,
      revision_number
    } = req.body;

    if (!vendor_id || !rfq_id || !quotation_number || !lines || lines.length === 0) {
      return res.status(422).json({ code: "VALIDATION_FAILED", message: "Missing required fields or lines." });
    }

    const vendor = (db.vendors || []).find((v) => v.id === vendor_id && !v.is_deleted);
    if (!vendor) {
      return res.status(404).json({ code: "VENDOR_NOT_FOUND", message: "Vendor not found" });
    }

    // BLOCKED vendor cannot submit quotes
    if (vendor.status === "BLOCKED") {
      return res.status(400).json({ code: "BLOCKED_VENDOR", message: "Rejected. Vendor status is BLOCKED." });
    }

    if (vendor.status !== "ACTIVE") {
      return res.status(400).json({ code: "INACTIVE_VENDOR", message: "Only ACTIVE vendors can submit quotations." });
    }

    const rfq = (db.rfqs || []).find((r) => r.id === rfq_id && !r.is_deleted);
    if (!rfq) {
      return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });
    }

    // Check assignment
    const assignment = (db.rfq_vendor_assignments || []).find((a) => a.rfq_id === rfq_id && a.vendor_id === vendor_id && !a.is_deleted);
    if (!assignment) {
      return res.status(400).json({ code: "NOT_ASSIGNED", message: "This vendor is not assigned to this RFQ." });
    }

    // Duplicate Quotation Protection unless it's a revision
    const existingQ = (db.vendor_quotations || []).filter((q) => q.vendor_id === vendor_id && q.rfq_id === rfq_id && !q.is_deleted);
    const reqRev = Number(revision_number || 0);

    if (existingQ.length > 0) {
      const maxRevision = Math.max(...existingQ.map((q) => q.revision_number || 0));
      if (reqRev <= maxRevision) {
        return res.status(400).json({ code: "DUPLICATE_QUOTATION", message: "Quotation already exists for this vendor and RFQ. Please submit as a revision." });
      }
    }

    // Create quotation header
    const quote_id = "vq-" + crypto.randomUUID();
    const quotation: VendorQuotationHeader = {
      id: quote_id,
      vendor_id,
      rfq_id,
      quotation_number,
      quotation_date: quotation_date || new Date().toISOString(),
      valid_until: valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: currency || "INR",
      payment_terms: payment_terms || "Net 30",
      delivery_terms: delivery_terms || "FOB",
      remarks: remarks || null,
      revision_number: reqRev,
      created_at: new Date().toISOString(),
      is_deleted: false,
    };

    db.vendor_quotations.push(quotation);

    // Create lines
    const createdLines: VendorQuotationLine[] = [];
    for (const line of lines) {
      const quoted_unit_price = Number(line.quoted_unit_price || 0);
      const quantity = Number(line.quantity || 1);
      const discount_percent = Number(line.discount_percent || 0);
      const tax_percent = Number(line.tax_percent || 0);
      const freight = Number(line.freight || 0);

      const line_total = (quoted_unit_price * quantity) * (1 - discount_percent / 100) * (1 + tax_percent / 100) + freight;

      const qLine: VendorQuotationLine = {
        id: "vql-" + crypto.randomUUID(),
        vendor_quotation_id: quote_id,
        material_id: line.material_id || "",
        material_code: line.material_code || "",
        description: line.description || "",
        quoted_unit_price,
        discount_percent,
        tax_percent,
        freight,
        lead_time_days: Number(line.lead_time_days || 0),
        moq: Number(line.moq || 0),
        total_amount: line_total,
        is_deleted: false,
      };
      db.vendor_quotation_lines.push(qLine);
      createdLines.push(qLine);
    }

    // Update vendor assignment status
    assignment.response_status = "QUOTATION_RECEIVED";

    // Evaluate state transition
    const allAssignments = (db.rfq_vendor_assignments || []).filter((a) => a.rfq_id === rfq_id && !a.is_deleted);
    const responded = allAssignments.filter((a) => a.response_status === "QUOTATION_RECEIVED" || a.response_status === "DECLINED");

    if (responded.length === allAssignments.length) {
      rfq.status = "FULLY_RESPONDED";
    } else if (rfq.status === "SENT" || rfq.status === "DRAFT") {
      rfq.status = "PARTIALLY_RESPONDED";
    }

    addAuditLog(req.user.id, req.user.email, "QUOTATION_SUBMIT", `Vendor ${vendor.vendor_code} submitted quotation ${quotation_number} for RFQ ${rfq.rfq_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({
      ...quotation,
      lines: createdLines,
      rfq_status: rfq.status
    });
  });

  // PUT /api/v1/vendor-quotations/:id
  app.put("/api/v1/vendor-quotations/:id", requireAuth, (req: any, res: any) => {
    const q = (db.vendor_quotations || []).find((item) => item.id === req.params.id && !item.is_deleted);
    if (!q) return res.status(404).json({ code: "QUOTATION_NOT_FOUND", message: "Quotation not found" });

    const { valid_until, remarks, payment_terms, delivery_terms } = req.body;
    if (valid_until) q.valid_until = valid_until;
    if (remarks !== undefined) q.remarks = remarks;
    if (payment_terms) q.payment_terms = payment_terms;
    if (delivery_terms) q.delivery_terms = delivery_terms;

    addAuditLog(req.user.id, req.user.email, "QUOTATION_UPDATE", `Updated quotation ${q.quotation_number}`, "SUCCESS");
    saveDB();

    res.json(q);
  });

  // =========================================================================
  // Sprint 4D: Vendor Comparison & Source Selection Engine APIs
  // =========================================================================

  // Evaluation engine function to perform commercial, technical and overall scoring
  function runVendorComparisonEvaluation(comparisonId: string) {
    if (!db.vendor_comparisons) db.vendor_comparisons = [];
    const comparison = db.vendor_comparisons.find(c => c.id === comparisonId && !c.is_deleted);
    if (!comparison) return;

    const rfqId = comparison.rfq_id;
    const quotes = (db.vendor_quotations || []).filter(q => q.rfq_id === rfqId && !q.is_deleted);
    const rfqLines = (db.rfq_lines || []).filter(l => l.rfq_id === rfqId && !l.is_deleted);

    // Weights
    const commWeight = comparison.commercial_weight !== undefined ? comparison.commercial_weight : 40;
    const techWeight = comparison.technical_weight !== undefined ? comparison.technical_weight : 25;
    const qualWeight = comparison.quality_weight !== undefined ? comparison.quality_weight : 15;
    const delWeight = comparison.delivery_weight !== undefined ? comparison.delivery_weight : 10;
    const servWeight = comparison.service_weight !== undefined ? comparison.service_weight : 10;

    const compLines: VendorComparisonLine[] = [];
    const vendorTotals: { [vendorId: string]: { totalCost: number, leadTime: number, minValidUntil: string, moq: number, lineCount: number } } = {};

    for (const quote of quotes) {
      const qLines = (db.vendor_quotation_lines || []).filter(l => l.vendor_quotation_id === quote.id && !l.is_deleted);
      const vendorId = quote.vendor_id;
      vendorTotals[vendorId] = { totalCost: 0, leadTime: 0, minValidUntil: quote.valid_until, moq: 0, lineCount: 0 };

      for (const rfqLine of rfqLines) {
        const qLine = qLines.find(ql => ql.material_id === rfqLine.material_id);
        
        const unitPrice = qLine ? qLine.quoted_unit_price : 0;
        const discount = qLine ? qLine.discount_percent : 0;
        const tax = qLine ? qLine.tax_percent : 0;
        const freight = qLine ? qLine.freight : 0;
        const quantity = rfqLine.quantity;

        // Formula: line_total = (quoted_unit_price * quantity) * (1 - discount_percent / 100) * (1 + tax_percent / 100) + freight
        const totalLineCost = qLine ? qLine.total_amount : ((unitPrice * quantity) * (1 - discount / 100) * (1 + tax / 100) + freight);
        const netUnitCost = quantity > 0 ? (totalLineCost / quantity) : 0;

        const compLine: VendorComparisonLine = {
          id: "vcl-" + crypto.randomUUID(),
          vendor_comparison_id: comparisonId,
          material_id: rfqLine.material_id,
          vendor_id: vendorId,
          unit_price: unitPrice,
          discount_percent: discount,
          tax_percent: tax,
          freight: freight,
          net_unit_cost: netUnitCost,
          total_cost: totalLineCost,
          lead_time_days: qLine ? qLine.lead_time_days : 0,
          moq: qLine ? qLine.moq : 0,
          valid_until: quote.valid_until,
          is_deleted: false
        };
        compLines.push(compLine);

        vendorTotals[vendorId].totalCost += totalLineCost;
        vendorTotals[vendorId].leadTime = Math.max(vendorTotals[vendorId].leadTime, qLine ? qLine.lead_time_days : 0);
        vendorTotals[vendorId].moq = Math.max(vendorTotals[vendorId].moq, qLine ? qLine.moq : 0);
      }
    }

    // Persist comparison lines
    if (!db.vendor_comparison_lines) db.vendor_comparison_lines = [];
    db.vendor_comparison_lines = db.vendor_comparison_lines.filter(l => l.vendor_comparison_id !== comparisonId);
    db.vendor_comparison_lines.push(...compLines);

    // Perform rankings
    const vendorIds = Object.keys(vendorTotals);
    if (vendorIds.length === 0) return;

    // Commercial totals
    const sortedCommercial = [...vendorIds].sort((a, b) => vendorTotals[a].totalCost - vendorTotals[b].totalCost);
    const lowestCostVendorId = sortedCommercial[0];
    const lowestTotalCost = vendorTotals[lowestCostVendorId].totalCost;

    // Verify technical evaluations exist
    if (!db.technical_evaluations) db.technical_evaluations = [];
    const techEvals = db.technical_evaluations.filter(te => te.vendor_comparison_id === comparisonId && !te.is_deleted);

    for (const vId of vendorIds) {
      let te = techEvals.find(e => e.vendor_id === vId);
      if (!te) {
        te = {
          id: "te-" + crypto.randomUUID(),
          vendor_comparison_id: comparisonId,
          vendor_id: vId,
          quality_score: 8,
          delivery_score: 8,
          compliance_score: 8,
          service_score: 8,
          documentation_score: 8,
          warranty_score: 8,
          weighted_avg: 8,
          is_deleted: false
        };
        db.technical_evaluations.push(te);
      } else {
        te.weighted_avg = (te.quality_score + te.delivery_score + te.compliance_score + te.service_score + te.documentation_score + te.warranty_score) / 6;
      }
    }

    const updatedTechEvals = db.technical_evaluations.filter(te => te.vendor_comparison_id === comparisonId && !te.is_deleted);
    const vendorRatings = db.vendor_ratings || [];

    // Overall metrics calculation
    const finalRankings = vendorIds.map(vId => {
      const totalCost = vendorTotals[vId].totalCost;
      
      // Commercial score out of 100
      const commScore = totalCost > 0 ? (lowestTotalCost / totalCost) * 100 : 0;

      // Technical score out of 100
      const te = updatedTechEvals.find(e => e.vendor_id === vId);
      const techScore = te ? te.weighted_avg * 10 : 80;

      // Sprint 4B ratings
      const rating = vendorRatings.find(r => r.vendor_id === vId && !r.is_deleted) || {
        quality_rating: 4.2,
        delivery_rating: 4.1,
        price_rating: 4.0,
        service_rating: 4.3,
      };

      const qualHistoryScore = (rating.quality_rating <= 5) ? rating.quality_rating * 20 : rating.quality_rating * 10;
      const delHistoryScore = (rating.delivery_rating <= 5) ? rating.delivery_rating * 20 : rating.delivery_rating * 10;
      const servHistoryScore = (rating.service_rating <= 5) ? rating.service_rating * 20 : rating.service_rating * 10;

      const overallScore = (commScore * commWeight / 100) +
                           (techScore * techWeight / 100) +
                           (qualHistoryScore * qualWeight / 100) +
                           (delHistoryScore * delWeight / 100) +
                           (servHistoryScore * servWeight / 100);

      return {
        vendorId: vId,
        commScore,
        techScore,
        overallScore,
        totalCost
      };
    });

    const sortedOverall = [...finalRankings].sort((a, b) => b.overallScore - a.overallScore);
    const overallBestVendorId = sortedOverall[0].vendorId;

    const sortedTechnical = [...finalRankings].sort((a, b) => b.techScore - a.techScore);
    const bestTechnicalVendorId = sortedTechnical[0].vendorId;

    // Savings computations
    const totalCosts = finalRankings.map(r => r.totalCost);
    const maxCost = Math.max(...totalCosts);
    const savingsAmount = maxCost - lowestTotalCost;
    const priceVariancePercent = lowestTotalCost > 0 ? ((maxCost - lowestTotalCost) / lowestTotalCost) * 100 : 0;

    const getVendorName = (vId: string) => {
      const v = db.vendors.find(item => item.id === vId);
      return v ? v.vendor_name : "Unknown Vendor";
    };

    const commReason = `${getVendorName(lowestCostVendorId)} offers the lowest total cost of ${lowestTotalCost.toFixed(2)} (Savings of ${savingsAmount.toFixed(2)} vs highest quote).`;
    const techReason = `${getVendorName(bestTechnicalVendorId)} achieved the highest manual technical score of ${(sortedTechnical[0].techScore / 10).toFixed(2)}/10 across compliance, quality and support parameters.`;
    const overallReason = `${getVendorName(overallBestVendorId)} is recommended as the Overall Best Vendor with a composite weighted score of ${sortedOverall[0].overallScore.toFixed(2)}/100, balancing Commercial Price (${commWeight}%), Technical Capability (${techWeight}%), and historical Vendor Performance (${qualWeight + delWeight + servWeight}%).`;

    if (!db.vendor_comparison_recommendations) db.vendor_comparison_recommendations = [];
    let rec = db.vendor_comparison_recommendations.find(r => r.vendor_comparison_id === comparisonId);
    if (!rec) {
      rec = {
        id: "rec-" + crypto.randomUUID(),
        vendor_comparison_id: comparisonId,
        best_commercial_vendor_id: lowestCostVendorId,
        best_commercial_reason: commReason,
        best_technical_vendor_id: bestTechnicalVendorId,
        best_technical_reason: techReason,
        overall_best_vendor_id: overallBestVendorId,
        overall_best_reason: overallReason,
        savings_amount: savingsAmount,
        price_variance_percent: priceVariancePercent,
        notes: "Evaluation compiled automatically using multicriteria optimization scoring.",
        is_deleted: false
      };
      db.vendor_comparison_recommendations.push(rec);
    } else {
      rec.best_commercial_vendor_id = lowestCostVendorId;
      rec.best_commercial_reason = commReason;
      rec.best_technical_vendor_id = bestTechnicalVendorId;
      rec.best_technical_reason = techReason;
      rec.overall_best_vendor_id = overallBestVendorId;
      rec.overall_best_reason = overallReason;
      rec.savings_amount = savingsAmount;
      rec.price_variance_percent = priceVariancePercent;
      rec.notes = "Re-evaluated and updated with latest scoring weights and technical evaluations.";
    }

    saveDB();
  }

  // GET /api/v1/vendor-comparisons
  app.get("/api/v1/vendor-comparisons", requireAuth, (req: any, res: any) => {
    const list = (db.vendor_comparisons || []).filter(c => !c.is_deleted);
    const enriched = list.map(c => {
      const rfq = (db.rfqs || []).find(r => r.id === c.rfq_id);
      const quotes = (db.vendor_quotations || []).filter(q => q.rfq_id === c.rfq_id && !q.is_deleted);
      return {
        ...c,
        rfq_number: rfq ? rfq.rfq_number : "Unknown RFQ",
        closing_date: rfq ? rfq.closing_date : "N/A",
        quotations_count: quotes.length
      };
    });
    res.json(enriched);
  });

  // GET /api/v1/vendor-comparisons/:id
  app.get("/api/v1/vendor-comparisons/:id", requireAuth, (req: any, res: any) => {
    const comparison = (db.vendor_comparisons || []).find(c => c.id === req.params.id && !c.is_deleted);
    if (!comparison) return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison session not found" });

    const rfq = (db.rfqs || []).find(r => r.id === comparison.rfq_id);
    const lines = (db.vendor_comparison_lines || []).filter(l => l.vendor_comparison_id === comparison.id && !l.is_deleted);
    const techEvals = (db.technical_evaluations || []).filter(te => te.vendor_comparison_id === comparison.id && !te.is_deleted);
    const rec = (db.vendor_comparison_recommendations || []).find(r => r.vendor_comparison_id === comparison.id && !r.is_deleted);

    const rfqLines = (db.rfq_lines || []).filter(rl => rl.rfq_id === comparison.rfq_id && !rl.is_deleted);

    res.json({
      ...comparison,
      rfq_number: rfq ? rfq.rfq_number : "Unknown RFQ",
      rfq_status: rfq ? rfq.status : "N/A",
      rfq_lines: rfqLines,
      lines,
      technical_evaluations: techEvals,
      recommendation: rec || null
    });
  });

  // POST /api/v1/vendor-comparisons/from-rfq/:rfqId
  app.post("/api/v1/vendor-comparisons/from-rfq/:rfqId", requireAuth, (req: any, res: any) => {
    const rfqId = req.params.rfqId;
    const rfq = (db.rfqs || []).find(r => r.id === rfqId && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    // Validate RFQ must be FULLY_RESPONDED or already UNDER_EVALUATION / COMPLETED
    if (rfq.status !== "FULLY_RESPONDED" && rfq.status !== "UNDER_EVALUATION" && rfq.status !== "COMPLETED") {
      return res.status(400).json({ code: "RFQ_NOT_FULLY_RESPONDED", message: "RFQ must be FULLY_RESPONDED before generating a comparison." });
    }

    const quotes = (db.vendor_quotations || []).filter(q => q.rfq_id === rfqId && !q.is_deleted);
    // At least two quotations required
    if (quotes.length < 2) {
      return res.status(400).json({ code: "MIN_QUOTATIONS_NOT_MET", message: "At least two quotations are required to generate a comparison matrix." });
    }

    // Duplicate comparison sessions prevented
    if (!db.vendor_comparisons) db.vendor_comparisons = [];
    const existing = db.vendor_comparisons.find(c => c.rfq_id === rfqId && !c.is_deleted);
    if (existing) {
      return res.status(400).json({ code: "DUPLICATE_COMPARISON", message: "A vendor comparison session for this RFQ already exists." });
    }

    const compId = "vc-" + crypto.randomUUID();
    const comparison: VendorComparisonHeader = {
      id: compId,
      comparison_number: "VC-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
      rfq_id: rfqId,
      comparison_date: new Date().toISOString().split("T")[0],
      buyer: req.user.full_name || req.user.email,
      status: "DRAFT",
      remarks: req.body.remarks || "Automated comparison generated from RFQ quotations",
      commercial_weight: 40,
      technical_weight: 25,
      quality_weight: 15,
      delivery_weight: 10,
      service_weight: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    db.vendor_comparisons.push(comparison);

    // Run evaluation to populate lines, scores, and recommendation automatically
    runVendorComparisonEvaluation(compId);
    addAuditLog(req.user.id, req.user.email, "COMPARISON_CREATE", `Created vendor comparison ${comparison.comparison_number} for RFQ ${rfq.rfq_number}`, "SUCCESS");

    res.status(201).json(comparison);
  });

  // POST /api/v1/vendor-comparisons
  app.post("/api/v1/vendor-comparisons", requireAuth, (req: any, res: any) => {
    const { rfq_id, remarks, commercial_weight, technical_weight, quality_weight, delivery_weight, service_weight } = req.body;
    if (!rfq_id) return res.status(400).json({ code: "MISSING_RFQ", message: "RFQ reference is required." });

    const rfq = (db.rfqs || []).find(r => r.id === rfq_id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    if (rfq.status !== "FULLY_RESPONDED" && rfq.status !== "UNDER_EVALUATION" && rfq.status !== "COMPLETED") {
      return res.status(400).json({ code: "RFQ_NOT_FULLY_RESPONDED", message: "RFQ must be FULLY_RESPONDED before generating a comparison." });
    }

    const quotes = (db.vendor_quotations || []).filter(q => q.rfq_id === rfq_id && !q.is_deleted);
    if (quotes.length < 2) {
      return res.status(400).json({ code: "MIN_QUOTATIONS_NOT_MET", message: "At least two quotations are required to generate a comparison matrix." });
    }

    if (!db.vendor_comparisons) db.vendor_comparisons = [];
    const existing = db.vendor_comparisons.find(c => c.rfq_id === rfq_id && !c.is_deleted);
    if (existing) {
      return res.status(400).json({ code: "DUPLICATE_COMPARISON", message: "A vendor comparison session for this RFQ already exists." });
    }

    const compId = "vc-" + crypto.randomUUID();
    const comparison: VendorComparisonHeader = {
      id: compId,
      comparison_number: "VC-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
      rfq_id,
      comparison_date: new Date().toISOString().split("T")[0],
      buyer: req.user.full_name || req.user.email,
      status: "DRAFT",
      remarks: remarks || "Comparison generated",
      commercial_weight: Number(commercial_weight !== undefined ? commercial_weight : 40),
      technical_weight: Number(technical_weight !== undefined ? technical_weight : 25),
      quality_weight: Number(quality_weight !== undefined ? quality_weight : 15),
      delivery_weight: Number(delivery_weight !== undefined ? delivery_weight : 10),
      service_weight: Number(service_weight !== undefined ? service_weight : 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    db.vendor_comparisons.push(comparison);
    runVendorComparisonEvaluation(compId);

    addAuditLog(req.user.id, req.user.email, "COMPARISON_CREATE", `Created manual vendor comparison ${comparison.comparison_number}`, "SUCCESS");
    res.status(201).json(comparison);
  });

  // PUT /api/v1/vendor-comparisons/:id
  app.put("/api/v1/vendor-comparisons/:id", requireAuth, (req: any, res: any) => {
    const comparison = (db.vendor_comparisons || []).find(c => c.id === req.params.id && !c.is_deleted);
    if (!comparison) return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison session not found" });

    // Locked comparisons cannot be edited
    if (comparison.status === "APPROVED" || comparison.status === "COMPLETED") {
      return res.status(400).json({ code: "COMPARISON_LOCKED", message: "Locked comparisons cannot be edited." });
    }

    const {
      remarks,
      commercial_weight,
      technical_weight,
      quality_weight,
      delivery_weight,
      service_weight,
      technical_evaluations
    } = req.body;

    if (remarks !== undefined) comparison.remarks = remarks;
    if (commercial_weight !== undefined) comparison.commercial_weight = Number(commercial_weight);
    if (technical_weight !== undefined) comparison.technical_weight = Number(technical_weight);
    if (quality_weight !== undefined) comparison.quality_weight = Number(quality_weight);
    if (delivery_weight !== undefined) comparison.delivery_weight = Number(delivery_weight);
    if (service_weight !== undefined) comparison.service_weight = Number(service_weight);

    comparison.updated_at = new Date().toISOString();

    // Update manual technical scores if provided
    if (Array.isArray(technical_evaluations)) {
      if (!db.technical_evaluations) db.technical_evaluations = [];
      for (const scoreObj of technical_evaluations) {
        const te = db.technical_evaluations.find(e => e.id === scoreObj.id && e.vendor_comparison_id === comparison.id);
        if (te) {
          if (scoreObj.quality_score !== undefined) te.quality_score = Number(scoreObj.quality_score);
          if (scoreObj.delivery_score !== undefined) te.delivery_score = Number(scoreObj.delivery_score);
          if (scoreObj.compliance_score !== undefined) te.compliance_score = Number(scoreObj.compliance_score);
          if (scoreObj.service_score !== undefined) te.service_score = Number(scoreObj.service_score);
          if (scoreObj.documentation_score !== undefined) te.documentation_score = Number(scoreObj.documentation_score);
          if (scoreObj.warranty_score !== undefined) te.warranty_score = Number(scoreObj.warranty_score);
          te.weighted_avg = (te.quality_score + te.delivery_score + te.compliance_score + te.service_score + te.documentation_score + te.warranty_score) / 6;
        }
      }
    }

    // Run re-evaluation automatically
    runVendorComparisonEvaluation(comparison.id);

    addAuditLog(req.user.id, req.user.email, "COMPARISON_UPDATE", `Updated vendor comparison weights and technical scores for ${comparison.comparison_number}`, "SUCCESS");
    res.json(comparison);
  });

  // POST /api/v1/vendor-comparisons/:id/evaluate
  app.post("/api/v1/vendor-comparisons/:id/evaluate", requireAuth, (req: any, res: any) => {
    const comparison = (db.vendor_comparisons || []).find(c => c.id === req.params.id && !c.is_deleted);
    if (!comparison) return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison session not found" });

    // Enforce status transition or update status
    comparison.status = "UNDER_REVIEW";
    comparison.updated_at = new Date().toISOString();

    runVendorComparisonEvaluation(comparison.id);

    addAuditLog(req.user.id, req.user.email, "COMPARISON_EVALUATE", `Compiled matrix and recommendations for ${comparison.comparison_number}`, "SUCCESS");
    res.json({ success: true, status: comparison.status });
  });

  // POST /api/v1/vendor-comparisons/:id/approve
  app.post("/api/v1/vendor-comparisons/:id/approve", requireAuth, (req: any, res: any) => {
    const comparison = (db.vendor_comparisons || []).find(c => c.id === req.params.id && !c.is_deleted);
    if (!comparison) return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison session not found" });

    const previousStatus = comparison.status;
    let targetStatus = req.body.status;

    if (!targetStatus) {
      // Automatic step transition DRAFT -> UNDER_REVIEW -> APPROVED -> COMPLETED
      if (previousStatus === "DRAFT") targetStatus = "UNDER_REVIEW";
      else if (previousStatus === "UNDER_REVIEW") targetStatus = "APPROVED";
      else if (previousStatus === "APPROVED") targetStatus = "COMPLETED";
      else targetStatus = previousStatus;
    }

    comparison.status = targetStatus;
    comparison.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "COMPARISON_APPROVE", `Transitioned comparison ${comparison.comparison_number} from ${previousStatus} to ${targetStatus}`, "SUCCESS");
    saveDB();

    res.json({ success: true, status: comparison.status });
  });

  // GET /api/v1/vendor-comparisons/:id/recommendation
  app.get("/api/v1/vendor-comparisons/:id/recommendation", requireAuth, (req: any, res: any) => {
    const comparison = (db.vendor_comparisons || []).find(c => c.id === req.params.id && !c.is_deleted);
    if (!comparison) return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison session not found" });

    const rec = (db.vendor_comparison_recommendations || []).find(r => r.vendor_comparison_id === comparison.id && !r.is_deleted);
    if (!rec) return res.status(404).json({ code: "RECOMMENDATION_NOT_FOUND", message: "Recommendation has not been calculated yet. Run evaluation." });

    res.json(rec);
  });

  // GET /api/v1/rfqs/:id/responses
  app.get("/api/v1/rfqs/:id/responses", requireAuth, (req: any, res: any) => {
    const rfq_id = req.params.id;
    const rfq = (db.rfqs || []).find((r) => r.id === rfq_id && !r.is_deleted);
    if (!rfq) return res.status(404).json({ code: "RFQ_NOT_FOUND", message: "RFQ not found" });

    const assignments = (db.rfq_vendor_assignments || []).filter((a) => a.rfq_id === rfq_id && !a.is_deleted);
    const sentCount = assignments.filter((a) => a.response_status !== "NOT_SENT").length;
    const pendingCount = assignments.filter((a) => a.response_status === "SENT" || a.response_status === "ACKNOWLEDGED").length;
    const declinedCount = assignments.filter((a) => a.response_status === "DECLINED").length;
    const receivedCount = assignments.filter((a) => a.response_status === "QUOTATION_RECEIVED").length;

    const isLate = new Date(rfq.closing_date) < new Date();
    const lateCount = isLate ? pendingCount : 0;

    res.json({
      rfq_id,
      sentCount,
      pendingCount,
      declinedCount,
      receivedCount,
      lateCount,
      assignments: assignments.map((a) => {
        const v = (db.vendors || []).find((item) => item.id === a.vendor_id);
        return {
          ...a,
          vendor_name: v ? v.vendor_name : "Unknown Vendor",
          vendor_code: v ? v.vendor_code : "N/A",
        };
      }),
    });
  });


  // =========================================================================
  // Sprint 4E: Purchase Order Management APIs
  // =========================================================================

  // Helper to ensure PO collections exist
  function initPoCollections() {
    if (!db.purchase_orders) db.purchase_orders = [];
    if (!db.purchase_order_lines) db.purchase_order_lines = [];
    if (!db.vendor_acknowledgements) db.vendor_acknowledgements = [];
    if (!db.purchase_order_revisions) db.purchase_order_revisions = [];
  }

  // GET /api/v1/purchase-orders
  app.get("/api/v1/purchase-orders", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const { status, vendor, buyer } = req.query;
    let list = (db.purchase_orders || []).filter((po: any) => !po.is_deleted);

    if (status) {
      list = list.filter((po: any) => po.status === status);
    }
    if (vendor) {
      list = list.filter((po: any) => po.vendor_id === vendor);
    }
    if (buyer) {
      list = list.filter((po: any) => po.buyer.toLowerCase().includes(String(buyer).toLowerCase()));
    }

    // Join with vendor name/code
    const enriched = list.map((po: any) => {
      const v = (db.vendors || []).find((item: any) => item.id === po.vendor_id);
      return {
        ...po,
        vendor_name: v ? v.vendor_name : "Unknown Vendor",
        vendor_code: v ? v.vendor_code : "N/A"
      };
    });

    res.json(enriched);
  });

  // GET /api/v1/purchase-orders/{id}
  app.get("/api/v1/purchase-orders/:id", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = (db.purchase_orders || []).find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) {
      return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });
    }

    const lines = (db.purchase_order_lines || []).filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
    const acks = (db.vendor_acknowledgements || []).filter((a: any) => a.purchase_order_id === po.id && !a.is_deleted);
    const revs = (db.purchase_order_revisions || []).filter((r: any) => r.purchase_order_id === po.id && !r.is_deleted);
    const v = (db.vendors || []).find((item: any) => item.id === po.vendor_id);

    res.json({
      ...po,
      vendor_name: v ? v.vendor_name : "Unknown Vendor",
      vendor_code: v ? v.vendor_code : "N/A",
      lines,
      acknowledgements: acks,
      revisions: revs
    });
  });

  // POST /api/v1/purchase-orders
  app.post("/api/v1/purchase-orders", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const {
      vendor_id,
      vendor_comparison_id,
      rfq_id,
      purchase_requisition_id,
      currency,
      payment_terms,
      delivery_terms,
      incoterms,
      delivery_address,
      billing_address,
      expected_delivery_date,
      remarks,
      lines
    } = req.body;

    if (!vendor_id) {
      return res.status(400).json({ code: "MISSING_VENDOR", message: "Winning Vendor mandatory." });
    }

    // Verify duplicate
    if (vendor_comparison_id) {
      const isDupe = db.purchase_orders.some(
        (po: any) => po.vendor_comparison_id === vendor_comparison_id && po.vendor_id === vendor_id && !po.is_deleted
      );
      if (isDupe) {
        return res.status(400).json({ code: "DUPLICATE_PO", message: "Duplicate Purchase Orders prevented." });
      }
    }

    // Validate inactive materials
    if (Array.isArray(lines)) {
      for (const line of lines) {
        const mat = (db.materials || []).find((m: any) => m.id === line.material_id);
        if (!mat || mat.is_deleted || (mat as any).status === "INACTIVE" || (mat as any).is_active === false) {
          return res.status(400).json({ code: "INACTIVE_MATERIAL", message: `PO lines cannot contain inactive materials: ${line.material_code || "Unknown"}` });
        }
      }
    }

    const poId = "po-" + crypto.randomUUID();
    const poNumber = "PO-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

    const newPO: PurchaseOrderHeader = {
      id: poId,
      po_number: poNumber,
      po_date: new Date().toISOString().split("T")[0],
      vendor_id,
      vendor_comparison_id: vendor_comparison_id || "",
      rfq_id: rfq_id || "",
      purchase_requisition_id: purchase_requisition_id || null,
      buyer: req.user.full_name || req.user.email,
      currency: currency || "INR",
      payment_terms: payment_terms || "Net 30",
      delivery_terms: delivery_terms || "Ex-Works",
      incoterms: incoterms || "FOB",
      delivery_address: delivery_address || "CCS SPACEMAKER Factory, Gurgaon",
      billing_address: billing_address || "CCS SPACEMAKER SI PVT LTD, Gurgaon",
      expected_delivery_date: expected_delivery_date || new Date(Date.now() + 14*24*3600*1000).toISOString().split("T")[0],
      total_amount: 0,
      remarks: remarks || "",
      status: "DRAFT",
      revision_number: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    let totalVal = 0;
    const poLines: PurchaseOrderLine[] = [];

    if (Array.isArray(lines)) {
      for (const l of lines) {
        const lineTotal = Number(l.quantity) * Number(l.unit_price || 0) * (1 - Number(l.discount_percent || 0)/100) * (1 + Number(l.tax_percent || 0)/100) + Number(l.freight || 0);
        totalVal += lineTotal;

        poLines.push({
          id: "pol-" + crypto.randomUUID(),
          purchase_order_id: poId,
          material_id: l.material_id,
          material_code: l.material_code,
          description: l.description || "",
          quantity: Number(l.quantity),
          uom: l.uom || "PCS",
          unit_price: Number(l.unit_price || 0),
          discount_percent: Number(l.discount_percent || 0),
          tax_percent: Number(l.tax_percent || 0),
          freight: Number(l.freight || 0),
          net_unit_cost: l.quantity > 0 ? (lineTotal / l.quantity) : 0,
          total_amount: lineTotal,
          delivery_date: l.delivery_date || newPO.expected_delivery_date,
          is_deleted: false
        });
      }
    }

    newPO.total_amount = totalVal;
    db.purchase_orders.push(newPO);
    db.purchase_order_lines.push(...poLines);

    addAuditLog(req.user.id, req.user.email, "PO_CREATE", `Created Purchase Order ${poNumber} manually`, "SUCCESS");
    saveDB();

    res.status(201).json({ ...newPO, lines: poLines });
  });

  // POST /api/v1/purchase-orders/from-comparison/{comparisonId}
  app.post("/api/v1/purchase-orders/from-comparison/:comparisonId", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const compId = req.params.comparisonId;
    const comparison = (db.vendor_comparisons || []).find((c: any) => c.id === compId && !c.is_deleted);
    if (!comparison) {
      return res.status(404).json({ code: "COMPARISON_NOT_FOUND", message: "Vendor comparison not found." });
    }

    // Rule: Vendor Comparison must be APPROVED
    if (comparison.status !== "APPROVED" && comparison.status !== "COMPLETED") {
      return res.status(400).json({ code: "COMPARISON_NOT_APPROVED", message: "Vendor Comparison must be APPROVED." });
    }

    const rec = (db.vendor_comparison_recommendations || []).find((r: any) => r.vendor_comparison_id === compId && !r.is_deleted);
    const winningVendorId = req.body.vendor_id || rec?.overall_best_vendor_id;

    if (!winningVendorId) {
      return res.status(400).json({ code: "MISSING_VENDOR", message: "Winning Vendor mandatory." });
    }

    // Rule: Duplicate Purchase Orders prevented
    const isDupe = db.purchase_orders.some(
      (po: any) => po.vendor_comparison_id === compId && po.vendor_id === winningVendorId && !po.is_deleted
    );
    if (isDupe) {
      return res.status(400).json({ code: "DUPLICATE_PO", message: "Duplicate Purchase Orders prevented." });
    }

    // Fetch RFQ
    const rfq = (db.rfqs || []).find((r: any) => r.id === comparison.rfq_id && !r.is_deleted);
    const purchase_requisition_id = rfq?.purchase_requisition_id || null;

    // Fetch vendor quotation
    const quotation = (db.vendor_quotations || []).find(
      (q: any) => q.rfq_id === comparison.rfq_id && q.vendor_id === winningVendorId && !q.is_deleted
    );
    if (!quotation) {
      return res.status(404).json({ code: "QUOTATION_NOT_FOUND", message: "Quotation from the winning vendor was not found for this RFQ." });
    }

    const qLines = (db.vendor_quotation_lines || []).filter((ql: any) => ql.vendor_quotation_id === quotation.id && !ql.is_deleted);

    // Validate active materials
    for (const ql of qLines) {
      const mat = (db.materials || []).find((m: any) => m.id === ql.material_id);
      if (!mat || mat.is_deleted || (mat as any).status === "INACTIVE" || (mat as any).is_active === false) {
        return res.status(400).json({ code: "INACTIVE_MATERIAL", message: `PO lines cannot contain inactive materials: ${ql.material_code || "Unknown"}` });
      }
    }

    const poId = "po-" + crypto.randomUUID();
    const poNumber = "PO-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

    const newPO: PurchaseOrderHeader = {
      id: poId,
      po_number: poNumber,
      po_date: new Date().toISOString().split("T")[0],
      vendor_id: winningVendorId,
      vendor_comparison_id: compId,
      rfq_id: comparison.rfq_id,
      purchase_requisition_id,
      buyer: req.user.full_name || req.user.email,
      currency: rfq?.currency || "INR",
      payment_terms: quotation.payment_terms || "Net 30",
      delivery_terms: quotation.delivery_terms || "Ex-Works",
      incoterms: "FOB",
      delivery_address: "CCS SPACEMAKER SI PVT LTD, Corporate Office, Gurgaon",
      billing_address: "CCS SPACEMAKER SI PVT LTD, Corporate Office, Gurgaon",
      expected_delivery_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      total_amount: 0,
      remarks: "Generated automatically from approved vendor comparison " + comparison.comparison_number,
      status: "DRAFT",
      revision_number: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    let totalVal = 0;
    const poLines: PurchaseOrderLine[] = [];
    const rfqLines = (db.rfq_lines || []).filter((rl: any) => rl.rfq_id === comparison.rfq_id && !rl.is_deleted);

    for (const ql of qLines) {
      const rfqLine = rfqLines.find((rl: any) => rl.material_id === ql.material_id);
      const quantity = rfqLine ? rfqLine.quantity : 1;
      const uom = rfqLine ? rfqLine.uom : "PCS";

      const lineTotal = ql.total_amount || (Number(ql.quoted_unit_price) * Number(quantity) * (1 - (ql.discount_percent || 0)/100) * (1 + (ql.tax_percent || 0)/100) + (ql.freight || 0));
      totalVal += lineTotal;

      poLines.push({
        id: "pol-" + crypto.randomUUID(),
        purchase_order_id: poId,
        material_id: ql.material_id,
        material_code: ql.material_code,
        description: ql.description || "",
        quantity: Number(quantity),
        uom: uom,
        unit_price: Number(ql.quoted_unit_price),
        discount_percent: Number(ql.discount_percent || 0),
        tax_percent: Number(ql.tax_percent || 0),
        freight: Number(ql.freight || 0),
        net_unit_cost: quantity > 0 ? (lineTotal / quantity) : 0,
        total_amount: lineTotal,
        delivery_date: newPO.expected_delivery_date,
        is_deleted: false
      });
    }

    newPO.total_amount = totalVal;
    db.purchase_orders.push(newPO);
    db.purchase_order_lines.push(...poLines);

    addAuditLog(req.user.id, req.user.email, "PO_CREATE", `Generated Purchase Order ${poNumber} from Comparison ${comparison.comparison_number}`, "SUCCESS");
    saveDB();

    res.status(201).json({ ...newPO, lines: poLines });
  });

  // PUT /api/v1/purchase-orders/{id}
  app.put("/api/v1/purchase-orders/:id", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) {
      return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });
    }

    // Rule: Locked Purchase Orders cannot be edited
    // Locked if NOT in DRAFT or UNDER_REVIEW
    if (po.status !== "DRAFT" && po.status !== "UNDER_REVIEW") {
      return res.status(400).json({ code: "PO_LOCKED", message: "Locked Purchase Orders cannot be edited." });
    }

    const {
      currency,
      payment_terms,
      delivery_terms,
      incoterms,
      delivery_address,
      billing_address,
      expected_delivery_date,
      remarks,
      lines
    } = req.body;

    if (currency !== undefined) po.currency = currency;
    if (payment_terms !== undefined) po.payment_terms = payment_terms;
    if (delivery_terms !== undefined) po.delivery_terms = delivery_terms;
    if (incoterms !== undefined) po.incoterms = incoterms;
    if (delivery_address !== undefined) po.delivery_address = delivery_address;
    if (billing_address !== undefined) po.billing_address = billing_address;
    if (expected_delivery_date !== undefined) po.expected_delivery_date = expected_delivery_date;
    if (remarks !== undefined) po.remarks = remarks;

    // Handle lines update
    if (Array.isArray(lines)) {
      // Validate active materials first
      for (const line of lines) {
        const mat = (db.materials || []).find((m: any) => m.id === line.material_id);
        if (!mat || mat.is_deleted || (mat as any).status === "INACTIVE" || (mat as any).is_active === false) {
          return res.status(400).json({ code: "INACTIVE_MATERIAL", message: `PO lines cannot contain inactive materials: ${line.material_code || "Unknown"}` });
        }
      }

      // Remove previous lines
      db.purchase_order_lines = db.purchase_order_lines.filter((l: any) => l.purchase_order_id !== po.id);

      let totalVal = 0;
      for (const l of lines) {
        const lineTotal = Number(l.quantity) * Number(l.unit_price || 0) * (1 - Number(l.discount_percent || 0)/100) * (1 + Number(l.tax_percent || 0)/100) + Number(l.freight || 0);
        totalVal += lineTotal;

        db.purchase_order_lines.push({
          id: l.id && l.id.startsWith("pol-") ? l.id : "pol-" + crypto.randomUUID(),
          purchase_order_id: po.id,
          material_id: l.material_id,
          material_code: l.material_code,
          description: l.description || "",
          quantity: Number(l.quantity),
          uom: l.uom || "PCS",
          unit_price: Number(l.unit_price || 0),
          discount_percent: Number(l.discount_percent || 0),
          tax_percent: Number(l.tax_percent || 0),
          freight: Number(l.freight || 0),
          net_unit_cost: l.quantity > 0 ? (lineTotal / l.quantity) : 0,
          total_amount: lineTotal,
          delivery_date: l.delivery_date || po.expected_delivery_date,
          is_deleted: false
        });
      }
      po.total_amount = totalVal;
    }

    po.updated_at = new Date().toISOString();
    addAuditLog(req.user.id, req.user.email, "PO_UPDATE", `Updated Purchase Order ${po.po_number}`, "SUCCESS");
    saveDB();

    res.json(po);
  });

  // POST /api/v1/purchase-orders/{id}/submit
  app.post("/api/v1/purchase-orders/:id/submit", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    po.status = "UNDER_REVIEW";
    po.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PO_SUBMIT", `Submitted PO ${po.po_number} for L2-Admin approval`, "SUCCESS");
    recordNotification("SYSTEM", "L2-Admin", null, "PO Under Review", `Purchase Order ${po.po_number} is pending approval.`);
    saveDB();

    res.json({ success: true, status: po.status });
  });

  // POST /api/v1/purchase-orders/{id}/approve
  app.post("/api/v1/purchase-orders/:id/approve", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    // Permissions check
    if (req.user.role !== "L2-Admin") {
      return res.status(403).json({ code: "FORBIDDEN", message: "Only L2-Admin can approve Purchase Orders." });
    }

    po.status = "APPROVED";
    po.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PO_APPROVE", `Approved Purchase Order ${po.po_number}`, "SUCCESS");
    recordNotification("SYSTEM", null, null, "PO Approved", `Purchase Order ${po.po_number} was approved by ${req.user.email}.`);
    saveDB();

    res.json({ success: true, status: po.status });
  });

  // POST /api/v1/purchase-orders/{id}/issue
  app.post("/api/v1/purchase-orders/:id/issue", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    if (po.status !== "APPROVED") {
      return res.status(400).json({ code: "PO_NOT_APPROVED", message: "Purchase Order must be APPROVED before issuing." });
    }

    po.status = "ISSUED";
    po.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PO_ISSUE", `Issued Purchase Order ${po.po_number} to Vendor`, "SUCCESS");
    recordNotification("SYSTEM", null, null, "PO Issued", `Purchase Order ${po.po_number} was issued to vendor.`);
    saveDB();

    res.json({ success: true, status: po.status });
  });

  // POST /api/v1/purchase-orders/{id}/acknowledge
  app.post("/api/v1/purchase-orders/:id/acknowledge", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    const { acknowledgement_status, comments, contact_person } = req.body;
    if (!acknowledgement_status) {
      return res.status(400).json({ code: "MISSING_STATUS", message: "Acknowledgement status is required." });
    }

    // Save acknowledgement entry
    const ack: VendorAcknowledgement = {
      id: "ack-" + crypto.randomUUID(),
      purchase_order_id: po.id,
      acknowledgement_status,
      acknowledgement_date: new Date().toISOString().split("T")[0],
      comments: comments || null,
      contact_person: contact_person || "Vendor Sales Rep",
      is_deleted: false
    };
    db.vendor_acknowledgements.push(ack);

    // Apply lifecycle update based on vendor selection
    if (acknowledgement_status === "ACCEPTED" || acknowledgement_status === "ACCEPTED_WITH_COMMENTS") {
      po.status = "ACKNOWLEDGED";
    } else if (acknowledgement_status === "CHANGES_REQUESTED") {
      // "Vendor Requests Changes: Status updated with audit trail and notification."
      // Keep in ISSUED or set back to UNDER_REVIEW/DRAFT if requested. Let's keep status and track acknowledgement state.
      // We can keep it in UNDER_REVIEW so it can be revised or edited!
      po.status = "UNDER_REVIEW";
    } else if (acknowledgement_status === "DECLINED") {
      po.status = "CANCELLED";
    }

    po.updated_at = new Date().toISOString();

    addAuditLog(
      req.user.id,
      req.user.email,
      "PO_ACKNOWLEDGE",
      `Vendor recorded acknowledgement '${acknowledgement_status}' for PO ${po.po_number}. Comments: ${comments || "None"}`,
      "SUCCESS"
    );

    recordNotification(
      "SYSTEM",
      "L2-Admin",
      null,
      `PO Ack: ${acknowledgement_status}`,
      `Vendor ${acknowledgement_status} PO ${po.po_number}. Comments: ${comments || "None"}`
    );

    saveDB();

    res.json({ success: true, status: po.status, acknowledgement: ack });
  });

  // POST /api/v1/purchase-orders/{id}/revise
  app.post("/api/v1/purchase-orders/:id/revise", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    // Capture previous state of header & lines for snapshotted history
    const prevLines = db.purchase_order_lines.filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
    const snapshot = {
      header: { ...po },
      lines: prevLines.map((l: any) => ({ ...l }))
    };

    const nextRevisionNum = po.revision_number + 1;

    // Create revision log entry
    const revision: PurchaseOrderRevision = {
      id: "por-" + crypto.randomUUID(),
      purchase_order_id: po.id,
      revision_number: po.revision_number,
      revised_by: req.user.full_name || req.user.email,
      revised_at: new Date().toISOString(),
      change_summary: req.body.change_summary || `Revised from Rev ${po.revision_number} to Rev ${nextRevisionNum}`,
      snapshot_data: JSON.stringify(snapshot),
      is_deleted: false
    };
    db.purchase_order_revisions.push(revision);

    // Update PO header status and revision number
    po.revision_number = nextRevisionNum;
    po.status = "DRAFT"; // resets to DRAFT for revision editing & re-evaluation
    po.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PO_REVISE", `Created Revision ${nextRevisionNum} for PO ${po.po_number}`, "SUCCESS");
    recordNotification("SYSTEM", null, null, "PO Revised", `Purchase Order ${po.po_number} was revised to Rev ${nextRevisionNum} and reset to DRAFT.`);
    saveDB();

    res.json({ success: true, status: po.status, revision_number: po.revision_number });
  });

  // POST /api/v1/purchase-orders/{id}/cancel
  app.post("/api/v1/purchase-orders/:id/cancel", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    po.status = "CANCELLED";
    po.updated_at = new Date().toISOString();

    addAuditLog(req.user.id, req.user.email, "PO_CANCEL", `Cancelled Purchase Order ${po.po_number}`, "SUCCESS");
    recordNotification("SYSTEM", null, null, "PO Cancelled", `Purchase Order ${po.po_number} was cancelled.`);
    saveDB();

    res.json({ success: true, status: po.status });
  });

  // GET /api/v1/purchase-orders/{id}/print
  app.get("/api/v1/purchase-orders/:id/print", requireAuth, (req: any, res: any) => {
    initPoCollections();
    const po = db.purchase_orders.find((p: any) => p.id === req.params.id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found" });

    const lines = (db.purchase_order_lines || []).filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
    const vendor = (db.vendors || []).find((v: any) => v.id === po.vendor_id);

    // Calculate overall totals
    const lineSubtotal = lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0);
    const totalDiscount = lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price * (l.discount_percent || 0) / 100), 0);
    const totalTax = lines.reduce((acc: number, l: any) => acc + ((l.quantity * l.unit_price - (l.quantity * l.unit_price * (l.discount_percent || 0) / 100)) * (l.tax_percent || 0) / 100), 0);
    const totalFreight = lines.reduce((acc: number, l: any) => acc + (l.freight || 0), 0);

    res.json({
      companyDetails: {
        company_name: "CCS SPACEMAKER SI PVT LTD",
        address: "Corporate Office: 12th Floor, Tower B, Signature Towers, Gurgaon, Haryana - 122001",
        factory_address: "Plot No. 45, Sector 4, IMT Manesar, Gurugram, Haryana - 122050",
        gstin: "06AAACC4321R1Z5",
        email: "procurement@ccsspacemaker.com",
        phone: "+91-124-4900100"
      },
      vendorDetails: vendor ? {
        vendor_name: vendor.vendor_name,
        vendor_code: vendor.vendor_code,
        address: (() => {
          const addr = (db.vendor_addresses || []).find((a: any) => a.vendor_id === vendor.id && !a.is_deleted);
          return addr ? `${addr.address_line_1}, ${addr.address_line_2 || ""}, ${addr.city}, ${addr.state} - ${addr.pin_code}` : "Vendor Address Not Configured";
        })(),
        email: vendor.email || "N/A",
        phone: vendor.mobile || "N/A",
        gstin: vendor.gstin || "N/A"
      } : null,
      poHeader: po,
      poLines: lines,
      totals: {
        subtotal: lineSubtotal,
        discount: totalDiscount,
        tax: totalTax,
        freight: totalFreight,
        grandTotal: po.total_amount
      },
      authorizedSignatories: [
        { name: po.buyer, designation: "Buyer / Procurement Officer" },
        { name: "Suresh Narayanan", designation: "General Manager - Procurement" }
      ]
    });
  });


  // --- GOODS RECEIPT NOTE (GRN) ENDPOINTS ---

  function initGrnCollections() {
    if (!db.grns) db.grns = [];
    if (!db.grn_lines) db.grn_lines = [];
    if (!db.grn_histories) db.grn_histories = [];
    if (!db.purchase_orders) db.purchase_orders = [];
    if (!db.purchase_order_lines) db.purchase_order_lines = [];
  }

  function getPreviouslyReceivedQty(poLineId: string, excludeGrnId?: string): number {
    initGrnCollections();
    const activeGrnLines = (db.grn_lines || []).filter(line => {
      if (line.purchase_order_line_id !== poLineId) return false;
      if (line.is_deleted) return false;
      const grn = (db.grns || []).find(g => g.id === line.goods_receipt_id);
      if (!grn || grn.is_deleted) return false;
      if (excludeGrnId && grn.id === excludeGrnId) return false;
      return grn.status === "RECEIVED" || grn.status === "PARTIALLY_RECEIVED";
    });
    return activeGrnLines.reduce((sum, line) => sum + (line.accepted_quantity || 0), 0);
  }

  // GET /api/v1/grns
  app.get("/api/v1/grns", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const { status, vendor, warehouse, purchase_order_id, date } = req.query;
    let list = (db.grns || []).filter((g: any) => !g.is_deleted);

    if (status) {
      list = list.filter((g: any) => g.status === status);
    }
    if (vendor) {
      list = list.filter((g: any) => g.vendor_id === vendor);
    }
    if (warehouse) {
      list = list.filter((g: any) => g.warehouse.toLowerCase().includes(String(warehouse).toLowerCase()));
    }
    if (purchase_order_id) {
      list = list.filter((g: any) => g.purchase_order_id === purchase_order_id);
    }
    if (date) {
      list = list.filter((g: any) => g.grn_date === date);
    }

    const enriched = list.map((grn: any) => {
      const v = (db.vendors || []).find((item: any) => item.id === grn.vendor_id);
      const po = (db.purchase_orders || []).find((item: any) => item.id === grn.purchase_order_id);
      return {
        ...grn,
        vendor_name: v ? v.vendor_name : "Unknown Vendor",
        vendor_code: v ? v.vendor_code : "N/A",
        po_number: po ? po.po_number : "N/A"
      };
    });

    res.json(enriched);
  });

  // GET /api/v1/grns/:id
  app.get("/api/v1/grns/:id", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = (db.grns || []).find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) {
      return res.status(404).json({ code: "GRN_NOT_FOUND", message: "Goods Receipt Note not found" });
    }

    const lines = (db.grn_lines || []).filter((l: any) => l.goods_receipt_id === grn.id && !l.is_deleted);
    const history = (db.grn_histories || []).filter((h: any) => h.goods_receipt_id === grn.id);
    const v = (db.vendors || []).find((item: any) => item.id === grn.vendor_id);
    const po = (db.purchase_orders || []).find((item: any) => item.id === grn.purchase_order_id);

    res.json({
      ...grn,
      vendor_name: v ? v.vendor_name : "Unknown Vendor",
      vendor_code: v ? v.vendor_code : "N/A",
      po_number: po ? po.po_number : "N/A",
      lines,
      history
    });
  });

  // POST /api/v1/grns/from-po/:purchaseOrderId
  app.post("/api/v1/grns/from-po/:purchaseOrderId", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const po = (db.purchase_orders || []).find((p: any) => p.id === req.params.purchaseOrderId && !p.is_deleted);
    if (!po) {
      return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found." });
    }

    // Validation: PO must be ISSUED, ACKNOWLEDGED or PARTIALLY_RECEIVED
    if (po.status !== "ISSUED" && po.status !== "ACKNOWLEDGED" && po.status !== "PARTIALLY_RECEIVED") {
      return res.status(400).json({ 
        code: "INVALID_PO_STATUS", 
        message: `Only ISSUED, ACKNOWLEDGED, or PARTIALLY_RECEIVED Purchase Orders can be received. Current status: ${po.status}` 
      });
    }

    // Auto generate GRN number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = (db.grns || []).filter((g: any) => g.grn_number.startsWith(`GRN-${dateStr}`)).length + 1;
    const grn_number = `GRN-${dateStr}-${String(count).padStart(4, "0")}`;

    const grnId = "grn-" + crypto.randomUUID();
    const newGrn: GoodsReceiptHeader = {
      id: grnId,
      grn_number,
      grn_date: new Date().toISOString().slice(0, 10),
      purchase_order_id: po.id,
      vendor_id: po.vendor_id,
      warehouse: "Main Warehouse",
      vehicle_number: "",
      transporter: "",
      supplier_invoice_number: "",
      supplier_invoice_date: "",
      received_by: req.user.fullName || req.user.email,
      remarks: "",
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    // Copy lines from PO
    const poLines = (db.purchase_order_lines || []).filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
    const grnLines: GoodsReceiptLine[] = [];

    for (const poLine of poLines) {
      const previouslyReceived = getPreviouslyReceivedQty(poLine.id);
      const remaining = Math.max(0, poLine.quantity - previouslyReceived);
      
      // If we already fully received this item, skip it or add it with zero receiving quantity
      if (remaining <= 0) continue;

      const lineId = "grn-line-" + crypto.randomUUID();
      const grnLine: GoodsReceiptLine = {
        id: lineId,
        goods_receipt_id: grnId,
        purchase_order_line_id: poLine.id,
        material_id: poLine.material_id,
        material_code: poLine.material_code,
        description: poLine.description,
        ordered_quantity: poLine.quantity,
        previously_received_quantity: previouslyReceived,
        receiving_quantity: remaining,
        accepted_quantity: remaining,
        rejected_quantity: 0,
        pending_quantity: 0, // ordered - previously - receiving
        uom: poLine.uom,
        warehouse_location: "Main Warehouse",
        batch_number: "",
        serial_number: "",
        inspection_status: "PENDING",
        is_deleted: false
      };

      grnLines.push(grnLine);
    }

    if (grnLines.length === 0) {
      return res.status(400).json({
        code: "PO_ALREADY_FULLY_RECEIVED",
        message: "This Purchase Order has already been fully received."
      });
    }

    db.grns.push(newGrn);
    db.grn_lines.push(...grnLines);

    // Add to history
    const historyId = "grn-hist-" + crypto.randomUUID();
    const hist: GoodsReceiptHistory = {
      id: historyId,
      goods_receipt_id: grnId,
      timestamp: new Date().toISOString(),
      event_type: "CREATION",
      status_from: null,
      status_to: "DRAFT",
      user_email: req.user.email,
      remarks: "Goods Receipt Note draft initiated from Purchase Order"
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_CREATE", `Initiated GRN ${grn_number} from PO ${po.po_number}`, "SUCCESS");
    recordNotification("SYSTEM", "L2-Admin", null, "GRN Draft Created", `Goods Receipt Note ${grn_number} was drafted.`);
    saveDB();

    res.json({
      ...newGrn,
      lines: grnLines,
      history: [hist]
    });
  });

  // POST /api/v1/grns
  app.post("/api/v1/grns", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const {
      purchase_order_id,
      vendor_id,
      warehouse,
      vehicle_number,
      transporter,
      supplier_invoice_number,
      supplier_invoice_date,
      remarks,
      lines
    } = req.body;

    if (!purchase_order_id) {
      return res.status(400).json({ code: "MISSING_PO", message: "Purchase Order is mandatory." });
    }
    if (!vendor_id) {
      return res.status(400).json({ code: "MISSING_VENDOR", message: "Vendor is mandatory." });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = (db.grns || []).filter((g: any) => g.grn_number.startsWith(`GRN-${dateStr}`)).length + 1;
    const grn_number = `GRN-${dateStr}-${String(count).padStart(4, "0")}`;

    const grnId = "grn-" + crypto.randomUUID();
    const newGrn: GoodsReceiptHeader = {
      id: grnId,
      grn_number,
      grn_date: new Date().toISOString().slice(0, 10),
      purchase_order_id,
      vendor_id,
      warehouse: warehouse || "Main Warehouse",
      vehicle_number: vehicle_number || "",
      transporter: transporter || "",
      supplier_invoice_number: supplier_invoice_number || "",
      supplier_invoice_date: supplier_invoice_date || "",
      received_by: req.user.fullName || req.user.email,
      remarks: remarks || "",
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false
    };

    const grnLines: GoodsReceiptLine[] = [];
    if (lines && Array.isArray(lines)) {
      for (const line of lines) {
        const lineId = "grn-line-" + crypto.randomUUID();
        grnLines.push({
          id: lineId,
          goods_receipt_id: grnId,
          purchase_order_line_id: line.purchase_order_line_id,
          material_id: line.material_id,
          material_code: line.material_code,
          description: line.description,
          ordered_quantity: line.ordered_quantity || 0,
          previously_received_quantity: line.previously_received_quantity || 0,
          receiving_quantity: line.receiving_quantity || 0,
          accepted_quantity: line.accepted_quantity || line.receiving_quantity || 0,
          rejected_quantity: line.rejected_quantity || 0,
          pending_quantity: Math.max(0, (line.ordered_quantity || 0) - (line.previously_received_quantity || 0) - (line.receiving_quantity || 0)),
          uom: line.uom || "PCS",
          warehouse_location: line.warehouse_location || "Main Warehouse",
          batch_number: line.batch_number || "",
          serial_number: line.serial_number || "",
          inspection_status: line.inspection_status || "PENDING",
          is_deleted: false
        });
      }
    }

    db.grns.push(newGrn);
    db.grn_lines.push(...grnLines);

    const hist: GoodsReceiptHistory = {
      id: "grn-hist-" + crypto.randomUUID(),
      goods_receipt_id: grnId,
      timestamp: new Date().toISOString(),
      event_type: "CREATION",
      status_from: null,
      status_to: "DRAFT",
      user_email: req.user.email,
      remarks: "Goods Receipt Note manual draft created"
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_CREATE", `Created manual GRN ${grn_number}`, "SUCCESS");
    saveDB();

    res.json({
      ...newGrn,
      lines: grnLines,
      history: [hist]
    });
  });

  // GET /api/v1/grns/:id/history
  app.get("/api/v1/grns/:id/history", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const list = (db.grn_histories || []).filter((h: any) => h.goods_receipt_id === req.params.id);
    res.json(list);
  });

  // PUT /api/v1/grns/:id
  app.put("/api/v1/grns/:id", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = db.grns.find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) return res.status(404).json({ code: "GRN_NOT_FOUND", message: "GRN not found." });

    if (grn.status !== "DRAFT" && grn.status !== "UNDER_INSPECTION") {
      return res.status(400).json({ code: "LOCKED_GRN", message: "Completed or cancelled GRNs are immutable." });
    }

    const {
      warehouse,
      vehicle_number,
      transporter,
      supplier_invoice_number,
      supplier_invoice_date,
      remarks,
      lines
    } = req.body;

    if (warehouse !== undefined) grn.warehouse = warehouse;
    if (vehicle_number !== undefined) grn.vehicle_number = vehicle_number;
    if (transporter !== undefined) grn.transporter = transporter;
    if (supplier_invoice_number !== undefined) grn.supplier_invoice_number = supplier_invoice_number;
    if (supplier_invoice_date !== undefined) grn.supplier_invoice_date = supplier_invoice_date;
    if (remarks !== undefined) grn.remarks = remarks;

    grn.updated_at = new Date().toISOString();

    if (lines && Array.isArray(lines)) {
      for (const lineUpdate of lines) {
        const line = db.grn_lines.find((l: any) => l.id === lineUpdate.id && !l.is_deleted);
        if (line) {
          const prevReceived = line.previously_received_quantity || 0;
          const allowed = line.ordered_quantity - prevReceived;

          if (lineUpdate.receiving_quantity !== undefined) {
            if (lineUpdate.receiving_quantity < 0) {
              return res.status(400).json({ code: "NEGATIVE_QUANTITY", message: "Quantities cannot be negative." });
            }
            if (lineUpdate.receiving_quantity > allowed) {
              return res.status(400).json({ code: "OVER_RECEIVING", message: "Receiving Quantity cannot exceed Pending Quantity." });
            }
            line.receiving_quantity = lineUpdate.receiving_quantity;
          }

          if (lineUpdate.accepted_quantity !== undefined) line.accepted_quantity = lineUpdate.accepted_quantity;
          if (lineUpdate.rejected_quantity !== undefined) line.rejected_quantity = lineUpdate.rejected_quantity;
          if (lineUpdate.warehouse_location !== undefined) line.warehouse_location = lineUpdate.warehouse_location;
          if (lineUpdate.batch_number !== undefined) line.batch_number = lineUpdate.batch_number;
          if (lineUpdate.serial_number !== undefined) line.serial_number = lineUpdate.serial_number;
          if (lineUpdate.inspection_status !== undefined) line.inspection_status = lineUpdate.inspection_status;

          // Re-calculate line pending
          line.pending_quantity = Math.max(0, line.ordered_quantity - prevReceived - line.receiving_quantity);
        }
      }
    }

    saveDB();
    res.json(grn);
  });

  // POST /api/v1/grns/:id/submit
  app.post("/api/v1/grns/:id/submit", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = db.grns.find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) return res.status(404).json({ code: "GRN_NOT_FOUND", message: "GRN not found." });

    if (grn.status !== "DRAFT") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only DRAFT GRNs can be submitted." });
    }

    const lines = db.grn_lines.filter((l: any) => l.goods_receipt_id === grn.id && !l.is_deleted);

    // Validation checks
    for (const line of lines) {
      // 1. Inactive material rejection
      const material = (db.materials || []).find((m: any) => m.id === line.material_id);
      if (material && (material.is_active === false || material.is_deleted)) {
        return res.status(400).json({
          code: "INACTIVE_MATERIAL",
          message: `Material ${line.material_code} is INACTIVE and cannot be received.`
        });
      }

      // 2. Negative quantity checks
      if (line.receiving_quantity < 0 || line.accepted_quantity < 0 || line.rejected_quantity < 0) {
        return res.status(400).json({ code: "NEGATIVE_QUANTITY", message: "Quantities cannot be negative." });
      }

      // 3. Receiving quantity > Pending before receipt
      const maxAllowed = line.ordered_quantity - line.previously_received_quantity;
      if (line.receiving_quantity > maxAllowed) {
        return res.status(400).json({
          code: "OVER_RECEIVING",
          message: `Receiving quantity (${line.receiving_quantity}) exceeds the pending quantity (${maxAllowed}) for ${line.material_code}.`
        });
      }
    }

    grn.status = "UNDER_INSPECTION";
    grn.updated_at = new Date().toISOString();

    const hist: GoodsReceiptHistory = {
      id: "grn-hist-" + crypto.randomUUID(),
      goods_receipt_id: grn.id,
      timestamp: new Date().toISOString(),
      event_type: "STATUS_CHANGE",
      status_from: "DRAFT",
      status_to: "UNDER_INSPECTION",
      user_email: req.user.email,
      remarks: "Goods Receipt Note submitted for Inspection"
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_SUBMIT", `Submitted GRN ${grn.grn_number} for inspection`, "SUCCESS");
    recordNotification("SYSTEM", "L2-Admin", null, "GRN Submitted", `GRN ${grn.grn_number} is pending inspection.`);
    saveDB();

    res.json({ success: true, status: grn.status });
  });

  // POST /api/v1/grns/:id/inspect
  app.post("/api/v1/grns/:id/inspect", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = db.grns.find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) return res.status(404).json({ code: "GRN_NOT_FOUND", message: "GRN not found." });

    if (grn.status !== "UNDER_INSPECTION" && grn.status !== "DRAFT") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Inspection can only be performed on DRAFT or UNDER_INSPECTION GRNs." });
    }

    const { lines } = req.body;
    if (!lines || !Array.isArray(lines)) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "Inspection lines updates are required." });
    }

    for (const update of lines) {
      const line = db.grn_lines.find((l: any) => l.id === update.id && !l.is_deleted);
      if (!line) continue;

      if (update.receiving_quantity !== undefined) {
        line.receiving_quantity = update.receiving_quantity;
      }
      
      const accepted = update.accepted_quantity !== undefined ? update.accepted_quantity : line.accepted_quantity;
      const rejected = update.rejected_quantity !== undefined ? update.rejected_quantity : line.rejected_quantity;
      const status = update.inspection_status || line.inspection_status;

      // 1. Accepted + Rejected !== Receiving Quantity -> FAIL
      if (accepted + rejected !== line.receiving_quantity) {
        return res.status(400).json({
          code: "INVALID_RECEIPT_QUANTITIES",
          message: `Accepted quantity (${accepted}) + Rejected quantity (${rejected}) must equal Receiving quantity (${line.receiving_quantity}) for material ${line.material_code}.`
        });
      }

      // 2. If FAILED, Rejected quantity must be greater than zero
      if (status === "FAILED" && rejected <= 0) {
        return res.status(400).json({
          code: "REJECTED_QUANTITY_MANDATORY",
          message: `Rejected Quantity is mandatory and must be greater than zero if Inspection Status is FAILED.`
        });
      }

      // 3. Negative quantities check
      if (accepted < 0 || rejected < 0) {
        return res.status(400).json({ code: "NEGATIVE_QUANTITY", message: "Quantities cannot be negative." });
      }

      line.accepted_quantity = accepted;
      line.rejected_quantity = rejected;
      line.inspection_status = status;
      if (update.warehouse_location) line.warehouse_location = update.warehouse_location;
      if (update.batch_number !== undefined) line.batch_number = update.batch_number;
      if (update.serial_number !== undefined) line.serial_number = update.serial_number;
    }

    grn.updated_at = new Date().toISOString();

    const hist: GoodsReceiptHistory = {
      id: "grn-hist-" + crypto.randomUUID(),
      goods_receipt_id: grn.id,
      timestamp: new Date().toISOString(),
      event_type: "INSPECTION",
      status_from: grn.status,
      status_to: grn.status,
      user_email: req.user.email,
      remarks: "Goods Receipt Note inspection logged"
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_INSPECT", `Logged inspection results for GRN ${grn.grn_number}`, "SUCCESS");
    saveDB();

    res.json({ success: true, message: "Inspection results logged successfully." });
  });

  // POST /api/v1/grns/:id/receive
  app.post("/api/v1/grns/:id/receive", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = db.grns.find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) return res.status(404).json({ code: "GRN_NOT_FOUND", message: "GRN not found." });

    if (grn.status !== "UNDER_INSPECTION") {
      return res.status(400).json({ code: "INVALID_STATE", message: "Only GRNs in UNDER_INSPECTION status can be finalized/received." });
    }

    const lines = db.grn_lines.filter((l: any) => l.goods_receipt_id === grn.id && !l.is_deleted);

    // 1. All lines must be inspected (PASSED or FAILED) before receipt posting
    const pendingInspection = lines.some((l: any) => l.inspection_status === "PENDING");
    if (pendingInspection) {
      return res.status(400).json({
        code: "INSPECTION_PENDING",
        message: "Inspection must complete (either PASSED or FAILED) for all lines before receipt posting."
      });
    }

    const po = db.purchase_orders.find((p: any) => p.id === grn.purchase_order_id && !p.is_deleted);
    if (!po) return res.status(404).json({ code: "PO_NOT_FOUND", message: "Purchase order not found for this receipt." });

    // Validate quantities
    for (const line of lines) {
      const prevReceived = getPreviouslyReceivedQty(line.purchase_order_line_id, grn.id);
      const remainingAllowed = line.ordered_quantity - prevReceived;

      if (line.receiving_quantity > remainingAllowed) {
        return res.status(400).json({
          code: "OVER_RECEIVING",
          message: `Double receiving error: receiving quantity (${line.receiving_quantity}) exceeds remaining allowed quantity (${remainingAllowed}) for ${line.material_code}.`
        });
      }

      if (line.accepted_quantity + line.rejected_quantity !== line.receiving_quantity) {
        return res.status(400).json({
          code: "INVALID_RECEIPT_QUANTITIES",
          message: `Accepted (${line.accepted_quantity}) + Rejected (${line.rejected_quantity}) must equal Receiving quantity (${line.receiving_quantity}) for ${line.material_code}.`
        });
      }
    }

    // Process and update PO status and lines
    const poLines = db.purchase_order_lines.filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
    let allFullyReceived = true;

    for (const poLine of poLines) {
      // Find matching line in this GRN
      const grnLine = lines.find((l: any) => l.purchase_order_line_id === poLine.id);
      const thisAccepted = grnLine ? grnLine.accepted_quantity : 0;

      const prevReceived = getPreviouslyReceivedQty(poLine.id, grn.id);
      const totalAccepted = prevReceived + thisAccepted;

      // Update PO Line
      poLine.received_quantity = totalAccepted;
      poLine.pending_quantity = Math.max(0, poLine.quantity - totalAccepted);

      if (totalAccepted < poLine.quantity) {
        allFullyReceived = false;
      }
    }

    // Set PO Status
    po.status = allFullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";
    po.updated_at = new Date().toISOString();

    // Set GRN status
    grn.status = allFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
    grn.updated_at = new Date().toISOString();

    // Update lines pending to represent remaining pending on PO
    for (const line of lines) {
      const poLine = poLines.find((pl: any) => pl.id === line.purchase_order_line_id);
      if (poLine) {
        line.pending_quantity = poLine.pending_quantity || 0;
      }
    }

    const hist: GoodsReceiptHistory = {
      id: "grn-hist-" + crypto.randomUUID(),
      goods_receipt_id: grn.id,
      timestamp: new Date().toISOString(),
      event_type: "STATUS_CHANGE",
      status_from: "UNDER_INSPECTION",
      status_to: grn.status,
      user_email: req.user.email,
      remarks: `Goods Receipt finalized. PO status updated to ${po.status}`
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_RECEIVE", `Successfully finalized GRN ${grn.grn_number} with status ${grn.status}`, "SUCCESS");
    recordNotification("SYSTEM", "L2-Admin", null, "GRN Posting Finalized", `GRN ${grn.grn_number} was finalized. PO ${po.po_number} is now ${po.status}.`);
    saveDB();

    res.json({ success: true, status: grn.status, poStatus: po.status });
  });

  // POST /api/v1/grns/:id/cancel
  app.post("/api/v1/grns/:id/cancel", requireAuth, (req: any, res: any) => {
    initGrnCollections();
    const grn = db.grns.find((g: any) => g.id === req.params.id && !g.is_deleted);
    if (!grn) return res.status(404).json({ code: "GRN_NOT_FOUND", message: "GRN not found." });

    if (grn.status === "CANCELLED") {
      return res.status(400).json({ code: "ALREADY_CANCELLED", message: "GRN is already cancelled." });
    }

    const po = db.purchase_orders.find((p: any) => p.id === grn.purchase_order_id && !p.is_deleted);

    const oldStatus = grn.status;
    grn.status = "CANCELLED";
    grn.updated_at = new Date().toISOString();

    if (po && (oldStatus === "RECEIVED" || oldStatus === "PARTIALLY_RECEIVED")) {
      // Revert PO line received/pending quantities
      const poLines = db.purchase_order_lines.filter((l: any) => l.purchase_order_id === po.id && !l.is_deleted);
      const grnLines = db.grn_lines.filter((l: any) => l.goods_receipt_id === grn.id && !l.is_deleted);

      let anyReceived = false;
      let allFullyReceived = true;

      for (const poLine of poLines) {
        const grnLine = grnLines.find((l: any) => l.purchase_order_line_id === poLine.id);
        const thisAccepted = grnLine ? grnLine.accepted_quantity : 0;

        const currentTotal = poLine.received_quantity || 0;
        const revertedTotal = Math.max(0, currentTotal - thisAccepted);

        poLine.received_quantity = revertedTotal;
        poLine.pending_quantity = Math.max(0, poLine.quantity - revertedTotal);

        if (revertedTotal > 0) {
          anyReceived = true;
        }
        if (revertedTotal < poLine.quantity) {
          allFullyReceived = false;
        }
      }

      if (allFullyReceived) {
        po.status = "FULLY_RECEIVED";
      } else if (anyReceived) {
        po.status = "PARTIALLY_RECEIVED";
      } else {
        po.status = "ISSUED"; // Rollback to issued
      }
      po.updated_at = new Date().toISOString();
    }

    const hist: GoodsReceiptHistory = {
      id: "grn-hist-" + crypto.randomUUID(),
      goods_receipt_id: grn.id,
      timestamp: new Date().toISOString(),
      event_type: "CANCELLATION",
      status_from: oldStatus,
      status_to: "CANCELLED",
      user_email: req.user.email,
      remarks: `Goods Receipt Note cancelled by user`
    };
    db.grn_histories.push(hist);

    addAuditLog(req.user.id, req.user.email, "GRN_CANCEL", `Cancelled GRN ${grn.grn_number}`, "SUCCESS");
    recordNotification("SYSTEM", "L2-Admin", null, "GRN Cancelled", `GRN ${grn.grn_number} was cancelled.`);
    saveDB();

    res.json({ success: true, status: grn.status, poStatus: po ? po.status : null });
  });


  // --- GET ADMINISTRATIVE AUDITS ---

  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Starting Vite Server HMR Link Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n\n======================================================`);
    console.log(`🚀 CCS SPACEMAKER SECURE API SERVER LISTENING ON PORT ${PORT}`);
    console.log(`🔗 Interface Target Url: http://localhost:${PORT}`);
    console.log(`🏡 Persistence Database: ${DATA_FILE}`);
    console.log(`======================================================\n\n`);
  });
}

startServer();
