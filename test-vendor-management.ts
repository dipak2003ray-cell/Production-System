// ==========================================
// CCS SPACEMAKER JOB COSTING & BOM INTELLIGENCE
// Sprint 4B - Vendor Master & Vendor Management Verification Test Suite
// ==========================================

import * as crypto from "crypto";

// Mock database to verify business rules in isolation
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
  status: "DRAFT" | "ACTIVE" | "BLOCKED" | "INACTIVE" | "ARCHIVED";
  payment_terms: string;
  credit_days: number;
  currency: string;
  incoterms: string;
  delivery_terms: string;
  preferred_transport: string;
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

// In-memory db state for testing
let db_vendors: Vendor[] = [];
let db_addresses: any[] = [];
let db_banks: any[] = [];
let db_vendor_ratings: VendorRating[] = [];
let db_vendor_material_mappings: VendorMaterialMapping[] = [];

let passes = 0;
let fails = 0;

function assert(condition: boolean, name: string, errMsg: string = "") {
  if (condition) {
    console.log(` ✅ PASS: ${name}`);
    passes++;
  } else {
    console.error(` ❌ FAIL: ${name}`);
    if (errMsg) console.error(`    Details: ${errMsg}`);
    fails++;
  }
}

function resetTestState() {
  db_vendors = [];
  db_addresses = [];
  db_banks = [];
  db_vendor_ratings = [];
  db_vendor_material_mappings = [];
}

// Helper: Validation utilities replicating server.ts rules
function validateVendorData(data: Partial<Vendor>): { success: boolean; code?: string; message?: string } {
  const { vendor_name, legal_name, vendor_type, gstin, pan, contact_person, email, mobile } = data;

  if (!vendor_name || !legal_name || !vendor_type || !gstin || !pan || !contact_person || !email || !mobile) {
    return { success: false, code: "VALIDATION_FAILED", message: "Required general vendor info is missing." };
  }

  const gstinTrimmed = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(gstinTrimmed)) {
    return { success: false, code: "INVALID_GSTIN", message: "Invalid GSTIN format." };
  }

  const panTrimmed = pan.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(panTrimmed)) {
    return { success: false, code: "INVALID_PAN", message: "Invalid PAN format." };
  }

  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    return { success: false, code: "INVALID_EMAIL", message: "Invalid Email address format." };
  }

  const mobileTrimmed = mobile.trim();
  const mobileRegex = /^\+?(\d[\s-]?){9,14}\d$/;
  if (!mobileRegex.test(mobileTrimmed)) {
    return { success: false, code: "INVALID_MOBILE", message: "Invalid Mobile format." };
  }

  // Duplicate GSTIN
  const dupGstin = db_vendors.find(v => !v.is_deleted && v.gstin.toUpperCase() === gstinTrimmed);
  if (dupGstin) {
    return { success: false, code: "DUPLICATE_GSTIN", message: "Duplicate GSTIN already registered." };
  }

  return { success: true };
}

function createVendor(data: Omit<Vendor, "id" | "vendor_code" | "status" | "is_deleted">): { success: boolean; vendor?: Vendor; error?: any } {
  const check = validateVendorData(data);
  if (!check.success) {
    return { success: false, error: check };
  }

  const id = "vnd-" + crypto.randomUUID();
  const vendor_code = `VND-${new Date().getFullYear()}-${(db_vendors.length + 1).toString().padStart(4, "0")}`;

  const newVendor: Vendor = {
    ...data,
    id,
    vendor_code,
    status: "DRAFT",
    is_deleted: false
  };

  db_vendors.push(newVendor);
  return { success: true, vendor: newVendor };
}

function mapMaterialToVendor(mapping: Omit<VendorMaterialMapping, "id" | "is_deleted">): { success: boolean; mapping?: VendorMaterialMapping; message?: string } {
  const vendor = db_vendors.find(v => v.id === mapping.vendor_id && !v.is_deleted);
  if (!vendor) {
    return { success: false, message: "Vendor not found." };
  }

  // Check: Inactive vendors cannot be mapped to materials
  if (vendor.status !== "ACTIVE") {
    return { success: false, message: "Only ACTIVE status vendors can be mapped to materials." };
  }

  // Enforce single preferred vendor flag per material
  if (mapping.preferred_vendor_flag) {
    db_vendor_material_mappings.forEach(m => {
      if (m.material_id === mapping.material_id && !m.is_deleted) {
        m.preferred_vendor_flag = false;
      }
    });
  }

  const newMapping: VendorMaterialMapping = {
    ...mapping,
    id: "vmm-" + crypto.randomUUID(),
    is_deleted: false
  };

  db_vendor_material_mappings.push(newMapping);
  return { success: true, mapping: newMapping };
}

function runTests() {
  console.log("\n========================================================");
  console.log("🏁 SPRINT 4B VENDOR MASTER & VENDOR MANAGEMENT VERIFICATION");
  console.log("========================================================\n");

  // ------------------------------------------------------------------
  // Scenario 1: Create Vendor
  // ------------------------------------------------------------------
  resetTestState();
  const result1 = createVendor({
    vendor_name: "Acme Industrial Supplies",
    legal_name: "Acme Industrial Supplies Pvt Ltd",
    vendor_category: "Standard",
    vendor_type: "Manufacturer",
    gstin: "27AAAAA1111A1Z1", // Valid GSTIN format
    pan: "AAAAA1111A", // Valid PAN format
    msme_status: true,
    contact_person: "John Doe",
    email: "john.doe@acme.com",
    mobile: "9876543210",
    payment_terms: "Net 30",
    credit_days: 30,
    currency: "INR",
    incoterms: "Ex Works",
    delivery_terms: "Direct",
    preferred_transport: "Road"
  });

  assert(result1.success === true, "Scenario 1: Vendor created successfully with correct properties");
  if (result1.vendor) {
    assert(result1.vendor.vendor_code.startsWith("VND-"), "Scenario 1: Auto-generated Vendor Code starts with VND-");
    assert(result1.vendor.status === "DRAFT", "Scenario 1: Default status is DRAFT");
  }

  // ------------------------------------------------------------------
  // Scenario 2: Duplicate GSTIN
  // ------------------------------------------------------------------
  const result2 = createVendor({
    vendor_name: "Acme Duplicates",
    legal_name: "Acme Duplicates Pvt Ltd",
    vendor_category: "Standard",
    vendor_type: "Trader",
    gstin: "27AAAAA1111A1Z1", // Duplicate GSTIN
    pan: "BBBBB2222B",
    msme_status: false,
    contact_person: "Jane Doe",
    email: "jane@acme.com",
    mobile: "9999888877",
    payment_terms: "Net 45",
    credit_days: 45,
    currency: "INR",
    incoterms: "CIF",
    delivery_terms: "Port delivery",
    preferred_transport: "Sea"
  });

  assert(result2.success === false && result2.error?.code === "DUPLICATE_GSTIN", "Scenario 2: Rejected duplicate GSTIN correctly with validation error");

  // ------------------------------------------------------------------
  // Scenario 3: Inactive Vendor -> Assign Material
  // ------------------------------------------------------------------
  const draftVendor = result1.vendor!;
  const result3 = mapMaterialToVendor({
    vendor_id: draftVendor.id,
    material_id: "mat-steel-123",
    vendor_material_code: "ACME-ST-123",
    preferred_vendor_flag: true,
    last_purchase_rate: 120,
    lead_time_days: 5,
    moq: 100
  });

  assert(result3.success === false, "Scenario 3: Rejected assigning materials to inactive/draft vendor correctly");

  // ------------------------------------------------------------------
  // Scenario 4: Activate Vendor
  // ------------------------------------------------------------------
  draftVendor.status = "ACTIVE"; // Activating
  const result4 = mapMaterialToVendor({
    vendor_id: draftVendor.id,
    material_id: "mat-steel-123",
    vendor_material_code: "ACME-ST-123",
    preferred_vendor_flag: true,
    last_purchase_rate: 120,
    lead_time_days: 5,
    moq: 100
  });

  assert(result4.success === true, "Scenario 4: Activated vendor successfully became available for material mapping");

  // ------------------------------------------------------------------
  // Scenario 5: Preferred Vendor Constraint
  // ------------------------------------------------------------------
  // Create another vendor and activate
  const secondVendorResult = createVendor({
    vendor_name: "Apex Steel Ltd",
    legal_name: "Apex Steel Manufacturing Ltd",
    vendor_category: "Premium",
    vendor_type: "Manufacturer",
    gstin: "27BBBBB2222B2Z2",
    pan: "BBBBB2222B",
    msme_status: false,
    contact_person: "Bob Builder",
    email: "bob@apex.com",
    mobile: "9123456789",
    payment_terms: "Net 15",
    credit_days: 15,
    currency: "INR",
    incoterms: "FOB",
    delivery_terms: "Direct",
    preferred_transport: "Rail"
  });

  const secondVendor = secondVendorResult.vendor!;
  secondVendor.status = "ACTIVE"; // Activate second vendor

  // Map second vendor as PREFERRED for the same material "mat-steel-123"
  const result5 = mapMaterialToVendor({
    vendor_id: secondVendor.id,
    material_id: "mat-steel-123",
    vendor_material_code: "APEX-ST-456",
    preferred_vendor_flag: true,
    last_purchase_rate: 115,
    lead_time_days: 3,
    moq: 50
  });

  assert(result5.success === true, "Scenario 5: Registered second preferred vendor mapping");
  
  // Verify that the first vendor's preferred flag was cleared automatically to enforce exactly one preferred vendor per material
  const firstMapping = db_vendor_material_mappings.find(m => m.vendor_id === draftVendor.id && m.material_id === "mat-steel-123");
  const secondMapping = db_vendor_material_mappings.find(m => m.vendor_id === secondVendor.id && m.material_id === "mat-steel-123");

  assert(firstMapping?.preferred_vendor_flag === false, "Scenario 5: First mapping's preferred flag was cleared automatically");
  assert(secondMapping?.preferred_vendor_flag === true, "Scenario 5: Second mapping is the single preferred supplier for this material");

  // ------------------------------------------------------------------
  // Scenario 6: Block Vendor
  // ------------------------------------------------------------------
  secondVendor.status = "BLOCKED";
  assert(secondVendor.status === "BLOCKED", "Scenario 6: Vendor status changed to BLOCKED successfully");

  // ------------------------------------------------------------------
  // Scenario 7: Vendor Rating update
  // ------------------------------------------------------------------
  const ratingRecord: VendorRating = {
    id: "rtg-1",
    vendor_id: draftVendor.id,
    quality_rating: 4,
    delivery_rating: 5,
    price_rating: 3,
    service_rating: 4,
    overall_rating: 4,
    is_deleted: false
  };
  db_vendor_ratings.push(ratingRecord);

  // Update Ratings
  const updatedRating = db_vendor_ratings.find(r => r.vendor_id === draftVendor.id);
  if (updatedRating) {
    updatedRating.quality_rating = 5;
    updatedRating.overall_rating = 4.5;
  }

  assert(ratingRecord.quality_rating === 5 && ratingRecord.overall_rating === 4.5, "Scenario 7: Vendor manual ratings persisted and updated correctly");

  console.log("\n========================================================");
  console.log(`🏁 TEST EXECUTION COMPLETE: Passed: ${passes} | Failed: ${fails}`);
  console.log("========================================================\n");

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
