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
import { Search, X, Loader2, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

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

  // Focus management refs
  const getReachButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update autocomplete options on input change
  useEffect(() => {
    let isActive = true;
    if (inputVal.trim().length > 1) {
      getAutocompleteDomains(inputVal).then(matches => {
        if (isActive) setSuggestions(matches);
      });
    } else {
      setSuggestions([]);
    }
    setSelectedIndex(-1);
    return () => { isActive = false; };
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

  // 1. Submit Search flow per §5
  const handlePerformSearch = async (overrideDomain?: string) => {
    const rawToSearch = overrideDomain !== undefined ? overrideDomain : inputVal;
    setShowSuggestions(false);

    if (!rawToSearch.trim()) {
      setValidationError('Please enter a domain name.');
      return;
    }

    const norm = normalizeDomain(rawToSearch);
    if (!isValidDomain(norm)) {
      setValidationError(`${rawToSearch.trim()} isn't a valid domain. Try example.com.`);
      return;
    }

    setValidationError(null);
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
        setToastMessage('Reach Value retrieved');
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

  // Keyboard navigation for autocomplete list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        setShowSuggestions(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        setInputVal(selected);
        setShowSuggestions(false);
        handlePerformSearch(selected);
      } else {
        e.preventDefault();
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
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Search Domain
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Search for a domain to view its Reach Value or request one for a domain not yet available.
        </p>
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
          <div className="relative flex-1">
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
                if (suggestions.length > 0) setShowSuggestions(true);
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
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover p-1 shadow-md text-popover-foreground">
                <ul role="listbox" className="max-h-48 overflow-y-auto py-1 text-sm">
                  {suggestions.map((item, idx) => (
                    <li
                      key={item}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      className={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                        idx === selectedIndex ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
                      }`}
                      onMouseDown={() => {
                        setInputVal(item);
                        setShowSuggestions(false);
                        handlePerformSearch(item);
                      }}
                    >
                      <span>{item}</span>
                      <span className="text-xs text-muted-foreground font-mono">Master DB</span>
                    </li>
                  ))}
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
            <ReachResultCard
              record={searchState.record}
              onRefresh={handleGetReach}
            />
          )}

        {/* 6. Error State (§6: Destructive Alert + Verbatim Copy + Retry) */}
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
      </div>
    </div>
  );
};
