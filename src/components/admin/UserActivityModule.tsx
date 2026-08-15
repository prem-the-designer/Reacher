import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { ActivityLog, ReachRequest, PaginationState } from '@/types';
import { getUserActivityLogs, getReachRequests } from '@/services/adminService';
import { DataTable, DataTableColumn, DataTableState } from '@/components/ui/DataTable';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

const TABS = [
  { id: 'user', label: 'User Activity' },
  { id: 'request', label: 'Request Activity' },
];

// ── Activity log columns ──────────────────────────────────────────────────────

const ACTIVITY_COLUMNS: DataTableColumn<ActivityLog>[] = [
  {
    key: 'user',
    header: 'User',
    render: (row) => (
      <span className="text-xs text-foreground truncate max-w-[160px] block" title={row.user_display}>
        {row.user_display?.split(' (')[0] ?? '—'}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (row) => (
      <code className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
        {row.action_type}
      </code>
    ),
  },
  {
    key: 'resource',
    header: 'Resource',
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.resource_type} / <span className="text-foreground">{row.resource_id}</span>
      </span>
    ),
    mobileHidden: true,
  },
  {
    key: 'timestamp',
    header: 'Timestamp',
    align: 'right',
    render: (row) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {new Date(row.timestamp).toLocaleString()}
      </span>
    ),
    mobileHidden: true,
  },
];

// ── Request columns ───────────────────────────────────────────────────────────

const REQUEST_COLUMNS: DataTableColumn<ReachRequest>[] = [
  {
    key: 'domain',
    header: 'Domain',
    render: (row) => <span className="font-mono text-sm">{row.domain_name}</span>,
    mobileTitle: true,
  },
  {
    key: 'requested_by',
    header: 'Requested By',
    render: (row) => <span className="text-xs text-muted-foreground">{row.requested_by}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'created_at',
    header: 'Requested',
    align: 'right',
    render: (row) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {new Date(row.created_at).toLocaleString()}
      </span>
    ),
    mobileHidden: true,
  },
  {
    key: 'fulfilled_at',
    header: 'Fulfilled',
    align: 'right',
    render: (row) => (
      <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">
        {row.fulfilled_at ? new Date(row.fulfilled_at).toLocaleString() : '—'}
      </span>
    ),
    mobileHidden: true,
  },
];

// ── Module ────────────────────────────────────────────────────────────────────

export const UserActivityModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('user');

  // User activity state
  const [activityData, setActivityData] = useState<ActivityLog[]>([]);
  const [activityState, setActivityState] = useState<DataTableState>('loading');
  const [activityFilter, setActivityFilter] = useState('');
  const [activityPagination, setActivityPagination] = useState<PaginationState>({ page: 1, pageSize: 25, total: 0 });
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  // Request state
  const [requestData, setRequestData] = useState<ReachRequest[]>([]);
  const [requestState, setRequestState] = useState<DataTableState>('loading');
  const [requestFilter, setRequestFilter] = useState('');
  const [requestPagination, setRequestPagination] = useState<PaginationState>({ page: 1, pageSize: 25, total: 0 });

  const filterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadActivity = useCallback(async (page: number, filter: string) => {
    setActivityState('loading');
    try {
      const { data, pagination } = await getUserActivityLogs(page, activityPagination.pageSize, filter || undefined);
      setActivityData(data);
      setActivityPagination(pagination);
      setActivityState(data.length === 0 ? (filter ? 'no-results' : 'empty') : 'loaded');
    } catch {
      setActivityState('error');
    }
  }, [activityPagination.pageSize]);

  const loadRequests = useCallback(async (page: number, filter: string) => {
    setRequestState('loading');
    try {
      const { data, pagination } = await getReachRequests(page, requestPagination.pageSize, filter || undefined);
      setRequestData(data);
      setRequestPagination(pagination);
      setRequestState(data.length === 0 ? (filter ? 'no-results' : 'empty') : 'loaded');
    } catch {
      setRequestState('error');
    }
  }, [requestPagination.pageSize]);

  useEffect(() => { loadActivity(1, ''); }, []);
  useEffect(() => { loadRequests(1, ''); }, []);

  const handleActivityFilter = (val: string) => {
    setActivityFilter(val);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => loadActivity(1, val), 300);
  };

  const handleRequestFilter = (val: string) => {
    setRequestFilter(val);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => loadRequests(1, val), 300);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">User Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">User actions and reach value request history</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} aria-label="Activity views" />

      {/* User Activity tab */}
      <TabPanel id="user" activeTab={activeTab}>
        <DataTable
          columns={ACTIVITY_COLUMNS}
          data={activityData}
          state={activityState}
          rowKey={(r) => r.id}
          onRowClick={setSelectedActivity}
          onRetry={() => loadActivity(activityPagination.page, activityFilter)}
          onClearFilters={() => { setActivityFilter(''); loadActivity(1, ''); }}
          caption="User activity log"
          pagination={activityPagination}
          onPageChange={(p) => { setActivityPagination((prev) => ({ ...prev, page: p })); loadActivity(p, activityFilter); }}
          emptyTitle="No activity recorded"
          emptyDescription="User actions will appear here once logged."
          toolbar={
            <Input
              id="activity-filter"
              placeholder="Filter by user, action or resource…"
              value={activityFilter}
              onChange={(e) => handleActivityFilter(e.target.value)}
              leadingIcon={<Search className="h-4 w-4" />}
              className="max-w-xs"
            />
          }
        />
      </TabPanel>

      {/* Request Activity tab */}
      <TabPanel id="request" activeTab={activeTab}>
        <DataTable
          columns={REQUEST_COLUMNS}
          data={requestData}
          state={requestState}
          rowKey={(r) => r.id}
          onRetry={() => loadRequests(requestPagination.page, requestFilter)}
          onClearFilters={() => { setRequestFilter(''); loadRequests(1, ''); }}
          caption="Reach value request history"
          pagination={requestPagination}
          onPageChange={(p) => { setRequestPagination((prev) => ({ ...prev, page: p })); loadRequests(p, requestFilter); }}
          emptyTitle="No requests yet"
          emptyDescription="Reach value requests from analysts will appear here."
          toolbar={
            <Input
              id="request-filter"
              placeholder="Filter by domain, user or status…"
              value={requestFilter}
              onChange={(e) => handleRequestFilter(e.target.value)}
              leadingIcon={<Search className="h-4 w-4" />}
              className="max-w-xs"
            />
          }
        />
      </TabPanel>

      {/* Activity detail dialog */}
      {selectedActivity && (
        <Dialog
          open={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title="Activity Detail"
          size="md"
        >
          <dl className="space-y-4 text-sm">
            {[
              { label: 'User', value: selectedActivity.user_display },
              { label: 'Action', value: selectedActivity.action_type },
              { label: 'Resource', value: `${selectedActivity.resource_type} / ${selectedActivity.resource_id}` },
              { label: 'Timestamp', value: new Date(selectedActivity.timestamp).toLocaleString() },
              { label: 'Details', value: selectedActivity.details },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-2">
                <dt className="text-muted-foreground font-medium text-xs pt-0.5">{label}</dt>
                <dd className="text-foreground break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </div>
  );
};
