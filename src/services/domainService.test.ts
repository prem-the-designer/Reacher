import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSimilarwebCreditThreshold } from './domainService';
import { supabase } from '@/lib/supabase';

vi.mock('./adminService', () => ({
  saveSettings: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    }
  }
}));

describe('checkSimilarwebCreditThreshold', () => {

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow request if credits are above threshold (using remaining_hits)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_hits: 150 },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(150);
  });

  it('should allow request if credits are above threshold (using remaining_credits)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_credits: 200 },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(200);
  });

  it('should allow request if credits are above threshold (using credits_remaining)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { credits_remaining: 101 },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(101);
  });

  it('should block request if credits are equal to threshold', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_hits: 100 },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
    expect(result.remainingCredits).toBe(100);
  });

  it('should block request if credits are below threshold', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_hits: 50 },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
    expect(result.remainingCredits).toBe(50);
  });

  it('should block request if supabase invoke fails', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new Error('Network error')
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
  });

  it('should block request if the backend returns an error message', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: 'Invalid API key' },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
  });

  it('should block request if no credit field is found in response', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { foo: 'bar' },
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
  });

  it('should block request if the credit field is not a number', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_hits: '150' }, // String instead of number
      error: null
    } as any);

    const result = await checkSimilarwebCreditThreshold(100);

    expect(result.allowed).toBe(false);
  });

  it('should properly configure default threshold logic independently', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { remaining_hits: 10 },
      error: null
    } as any);

    // Using a different threshold
    const result = await checkSimilarwebCreditThreshold(5);

    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(10);
  });
});
