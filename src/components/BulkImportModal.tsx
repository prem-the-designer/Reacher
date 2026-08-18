import React, { useState, useRef } from 'react';
import { Dialog, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Download, Upload, AlertCircle } from 'lucide-react';
import { normalizeDomain, isValidDomain } from '@/services/domainService';
import { Alert } from './ui/Alert';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (domains: string[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ open, onClose, onImport }) => {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = "domain_url\nexample.com\nnytimes.com\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError("Please upload a .csv file.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setError("File is empty or could not be read.");
        return;
      }

      // Basic CSV parsing
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length === 0) {
        setError("File contains no data.");
        return;
      }

      // Check if first line is a header
      const hasHeader = lines[0].toLowerCase().includes('domain');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      if (dataLines.length > 100) {
        setError(`Rate limit exceeded: You can only import up to 100 outlets per take. File contains ${dataLines.length} valid rows.`);
        return;
      }

      const uniqueDomains = new Set<string>();
      const duplicates = new Set<string>();
      const invalidDomains = new Set<string>();

      for (const line of dataLines) {
        // Handle potential quoted CSV values and extract first column
        const firstCol = line.split(',')[0].replace(/^"|"$/g, '').trim();
        if (!firstCol) continue;

        const normalized = normalizeDomain(firstCol);
        if (!isValidDomain(normalized)) {
          invalidDomains.add(firstCol);
          continue;
        }

        if (uniqueDomains.has(normalized)) {
          duplicates.add(normalized);
        } else {
          uniqueDomains.add(normalized);
        }
      }

      if (invalidDomains.size > 0) {
        setError(`Found ${invalidDomains.size} invalid domain(s). Please check your file. Examples: ${Array.from(invalidDomains).slice(0, 3).join(', ')}`);
        return;
      }

      if (duplicates.size > 0) {
        setError(`File contains duplicate domains. Please remove duplicates before importing. Examples: ${Array.from(duplicates).slice(0, 3).join(', ')}`);
        return;
      }

      if (uniqueDomains.size === 0) {
        setError("No valid domains found in the file.");
        return;
      }

      // Validation passed
      onImport(Array.from(uniqueDomains));
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setError("Failed to read the file.");
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Import Bulk Domains">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Upload a CSV file containing a list of domains to search. You can import a maximum of 100 domains at a time.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Button variant="outline" onClick={handleDownloadTemplate} className="w-full sm:w-auto gap-2">
            <Download className="h-4 w-4" />
            Download Template
          </Button>

          <div className="relative w-full sm:w-auto flex-1">
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <Button variant="default" className="w-full gap-2 pointer-events-none">
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="Validation Error">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={handleClose}>
          Cancel
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
