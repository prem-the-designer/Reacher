import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { ActivityLog, RequestLog, ApiLog, ErrorLog, LogType, PaginationState } from '@/types';
import { getLogs } from '@/services/adminService';
import { DataTable, DataTableColumn, DataTableState } from '@/components/ui/DataTable';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

// NOTE: No keys, secrets or tokens appear anywhere in this module.
// The API layer strips them before the data reaches the browser.

const TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'request', label: 'Request' },
  { id: 'api', label: 'API' },
  { id: 'error', label: 'Error' },
];

// ── Column definitions ────────────────────────────────────────────────────────

const ACTIVITY_COLS: DataTableColumn<ActivityLog>[] = [
  { key: 'ts', header: 'Timestamp', align: 'right', render: (r) => <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</span>, width: '160px' },
  { key: 'user', header: 'User', render: (r) => <span className="text-xs truncate max-w-[150px] block" title={r.user_display}>{r.user_display?.split(' (')[0] ?? '—'}</span> },
  { key: 'action', header: 'Action', render: (r) => <code className="text-xs font-mono bg-muted/50 rounded px-1">{r.action_type}</code>, mobileHidden: true },
  { key: 'resource', header: 'Resource', render: (r) => <span className="text-xs text-muted-foreground">{r.resource_type}/{r.resource_id}</span>, mobileHidden: true },
  { key: 'details', header: 'Details', render: (r) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={r.details}>{r.details}</span>, mobileHidden: true },
];

const REQUEST_COLS: DataTableColumn<RequestLog>[] = [
  { key: 'ts', header: 'Requested', align: 'right', render: (r) => <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>, width: '160px' },
  { key: 'domain', header: 'Domain', render: (r) => <span className="font-mono text-sm">{r.domain_name}</span> },
  { key: 'by', header: 'By', render: (r) => <span className="text-xs text-muted-foreground">{r.requested_by}</span>, mobileHidden: true },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'fulfilled', header: 'Fulfilled', align: 'right', render: (r) => <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{r.fulfilled_at ? new Date(r.fulfilled_at).toLocaleString() : '—'}</span>, mobileHidden: true },
];

// API logs: safe operational fields only — no keys, no secrets
const API_COLS: DataTableColumn<ApiLog>[] = [
  { key: 'ts', header: 'Timestamp', align: 'right', render: (r) => <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</span>, width: '160px' },
  { key: 'op', header: 'Operation', render: (r) => <code className="text-xs font-mono bg-muted/50 rounded px-1">{r.operation}</code> },
  { key: 'resource', header: 'Resource', render: (r) => <span className="font-mono text-sm">{r.resource}</span>, mobileHidden: true },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'duration', header: 'Duration', align: 'right', render: (r) => <span className="text-xs tabular-nums text-muted-foreground">{r.duration_ms != null ? `${r.duration_ms.toLocaleString()} ms` : '—'}</span>, mobileHidden: true },
];

const ERROR_COLS: DataTableColumn<ErrorLog>[] = [
  { key: 'ts', header: 'Timestamp', align: 'right', render: (r) => <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</span>, width: '160px' },
  { key: 'ctx', header: 'Context', render: (r) => <span className="text-sm text-foreground truncate max-w-[200px] block" title={r.error_context}>{r.error_context}</span> },
  { key: 'resource', header: 'Resource', render: (r) => <span className="text-xs text-muted-foreground font-mono">{r.related_resource ?? '—'}</span>, mobileHidden: true },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'diag', header: 'Diagnostic', render: (r) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={r.diagnostic}>{r.diagnostic}</span>, mobileHidden: true },
];

// ── Module ────────────────────────────────────────────────────────────────────

type AnyLog = ActivityLog | RequestLog | ApiLog | ErrorLog;

export const LogsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LogType>('activity');
  const [logData, setLogData] = useState<AnyLog[]>([]);
  const [tableState, setTableState] = useState<DataTableState>('loading');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 50, total: 0 });
  const [filter, setFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AnyLog | null>(null);
  const filterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLogs = useCallback(async (tab: LogType, page: number, f: string) => {
    setTableState('loading');
    try {
      const { data, pagination: p } = await getLogs(tab, page, pagination.pageSize, f || undefined);
      setLogData(data as AnyLog[]);
      setPagination(p);
      setTableState(data.length === 0 ? (f ? 'no-results' : 'empty') : 'loaded');
    } catch {
      setTableState('error');
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    setFilter('');
    loadLogs(activeTab, 1, '');
  }, [activeTab]);

  const handleFilter = (val: string) => {
    setFilter(val);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => loadLogs(activeTab, 1, val), 300);
  };

  const getColumns = () => {
    switch (activeTab) {
      case 'activity': return ACTIVITY_COLS as DataTableColumn<AnyLog>[];
      case 'request': return REQUEST_COLS as DataTableColumn<AnyLog>[];
      case 'api': return API_COLS as DataTableColumn<AnyLog>[];
      case 'error': return ERROR_COLS as DataTableColumn<AnyLog>[];
    }
  };

  const renderDetailContent = () => {
    if (!selectedLog) return null;
    const entries = Object.entries(selectedLog).filter(([k]) => k !== 'id');
    return (
      <dl className="space-y-3 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
            <dt className="text-muted-foreground font-medium text-xs pt-0.5 capitalize">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd className="text-foreground break-words font-mono text-xs">
              {String(value ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Operational log entries — UTC timezone</p>
      </div>

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as LogType)}
        aria-label="Log type"
      />

      {TABS.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} activeTab={activeTab}>
          <DataTable
            columns={getColumns()}
            data={logData}
            state={tableState}
            rowKey={(r) => (r as { id: string }).id}
            onRowClick={setSelectedLog}
            dense
            onRetry={() => loadLogs(activeTab, pagination.page, filter)}
            onClearFilters={() => { setFilter(''); loadLogs(activeTab, 1, ''); }}
            caption={`${tab.label} log`}
            pagination={pagination}
            onPageChange={(p) => { setPagination((prev) => ({ ...prev, page: p })); loadLogs(activeTab, p, filter); }}
            onPageSizeChange={(size) => setPagination((prev) => ({ ...prev, pageSize: size }))}
            emptyTitle={`No ${tab.label.toLowerCase()} logs`}
            emptyDescription="Log entries will appear here as activity occurs."
            toolbar={
              <Input
                id={`logs-filter-${tab.id}`}
                placeholder="Filter logs…"
                value={filter}
                onChange={(e) => handleFilter(e.target.value)}
                leadingIcon={<Search className="h-4 w-4" />}
                className="max-w-xs"
              />
            }
          />
        </TabPanel>
      ))}

      {/* Log detail dialog */}
      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Log Entry Detail"
        size="lg"
      >
        {renderDetailContent()}
      </Dialog>
    </div>
  );
};
