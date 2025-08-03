import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocStructure } from '@/lib/docs';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';

interface DocsNavigationProps {
  docStructure: DocStructure[];
  currentSlug?: string;
}

interface NavigationItem {
  title: string;
  slug: string;
  path: string;
}

// Format title: capitalize and replace dashes with spaces
function formatTitle(title: string): string {
  return title
    .replace(/\.md$/, '') // Remove .md extension
    .replace(/-/g, ' ') // Replace dashes with spaces
    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize each word
}

// Flatten the doc structure to get a linear array of all pages
function flattenDocStructure(docs: DocStructure[], basePath: string = ''): NavigationItem[] {
  const items: NavigationItem[] = [];
  
  docs.forEach(doc => {
    if (doc.type === 'file') {
      items.push({
        title: formatTitle(doc.name),
        slug: doc.path,
        path: `/docs/${doc.path}`
      });
    }
    
    if (doc.children) {
      items.push(...flattenDocStructure(doc.children, basePath));
    }
  });
  
  return items;
}

export function DocsNavigation({ docStructure, currentSlug }: DocsNavigationProps) {
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = React.useState<string | null>(null);
  const allPages = React.useMemo(() => flattenDocStructure(docStructure), [docStructure]);
  
  const currentIndex = allPages.findIndex(page => page.slug === currentSlug);
  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  // Handle navigation with immediate loading state
  const handleNavigation = (path: string) => {
    setNavigatingTo(path);
    router.push(path);
  };

  // Reset loading state when route changes
  React.useEffect(() => {
    const handleRouteChangeComplete = () => {
      setNavigatingTo(null);
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeComplete);
    };
  }, [router]);

  // Don't render if there are no prev/next pages
  if (!prevPage && !nextPage) {
    return null;
  }

  return (
    <div className="border-t border-primary/20 mt-12 pt-8">
      <div className="grid grid-cols-2 gap-4">
        {/* Previous page */}
        {prevPage ? (
          <Button
            variant="bordered"
            size="l"
            onClick={() => handleNavigation(prevPage.path)}
            disabled={navigatingTo === prevPage.path}
            className={cn(
              "group h-auto p-4 w-full justify-start",
              navigatingTo === prevPage.path && "opacity-75 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              {navigatingTo === prevPage.path ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                Previous
              </div>
              <div className="text-lg text-foreground group-hover:text-primary transition-colors truncate">
                {prevPage.title}
              </div>
            </div>
          </Button>
        ) : (
          <div /> // Empty spacer
        )}

        {/* Next page */}
        {nextPage ? (
          <Button
            variant="bordered"
            size="l"
            onClick={() => handleNavigation(nextPage.path)}
            disabled={navigatingTo === nextPage.path}
            className={cn(
              "group h-auto p-4 w-full justify-between",
              navigatingTo === nextPage.path && "opacity-75 cursor-not-allowed"
            )}
          >
            <div className="text-right min-w-0 flex-1">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                Next
              </div>
              <div className="text-lg text-foreground group-hover:text-primary transition-colors truncate">
                {nextPage.title}
              </div>
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              {navigatingTo === nextPage.path ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4 text-primary" />
              )}
            </div>
          </Button>
        ) : (
          <div /> // Empty spacer
        )}
      </div>
    </div>
  );
}