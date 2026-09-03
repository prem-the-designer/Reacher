import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhnlpwfirkjcvqdwrcgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmxwd2ZpcmtqY3ZxZHdyY2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3ODQ2MjAsImV4cCI6MjEwMjM2MDYyMH0.Zexfrt0XLAS7hfUOtgJtgN0V2bqWKE0Kls96wrSz3O8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data, error } = await supabase.from('notifications').insert({
    id: crypto.randomUUID(),
    category: 'low_api_credits',
    title: 'Warning: Low API Credits Test',
    body: `Test notification`,
    read: false,
    link_module: 'settings',
    link_label: 'View Settings'
  }).select();

  console.log("Insert result:", { data, error });
}

testInsert();
