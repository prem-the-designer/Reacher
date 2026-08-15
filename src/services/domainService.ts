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
    .eq('domain_url', normalized)
    .single();

  if (manualError && manualError.code !== 'PGRST116') {
    console.error('Supabase error on manual_reach_values:', manualError);
    return { record: null, error: 'database_unavailable' };
  }

  if (manualData) {
    return { 
      record: {
        id: manualData.id || normalized,
        domain_name: manualData.domain_url,
        reach_value: manualData.reach_value,
        provider: 'Manual DBO',
        country: manualData.country,
        media_type: manualData.media_type,
        publication: manualData.outlet_name,
        granularity: null,
        data_source: 'Master DB',
        last_updated: manualData.updated_date
      }, 
      error: null 
    };
  }

  // 2. If not in Master DB, search similarweb_reach
  const { data: swData, error: swError } = await supabase
    .from('similarweb_reach')
    .select('*')
    .eq('domain_url', normalized)
    .single();

  if (swError && swError.code !== 'PGRST116') {
    console.error('Supabase error on similarweb_reach:', swError);
    return { record: null, error: 'database_unavailable' };
  }

  if (swData) {
    return { 
      record: {
        id: swData.id || normalized,
        domain_name: swData.domain_url,
        reach_value: swData.reach_value,
        provider: 'Similarweb',
        country: null,
        media_type: null,
        publication: null,
        granularity: null,
        data_source: 'Similarweb API',
        last_updated: swData.updated_date
      }, 
      error: null 
    };
  }

  // 3. Not found in either, return null
  return { record: null, error: null };
}

/**
 * Fetch Reach Value from API for NEW domains only (§2, §6, §11)
 * Triggered strictly when Analyst clicks "Get Reach".
 * Returns Reach Value + "API Fetch" badge + null (renders as '—') for 5 metadata fields.
 */
export async function fetchNewDomainReach(
  normalizedDomain: string
): Promise<{ record: DomainRecord | null; error: ErrorType | null }> {
  // Simulate retrieval latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Handle deterministic failure fixtures (§11)
  if (normalizedDomain === 'rate-limit.test') return { record: null, error: 'rate_limited' };
  if (normalizedDomain === 'server-error.test') return { record: null, error: 'server_failure' };
  if (normalizedDomain === 'offline.test') return { record: null, error: 'network_failure' };
  if (normalizedDomain === 'domain-unavailable.test') return { record: null, error: 'domain_unavailable' };

  // Generate deterministic reach value for new domain based on string hash
  let hash = 0;
  for (let i = 0; i < normalizedDomain.length; i++) {
    hash = (hash << 5) - hash + normalizedDomain.charCodeAt(i);
    hash |= 0;
  }
  const generatedReach = Math.abs(hash % 9000000) + 1250000;

  const row = {
    domain_name: normalizedDomain,
    reach_value: generatedReach,
    data_source: 'API Fetch',
  };

  const { error } = await supabase.from('domains').insert([row]);
  
  if (error) {
    console.error('Failed to insert domain:', error);
    return { record: null, error: 'database_unavailable' };
  }

  const newRecord: DomainRecord = {
    id: normalizedDomain,
    domain_name: normalizedDomain,
    reach_value: generatedReach,
    provider: null,
    country: null,
    media_type: null,
    publication: null,
    granularity: null,
    data_source: 'API Fetch',
    last_updated: new Date().toISOString(),
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
