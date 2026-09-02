// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { action, domain, countryEnabled, granularityEnabled } = body
    
    // Connect to Supabase to fetch the API key from the settings table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing on server' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: apiSettings, error: dbError } = await supabase
      .from('app_settings')
      .select('config')
      .eq('section', 'api')
      .single()

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Database error: ${dbError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const apiKey = apiSettings?.config?.credential_value
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Similarweb API Key not configured in Database' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (action === 'check_credits') {
      const response = await fetch(`https://api.similarweb.com/capabilities?api_key=${apiKey}`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      })
    }

    if (action === 'fetch_domain') {
      // Construct Similarweb API endpoint
      // Ensure the latest available month is queried to avoid "Dates not in range" errors.
      // Similarweb releases previous month's data around the 10th-12th of the current month.
      const date = new Date();
      if (date.getDate() < 12) {
        date.setMonth(date.getMonth() - 2);
      } else {
        date.setMonth(date.getMonth() - 1);
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dateStr = `${year}-${month}`;
      
      const countryStr = 'world';
      const granStr = 'monthly';
      
      const endpoint = `https://api.similarweb.com/v1/website/${domain}/unique-visitors/total?api_key=${apiKey}&start_date=${dateStr}&end_date=${dateStr}&country=${countryStr}&granularity=${granStr}&main_domain_only=false&format=json`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      
      // We always return 200 OK to Supabase Client so it doesn't throw a FunctionsHttpError.
      // The frontend will check data.meta.status or data.error instead.
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  } catch (error) {
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
