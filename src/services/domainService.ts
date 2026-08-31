import { DomainRecord, ErrorType } from '@/types';
import { supabase } from '@/lib/supabase';
import { getSettings } from '@/services/adminService';

/**
 * Normalizes input domain per §5 & §11
 * Accepts: example.com, www.example.com, https://example.com, https://www.example.com/path
 * Strips scheme, www., path, query, fragment, port and trailing dot; lowercases.
 */
export function normalizeDomain(rawInput: string): string {
  if (!rawInput) return '';
  let cleaned = rawInput.trim();
  cleaned = cleaned.replace(/^[a-zA-Z]+:+\/*/, '');
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@').pop() || '';
  }
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.replace(/:\d+(?=\/|$)/, '');
  cleaned = cleaned.replace(/^www\./i, '');
  cleaned = cleaned.replace(/[\/\.]+$/, '');
  return cleaned.toLowerCase();
}

/**
 * Validates domain format per §5
 */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/.*)?$/;
  return domainRegex.test(domain);
}

export async function getAutocompleteDomains(query: string): Promise<string[]> {
  const normQuery = normalizeDomain(query);
  if (!normQuery) return [];
  
  const { data, error } = await supabase
    .rpc('get_domain_suggestions', { search_query: normQuery, max_results: 5 });
    
  if (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    return [];
  }
  
  return data ? data.map((d: any) => d.domain_name) : [];
}

/**
 * Master Database Lookup
 * Never calls Similarweb. If domain is in Master DB, returns stored record.
 */
export async function searchMasterDatabase(
  rawInput: string
): Promise<{ record: DomainRecord | null; error: ErrorType | null }> {
  const normalized = normalizeDomain(rawInput);

  // Deterministic error fixture for database down
  if (normalized === 'db-down.test') {
    return { record: null, error: 'database_unavailable' };
  }

  // 1. Search manual_reach_values (Master Database)
  let { data: manualData, error: manualError } = await supabase
    .from('manual_reach_values')
    .select('*')
    .eq('domain_url', normalized)
    .limit(1);

  if (manualError) {
    console.error('Supabase error on manual_reach_values:', manualError);
    return { record: null, error: 'database_unavailable' };
  }

  if (manualData && manualData.length > 0) {
    const record = manualData[0];
    return { 
      record: {
        id: record.id || normalized,
        domain_name: record.domain_url,
        reach_value: record.reach_value,
        provider: 'Manual DBO',
        country: record.country,
        media_type: record.media_type,
        publication: record.outlet_name,
        granularity: null,
        data_source: 'Master Database',
        last_updated: record.updated_date
      }, 
      error: null 
    };
  }

  let { data: swData, error: swError } = await supabase
    .from('similarweb_reach')
    .select('*')
    .eq('domain_url', normalized)
    .limit(1);

  if (swError) {
    console.error('Supabase error on similarweb_reach:', swError);
    return { record: null, error: 'database_unavailable' };
  }

  if (swData && swData.length > 0) {
    const record = swData[0];
    return { 
      record: {
        id: record.id || normalized,
        domain_name: record.domain_url,
        reach_value: record.reach_value,
        provider: 'Similarweb',
        country: null,
        media_type: null,
        publication: null,
        granularity: null,
        data_source: 'API Fetch',
        last_updated: record.updated_date
      }, 
      error: null 
    };
  }

  // 3. Not found in either, return null
  return { record: null, error: null };
}

/**
 * Simulates the Exact Structure of the Similarweb "Total Traffic & Engagement" API
 */
async function fakeSimilarwebApi(domain: string, countryEnabled: boolean) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Generate deterministic reach value for the domain based on string hash, plus some randomness to simulate live data changes
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const baseReach = Math.abs(hash % 9000000) + 1250000;
  const generatedReach = baseReach + Math.floor(Math.random() * 50000) - 25000;

  // Exact JSON structure returned by Similarweb V1 API for Visits
  return {
    meta: {
      request: {
        domain: domain,
        start_date: "2023-09-01",
        end_date: "2023-09-30",
        country: "world",
        granularity: "monthly",
        main_domain_only: false,
        show_verified: false,
        format: "json"
      },
      status: "Success",
      last_updated: new Date().toISOString()
    },
    visits: [
      {
        date: "2023-09-01",
        visits: generatedReach
      }
    ],
    // Mocking an extension to the API if country is enabled
    country: countryEnabled ? 'US' : null,
  };
}

/**
 * Fetch Reach Value from API for NEW domains only (§2, §6, §11)
 * Triggered strictly when Analyst clicks "Get Reach".
 * Returns Reach Value + "API Fetch" badge + null (renders as '—') for 5 metadata fields.
 */
export async function fetchNewDomainReach(
  normalizedDomain: string
): Promise<{ record: DomainRecord | null; error: ErrorType | null }> {
  const startTime = Date.now();

  const logApi = async (status: 'success' | 'failed' | 'rate_limited') => {
    const duration = Date.now() - startTime;
    const { error } = await supabase.from('api_logs').insert([{
      operation: 'Similarweb Fetch',
      resource: normalizedDomain,
      status: status,
      duration_ms: duration
    }]);
    if (error) console.error('Error inserting api log:', error);
  };

  const logActivity = async (action: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('activity_logs').insert([{
        user_id: user.id,
        user_display: user.user_metadata?.name || user.email || 'Analyst',
        action_type: action,
        resource_type: 'Domain',
        resource_id: normalizedDomain,
        details: `Fetched reach for ${normalizedDomain}`
      }]);
      if (error) console.error('Error inserting activity log:', error);
    }
  };

  const logReachRequest = async (status: 'fulfilled' | 'failed') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('reach_requests').insert([{
        domain_name: normalizedDomain,
        requested_by: user.id,
        status: status,
        fulfilled_at: status === 'fulfilled' ? new Date().toISOString() : null
      }]);
      if (error) console.error('Error inserting reach request:', error);
    }
  };

  const rootDomain = normalizedDomain.split('/')[0];

  // Handle deterministic failure fixtures (§11)
  if (rootDomain === 'rate-limit.test') {
    await logApi('rate_limited');
    await logReachRequest('failed');
    return { record: null, error: 'rate_limited' };
  }
  if (rootDomain === 'server-error.test' || rootDomain === 'offline.test' || rootDomain === 'domain-unavailable.test') {
    await logApi('failed');
    await logReachRequest('failed');
    return { record: null, error: 'server_failure' };
  }

  // Load similarweb settings
  const settings = await getSettings();
  const swConfig = settings.similarweb?.SIMILARWEB_WEBSITES_TRAFFIC_AND_ENGAGEMENT;
  const isEnabled = swConfig?.enabled ?? true;
  
  if (!isEnabled) {
    // If the integration is completely disabled, we fail the fetch
    await logApi('failed');
    await logReachRequest('failed');
    return { record: null, error: 'domain_unavailable' }; 
  }

  const countryEnabled = swConfig?.country ?? true;

  // Call the fake Similarweb API with rootDomain
  const apiResponse = await fakeSimilarwebApi(rootDomain, countryEnabled);
  
  // Extract reach value from the Similarweb API JSON structure
  const fetchedReach = apiResponse.visits[0].visits;
  const fetchedCountry = apiResponse.country;


  // Check if it exists in manual_reach_values first
  let { data: manualData } = await supabase
    .from('manual_reach_values')
    .select('id, country, media_type, outlet_name')
    .eq('domain_url', normalizedDomain)
    .single();

  if (!manualData && normalizedDomain.includes('/')) {
    const { data: fbData } = await supabase
      .from('manual_reach_values')
      .select('id, country, media_type, outlet_name')
      .eq('domain_url', rootDomain)
      .single();
    manualData = fbData;
  }

  let data, error;
  let dataSource: 'API Fetch' | 'Master Database' = 'API Fetch';
  let provider = 'Similarweb';
  let recordCountry = null;
  let recordMediaType = null;
  let recordPublication = null;

  if (manualData) {
    // If it was a manual entry, update it in place so searchMasterDatabase finds the fresh value
    const res = await supabase
      .from('manual_reach_values')
      .update({ reach_value: fetchedReach, country: fetchedCountry || manualData.country, updated_date: new Date().toISOString() })
      .eq('id', manualData.id)
      .select()
      .single();
    data = res.data;
    error = res.error;
    dataSource = 'Master Database';
    provider = 'Manual DBO (Refreshed)';
    recordCountry = fetchedCountry || manualData.country;
    recordMediaType = manualData.media_type;
    recordPublication = manualData.outlet_name;
  } else {
    // Otherwise handle it in similarweb_reach using normalizedDomain
    const { data: existingData } = await supabase
      .from('similarweb_reach')
      .select('id')
      .eq('domain_url', normalizedDomain)
      .single();

      if (existingData) {
      // Update existing
      const res = await supabase
        .from('similarweb_reach')
        .update({ reach_value: fetchedReach, country: fetchedCountry, updated_date: new Date().toISOString() })
        .eq('id', existingData.id)
        .select()
        .single();
      data = res.data;
      error = res.error;
      recordCountry = fetchedCountry;
    } else {
      // Insert new
      const res = await supabase
        .from('similarweb_reach')
        .insert([{ domain_url: normalizedDomain, reach_value: fetchedReach, country: fetchedCountry }])
        .select()
        .single();
      data = res.data;
      error = res.error;
      recordCountry = fetchedCountry;
    }
  }
  
  if (error) {
    console.error('Failed to update reach:', error);
    await logApi('failed');
    await logReachRequest('failed');
    return { record: null, error: 'database_unavailable' };
  }

  await logApi('success');
  await logActivity(manualData ? 'Refresh Reach' : 'Fetch Reach');
  await logReachRequest('fulfilled');

  const newRecord: DomainRecord = {
    id: data.id,
    domain_name: normalizedDomain,
    reach_value: fetchedReach,
    provider: provider,
    country: recordCountry,
    media_type: recordMediaType,
    publication: recordPublication,
    granularity: null,
    data_source: dataSource,
    last_updated: data.updated_date,
  };

  return { record: newRecord, error: null };
}

/**
 * Reset Master DB back to seed state (for QA reset)
 */
export async function resetMasterDatabase(): Promise<void> {
  // In a real environment, you'd protect this endpoint.
  // For now, we won't actually wipe the real DB.
  console.warn('resetMasterDatabase called but ignored for Supabase integration.');
}
