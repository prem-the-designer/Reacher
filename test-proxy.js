const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwNzMyOTM2NSwiZXhwIjoyMDIyOTM5MzY1fQ.X_'; // Default local anon key part

async function testProxy() {
  try {
    const res = await fetch(`https://nhnlpwfirkjcvqdwrcgw.supabase.co/functions/v1/similarweb-proxy`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmxwd2ZpcmtqY3ZxZHdyY2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3ODQ2MjAsImV4cCI6MjEwMjM2MDYyMH0.Zexfrt0XLAS7hfUOtgJtgN0V2bqWKE0Kls96wrSz3O8`
      },
      body: JSON.stringify({ action: 'fetch_domain', domain: 'example.com', countryEnabled: false, granularityEnabled: true })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testProxy();
