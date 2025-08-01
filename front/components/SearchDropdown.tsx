import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, Hash, Loader2 } from 'lucide-react';
import { searchService, SearchResult } from '@/lib/search';
import { cn } from '@/lib/utils';

interface SearchDropdownProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  isOpen: boolean; // Control visibility from parent
}

export function SearchDropdown({ query, onQueryChange, onClose, isOpen }: SearchDropdownProps) {
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search with debouncing
  React.useEffect(() => {
    const defaultResult = {
      id: 'docs-home',
      title: 'Documentation Home',
      url: '/docs',
      category: '1edge',
      matchedText: 'Advanced orders and market making strategies for 1inch\'s order book',
      score: 100
    };

    if (!query.trim() || query.length < 2) {
      setResults([defaultResult]);
      setSelectedIndex(0);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const searchResults = await searchService.search(query, 7);
        // Always include the docs home as the first result
        setResults([defaultResult, ...searchResults]);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([defaultResult]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Handle keyboard navigation for dropdown
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          if (results.length > 0) {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
          }
          break;
        case 'ArrowUp':
          if (results.length > 0) {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
          }
          break;
        case 'Enter':
          if (results.length > 0 && results[selectedIndex]) {
            e.preventDefault();
            handleResultClick(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    onClose();
  };

  const shouldShowDropdown = isOpen && (isLoading || results.length > 0);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-20"
      onClick={onClose} // Close on overlay click
    >
      <Card
        ref={dropdownRef}
        className="w-full max-w-2xl bg-background/95 border-primary/50 shadow-2xl rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the card
      >
        {/* Search Input */}
        <div className="relative border-b border-primary/50">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-12 pr-4 py-4 w-full text-base bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-hidden">
          {isLoading ? (
            <div className="p-6 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-base">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="p-2">
                {query.length >= 2 && (
                  <div className="text-xs text-muted-foreground px-3 py-2">
                    Found {results.length} result{results.length !== 1 ? 's' : ''}
                  </div>
                )}
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <SearchResultItem
                      key={result.id}
                      result={result}
                      query={query}
                      isSelected={index === selectedIndex}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(index)} // Update selection on hover
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-base">No results found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function SearchResultItem({ result, query, isSelected, onClick, onMouseEnter }: SearchResultItemProps) {
  const isHeadingResult = result.id.includes('#');
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full text-left p-3 rounded-md transition-all duration-150 group cursor-pointer',
        'hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none',
        isSelected && 'bg-cyan-400/10'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {isHeadingResult ? (
            <Hash className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 
              className="font-medium text-foreground text-sm truncate"
              dangerouslySetInnerHTML={{ 
                __html: searchService.highlightMatches(result.title, query) 
              }}
            />
            {result.category && (
              <Badge variant="outline" className="text-xs flex-shrink-0 border-primary/50 text-primary">
                {result.category}
              </Badge>
            )}
          </div>
          
          {result.matchedText && (
            <p 
              className="text-xs text-muted-foreground line-clamp-2"
              dangerouslySetInnerHTML={{ 
                __html: searchService.highlightMatches(result.matchedText, query) 
              }}
            />
          )}
        </div>
      </div>
    </button>
  );
}