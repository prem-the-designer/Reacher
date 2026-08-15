import React, { useState } from 'react';
import type { ImportJob, ExportFormat, ExportStatus, ImportValidationError } from '@/types';
import { simulateImport, confirmImport, exportData } from '@/services/adminService';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { cn } from '@/lib/utils';
import {
  ACCEPTED_IMPORT_FORMATS,
  ACCEPTED_IMPORT_MIME,
  MAX_IMPORT_FILE_SIZE_MB,
} from '@/mocks/dboSheetSchema';
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ── Import step machine ───────────────────────────────────────────────────────

type ImportStep = 'upload' | 'validating' | 'result' | 'importing' | 'complete' | 'failed';

interface ImportState {
  step: ImportStep;
  file: File | null;
  job: ImportJob | null;
  error: string | null;
}

const VALIDATION_ERROR_COLUMNS: DataTableColumn<ImportValidationError>[] = [
  {
    key: 'row',
    header: 'Row',
    align: 'right',
    render: (e) => <span className="tabular-nums">{e.row}</span>,
    width: '80px',
  },
  {
    key: 'field',
    header: 'Field',
    render: (e) => <code className="text-xs font-mono bg-muted/50 rounded px-1">{e.field}</code>,
    width: '120px',
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (e) => <span className="text-sm">{e.reason}</span>,
  },
];

// ── Export state ──────────────────────────────────────────────────────────────

// ── Module ────────────────────────────────────────────────────────────────────

export const ImportExportModule: React.FC = () => {
  // Import
  const [importState, setImportState] = useState<ImportState>({
    step: 'upload',
    file: null,
    job: null,
    error: null,
  });
  const [dragOver, setDragOver] = useState(false);

  // Export
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('ready');
  const [exportFilename, setExportFilename] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Import handlers ─────────────────────────────────────────────────────────

  const validateFileType = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_IMPORT_FORMATS.includes(ext) && !ACCEPTED_IMPORT_MIME.includes(file.type)) {
      return `Unsupported file type. Accepted formats: ${ACCEPTED_IMPORT_FORMATS.join(', ')}.`;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_IMPORT_FILE_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFileType(file);
    if (err) {
      setImportState({ step: 'upload', file: null, job: null, error: err });
      return;
    }
    setImportState({ step: 'upload', file, job: null, error: null });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleValidate = async () => {
    if (!importState.file) return;
    setImportState((s) => ({ ...s, step: 'validating', error: null }));
    try {
      const job = await simulateImport(importState.file.name, importState.file.size);
      setImportState((s) => ({ ...s, step: 'result', job }));
    } catch {
      setImportState((s) => ({ ...s, step: 'failed', error: 'Validation could not be completed. Please try again.' }));
    }
  };

  const handleConfirmImport = async () => {
    if (!importState.job) return;
    setImportState((s) => ({ ...s, step: 'importing' }));
    try {
      const completed = await confirmImport(importState.job.id);
      setImportState((s) => ({ ...s, step: 'complete', job: completed }));
    } catch {
      setImportState((s) => ({ ...s, step: 'failed', error: 'Import failed. Your data has not been changed.' }));
    }
  };

  const handleReset = () => {
    setImportState({ step: 'upload', file: null, job: null, error: null });
  };

  // ── Export handlers ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExportStatus('processing');
    setExportError(null);
    setExportFilename(null);
    try {
      const result = await exportData(exportFormat);
      setExportFilename(result.filename);
      setExportStatus('success');
    } catch {
      setExportStatus('failed');
      setExportError('Export could not be completed. Please try again.');
    }
  };

  // ── Step progress indicator ───────────────────────────────────────────────

  const STEPS: { id: ImportStep; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'validating', label: 'Validating' },
    { id: 'result', label: 'Review' },
    { id: 'importing', label: 'Importing' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIdx = STEPS.findIndex(
    (s) => s.id === importState.step || (importState.step === 'failed' && s.id === 'complete')
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">Bulk import DBO Reach Sheet data or export records</p>
      </div>

      {/* ── IMPORT ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-lg font-semibold text-foreground mb-4">Import</h2>

        {/* Step progress */}
        <nav aria-label="Import progress" className="mb-6">
          <ol className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const done = idx < currentStepIdx;
              const current = idx === currentStepIdx;
              const failed = importState.step === 'failed' && idx === currentStepIdx;
              return (
                <React.Fragment key={step.id}>
                  <li className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                        done ? 'bg-success text-success-foreground' :
                        failed ? 'bg-destructive text-destructive-foreground' :
                        current ? 'bg-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      )}
                      aria-current={current ? 'step' : undefined}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span className={cn(
                      'text-xs font-medium hidden sm:inline',
                      current ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                  </li>
                  {idx < STEPS.length - 1 && (
                    <div className={cn('flex-1 h-px mx-2', done ? 'bg-success' : 'bg-border')} aria-hidden="true" />
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </nav>

        {/* Upload step */}
        {importState.step === 'upload' && (
          <Card elevation="xs" className="p-6 space-y-4 max-w-2xl">
            {importState.error && (
              <Alert variant="destructive" title="Invalid file">
                <p className="text-sm">{importState.error}</p>
              </Alert>
            )}

            {/* Dropzone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload file — click or drag and drop"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('import-file-input')?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('import-file-input')?.click(); } }}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80',
                dragOver ? 'border-primary bg-muted/30' : 'border-border hover:border-muted-foreground/40'
              )}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">
                {ACCEPTED_IMPORT_FORMATS.join(', ')} · Max {MAX_IMPORT_FILE_SIZE_MB} MB
              </p>
              <input
                id="import-file-input"
                type="file"
                accept={ACCEPTED_IMPORT_FORMATS.join(',')}
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                aria-label="Select file to import"
              />
            </div>

            {/* Selected file */}
            {importState.file && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{importState.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(importState.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportState((s) => ({ ...s, file: null }))}
                  aria-label="Remove selected file"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <Button
              variant="default"
              onClick={handleValidate}
              disabled={!importState.file}
              className="gap-2"
            >
              Validate File
            </Button>
          </Card>
        )}

        {/* Validating step */}
        {importState.step === 'validating' && (
          <Card elevation="xs" className="p-8 flex flex-col items-center gap-4 max-w-2xl" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Validating {importState.file?.name}…</p>
            <p className="text-xs text-muted-foreground">Checking rows against the expected schema.</p>
          </Card>
        )}

        {/* Result step */}
        {importState.step === 'result' && importState.job && (
          <div className="space-y-4 max-w-2xl">
            <Card elevation="xs" className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{importState.job.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {(importState.job.file_size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <StatusBadge status={importState.job.invalid_rows > 0 ? 'warning' : 'fulfilled'} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total rows', value: importState.job.total_rows },
                  { label: 'Valid rows', value: importState.job.valid_rows },
                  { label: 'Invalid rows', value: importState.job.invalid_rows },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="default"
                  onClick={handleConfirmImport}
                  disabled={importState.job.valid_rows === 0}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Import {importState.job.valid_rows.toLocaleString()} valid rows
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  Cancel
                </Button>
              </div>
            </Card>

            {/* Validation error report */}
            {importState.job.validation_errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                  {importState.job.invalid_rows} invalid {importState.job.invalid_rows === 1 ? 'row' : 'rows'}
                </h3>
                <DataTable
                  columns={VALIDATION_ERROR_COLUMNS}
                  data={importState.job.validation_errors}
                  state="loaded"
                  rowKey={(e) => String(e.row)}
                  caption="Import validation errors"
                  emptyTitle="No errors"
                />
              </div>
            )}
          </div>
        )}

        {/* Importing step */}
        {importState.step === 'importing' && (
          <Card elevation="xs" className="p-8 flex flex-col items-center gap-4 max-w-2xl" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Importing rows…</p>
            <p className="text-xs text-muted-foreground">This may take a moment. Do not close this page.</p>
          </Card>
        )}

        {/* Complete step */}
        {importState.step === 'complete' && importState.job && (
          <Card elevation="xs" className="p-8 flex flex-col items-center gap-4 max-w-2xl text-center">
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">Bulk Import Completed</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importState.job.rows_inserted.toLocaleString()} rows inserted
                {importState.job.rows_rejected > 0 && `, ${importState.job.rows_rejected} rejected`}.
              </p>
            </div>
            <Button variant="outline" onClick={handleReset} className="mt-2">
              Import another file
            </Button>
          </Card>
        )}

        {/* Failed step */}
        {importState.step === 'failed' && (
          <div className="space-y-4 max-w-2xl">
            <Alert variant="destructive" title="Import failed">
              <p className="text-sm">{importState.error}</p>
            </Alert>
            <Button variant="outline" onClick={handleReset}>Start over</Button>
          </div>
        )}
      </section>

      {/* ── EXPORT ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="export-heading">
        <h2 id="export-heading" className="text-lg font-semibold text-foreground mb-4">Export</h2>

        <Card elevation="xs" className="p-6 space-y-5 max-w-2xl">
          <div>
            <p className="text-sm text-foreground font-medium">Domain Reach Database</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All records currently in the Master Database.
            </p>
          </div>

          {/* Format selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Format</p>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 w-fit">
              {(['csv', 'excel'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => { setExportFormat(fmt); setExportStatus('ready'); setExportFilename(null); }}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80',
                    exportFormat === fmt
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={exportFormat === fmt}
                >
                  {fmt === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
                </button>
              ))}
            </div>
          </div>

          {/* Success */}
          {exportStatus === 'success' && exportFilename && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
              <span className="text-success font-medium">Export ready:</span>
              <span className="font-mono text-xs">{exportFilename}</span>
            </div>
          )}

          {/* Error */}
          {exportStatus === 'failed' && exportError && (
            <Alert variant="destructive" title="Export failed">
              <p className="text-sm">{exportError}</p>
            </Alert>
          )}

          <Button
            variant="default"
            onClick={handleExport}
            disabled={exportStatus === 'processing'}
            className="gap-2 w-fit"
          >
            {exportStatus === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exportStatus === 'processing' ? 'Exporting…' : 'Export'}
          </Button>
        </Card>
      </section>
    </div>
  );
};
