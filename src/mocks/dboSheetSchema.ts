/**
 * DBO Reach Sheet column schema — OPEN DECISION
 *
 * TODO(product): The backend has not established the accepted import formats or column
 * schema for the DBO Reach Sheet. This file is the SINGLE SOURCE OF TRUTH for all
 * import validation. When the real schema is confirmed, update this file only.
 * No UI component contains column names or validation rules.
 *
 * Placeholder schema below reflects a minimal reasonable structure only.
 * Do not treat this as final.
 */

export interface DboSheetColumn {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'url';
  description: string;
}

/** TODO(product): Replace with real DBO Reach Sheet column definitions */
export const DBO_SHEET_COLUMNS: DboSheetColumn[] = [
  {
    key: 'domain_name',
    label: 'Domain',
    required: true,
    type: 'url',
    description: 'The website domain (e.g. bbc.com). Must be a valid domain.',
  },
  {
    key: 'reach_value',
    label: 'Reach Value',
    required: true,
    type: 'number',
    description: 'Monthly reach value as a whole number.',
  },
  {
    key: 'provider',
    label: 'Provider',
    required: false,
    type: 'string',
    description: 'Data provider name (e.g. Similarweb).',
  },
  {
    key: 'country',
    label: 'Country',
    required: false,
    type: 'string',
    description: 'Country of audience.',
  },
  {
    key: 'media_type',
    label: 'Media Type',
    required: false,
    type: 'string',
    description: 'Category of media (e.g. News & Media).',
  },
  {
    key: 'publication',
    label: 'Publication',
    required: false,
    type: 'string',
    description: 'Publication name.',
  },
  {
    key: 'granularity',
    label: 'Granularity',
    required: false,
    type: 'string',
    description: 'Time granularity (e.g. Monthly).',
  },
];

/** Accepted file formats for import */
export const ACCEPTED_IMPORT_FORMATS = ['.csv', '.xlsx', '.xls'];
export const ACCEPTED_IMPORT_MIME = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
export const MAX_IMPORT_FILE_SIZE_MB = 10;
