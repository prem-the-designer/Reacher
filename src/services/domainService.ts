import { DomainRecord, ErrorType } from '@/types';
import { supabase } from '@/lib/supabase';

/**
 * Normalizes input domain per §5 & §11
 * Accepts: example.com, www.example.com, https://example.com, https://www.example.com/path
 * Strips scheme, www., path, query, fragment, port and trailing dot; lowercases.
 */
export function normalizeDomain(rawInput: string): string {
  if (!rawInput) return '';
  let cleaned = rawInput.trim();
  cleaned = cleaned.replace(/^[a-zA-Z]+:\/\//, '');
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@').pop() || '';
  }
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.split(':')[0];
  cleaned = cleaned.replace(/^www\./i, '');
  cleaned = cleaned.replace(/\.$/, '');
  return cleaned.toLowerCase();
}

/**
 * Validates domain format per §5
 */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
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
  const { data: manualData, error: manualError } = await supabase
    .from('manual_reach_values')
    .select('*')
    .ilike('domain_url', `%${normalized}%`)
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

  // 2. If not in Master DB, search similarweb_reach
  const { data: swData, error: swError } = await supabase
    .from('similarweb_reach')
    .select('*')
    .ilike('domain_url', `%${normalized}%`)
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
async function fakeSimilarwebApi(domain: string) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Generate deterministic reach value for the domain based on string hash
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const generatedReach = Math.abs(hash % 9000000) + 1250000;

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
    ]
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

  // Handle deterministic failure fixtures (§11)
  if (normalizedDomain === 'rate-limit.test') return { record: null, error: 'rate_limited' };
  if (normalizedDomain === 'server-error.test') return { record: null, error: 'server_failure' };
  if (normalizedDomain === 'offline.test') return { record: null, error: 'network_failure' };
  if (normalizedDomain === 'domain-unavailable.test') return { record: null, error: 'domain_unavailable' };

  // Call the fake Similarweb API
  const apiResponse = await fakeSimilarwebApi(normalizedDomain);
  
  // Extract reach value from the Similarweb API JSON structure
  const fetchedReach = apiResponse.visits[0].visits;

  const row = {
    domain_url: normalizedDomain,
    reach_value: fetchedReach,
  };

  // Insert into the new similarweb_reach table instead of the deprecated domains table
  // Check if it already exists to handle "refresh" action
  const { data: existingData } = await supabase
    .from('similarweb_reach')
    .select('id')
    .eq('domain_url', normalizedDomain)
    .single();

  let data, error;
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
      .insert([row])
      .select()
      .single();
    data = res.data;
    error = res.error;
  }
  
  if (error) {
    console.error('Failed to insert into similarweb_reach:', error);
    return { record: null, error: 'database_unavailable' };
  }

  const newRecord: DomainRecord = {
    id: data.id,
    domain_name: normalizedDomain,
    reach_value: fetchedReach,
    provider: 'Similarweb',
    country: null,
    media_type: null,
    publication: null,
    granularity: null,
    data_source: 'API Fetch',
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
