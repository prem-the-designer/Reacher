import { DomainRecord, ErrorType } from '@/types';
import { supabase } from '@/lib/supabase';
import { getSettings, saveSettings } from '@/services/adminService';

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

  // Call the proxy to fetch from real Similarweb API
  const { data: apiResponse, error: proxyError } = await supabase.functions.invoke('similarweb-proxy', {
    body: {
      action: 'fetch_domain',
      domain: rootDomain,
      countryEnabled,
      granularityEnabled
    }
  });

  if (proxyError || apiResponse?.error) {
    await logApi('failed');
    await logReachRequest('failed');
    return { record: null, error: 'server_failure' };
  }

  // Extract reach value from the Similarweb API JSON structure
  const fetchedReach = apiResponse.visits?.[0]?.visits;
  const fetchedCountry = apiResponse.country;
  const fetchedGranularity = apiResponse.granularity;

  if (fetchedReach === undefined) {
    await logApi('failed');
    await logReachRequest('failed');
    return { record: null, error: 'server_failure' };
  }


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
        .update({ reach_value: fetchedReach, updated_date: new Date().toISOString() })
        .eq('id', existingData.id)
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else {
      // Insert new
      const res = await supabase
        .from('similarweb_reach')
        .insert([{ domain_url: normalizedDomain, reach_value: fetchedReach }])
        .select()
        .single();
      data = res.data;
      error = res.error;
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
    granularity: fetchedGranularity,
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
