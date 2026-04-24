import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mvbluppriemvbmauevxl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Ymx1cHByaWVtdmJtYXVldnhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk1Njg5MywiZXhwIjoyMDkxNTMyODkzfQ.D6lbNd-uRCGGF9YEhHSy57uzMKdRgKQ-jum-TsqaOsc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('[v0] Reading migration script...');
    const sql = fs.readFileSync('./scripts/setup_transactions_complete.sql', 'utf-8');
    
    console.log('[v0] Executing migration...');
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('[v0] Error:', error.message);
    } else {
      console.log('[v0] Migration completed successfully!');
    }
  } catch (err) {
    console.log('[v0] Error running migration:', err.message);
    console.log('[v0] Please run this SQL manually in Supabase console:');
    console.log(fs.readFileSync('./scripts/setup_transactions_complete.sql', 'utf-8'));
  }
}

runMigration();
