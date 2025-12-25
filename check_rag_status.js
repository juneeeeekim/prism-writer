
require('dotenv').config({ path: './.env.local' });
const { createClient } = require('@supabase/supabase-js');


// Load env vars
const SUPABASE_URL = 'https://audrryyklmighhtdssoi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZHJyeXlrbG1pZ2hodGRzc29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTgyNTgsImV4cCI6MjA4MTI3NDI1OH0.cUlxfT4BlHOJklleSg_xJmOXANo3WBbO01lySZLSX9s';


if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDocuments() {
  console.log('--- Checking RAG Documents ---');
  
  // 1. Get recent documents
  const { data: docs, error: docError } = await supabase
    .from('rag_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (docError) {
    console.error('Error fetching documents:', docError);
    return;
  }

  console.log(`Found ${docs.length} recent documents:`);
  
  for (const doc of docs) {
    console.log(`\nDocument: [${doc.id}] ${doc.filename}`);
    console.log(`  - Status: ${doc.status}`);
    console.log(`  - Created: ${doc.created_at}`);
    console.log(`  - User ID: ${doc.user_id}`);

    // 2. Check chunks for this document
    const { count, error: chunkError } = await supabase
      .from('rag_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id);

    if (chunkError) {
      console.error('  - Error checking chunks:', chunkError);
    } else {
      console.log(`  - Total Chunks: ${count}`);
    }
  }
}

checkDocuments();
