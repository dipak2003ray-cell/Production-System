// ==========================================
// CCS SPACEMAKER JOB COSTING & BOM INTELLIGENCE
// Sprint 4A - Purchase Requisition Foundation Verification Test Suite
// ==========================================

import * as crypto from "crypto";

// Interfaces Mirroring Backend
interface Material {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
  is_deleted: boolean;
  last_rate: number;
  std_unit: string;
}

interface BOMLine {
  id: string;
  bom_header_id: string;
  line_type: "MATERIAL" | "PROCESS" | "SUB_ASSEMBLY" | "NOTE";
  material_id: string | null;
  description: string | null;
  quantity: number;
  uom: string;
  is_deleted: boolean;
}

interface CostSheetLine {
  id: string;
  cost_sheet_header_id: string;
  bom_line_id: string;
  base_rate: number;
  calculated_subtotal: number;
  is_deleted: boolean;
}

interface Estimate {
  id: string;
  estimate_number: string;
  description: string;
  status: "DRAFT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "LOCKED" | "SUPERSEDED" | "REJECTED";
  revision_number: number;
  bom_header_id: string | null;
  cost_sheet_id: string | null;
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
  is_deleted: boolean;
  current_approval_level: number | null;
  current_approver_role: string | null;
  pending_approval: boolean;
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
  is_deleted: boolean;
}

interface ApprovalMatrix {
  id: string;
  approval_level: number;
  role: string;
  sequence_order: number;
  is_active: boolean;
}

// In-Memory DB mock
let db_materials: Material[] = [];
let db_bom_lines: BOMLine[] = [];
let db_cost_sheet_lines: CostSheetLine[] = [];
let db_estimates: Estimate[] = [];
let db_purchase_requisitions: PurchaseRequisition[] = [];
let db_purchase_requisition_lines: PurchaseRequisitionLine[] = [];
let db_approval_matrices: ApprovalMatrix[] = [];

function resetDatabase() {
  db_materials = [
    { id: "mat-1", code: "MAT-STEEL-001", description: "Stainless Steel Plate 5mm", is_active: true, is_deleted: false, last_rate: 150, std_unit: "KG" },
    { id: "mat-2", code: "MAT-ALUM-002", description: "Aluminum Bracket 2inch", is_active: true, is_deleted: false, last_rate: 85, std_unit: "PCS" },
    { id: "mat-inactive", code: "MAT-INACTIVE", description: "Deprecated Bracket", is_active: false, is_deleted: false, last_rate: 40, std_unit: "PCS" }
  ];

  db_bom_lines = [
    { id: "bomline-1", bom_header_id: "bom-1", line_type: "MATERIAL", material_id: "mat-1", description: "Stainless Steel Plate 5mm", quantity: 50, uom: "KG", is_deleted: false },
    { id: "bomline-2", bom_header_id: "bom-1", line_type: "MATERIAL", material_id: "mat-2", description: "Aluminum Bracket 2inch", quantity: 10, uom: "PCS", is_deleted: false },
    { id: "bomline-process", bom_header_id: "bom-1", line_type: "PROCESS", material_id: null, description: "Welding Process Row", quantity: 2, uom: "HRS", is_deleted: false }
  ];

  db_cost_sheet_lines = [
    { id: "csline-1", cost_sheet_header_id: "cs-1", bom_line_id: "bomline-1", base_rate: 150, calculated_subtotal: 7500, is_deleted: false },
    { id: "csline-2", cost_sheet_header_id: "cs-1", bom_line_id: "bomline-2", base_rate: 85, calculated_subtotal: 850, is_deleted: false }
  ];

  db_estimates = [
    { id: "est-approved", estimate_number: "EST-2026-001", description: "Main Industrial Rig Structure", status: "APPROVED", revision_number: 1, bom_header_id: "bom-1", cost_sheet_id: "cs-1", is_deleted: false },
    { id: "est-draft", estimate_number: "EST-2026-002", description: "Preliminary Warehouse Scaffold", status: "DRAFT", revision_number: 1, bom_header_id: "bom-1", cost_sheet_id: "cs-1", is_deleted: false }
  ];

  db_purchase_requisitions = [];
  db_purchase_requisition_lines = [];

  db_approval_matrices = [
    { id: "matrix-1", approval_level: 1, role: "L1-Estimator", sequence_order: 1, is_active: true },
    { id: "matrix-2", approval_level: 2, role: "PM", sequence_order: 2, is_active: true },
    { id: "matrix-3", approval_level: 3, role: "L2-Admin", sequence_order: 3, is_active: true }
  ];
}

// Helper generation function replicating backend endpoint logic exactly
function generatePRFromEstimate(estimateId: string, allowDuplicate: boolean = false): { success: boolean; message: string; pr?: PurchaseRequisition; lines?: PurchaseRequisitionLine[] } {
  const estimate = db_estimates.find(e => e.id === estimateId && !e.is_deleted);
  if (!estimate) {
    return { success: false, message: "Estimate not found." };
  }

  if (estimate.status !== "APPROVED") {
    return { success: false, message: "Generation blocked. Purchase Requisition can only be generated from an APPROVED estimate." };
  }

  const activePR = db_purchase_requisitions.find(p => p.estimate_id === estimate.id && p.status !== "CANCELLED" && !p.is_deleted);
  if (activePR && !allowDuplicate) {
    return { success: false, message: `Generation blocked. An active Purchase Requisition '${activePR.pr_number}' already exists for this Estimate.` };
  }

  const bomHeaderId = estimate.bom_header_id;
  if (!bomHeaderId) {
    return { success: false, message: "No BOM is associated with this Estimate." };
  }

  const bomLines = db_bom_lines.filter(l => l.bom_header_id === bomHeaderId && !l.is_deleted);
  const materialLines = bomLines.filter(l => l.line_type === "MATERIAL");

  if (materialLines.length === 0) {
    return { success: false, message: "No eligible Material lines found in the latest approved BOM." };
  }

  const costSheetLines = estimate.cost_sheet_id 
    ? db_cost_sheet_lines.filter(cl => cl.cost_sheet_header_id === estimate.cost_sheet_id && !cl.is_deleted)
    : [];

  // Duplicate material rows prevention / consolidation
  const consolidatedLines: { [materialId: string]: { 
    quantity: number; 
    total_amount: number; 
    bomLine: any; 
    material: any;
  } } = {};

  for (const bomLine of materialLines) {
    const materialId = bomLine.material_id;
    if (!materialId) continue;

    const mat = db_materials.find(m => m.id === materialId && !m.is_deleted);
    if (!mat) {
      return { success: false, message: `BOM refers to missing material with ID '${materialId}'.` };
    }

    if (!mat.is_active) {
      return { success: false, message: `Generation rejected: Material '${mat.code}' (${mat.description}) is inactive.` };
    }

    if (bomLine.quantity <= 0) {
      return { success: false, message: `Validation error: BOM material line '${bomLine.description}' has a zero or negative quantity (${bomLine.quantity}).` };
    }

    const costLine = costSheetLines.find(cl => cl.bom_line_id === bomLine.id && !cl.is_deleted);
    const estimated_unit_rate = costLine ? costLine.base_rate : mat.last_rate;
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
  const pr_number = `PR-20260630-${(db_purchase_requisitions.length + 1).toString().padStart(3, "0")}`;

  const pr: PurchaseRequisition = {
    id: prId,
    pr_number,
    pr_date: "2026-06-30",
    department: "Procurement Division",
    project: estimate.description,
    estimate_id: estimate.id,
    bom_header_id: bomHeaderId,
    requested_by: "test@ccs.com",
    priority: "MEDIUM",
    status: "DRAFT",
    remarks: "Auto-generated",
    created_by: "test@ccs.com",
    created_at: new Date().toISOString(),
    updated_by: "test@ccs.com",
    updated_at: new Date().toISOString(),
    is_deleted: false,
    current_approval_level: null,
    current_approver_role: null,
    pending_approval: false
  };

  const lines: PurchaseRequisitionLine[] = [];
  for (const [matId, data] of Object.entries(consolidatedLines)) {
    const final_rate = data.total_amount / data.quantity;
    lines.push({
      id: "prline-" + crypto.randomUUID(),
      purchase_requisition_id: prId,
      material_id: matId,
      material_code: data.material.code,
      description: data.bomLine.description || data.material.description,
      required_quantity: data.quantity,
      uom: data.bomLine.uom || data.material.std_unit,
      required_date: "2026-07-14",
      estimated_unit_rate: final_rate,
      estimated_amount: data.total_amount,
      remarks: "",
      status: "PENDING",
      is_deleted: false
    });
  }

  db_purchase_requisitions.push(pr);
  db_purchase_requisition_lines.push(...lines);

  return { success: true, message: "Successfully generated", pr, lines };
}

// Submit flow replicating backend multi-level logic
function submitPR(prId: string): { success: boolean; message: string; pr?: PurchaseRequisition } {
  const pr = db_purchase_requisitions.find(p => p.id === prId && !p.is_deleted);
  if (!pr) return { success: false, message: "PR not found" };

  if (pr.status !== "DRAFT") return { success: false, message: "PR must be in DRAFT" };

  const activeLevels = db_approval_matrices.filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);

  if (activeLevels.length === 0) {
    pr.status = "APPROVED";
  } else {
    pr.status = "UNDER_REVIEW";
    pr.current_approval_level = activeLevels[0].approval_level;
    pr.current_approver_role = activeLevels[0].role;
    pr.pending_approval = true;
  }
  return { success: true, message: "Submitted successfully", pr };
}

// Approve flow replicating backend multi-level logic
function approvePR(prId: string, userRole: string): { success: boolean; message: string; pr?: PurchaseRequisition } {
  const pr = db_purchase_requisitions.find(p => p.id === prId && !p.is_deleted);
  if (!pr) return { success: false, message: "PR not found" };

  if (pr.status !== "UNDER_REVIEW") return { success: false, message: "PR must be in UNDER_REVIEW" };

  if (userRole !== pr.current_approver_role) {
    return { success: false, message: `Role ${userRole} is unauthorized. Pending: ${pr.current_approver_role}` };
  }

  const activeLevels = db_approval_matrices.filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
  const currentIdx = activeLevels.findIndex(l => l.approval_level === pr.current_approval_level);
  const nextIdx = currentIdx + 1;

  if (nextIdx < activeLevels.length) {
    pr.current_approval_level = activeLevels[nextIdx].approval_level;
    pr.current_approver_role = activeLevels[nextIdx].role;
  } else {
    pr.status = "APPROVED";
    pr.current_approval_level = null;
    pr.current_approver_role = null;
    pr.pending_approval = false;
  }

  return { success: true, message: "Approved successfully", pr };
}

// EXECUTE TEST SUITE
console.log("=========================================================================");
console.log("RUNNING SPRINT 4A: PURCHASE REQUISITION FOUNDATION TEST SUITE");
console.log("=========================================================================");

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedTests++;
  }
}

// TEST 1: Generate PR from Approved Estimate (Normal Flow)
try {
  resetDatabase();
  const res = generatePRFromEstimate("est-approved");
  assert(res.success === true, "PR generation from APPROVED estimate should succeed.");
  assert(res.lines?.length === 2, "Generated PR should contain exactly 2 consolidated material lines.");
  assert(res.lines?.some(l => l.material_code === "MAT-STEEL-001" && l.required_quantity === 50) === true, "Steel Plate quantity of 50 should be imported.");
  assert(res.lines?.some(l => l.material_code === "MAT-ALUM-002" && l.required_quantity === 10) === true, "Aluminum Bracket quantity of 10 should be imported.");
  assert(res.lines?.some(l => l.description === "Welding Process Row") === false, "Process costing lines should be completely ignored.");
} catch (e: any) {
  console.error("[ERROR] Test 1 failed with exception: ", e.message);
  failedTests++;
}

// TEST 2: Reject generation if Estimate is not APPROVED
try {
  resetDatabase();
  const res = generatePRFromEstimate("est-draft");
  assert(res.success === false, "Generation from non-APPROVED estimate should be blocked.");
  assert(res.message.includes("APPROVED estimate"), "Error message should mention APPROVED estimate requirement.");
} catch (e: any) {
  console.error("[ERROR] Test 2 failed with exception: ", e.message);
  failedTests++;
}

// TEST 3: Duplicate protection blocking
try {
  resetDatabase();
  generatePRFromEstimate("est-approved"); // First generation
  const res = generatePRFromEstimate("est-approved", false); // Second generation without override
  assert(res.success === false, "Duplicate PR generation should be blocked.");
  assert(res.message.includes("already exists"), "Duplicate error message should declare that PR already exists.");

  const resOverride = generatePRFromEstimate("est-approved", true); // Generation with override
  assert(resOverride.success === true, "Duplicate PR generation should be permitted when explicitly overridden.");
} catch (e: any) {
  console.error("[ERROR] Test 3 failed with exception: ", e.message);
  failedTests++;
}

// TEST 4: Zero quantity material line validation
try {
  resetDatabase();
  db_bom_lines.push({ id: "bomline-zero", bom_header_id: "bom-1", line_type: "MATERIAL", material_id: "mat-1", description: "Zero plate", quantity: 0, uom: "KG", is_deleted: false });
  const res = generatePRFromEstimate("est-approved");
  assert(res.success === false, "Zero quantity material line must cause validation failure.");
  assert(res.message.includes("zero or negative quantity"), "Error message must report zero or negative quantity.");
} catch (e: any) {
  console.error("[ERROR] Test 4 failed with exception: ", e.message);
  failedTests++;
}

// TEST 5: Inactive Material rejection
try {
  resetDatabase();
  db_bom_lines.push({ id: "bomline-inactive", bom_header_id: "bom-1", line_type: "MATERIAL", material_id: "mat-inactive", description: "Inactive metal plate", quantity: 15, uom: "PCS", is_deleted: false });
  const res = generatePRFromEstimate("est-approved");
  assert(res.success === false, "BOM containing inactive materials must trigger a generation rejection.");
  assert(res.message.includes("is inactive"), "Rejection message must report the inactive status of the material.");
} catch (e: any) {
  console.error("[ERROR] Test 5 failed with exception: ", e.message);
  failedTests++;
}

// TEST 6: Workflow transitions and Multi-level Approvals
try {
  resetDatabase();
  const genRes = generatePRFromEstimate("est-approved");
  const pr = genRes.pr!;
  
  assert(pr.status === "DRAFT", "Newly generated PR should start in DRAFT status.");

  const subRes = submitPR(pr.id);
  assert(subRes.pr?.status === "UNDER_REVIEW", "Submitted PR with active matrix should enter UNDER_REVIEW status.");
  assert(subRes.pr?.current_approval_level === 1, "Submitted PR should require Level 1 review.");
  assert(subRes.pr?.current_approver_role === "L1-Estimator", "Level 1 approver role should be L1-Estimator.");

  // Reject unauthorized role approval
  const rejectApp = approvePR(pr.id, "PM");
  assert(rejectApp.success === false, "Approval with incorrect role should be rejected.");

  // Approve Level 1
  const appL1 = approvePR(pr.id, "L1-Estimator");
  assert(appL1.pr?.current_approval_level === 2, "PR should transition to Level 2 review.");
  assert(appL1.pr?.current_approver_role === "PM", "Level 2 approver role should be PM.");

  // Approve Level 2
  const appL2 = approvePR(pr.id, "PM");
  assert(appL2.pr?.current_approval_level === 3, "PR should transition to Level 3 review.");
  assert(appL2.pr?.current_approver_role === "L2-Admin", "Level 3 approver role should be L2-Admin.");

  // Approve Level 3 (Final)
  const appL3 = approvePR(pr.id, "L2-Admin");
  assert(appL3.pr?.status === "APPROVED", "PR should reach APPROVED status upon final role sign-off.");
  assert(appL3.pr?.current_approval_level === null, "Approved PR should clear current_approval_level.");
  assert(appL3.pr?.current_approver_role === null, "Approved PR should clear current_approver_role.");
} catch (e: any) {
  console.error("[ERROR] Test 6 failed with exception: ", e.message);
  failedTests++;
}

console.log("=========================================================================");
console.log(`TEST EXECUTION SUMMARY: Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("=========================================================================");
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("ALL SPRINT 4A PERSISTENCE & RULE CHECKS PASSED!");
}
