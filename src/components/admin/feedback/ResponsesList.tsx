import React, { useState, useEffect } from 'react';
import type { FeedbackResponse, FeedbackCampaign } from '@/types/feedback';
import { getResponses, getCampaigns } from '@/services/feedbackService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ResponseDetailModal } from './ResponseDetailModal';
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  Inbox,
  RefreshCw,
} from 'lucide-react';

export const ResponsesList: React.FC = () => {
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [campaigns, setCampaigns] = useState<FeedbackCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resps, camps] = await Promise.all([getResponses(), getCampaigns()]);
      setResponses(resps);
      setCampaigns(camps);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = responses.filter((r) => {
    if (ratingFilter !== 'all' && r.rating !== ratingFilter) return false;
    if (campaignFilter !== 'all' && r.campaign_id !== campaignFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.domain.toLowerCase().includes(q) ||
        r.search_id.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q) ||
        r.reasons?.some((reason) => reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Feedback Responses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review feedback submitted by Analysts.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 self-start">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain, search ID, or comment..."
              className="pl-8 text-xs h-9"
            />
          </div>

          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#A1A1A1]/80 h-9"
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 text-xs">
          {(['all', 'positive', 'negative'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRatingFilter(mode)}
              className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
                ratingFilter === mode
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Response Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No feedback responses yet</h3>
            <p className="text-xs text-muted-foreground">
              Responses will appear here when Analysts submit feedback after successful domain searches.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Rating</th>
                  <th className="py-3 px-4 font-medium">Domain</th>
                  <th className="py-3 px-4 font-medium">Analyst</th>
                  <th className="py-3 px-4 font-medium">Campaign</th>
                  <th className="py-3 px-4 font-medium">Version</th>
                  <th className="py-3 px-4 font-medium">Reasons / Comment</th>
                  <th className="py-3 px-4 font-medium text-right">Search ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((resp) => {
                  const isPositive = resp.rating === 'positive';
                  return (
                    <tr
                      key={resp.id}
                      onClick={() => setSelectedResponse(resp)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 tabular-nums text-muted-foreground whitespace-nowrap">
                        {new Date(resp.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            isPositive
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}
                        >
                          {isPositive ? (
                            <ThumbsUp className="h-3 w-3" />
                          ) : (
                            <ThumbsDown className="h-3 w-3" />
                          )}
                          <span className="capitalize">{resp.rating}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {resp.domain}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {resp.user_name || 'Analyst'}
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium truncate max-w-[140px]">
                        {resp.campaign_name || 'Successful Search'}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {resp.version_label || 'v1'}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {isPositive ? (
                          <span className="text-muted-foreground italic">Useful result</span>
                        ) : (
                          <div className="space-y-0.5 truncate">
                            <span className="text-destructive font-medium truncate block">
                              {resp.reasons?.join(', ') || 'No reasons specified'}
                            </span>
                            {resp.comment && (
                              <span className="text-muted-foreground truncate block text-[11px]">
                                "{resp.comment}"
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {resp.search_id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Response Detail Modal */}
      <ResponseDetailModal
        response={selectedResponse}
        onClose={() => setSelectedResponse(null)}
      />
    </div>
  );
};
