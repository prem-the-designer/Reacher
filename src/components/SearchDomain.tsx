import React, { useState, useRef, useEffect } from 'react';
import { SearchState, ErrorType, ErrorPhase } from '@/types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { ReachResultCard } from './ReachResultCard';
import { ResultCardSkeleton } from './ui/Skeleton';
import {
  normalizeDomain,
  isValidDomain,
  searchMasterDatabase,
  fetchNewDomainReach,
  getAutocompleteDomains,
} from '@/services/domainService';
import { Search, X, Loader2, RefreshCw, CheckCircle2, ArrowRight, Info, Download } from 'lucide-react';
import { Dialog, DialogFooter } from './ui/Dialog';
import { BulkImportModal } from './BulkImportModal';
import { formatNumber } from '@/lib/utils';
import { Badge } from './ui/Badge';
import { SearchFeedbackWidget } from './SearchFeedbackWidget';
import { checkFeedbackEligibility, DEFAULT_CAMPAIGN } from '@/services/feedbackService';
import type { FeedbackEligibilityResult } from '@/types/feedback';
import { supabase } from '@/lib/supabase';

interface SearchDomainProps {
  onSearchStateChange?: (state: SearchState) => void;
  initialDomain?: string;
}

export const SearchDomain: React.FC<SearchDomainProps> = ({ onSearchStateChange, initialDomain }) => {
  const [searchState, setSearchState] = useState<SearchState>({
    mode: 'idle',
    inputDomain: '',
    normalizedDomain: '',
    record: null,
    errorType: null,
    errorMessage: null,
    errorPhase: null,
  });

  const [inputVal, setInputVal] = useState(initialDomain || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Autocomplete popover state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tutorial modal state
  const [showTutorial, setShowTutorial] = useState(false);

  // Bulk Import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDomains, setBulkDomains] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<Record<string, { record: any | null; status: 'pending' | 'found' | 'not_found' | 'fetching' | 'fetched' | 'error', error?: string }>>({});
  const [isFetchingMissing, setIsFetchingMissing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [feedbackEligibility, setFeedbackEligibility] = useState<FeedbackEligibilityResult | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('analyst-user');
  const [currentUserName, setCurrentUserName] = useState<string>('Analyst');
  const isCardRefresh = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'Analyst');
      }
    });
  }, []);

  // Reactive feedback eligibility: guarantees feedback prompt appears on any successful single-domain result
  useEffect(() => {
    if (
      (searchState.mode === 'found' || searchState.mode === 'success') &&
      searchState.record &&
      bulkDomains.length === 0 &&
      !isCardRefresh.current
    ) {
      const searchId =
        currentSearchId ||
        `SRCH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      if (!currentSearchId) {
        setCurrentSearchId(searchId);
      }

      checkFeedbackEligibility({
        userId: currentUserId,
        searchId,
        domain: searchState.normalizedDomain || searchState.record.domain_name,
        isSingleDomain: true,
        searchSuccess: true,
        reachAvailable: searchState.record.reach_value != null,
      })
        .then((eligibility) => {
          setFeedbackEligibility(eligibility);
        })
        .catch(() => {});
    } else if (
      searchState.mode === 'idle' ||
      searchState.mode === 'searching' ||
      searchState.mode === 'not_found' ||
      searchState.mode === 'error'
    ) {
      setFeedbackEligibility(null);
    }
  }, [
    searchState.mode,
    searchState.record,
    bulkDomains.length,
    currentUserId,
    currentSearchId,
    searchState.normalizedDomain,
  ]);

  useEffect(() => {
    if (bulkDomains.length === 0 && pendingSearchQuery !== null) {
      const query = pendingSearchQuery;
      setPendingSearchQuery(null);
      handlePerformSearch(query);
    }
  }, [bulkDomains.length, pendingSearchQuery]);

  // Focus management refs
  const getReachButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update autocomplete options on input change with debounce
  useEffect(() => {
    let isActive = true;
    const trimmedInput = inputVal.trim();

    if (trimmedInput.length <= 1) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    const timerId = setTimeout(() => {
      getAutocompleteDomains(trimmedInput).then(matches => {
        if (isActive) setSuggestions(matches);
      });
    }, 300); // 300ms debounce

    setSelectedIndex(-1);

    return () => {
      isActive = false;
      clearTimeout(timerId);
    };
  }, [inputVal]);

  // Notify parent component of state change if requested
  useEffect(() => {
    if (onSearchStateChange) {
      onSearchStateChange(searchState);
    }
  }, [searchState, onSearchStateChange]);

  // Handle Toast timeout
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Focus management per §6
  useEffect(() => {
    if (searchState.mode === 'not_found') {
      setTimeout(() => getReachButtonRef.current?.focus(), 50);
    } else if (searchState.mode === 'error') {
      setTimeout(() => retryButtonRef.current?.focus(), 50);
    }
  }, [searchState.mode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (showTutorial) {
          setShowTutorial(false);
          return;
        }
        if (isInputFocused) {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      if (isInputFocused) return;

      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowTutorial(true);
      } else if ((e.key === 'c' || e.key === 'C') && searchState.record) {
        e.preventDefault();
        document.getElementById('copy-reach-button')?.click();
        setToastMessage('Reach Value copied');
      } else if ((e.key === 'r' || e.key === 'R') && searchState.record) {
        e.preventDefault();
        document.getElementById('refresh-reach-button')?.click();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchState.record, showTutorial]);

  // Bulk Import Logic
  const handleBulkImport = async (domains: string[]) => {
    setShowBulkModal(false);
    setBulkDomains(domains);
    setSearchState(prev => ({ ...prev, mode: 'idle' })); // Clear regular search state
    setInputVal('');

    const initialResults: Record<string, any> = {};
    domains.forEach(d => {
      initialResults[d] = { record: null, status: 'pending' };
    });
    setBulkResults(initialResults);

    // Process them sequentially for the DB check
    for (const domain of domains) {
      try {
        const res = await searchMasterDatabase(domain);
        if (res.error) {
           setBulkResults(prev => ({...prev, [domain]: { record: null, status: 'error', error: getVerbatimErrorMessage(res.error || 'server_failure') }}));
        } else if (res.record) {
           setBulkResults(prev => ({...prev, [domain]: { record: res.record, status: 'found' }}));
        } else {
           setBulkResults(prev => ({...prev, [domain]: { record: null, status: 'not_found' }}));
        }
      } catch (e) {
        setBulkResults(prev => ({...prev, [domain]: { record: null, status: 'error', error: 'server_failure' }}));
      }
    }
  };

  const handleFetchMissing = async () => {
    setIsFetchingMissing(true);
    const missingDomains = bulkDomains.filter(d => bulkResults[d]?.status === 'not_found');
    
    for (const domain of missingDomains) {
      setBulkResults(prev => ({...prev, [domain]: { ...prev[domain], status: 'fetching' }}));
      // Add a small delay between requests to avoid rate limits when processing many domains (e.g. 300)
      await new Promise(r => setTimeout(r, 30));
      try {
        const res = await fetchNewDomainReach(domain);
        if (res.error) {
          setBulkResults(prev => ({...prev, [domain]: { record: null, status: 'error', error: getVerbatimErrorMessage(res.error || 'server_failure') }}));
        } else if (res.record) {
          setBulkResults(prev => ({...prev, [domain]: { record: res.record, status: 'fetched' }}));
        }
      } catch (e) {
        setBulkResults(prev => ({...prev, [domain]: { record: null, status: 'error', error: 'server_failure' }}));
      }
    }
    setIsFetchingMissing(false);
  };

  const handleDownloadBulkResults = () => {
    let csvContent = "Domain,Status,Reach Value\n";
    bulkDomains.forEach(domain => {
      const result = bulkResults[domain];
      const status = result?.status || 'unknown';
      let reach = '';
      if (typeof result?.record?.reach_value === 'number') {
        reach = result.record.reach_value.toString();
      } else if (result?.status === 'error') {
        reach = '0';
      }
      csvContent += `${domain},${status},${reach}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bulk_import_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Submit Search flow per §5
  const handlePerformSearch = async (overrideDomain?: string) => {
    const rawToSearch = overrideDomain !== undefined ? overrideDomain : inputVal;

    if (bulkDomains.length > 0) {
      setPendingSearchQuery(rawToSearch);
      setShowClearConfirm(true);
      return; 
    }
    setShowSuggestions(false);

    if (!rawToSearch.trim()) {
      setValidationError('Please enter a domain name.');
      return;
    }

    isCardRefresh.current = false;
    const norm = normalizeDomain(rawToSearch);
    if (!isValidDomain(norm)) {
      setValidationError(`${rawToSearch.trim()} isn't a valid domain. Try example.com.`);
      return;
    }

    setValidationError(null);
    const searchId = `SRCH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setCurrentSearchId(searchId);
    setFeedbackEligibility(null);

    setSearchState({
      mode: 'searching',
      inputDomain: rawToSearch,
      normalizedDomain: norm,
      record: null,
      errorType: null,
      errorMessage: null,
      errorPhase: null,
    });

    try {
      const res = await searchMasterDatabase(rawToSearch);

      if (res.error) {
        setSearchState({
          mode: 'error',
          inputDomain: rawToSearch,
          normalizedDomain: norm,
          record: null,
          errorType: res.error,
          errorMessage: getVerbatimErrorMessage(res.error),
          errorPhase: 'search',
        });
      } else if (res.record) {
        setSearchState({
          mode: 'found',
          inputDomain: rawToSearch,
          normalizedDomain: norm,
          record: res.record,
          errorType: null,
          errorMessage: null,
          errorPhase: null,
        });
      } else {
        setSearchState({
          mode: 'not_found',
          inputDomain: rawToSearch,
          normalizedDomain: norm,
          record: null,
          errorType: null,
          errorMessage: null,
          errorPhase: null,
        });
      }
    } catch {
      setSearchState({
        mode: 'error',
        inputDomain: rawToSearch,
        normalizedDomain: norm,
        record: null,
        errorType: 'server_failure',
        errorMessage: getVerbatimErrorMessage('server_failure'),
        errorPhase: 'search',
      });
    }
  };

  // 2. Explicit "Get Reach" action per §2 Rule 2 & §6
  const handleGetReach = async () => {
    if (!searchState.normalizedDomain) return;

    const norm = searchState.normalizedDomain;
    setSearchState((prev) => ({
      ...prev,
      mode: 'fetching',
    }));

    try {
      const res = await fetchNewDomainReach(norm);

      if (res.error) {
        setSearchState((prev) => ({
          ...prev,
          mode: 'error',
          errorType: res.error,
          errorMessage: getVerbatimErrorMessage(res.error || 'server_failure'),
          errorPhase: 'fetch' as ErrorPhase,
        }));
      } else if (res.record) {
        setSearchState((prev) => ({
          ...prev,
          mode: 'success',
          record: res.record,
          errorPhase: null,
        }));
        setToastMessage('Reach Value Updated');
      }
    } catch {
      setSearchState((prev) => ({
        ...prev,
        mode: 'error',
        errorType: 'server_failure',
        errorMessage: getVerbatimErrorMessage('server_failure'),
        errorPhase: 'fetch' as ErrorPhase,
      }));
    }
  };

  const handleCardRefresh = () => {
    isCardRefresh.current = true;
    setFeedbackEligibility(null);
    handleGetReach();
  };

  // 3. Retry flow per §10: Resumes the exact step that failed
  const handleRetry = () => {
    if (searchState.errorPhase === 'search') {
      handlePerformSearch(searchState.inputDomain);
    } else {
      handleGetReach();
    }
  };

  // Map error types to verbatim error copy per §6
  const getVerbatimErrorMessage = (errorType: ErrorType): string => {
    switch (errorType) {
      case 'domain_unavailable':
        return "We couldn't retrieve the Reach Value for this domain.";
      case 'rate_limited':
        return 'Your request is being processed. Please try again shortly.';
      case 'server_failure':
        return "We couldn't retrieve the Reach Value right now.";
      case 'network_failure':
        return 'Check your connection and try again.';
      case 'database_unavailable':
        return "We're temporarily unable to search the database. Please try again shortly.";
      default:
        return "We couldn't process your request.";
    }
  };

  // Auto-trigger search when initialDomain is provided by QA fixtures
  // Runs only once after all handlers are defined
  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (initialDomain && !didAutoSearch.current) {
      didAutoSearch.current = true;
      handlePerformSearch(initialDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normInput = normalizeDomain(inputVal);
  const hasExactMatch = suggestions.some(s => normalizeDomain(s) === normInput);
  const showGetReachOption = inputVal.trim().length > 1 && !hasExactMatch;
  const totalOptions = suggestions.length + (showGetReachOption ? 1 : 0);

  // Keyboard navigation for autocomplete list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalOptions > 0) {
        setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
        setShowSuggestions(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalOptions > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
      }
    } else if (e.key === 'Enter') {
      if (showSuggestions && selectedIndex >= 0 && selectedIndex < totalOptions) {
        e.preventDefault();
        if (selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex];
          setInputVal(selected);
          setShowSuggestions(false);
          handlePerformSearch(selected);
        } else {
          setShowSuggestions(false);
          handlePerformSearch(inputVal);
        }
      } else {
        e.preventDefault();
        setShowSuggestions(false);
        handlePerformSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const isSearchDisabled =
    searchState.mode === 'searching' || searchState.mode === 'fetching';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12 space-y-8">
      {/* Page Header */}
      <div className="space-y-2 text-center sm:text-left relative">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Search Domain
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed pr-10">
          Search for a domain to view its Reach Value or request one for a domain not yet available.
        </p>
        <button
          type="button"
          onClick={() => setShowTutorial(true)}
          className="absolute top-0 right-0 sm:right-2 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors flex items-center justify-center"
          title="Tutorial"
          aria-label="Tutorial"
        >
          <Info className="h-5 w-5" />
        </button>
      </div>

      {/* Search Input Row per §5 */}
      <div className="space-y-2 relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePerformSearch();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div ref={containerRef} className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              placeholder="example.com"
              value={inputVal}
              isInvalid={!!validationError}
              onChange={(e) => {
                setInputVal(e.target.value);
                setValidationError(null);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (totalOptions > 0) setShowSuggestions(true);
              }}
              disabled={isSearchDisabled}
              leadingIcon={<Search className="h-4 w-4" />}
              trailingAction={
                inputVal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInputVal('');
                      setValidationError(null);
                      inputRef.current?.focus();
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-full"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null
              }
            />

            {/* Autocomplete Dropdown list */}
            {showSuggestions && totalOptions > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover p-1 shadow-md text-popover-foreground">
                <ul role="listbox" className="max-h-48 overflow-y-auto py-1 text-sm">
                  {suggestions.map((item, idx) => (
                    <li
                      key={item}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      className={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors flex items-center justify-between ${idx === selectedIndex ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
                        }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setInputVal(item);
                        setShowSuggestions(false);
                        handlePerformSearch(item);
                      }}
                    >
                      <span>{item}</span>
                      <span className="text-xs text-muted-foreground font-mono">Master DB</span>
                    </li>
                  ))}
                  {showGetReachOption && (
                    <li
                      role="option"
                      aria-selected={selectedIndex === suggestions.length}
                      className={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors flex items-center gap-2 border-t border-border mt-1 pt-2 ${selectedIndex === suggestions.length ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
                        }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowSuggestions(false);
                        handlePerformSearch(inputVal);
                      }}
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="truncate">Search for <strong className="font-semibold text-foreground">"{inputVal}"</strong></span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="h11"
            disabled={isSearchDisabled}
            isLoading={searchState.mode === 'searching'}
            loadingText="Searching…"
            className="w-full sm:w-auto px-6 font-medium"
          >
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="h11"
            onClick={() => setShowBulkModal(true)}
            disabled={isSearchDisabled}
            className="w-full sm:w-auto px-6 font-medium whitespace-nowrap"
          >
            Import Bulk
          </Button>
        </form>

        {/* Validation Error */}
        {validationError && (
          <p className="text-xs font-normal text-destructive pt-1 px-1">
            {validationError}
          </p>
        )}
      </div>

      {/* STATE REGION — EXACTLY ONE OF SEVEN OCCUPIES THIS REGION (§6) */}
      <div className="min-h-[280px] transition-all duration-150">
        {/* Toast Notification for Success (§6) */}
        {toastMessage && (
          <div
            role="status"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm shadow-md animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {bulkDomains.length > 0 ? (
          /* Bulk Results Table */
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                 <h3 className="text-lg font-semibold tracking-tight">Bulk Import Results</h3>
                 <p className="text-sm text-muted-foreground mt-1">
                   Processed {bulkDomains.length} domains
                   {(() => {
                     const fetchingCount = bulkDomains.filter(d => bulkResults[d]?.status === 'fetching').length;
                     const remainingCount = bulkDomains.filter(d => bulkResults[d]?.status === 'not_found').length;
                     if (isFetchingMissing) {
                       return <span className="ml-2 text-primary font-medium">| {fetchingCount} currently fetching</span>;
                     }
                     if (remainingCount > 0) {
                       return <span className="ml-2 text-amber-600 dark:text-amber-500 font-medium">| {remainingCount} remaining to fetch</span>;
                     }
                     return null;
                   })()}
                 </p>
               </div>
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 {bulkDomains.some(d => bulkResults[d]?.status === 'not_found' || bulkResults[d]?.status === 'error') && (
                   <Button onClick={handleFetchMissing} disabled={isFetchingMissing} size="sm" className="flex-1 sm:flex-none">
                     {isFetchingMissing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                     Fetch Missing from Similarweb
                   </Button>
                 )}
                 <Button variant="ghost" onClick={handleDownloadBulkResults} size="sm" className="px-2" title="Download Results" aria-label="Download Results">
                   <Download className="h-4 w-4" />
                 </Button>
                 {isFetchingMissing ? (
                   <Button 
                     variant="destructive" 
                     onClick={() => setShowClearConfirm(true)} 
                     size="sm" 
                     className="flex-1 sm:flex-none"
                   >
                      Cancel
                   </Button>
                 ) : (
                   <Button 
                     variant="ghost" 
                     onClick={() => setShowClearConfirm(true)} 
                     size="sm" 
                     className="flex-1 sm:flex-none"
                   >
                      Clear Results
                   </Button>
                 )}
               </div>
            </div>
            
            <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
               <div className="overflow-auto max-h-[400px]">
                 <table className="w-full text-sm text-left whitespace-nowrap">
                   <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                     <tr>
                       <th className="px-5 py-3.5 font-medium">Domain</th>
                       <th className="px-5 py-3.5 font-medium">Status</th>
                       <th className="px-5 py-3.5 font-medium text-right">Reach Value</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                     {bulkDomains.map(domain => {
                       const result = bulkResults[domain];
                       return (
                         <tr key={domain} className="hover:bg-muted/30 transition-colors">
                           <td className="px-5 py-4 font-medium text-foreground">{domain}</td>
                           <td className="px-5 py-4">
                              {result?.status === 'pending' && <Badge variant="outline" className="text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-1.5 inline"/>Checking DB</Badge>}
                              {result?.status === 'found' && <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20">Found in DB</Badge>}
                              {result?.status === 'not_found' && <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5">Unavailable</Badge>}
                              {result?.status === 'fetching' && <Badge variant="outline" className="text-primary border-primary/30"><Loader2 className="h-3 w-3 animate-spin mr-1.5 inline"/>Fetching API</Badge>}
                              {result?.status === 'fetched' && <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white">Fetched API</Badge>}
                              {result?.status === 'error' && <Badge variant="destructive" title={result.error}>Error</Badge>}
                           </td>
                           <td className="px-5 py-4 text-right tabular-nums font-medium text-foreground">
                              {typeof result?.record?.reach_value === 'number' 
                                ? formatNumber(result.record.reach_value) 
                                : result?.status === 'error' ? '0' : '—'}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Empty / Idle State */}
            {searchState.mode === 'idle' && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">No domain searched yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Enter a domain above (e.g., <code className="font-mono text-foreground">bbc.com</code>, <code className="font-mono text-foreground">nytimes.com</code> or <code className="font-mono text-foreground">https://www.example.com</code>).
              </p>
            </div>
          </div>
        )}

        {/* 2. Searching State (§6: Skeleton loader) */}
        {searchState.mode === 'searching' && <ResultCardSkeleton />}

        {/* 3. Not Found State (§6: Alert with Get Reach CTA) */}
        {searchState.mode === 'not_found' && (
          <Alert variant="default" title="Domain not found" className="p-6">
            <p className="text-sm text-foreground leading-relaxed">
              This domain isn't currently available in the database.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                ref={getReachButtonRef}
                variant="default"
                size="default"
                onClick={handleGetReach}
                className="gap-2 font-medium"
              >
                <span>Get Reach</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="default"
                onClick={() => {
                  setSearchState({
                    mode: 'idle',
                    inputDomain: '',
                    normalizedDomain: '',
                    record: null,
                    errorType: null,
                    errorMessage: null,
                    errorPhase: null,
                  });
                  setInputVal('');
                  inputRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Search another domain
              </Button>
            </div>
          </Alert>
        )}

        {/* 4. Fetching (Getting Reach) State (§6: Distinct spinner row, Get Reach removed from DOM) */}
        {searchState.mode === 'fetching' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-10 text-center space-y-4 shadow-xs"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Getting Reach Value</h3>
              <p className="text-xs text-muted-foreground font-mono">
                Retrieving Reach Value for {searchState.normalizedDomain}…
              </p>
            </div>
          </div>
        )}

        {/* 5. Success / 7. Found State: Result Card (§6 & §7) */}
        {(searchState.mode === 'found' || searchState.mode === 'success') &&
          searchState.record && (
            <>
              {/* Analyst Feedback Component (Placed above reach result card for immediate visibility) */}
              {(feedbackEligibility === null || feedbackEligibility?.eligible) && (
                <SearchFeedbackWidget
                  campaign={feedbackEligibility?.campaign || DEFAULT_CAMPAIGN}
                  version={feedbackEligibility?.version || DEFAULT_CAMPAIGN.versions?.[0]!}
                  searchId={currentSearchId || `SRCH-${Date.now()}`}
                  domain={searchState.normalizedDomain || searchState.record.domain_name}
                  userId={currentUserId}
                  userName={currentUserName}
                />
              )}

              <ReachResultCard
                record={searchState.record}
                onRefresh={handleCardRefresh}
              />
            </>
          )}

        {searchState.mode === 'error' && (
          <Alert variant="destructive" title="Error" className="p-6">
            <p className="text-sm font-medium leading-relaxed">
              {searchState.errorMessage}
            </p>
            <div className="mt-4">
              <Button
                ref={retryButtonRef}
                variant="destructive"
                size="default"
                onClick={handleRetry}
                className="gap-2 font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </Button>
            </div>
          </Alert>
        )}
          </>
        )}
      </div>

      <BulkImportModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onImport={handleBulkImport}
      />

      <Dialog open={showTutorial} onClose={() => setShowTutorial(false)} title="Keyboard Shortcuts">
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Exit input field / Close modal</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">Esc</kbd>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Enter input field</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">/</kbd>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Fetch / Search Reach Value</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">Enter</kbd>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Copy Reach Value</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">C</kbd>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm font-medium text-foreground">Refresh Outdated Reach Value</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">R</kbd>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-foreground">Open Info Modal</span>
            <kbd className="px-2 py-1 bg-muted rounded-md text-xs font-mono text-muted-foreground border border-border">i</kbd>
          </div>
        </div>
      </Dialog>

      <Dialog 
        open={showClearConfirm} 
        onClose={() => { setShowClearConfirm(false); setPendingSearchQuery(null); }} 
        title="Clear Bulk Results?"
        description={pendingSearchQuery !== null ? "Do you want to clear the bulk import results and start a new clean search?" : "Are you sure you want to clear all results?"}
      >
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowClearConfirm(false); setPendingSearchQuery(null); }}>
            Keep Results
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              setBulkDomains([]);
              setBulkResults({});
              setShowClearConfirm(false);
            }}
          >
            Yes, Clear Results
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};
