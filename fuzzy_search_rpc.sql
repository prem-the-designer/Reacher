-- 1. Enable the fuzzystrmatch extension for Levenshtein distance
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 2. Drop the function if it exists to allow recreation
DROP FUNCTION IF EXISTS public.get_domain_suggestions;

-- 3. Create the RPC function
CREATE OR REPLACE FUNCTION public.get_domain_suggestions(search_query text, max_results int DEFAULT 5)
RETURNS TABLE (domain_name text, distance int)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH all_domains AS (
    SELECT domain_url AS domain_name, 1 AS priority_level FROM public.manual_reach_values
    UNION
    SELECT domain_url AS domain_name, 2 AS priority_level FROM public.similarweb_reach
  ),
  scored_domains AS (
    SELECT 
      domain_name,
      priority_level,
      levenshtein(domain_name, search_query) AS distance
    FROM all_domains
    WHERE length(domain_name) > 0
  )
  SELECT domain_name, distance
  FROM scored_domains
  -- Optimization: only consider reasonably close matches or substring matches
  WHERE distance <= 5 OR domain_name ILIKE '%' || search_query || '%'
  -- Prioritize distance first, then manual_reach_values over similarweb_reach
  ORDER BY distance ASC, priority_level ASC, domain_name ASC
  LIMIT max_results;
$$;
