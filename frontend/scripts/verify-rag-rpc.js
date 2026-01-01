
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TARGET_USER_ID = '9197d9da-604c-4deb-a148-bf011d73a542'; // User from logs
const TEST_QUERY_EMBEDDING = new Array(1536).fill(0.1); // Dummy embedding vector

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyRPC() {
  console.log('--- RPC Verification Start ---');
  console.log('Target User:', TARGET_USER_ID);
  
  // 1. Call match_document_chunks
  console.log('\nCalling match_document_chunks...');
  
  /* 
    We use a very low threshold (-1.0) to ensure we match *something* if data exists.
    We pass a dummy embedding since we just want to verify the table JOIN works.
  */
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: TEST_QUERY_EMBEDDING,
    match_threshold: -1.0, 
    match_count: 5,
    user_id_param: TARGET_USER_ID,
    category_param: null
  });

  if (error) {
    console.error('❌ RPC FAILED:', error);
    console.log('\nPossible causes:');
    console.log('1. You have NOT executed the SQL migration yet.');
    console.log('2. The function signature does not match (e.g. parameter names).');
  } else {
    if (data && data.length > 0) {
      console.log('✅ RPC SUCCESS! Retrieved', data.length, 'chunks.');
      console.log('Sample chunk:', data[0].content.substring(0, 50) + '...');
      console.log('\nConclusion: The DB fix IS APPLIED correctly.');
    } else {
      console.log('⚠️ RPC returned 0 results.');
      console.log('This means the function ran but found no matches.');
      console.log('Possible causes:');
      console.log('1. User has no chunks (but we saw 147 earlier).');
      console.log('2. The function is still querying the empty "document_chunks" table (Fix NOT applied).');
    }
  }
}

verifyRPC();
