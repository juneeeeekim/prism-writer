
// Mock Data
const RAFT_CATEGORIES = ["마케팅", "기술/개발", "일반/상식"];
const dbDocuments = [
  { category: "마케팅" },       // Exact match
  { category: " 마케팅 " },     // Dirty (spaces)
  { category: "기술/개발" },    // Exact match
  { category: "New Category" }, // New
  { category: " New Category " }// Dirty new
];

console.log("--- Logic Verification Start ---");

// 1. Simulate DB Extraction & Trim
const dbCategories = dbDocuments.map(d => d.category?.trim() || []);
console.log("Trimmed DB Categories:", dbCategories);

// 2. Simulate Merge & Dedup
const uniqueCategoriesSet = new Set([
  ...RAFT_CATEGORIES,
  ...dbCategories
]);

// 3. Sort
const sortedCategories = Array.from(uniqueCategoriesSet)
  .filter(c => c && c.length > 0)
  .sort((a, b) => a.localeCompare(b, 'ko'));

console.log("Final Unique Categories:", sortedCategories);

// Verification Assertion
const expected = ["New Category", "기술/개발", "마케팅", "일반/상식"].sort((a, b) => a.localeCompare(b, 'ko'));
const isMatch = JSON.stringify(sortedCategories) === JSON.stringify(expected);

if (isMatch) {
  console.log("✅ Data Clean Test PASSED: Duplicates merged and trimmed correctly.");
} else {
  console.error("❌ Data Clean Test FAILED");
  console.error("Expected:", expected);
  console.error("Actual:", sortedCategories);
  process.exit(1);
}
