async function check() {
  const res = await fetch('https://nhnlpwfirkjcvqdwrcgw.supabase.co/functions/v1/similarweb-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fetch_domain', domain: 'google.com' })
  });
  const data = await res.json();
  console.log(data);
}
check();
