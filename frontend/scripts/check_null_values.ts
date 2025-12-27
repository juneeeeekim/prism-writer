
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// =============================================================================
// Phase 5: NULL Data Check Script
// Checks for NULL gold_answer values in raft_dataset
// =============================================================================

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkNullValues() {
  console.log('🔍 Checking for NULL values in raft_dataset...');
  console.log('--------------------------------------------------');

  // Check for NULL gold_answer
  const { data: nullGoldAnswer, error: err1 } = await supabase
    .from('raft_dataset')
    .select('id')
    .is('gold_answer', null);

  if (err1) {
    console.error('Error checking gold_answer:', err1.message);
  } else {
    console.log(`❓ NULL gold_answer count: ${nullGoldAnswer?.length || 0}`);
  }

  // Check for NULL context
  const { data: nullContext, error: err2 } = await supabase
    .from('raft_dataset')
    .select('id')
    .is('context', null);

  if (err2) {
    console.error('Error checking context:', err2.message);
  } else {
    console.log(`❓ NULL context count: ${nullContext?.length || 0}`);
  }

  // Check for NULL user_query
  const { data: nullUserQuery, error: err3 } = await supabase
    .from('raft_dataset')
    .select('id')
    .is('user_query', null);

  if (err3) {
    console.error('Error checking user_query:', err3.message);
  } else {
    console.log(`❓ NULL user_query count: ${nullUserQuery?.length || 0}`);
  }

  console.log('--------------------------------------------------');
  
  const totalNulls = (nullGoldAnswer?.length || 0) + (nullContext?.length || 0) + (nullUserQuery?.length || 0);
  if (totalNulls === 0) {
    console.log('✅ No NULL values found in critical fields!');
  } else {
    console.log(`⚠️ Found ${totalNulls} rows with NULL values in critical fields.`);
  }
}

checkNullValues();
