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

/**
 * Get list of known domains for autocomplete popover
 */
export async function getAutocompleteDomains(query: string): Promise<string[]> {
  const normQuery = normalizeDomain(query);
  if (!normQuery) return [];
  
  const { data } = await supabase
    .from('domains')
    .select('domain_name')
    .ilike('domain_name', `%${normQuery}%`)
    .limit(5);
    
  return data ? data.map(d => d.domain_name) : [];
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

  const { data, error } = await supabase
    .from('domains')
    .select('*')
    .eq('domain_name', normalized)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
    console.error('Supabase error:', error);
    return { record: null, error: 'database_unavailable' };
  }

  if (data) {
    return { 
      record: {
        id: data.domain_name,
        domain_name: data.domain_name,
        reach_value: data.reach_value,
        provider: data.provider,
        country: data.country,
        media_type: data.media_type,
        publication: data.publication,
        granularity: data.granularity,
        data_source: data.data_source,
        last_updated: data.last_updated
      }, 
      error: null 
    };
  }

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
