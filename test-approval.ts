// ==========================================
// CCS SPACEMAKER JOB COSTING PLATFORM
// Sprint 3B - Multi-Level Approval Workflow Verification
// ==========================================

import * as crypto from "crypto";

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

interface WorkflowHistory {
  id: string;
  estimate_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  notes: string | null;
  timestamp: string;
}

// MOCK DATA persistence state
let db_estimates: Estimate[] = [];
let db_workflow_history: WorkflowHistory[] = [];
let db_approval_matrices: ApprovalMatrix[] = [
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

function resetState() {
  db_estimates = [];
  db_workflow_history = [];
}

// SIMULATE: POST /api/v1/estimates
function createEstimate(description: string, userEmail: string): Estimate {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randStr = crypto.randomBytes(3).toString("hex").toUpperCase();
  const estimate_number = `EST-${dateStr}-${randStr}`;

  const newEst: Estimate = {
    id: "est-" + Math.random().toString(36).substring(2, 11),
    estimate_number,
    description,
    status: "DRAFT",
    revision_number: 1,
    parent_estimate_id: null,
    previous_revision_id: null,
    is_current_active: true,
    revision_notes: "Initial draft creation",
    revision_timestamp: new Date().toISOString(),
    cost_sheet_id: null,
    bom_header_id: null,
    customer_id: null,
    created_by: userEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db_estimates.push(newEst);
  return newEst;
}

// SIMULATE: POST /api/v1/estimates/:id/submit
function submitEstimate(estimateId: string, userEmail: string): Estimate {
  const estimate = db_estimates.find(e => e.id === estimateId);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.status !== "DRAFT" && estimate.status !== "CHANGES_REQUESTED") {
    throw new Error("Invalid transition from current state");
  }

  estimate.status = "UNDER_REVIEW";
  estimate.updated_at = new Date().toISOString();

  const activeLevels = db_approval_matrices.filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
  if (activeLevels.length > 0) {
    estimate.current_approval_level = activeLevels[0].approval_level;
    estimate.current_approver_role = activeLevels[0].role;
    estimate.pending_approval = true;
  } else {
    estimate.status = "APPROVED";
    estimate.current_approval_level = null;
    estimate.current_approver_role = null;
    estimate.pending_approval = false;
  }

  // Push history
  db_workflow_history.push({
    id: "ehist-" + Math.random().toString(36).substring(2, 11),
    estimate_id: estimate.id,
    from_status: "DRAFT",
    to_status: estimate.status,
    changed_by: userEmail,
    notes: "Submitted for review.",
    timestamp: new Date().toISOString()
  });

  return estimate;
}

// SIMULATE: POST /api/v1/estimates/:id/approve
function approveEstimate(estimateId: string, userRole: string, userEmail: string): Estimate {
  const estimate = db_estimates.find(e => e.id === estimateId);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.status !== "UNDER_REVIEW") {
    throw new Error("Only estimates in UNDER_REVIEW status can be approved.");
  }

  const activeLevels = db_approval_matrices.filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
  if (activeLevels.length === 0) {
    estimate.status = "APPROVED";
    estimate.current_approval_level = null;
    estimate.current_approver_role = null;
    estimate.pending_approval = false;
    return estimate;
  }

  if (!estimate.current_approval_level) {
    estimate.current_approval_level = activeLevels[0].approval_level;
    estimate.current_approver_role = activeLevels[0].role;
    estimate.pending_approval = true;
  }

  // Role verification - Scenario 3 validation
  if (userRole !== estimate.current_approver_role) {
    const err: any = new Error("403 Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const currentIdx = activeLevels.findIndex(l => l.approval_level === estimate.current_approval_level);
  const nextIdx = currentIdx + 1;

  const prevLevel = estimate.current_approval_level;

  if (nextIdx < activeLevels.length) {
    // Scenario 1: Level 1 Approval -> moves to Level 2
    estimate.current_approval_level = activeLevels[nextIdx].approval_level;
    estimate.current_approver_role = activeLevels[nextIdx].role;
    estimate.updated_at = new Date().toISOString();

    db_workflow_history.push({
      id: "ehist-" + Math.random().toString(36).substring(2, 11),
      estimate_id: estimate.id,
      from_status: `UNDER_REVIEW_LVL_${prevLevel}`,
      to_status: `UNDER_REVIEW_LVL_${estimate.current_approval_level}`,
      changed_by: userEmail,
      notes: `Level ${prevLevel} approved. Forwarded to Level ${estimate.current_approval_level}.`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Scenario 2: Final Approval -> status becomes APPROVED
    estimate.status = "APPROVED";
    estimate.current_approval_level = null;
    estimate.current_approver_role = null;
    estimate.pending_approval = false;
    estimate.updated_at = new Date().toISOString();

    db_workflow_history.push({
      id: "ehist-" + Math.random().toString(36).substring(2, 11),
      estimate_id: estimate.id,
      from_status: `UNDER_REVIEW_LVL_${prevLevel}`,
      to_status: "APPROVED",
      changed_by: userEmail,
      notes: `Final Level ${prevLevel} approved. Estimate status set to APPROVED.`,
      timestamp: new Date().toISOString()
    });
  }

  return estimate;
}

// SIMULATE: POST /api/v1/estimates/:id/reject
function rejectEstimate(estimateId: string, userRole: string, userEmail: string): Estimate {
  const estimate = db_estimates.find(e => e.id === estimateId);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.status !== "UNDER_REVIEW") {
    throw new Error("Only estimates in UNDER_REVIEW status can be rejected.");
  }

  if (estimate.current_approver_role && userRole !== estimate.current_approver_role) {
    const err: any = new Error("403 Forbidden");
    err.statusCode = 403;
    throw err;
  }

  estimate.status = "REJECTED";
  estimate.current_approval_level = null;
  estimate.current_approver_role = null;
  estimate.pending_approval = false;
  estimate.updated_at = new Date().toISOString();

  db_workflow_history.push({
    id: "ehist-" + Math.random().toString(36).substring(2, 11),
    estimate_id: estimate.id,
    from_status: "UNDER_REVIEW",
    to_status: "REJECTED",
    changed_by: userEmail,
    notes: "Estimate rejected.",
    timestamp: new Date().toISOString()
  });

  return estimate;
}

// SIMULATE: POST /api/v1/estimates/:id/request-changes
function requestChanges(estimateId: string, userRole: string, userEmail: string): Estimate {
  const estimate = db_estimates.find(e => e.id === estimateId);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.status !== "UNDER_REVIEW" && estimate.status !== "APPROVED") {
    throw new Error("Can only request changes on UNDER_REVIEW or APPROVED estimates.");
  }

  if (estimate.status === "UNDER_REVIEW") {
    if (estimate.current_approver_role && userRole !== estimate.current_approver_role) {
      const err: any = new Error("403 Forbidden");
      err.statusCode = 403;
      throw err;
    }
  }

  estimate.status = "CHANGES_REQUESTED";
  estimate.current_approval_level = null;
  estimate.current_approver_role = null;
  estimate.pending_approval = false;
  estimate.updated_at = new Date().toISOString();

  db_workflow_history.push({
    id: "ehist-" + Math.random().toString(36).substring(2, 11),
    estimate_id: estimate.id,
    from_status: "UNDER_REVIEW",
    to_status: "CHANGES_REQUESTED",
    changed_by: userEmail,
    notes: "Changes requested.",
    timestamp: new Date().toISOString()
  });

  return estimate;
}

// SIMULATE: GET /api/v1/estimates/:id/approval-progress
function getApprovalProgress(estimateId: string) {
  const estimate = db_estimates.find(e => e.id === estimateId);
  if (!estimate) throw new Error("Estimate not found");

  const activeLevels = db_approval_matrices.filter(m => m.is_active).sort((a,b) => a.sequence_order - b.sequence_order);
  const totalCount = activeLevels.length;

  let completed_levels: ApprovalMatrix[] = [];
  let remaining_levels: ApprovalMatrix[] = [];
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

  return {
    current_approval_level: estimate.current_approval_level || null,
    remaining_levels,
    completed_levels,
    overall_progress_percent: progress
  };
}

// ========================================================
// TEST RUNNER
// ========================================================
let passes = 0;
let fails = 0;

function assert(condition: boolean, testName: string, failureMessage: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passes++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   👉 Reason: ${failureMessage}`);
    fails++;
  }
}

async function runTests() {
  console.log("\n======================================================================");
  console.log("🏃 Sprint 3B - Multi-Level Approval Workflow - Test Execution Suite");
  console.log("======================================================================\n");

  // ------------------------------------------------------------------
  // Scenario 1: Level 1 Approval -> moves to Level 2
  // ------------------------------------------------------------------
  resetState();
  let est = createEstimate("Verifying level 1 workflow propagation", "estimator@ccs.com");
  submitEstimate(est.id, "estimator@ccs.com");
  
  // Current: Level 1, role: L1-Estimator, UNDER_REVIEW
  assert(est.status === "UNDER_REVIEW", "Scenario 1 Initial State check", `Expected status to be UNDER_REVIEW, got ${est.status}`);
  assert(est.current_approval_level === 1, "Scenario 1 Initial Level check", `Expected level to be 1, got ${est.current_approval_level}`);
  assert(est.current_approver_role === "L1-Estimator", "Scenario 1 Initial Role check", `Expected role to be L1-Estimator, got ${est.current_approver_role}`);

  approveEstimate(est.id, "L1-Estimator", "estimator-lead@ccs.com");
  
  assert(est.status === "UNDER_REVIEW", "Scenario 1 - Moves to Level 2 (status checks)", `Status should remain UNDER_REVIEW, got ${est.status}`);
  assert(est.current_approval_level === 2, "Scenario 1 - Moves to Level 2 (level checks)", `Expected level to move to 2, got ${est.current_approval_level}`);
  assert(est.current_approver_role === "PM", "Scenario 1 - Moves to Level 2 (role checks)", `Expected role to become PM, got ${est.current_approver_role}`);

  // ------------------------------------------------------------------
  // Scenario 2: Final Approval -> becomes APPROVED
  // ------------------------------------------------------------------
  resetState();
  est = createEstimate("Verifying entire approval chain to end state", "estimator@ccs.com");
  submitEstimate(est.id, "estimator@ccs.com");

  // Level 1: Approved by L1-Estimator
  approveEstimate(est.id, "L1-Estimator", "lead-estimator@ccs.com");
  // Level 2: Approved by PM
  approveEstimate(est.id, "PM", "project-mgr@ccs.com");
  
  assert(est.status === "UNDER_REVIEW", "Scenario 2 - Level 2 Approved (status check)", `Expected status to remain UNDER_REVIEW, got ${est.status}`);
  assert(est.current_approval_level === 3, "Scenario 2 - Level 2 Approved (level check)", `Expected level to be 3, got ${est.current_approval_level}`);
  assert(est.current_approver_role === "L2-Admin", "Scenario 2 - Level 2 Approved (role check)", `Expected role to be L2-Admin, got ${est.current_approver_role}`);

  // Level 3: Approved by L2-Admin (Final Level)
  approveEstimate(est.id, "L2-Admin", "general-mgr@ccs.com");

  assert(est.status === "APPROVED", "Scenario 2 - Final level approved (becomes APPROVED status)", `Expected final status to be APPROVED, got ${est.status}`);
  assert(est.current_approval_level === null, "Scenario 2 - Final level cleared level info", `Expected current_approval_level to be null, got ${est.current_approval_level}`);
  assert(est.current_approver_role === null, "Scenario 2 - Final level cleared role info", `Expected current_approver_role to be null, got ${est.current_approver_role}`);
  assert(est.pending_approval === false, "Scenario 2 - Final level clears pending flag", `Expected pending_approval to be false, got ${est.pending_approval}`);

  // ------------------------------------------------------------------
  // Scenario 3: Unauthorized User Approves -> HTTP 403 Forbidden
  // ------------------------------------------------------------------
  resetState();
  est = createEstimate("Verifying authorization checks", "estimator@ccs.com");
  submitEstimate(est.id, "estimator@ccs.com");

  // Current Level: 1 (role: L1-Estimator). Unauthorized user is "PM" or "L2-Admin"
  try {
    approveEstimate(est.id, "PM", "unauth-pm@ccs.com");
    assert(false, "Scenario 3 - Unauthorized User check", "PM was allowed to approve L1-Estimator level. This is a critical authorization failure!");
  } catch (err: any) {
    assert(err.statusCode === 403, "Scenario 3 - Unauthorized User check (throws 403)", `Expected status code 403 Forbidden, got ${err.statusCode || err.message}`);
  }

  // ------------------------------------------------------------------
  // Scenario 4: Request Changes -> CHANGES_REQUESTED
  // ------------------------------------------------------------------
  resetState();
  est = createEstimate("Verifying change request flow", "estimator@ccs.com");
  submitEstimate(est.id, "estimator@ccs.com");

  // Request changes as L1-Estimator (valid current role)
  requestChanges(est.id, "L1-Estimator", "lead-estimator@ccs.com");

  assert(est.status === "CHANGES_REQUESTED", "Scenario 4 - Request Changes (becomes CHANGES_REQUESTED)", `Expected status to become CHANGES_REQUESTED, got ${est.status}`);
  assert(est.current_approval_level === null, "Scenario 4 - Request Changes clears level", `Expected level to be null, got ${est.current_approval_level}`);
  assert(est.pending_approval === false, "Scenario 4 - Request Changes clears pending flag", `Expected pending_approval to be false`);

  // ------------------------------------------------------------------
  // Scenario 5: Reject -> REJECTED & stops workflow
  // ------------------------------------------------------------------
  resetState();
  est = createEstimate("Verifying workflow rejection", "estimator@ccs.com");
  submitEstimate(est.id, "estimator@ccs.com");

  // Reject as Level 1 Estimator
  rejectEstimate(est.id, "L1-Estimator", "lead-estimator@ccs.com");

  assert(est.status === "REJECTED", "Scenario 5 - Rejection status check", `Expected status to be REJECTED, got ${est.status}`);
  assert(est.current_approval_level === null, "Scenario 5 - Rejection clears level", `Expected level to be null, got ${est.current_approval_level}`);
  assert(est.pending_approval === false, "Scenario 5 - Rejection clears pending flag", `Expected pending_approval to be false`);

  // Verify we cannot approve a rejected estimate
  try {
    approveEstimate(est.id, "L1-Estimator", "lead-estimator@ccs.com");
    assert(false, "Scenario 5 - Block actions on rejected", "Was able to approve a rejected estimate!");
  } catch (err) {
    assert(true, "Scenario 5 - Block actions on rejected (rejection locked)", "Actions on REJECTED estimates are correctly blocked.");
  }

  // ------------------------------------------------------------------
  // Scenario 6: Approval Progress calculations
  // ------------------------------------------------------------------
  resetState();
  est = createEstimate("Verifying exact mathematical progress", "estimator@ccs.com");
  
  // Progress when Draft
  let progress = getApprovalProgress(est.id);
  assert(progress.overall_progress_percent === 0, "Scenario 6 - Draft Progress", `Expected 0%, got ${progress.overall_progress_percent}%`);
  assert(progress.completed_levels.length === 0, "Scenario 6 - Draft Completed levels count", `Expected 0 completed levels, got ${progress.completed_levels.length}`);
  assert(progress.remaining_levels.length === 3, "Scenario 6 - Draft Remaining levels count", `Expected 3 remaining levels, got ${progress.remaining_levels.length}`);

  // Progress when UNDER_REVIEW Level 1
  submitEstimate(est.id, "estimator@ccs.com");
  progress = getApprovalProgress(est.id);
  assert(progress.overall_progress_percent === 0, "Scenario 6 - Level 1 Progress", `Expected 0% (approved 0/3), got ${progress.overall_progress_percent}%`);
  assert(progress.completed_levels.length === 0, "Scenario 6 - Level 1 Completed list", `Expected 0 completed, got ${progress.completed_levels.length}`);
  assert(progress.remaining_levels.length === 3, "Scenario 6 - Level 1 Remaining list", `Expected 3 remaining, got ${progress.remaining_levels.length}`);

  // Progress when Level 2
  approveEstimate(est.id, "L1-Estimator", "lead-estimator@ccs.com");
  progress = getApprovalProgress(est.id);
  assert(progress.overall_progress_percent === 33, "Scenario 6 - Level 2 Progress", `Expected 33% (approved 1/3), got ${progress.overall_progress_percent}%`);
  assert(progress.completed_levels.length === 1 && progress.completed_levels[0].approval_level === 1, "Scenario 6 - Level 2 Completed list check", "Expected Level 1 to be completed");
  assert(progress.remaining_levels.length === 2 && progress.remaining_levels[0].approval_level === 2, "Scenario 6 - Level 2 Remaining list check", "Expected Levels 2, 3 to be remaining");

  // Progress when Level 3
  approveEstimate(est.id, "PM", "project-mgr@ccs.com");
  progress = getApprovalProgress(est.id);
  assert(progress.overall_progress_percent === 67, "Scenario 6 - Level 3 Progress", `Expected 67% (approved 2/3), got ${progress.overall_progress_percent}%`);
  assert(progress.completed_levels.length === 2, "Scenario 6 - Level 3 Completed list check", `Expected 2 completed, got ${progress.completed_levels.length}`);

  // Progress when fully Approved
  approveEstimate(est.id, "L2-Admin", "general-mgr@ccs.com");
  progress = getApprovalProgress(est.id);
  assert(progress.overall_progress_percent === 100, "Scenario 6 - Fully Approved Progress", `Expected 100%, got ${progress.overall_progress_percent}%`);
  assert(progress.completed_levels.length === 3, "Scenario 6 - Fully Approved Completed list count", `Expected 3 completed, got ${progress.completed_levels.length}`);
  assert(progress.remaining_levels.length === 0, "Scenario 6 - Fully Approved Remaining list count", `Expected 0 remaining, got ${progress.remaining_levels.length}`);

  console.log("\n======================================================================");
  console.log(`🏁 TEST EXECUTION COMPLETE: Passed: ${passes} | Failed: ${fails}`);
  console.log("======================================================================\n");

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
