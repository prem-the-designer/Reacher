import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function checkDb() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/similarweb_reach?select=*&order=id.desc&limit=5`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  
  const data = await res.json();
  console.log("Latest records in similarweb_reach:", data);
}

checkDb();
