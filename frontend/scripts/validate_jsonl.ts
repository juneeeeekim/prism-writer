
import fs from 'fs';
import path from 'path';

// =============================================================================
// Phase 5: JSONL Validation Script
// Validates that training_data.jsonl meets Google AI Studio requirements
// =============================================================================

const filePath = path.resolve(process.cwd(), 'training_data.jsonl');

console.log('🔍 Validating JSONL file:', filePath);
console.log('--------------------------------------------------');

if (!fs.existsSync(filePath)) {
  console.error('❌ File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(line => line.trim() !== '');

console.log(`📊 Total non-empty lines: ${lines.length}`);

let validCount = 0;
let invalidCount = 0;
const errors: string[] = [];

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];

  try {
    // ==========================================================================
    // Check 1: Valid JSON
    // ==========================================================================
    const parsed = JSON.parse(line);

    // ==========================================================================
    // Check 2: `messages` key exists at top level
    // ==========================================================================
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      errors.push(`Line ${lineNum}: Missing or invalid 'messages' array`);
      invalidCount++;
      continue;
    }

    // ==========================================================================
    // Check 3: `role` values are 'user' and 'model'
    // ==========================================================================
    const roles = parsed.messages.map((m: any) => m.role);
    const hasUser = roles.includes('user');
    const hasModel = roles.includes('model');
    const invalidRoles = roles.filter((r: string) => r !== 'user' && r !== 'model');

    if (!hasUser || !hasModel) {
      errors.push(`Line ${lineNum}: Missing user or model role`);
      invalidCount++;
      continue;
    }

    if (invalidRoles.length > 0) {
      errors.push(`Line ${lineNum}: Invalid roles found: ${invalidRoles.join(', ')}`);
      invalidCount++;
      continue;
    }

    // ==========================================================================
    // Check 4: Special characters are escaped (implicit via JSON.parse success)
    // ==========================================================================
    // If JSON.parse succeeded, escaping is correct

    validCount++;
  } catch (e: any) {
    errors.push(`Line ${lineNum}: Invalid JSON - ${e.message}`);
    invalidCount++;
  }
}

console.log('--------------------------------------------------');
console.log(`✅ Valid entries: ${validCount}`);
console.log(`❌ Invalid entries: ${invalidCount}`);

if (errors.length > 0) {
  console.log('\n🚨 Errors:');
  errors.forEach(err => console.log(`  - ${err}`));
}

if (invalidCount === 0) {
  console.log('\n🎉 All entries passed validation! Ready for Google AI Studio upload.');
  process.exit(0);
} else {
  console.log('\n⚠️ Some entries failed validation. Please review and fix.');
  process.exit(1);
}
