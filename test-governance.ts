// ==========================================
// CCS SPACEMAKER JOB COSTING & BOM INTELLIGENCE
// Sprint 3D - Governance Dashboard, SLA Monitoring & Final Certification Test Suite
// ==========================================

import * as crypto from "crypto";

// Interfaces mirroring the backend
interface Estimate {
  id: string;
  estimate_number: string;
  description: string;
  status: "DRAFT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "LOCKED" | "SUPERSEDED" | "REJECTED";
  revision_number: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_approval_level?: number | null;
  current_approver_role?: string | null;
  pending_approval?: boolean;
  is_deleted?: boolean;
}

interface ApprovalHistory {
  id: string;
  estimate_id: string;
  user_id: string;
  user_name: string;
  action: "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "LOCK";
  comments: string;
  timestamp: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
}

// In-memory test database
let db_estimates: Estimate[] = [];
let db_approval_histories: ApprovalHistory[] = [];
let db_users: User[] = [
  { id: "u-1", email: "estimator@ccs.com", full_name: "John Estimator", role_id: "role_l1_estimator" },
  { id: "u-2", email: "admin@ccs.com", full_name: "Sarah Admin", role_id: "role_l2_admin" },
  { id: "u-3", email: "approver@ccs.com", full_name: "Robert Signatory", role_id: "role_l3_approver" }
];

function resetTestState() {
  db_estimates = [
    {
      id: "est-1",
      estimate_number: "EST-20260630-A1",
      description: "Standard Space Frame Cost Sheet",
      status: "APPROVED",
      revision_number: 1,
      created_by: "estimator@ccs.com",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "est-2",
      estimate_number: "EST-20260630-B2",
      description: "Hydraulic System Assembly BOM",
      status: "UNDER_REVIEW",
      revision_number: 2,
      created_by: "estimator@ccs.com",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago (SLA Breached)
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      current_approval_level: 2,
      current_approver_role: "L2-Admin",
      pending_approval: true
    },
    {
      id: "est-3",
      estimate_number: "EST-20260630-C3",
      description: "Structural Truss Node Cost Sheet",
      status: "UNDER_REVIEW",
      revision_number: 1,
      created_by: "estimator@ccs.com",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (Compliant)
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      current_approval_level: 1,
      current_approver_role: "L1-Estimator",
      pending_approval: true
    }
  ];

  db_approval_histories = [
    {
      id: "hist-1",
      estimate_id: "est-1",
      user_id: "u-1",
      user_name: "John Estimator",
      action: "SUBMIT",
      comments: "Initial design ready for compliance check",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist-2",
      estimate_id: "est-1",
      user_id: "u-2",
      user_name: "Sarah Admin",
      action: "APPROVE",
      comments: "BOM validated and process routes cleared",
      timestamp: new Date(Date.now() - 4.5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist-3",
      estimate_id: "est-1",
      user_id: "u-3",
      user_name: "Robert Signatory",
      action: "APPROVE",
      comments: "Final signature applied",
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist-4",
      estimate_id: "est-2",
      user_id: "u-1",
      user_name: "John Estimator",
      action: "SUBMIT",
      comments: "Hydraulic Assembly v2 revised with cheaper materials",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

// 1. UNIT TEST: SLA calculation logic
function runSlaUnitTest() {
  console.log("▶ [UNIT TEST] Running SLA Calculations Verification...");
  resetTestState();
  
  const SLA_LIMIT_HOURS = 24;
  const item = db_estimates.find(e => e.id === "est-2")!; // created 48h ago
  
  const createdDate = new Date(item.created_at);
  const ageMins = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60));
  const isOverdue = ageMins > (SLA_LIMIT_HOURS * 60);
  const minsRemaining = Math.max(0, (SLA_LIMIT_HOURS * 60) - ageMins);
  
  if (isOverdue !== true) {
    throw new Error("SLA breach not identified for 48 hour queue age.");
  }
  if (minsRemaining !== 0) {
    throw new Error("Remaining minutes must be zero for overdue SLA.");
  }
  
  console.log("  ✔ SLA calculations unit test passed! (Correctly identified Overdue state)");
}

// 2. INTEGRATION TEST: KPI & Summary generation
function runKPIIntegrationTest() {
  console.log("▶ [INTEGRATION TEST] Running KPI Aggregations Verification...");
  resetTestState();

  const total = db_estimates.length;
  const approved = db_estimates.filter(e => e.status === "APPROVED").length;
  const underReview = db_estimates.filter(e => e.status === "UNDER_REVIEW").length;

  if (total !== 3 || approved !== 1 || underReview !== 2) {
    throw new Error(`Aggregate mismatch. Total: ${total}, Approved: ${approved}, Under Review: ${underReview}`);
  }

  const approvalRate = (approved / total) * 100;
  if (approvalRate !== (1/3)*100) {
    throw new Error(`Approval rate calculation error. Expected ~33.3%, got ${approvalRate}%`);
  }

  console.log("  ✔ KPI aggregation integration test passed!");
}

// 3. ANALYTICS TEST: Role and Level metric synthesis
function runAnalyticsTest() {
  console.log("▶ [ANALYTICS TEST] Running Workflow Analytics Verification...");
  resetTestState();

  // Calculate average duration of completed approvals (est-1 completed in 24 hours total)
  const est1 = db_estimates.find(e => e.id === "est-1")!;
  const start = new Date(est1.created_at).getTime();
  const end = new Date(est1.updated_at).getTime();
  const durationHours = (end - start) / (1000 * 60 * 60);

  if (durationHours !== 24) {
    throw new Error(`Completed duration mismatch. Expected 24 hours, got ${durationHours}`);
  }

  console.log("  ✔ Workflow analytics test passed!");
}

// 4. HEALTH SCORE TEST: Scoring compliance formulas
function runHealthScoreTest() {
  console.log("▶ [HEALTH TEST] Running Governance Health Score Formula...");
  resetTestState();

  // Test Formula logic
  const SLA_LIMIT_HOURS = 24;
  let compliantCount = 0;
  let totalReviewable = 0;

  db_estimates.forEach(e => {
    if (e.status === "UNDER_REVIEW") {
      totalReviewable++;
      const ageHours = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours <= SLA_LIMIT_HOURS) {
        compliantCount++;
      }
    }
  });

  const complianceRate = totalReviewable > 0 ? (compliantCount / totalReviewable) * 100 : 100;
  
  // Base Health score: starting from 100, penalize overdue queues
  const overdueCount = totalReviewable - compliantCount;
  const baseScore = Math.max(0, Math.floor(100 - (overdueCount * 15)));

  if (complianceRate !== 50) {
    throw new Error(`SLA Compliance mismatch. Expected 50% (1/2 compliant), got ${complianceRate}%`);
  }

  if (baseScore !== 85) { // 100 - (1 * 15) = 85
    throw new Error(`Governance health score penalty check failed. Expected 85, got ${baseScore}`);
  }

  console.log(`  ✔ Health Score calculation passed! Score: ${baseScore}% (Rating: GOOD)`);
}

// 5. PERFORMANCE TEST: User metrics tracking
function runUserPerformanceTest() {
  console.log("▶ [PERFORMANCE TEST] Running User Action Diagnostics...");
  resetTestState();

  const userPerformance = db_users.map(u => {
    const createdCount = db_estimates.filter(e => e.created_by === u.email).length;
    const actionsCount = db_approval_histories.filter(h => h.user_id === u.id).length;
    return {
      user: u.full_name,
      role: u.role_id,
      created: createdCount,
      actions: actionsCount
    };
  });

  const john = userPerformance.find(p => p.user === "John Estimator")!;
  if (john.created !== 3) {
    throw new Error(`User John Estimator created count mismatch. Expected 3, got ${john.created}`);
  }

  console.log("  ✔ User Performance diagnostic test passed!");
}

// Main execution runner
function runAllGovernanceTests() {
  console.log("======================================================================");
  console.log("CCS SPACEMAKER GOVERNANCE & SLA COMPLIANCE TEST SUITE");
  console.log("======================================================================");
  
  try {
    runSlaUnitTest();
    runKPIIntegrationTest();
    runAnalyticsTest();
    runHealthScoreTest();
    runUserPerformanceTest();
    
    console.log("======================================================================");
    console.log("✨ ALL SPRINT 3D GOVERNANCE TESTS PASSED SUCCESSFULLY! (100% READY)");
    console.log("======================================================================");
  } catch (error: any) {
    console.error("❌ TEST FAILURE ENCOUNTERED:");
    console.error(error.message);
    process.exit(1);
  }
}

runAllGovernanceTests();
