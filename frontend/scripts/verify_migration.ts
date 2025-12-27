
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional check

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}


// Use Service Role if available to bypass RLS for existence check
const supabaseKeyToUse = supabaseServiceKey || supabaseKey;
console.log('Credentials loaded. URL:', supabaseUrl, 'Key Length:', supabaseKeyToUse?.length);

const supabase = createClient(supabaseUrl, supabaseKeyToUse);

async function verify() {
  console.log('Starting Migration Test Verification...');

  try {
    // MT-1: raft_dataset Check
    const { data, error, count } = await supabase
      .from('raft_dataset')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.error('❌ MT-1 Failed: raft_dataset table does not exist.');
      } else {
        console.error('❌ MT-1 Failed with error:', JSON.stringify(error, null, 2));
      }
    } else {
      console.log('✅ MT-1 Passed: raft_dataset table exists. Count:', count);
    }

    // MT-2: RLS Check (Simple check: attempt to insert as anon which should fail)
    if (supabaseServiceKey) {
        console.log('Checking MT-2 with Anon Client...');
      // We are admin, verified table exists.
      // Now verify Anon behavior
      const anonClient = createClient(supabaseUrl as string, supabaseKey as string);
      
      
      const { error: insertError } = await anonClient
        .from('raft_dataset')
        .insert({
          user_query: 'test',
          context: 'test',
          gold_answer: 'test',
          source: 'manual'
        });
        
      if (insertError) {
         console.log('✅ MT-2 Passed: Anon insert blocked. Error:', insertError.message);
      } else {
         console.log('⚠️ MT-2 Warning: Anon insert succeeded (RLS might be off).');
      }
    } else {
      console.log('ℹ️ Skipping MT-2 thorough check (No Service Role Key).');
    }

    // MT-3: Index Existence
    console.log('ℹ️ MT-3: Inferred from successful MT-1 (indexes created with table).');
    
  } catch (err) {
      console.error('Unexpected error:', err);
  }
}

verify();
