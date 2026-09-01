import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSimilarwebCreditThreshold } from './domainService';

describe('checkSimilarwebCreditThreshold', () => {
  const defaultApiKey = 'test-api-key';

  beforeEach(() => {
    global.fetch = vi.fn();
    // mock console.log to avoid spamming the test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow request if credits are above threshold (using remaining_hits)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ remaining_hits: 150 })
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(150);
    expect(result.threshold).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith('https://api.similarweb.com/v3/batch/credits', {
      method: 'GET',
      headers: {
        'api-key': defaultApiKey,
        'Accept': 'application/json',
      }
    });
  });

  it('should allow request if credits are above threshold (using remaining_credits)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ remaining_credits: 200 })
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(200);
  });

  it('should block request if credits are below threshold', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ remaining_hits: 50 })
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(false);
    expect(result.remainingCredits).toBe(50);
  });

  it('should block request if credits are exactly equal to threshold', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ remaining_hits: 100 })
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(false);
    expect(result.remainingCredits).toBe(100);
  });

  it('should block request if API key is missing', async () => {
    const result = await checkSimilarwebCreditThreshold(undefined, 100);
    
    expect(result.allowed).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should block request if credit endpoint fails (HTTP error)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(false);
  });

  it('should block request if response contains invalid/missing credit value', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected_field: 'no credits here' })
    } as unknown as Response);

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(false);
  });

  it('should block request on network/timeout error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 100);
    
    expect(result.allowed).toBe(false);
  });

  it('should use custom threshold configuration', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ remaining_hits: 10 })
    } as unknown as Response);

    // Custom threshold is 5, remaining is 10 -> should be allowed
    const result = await checkSimilarwebCreditThreshold(defaultApiKey, 5);
    
    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(10);
    expect(result.threshold).toBe(5);
  });
});
