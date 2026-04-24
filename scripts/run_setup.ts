import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://mvbluppriemvbmauevxl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Ymx1cHByaWVtdmJtYXVldnhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk1Njg5MywiZXhwIjoyMDkxNTMyODkzfQ.D6lbNd-uRCGGF9YEhHSy57uzMKdRgKQ-jum-TsqaOsc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  try {
    console.log('[v0] Reading SQL script...');
    const sqlContent = fs.readFileSync('./scripts/setup_transactions_complete.sql', 'utf-8');
    
    // Split by statements and execute each
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`[v0] Found ${statements.length} SQL statements`);
    
    for (const statement of statements) {
      console.log(`[v0] Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec', { sql: statement });
      
      if (error) {
        console.error('[v0] Error:', error.message);
      } else {
        console.log('[v0] Statement executed successfully');
      }
    }
    
    console.log('[v0] Database setup completed!');
  } catch (err) {
    console.error('[v0] Error:', err);
  }
}

setupDatabase();
