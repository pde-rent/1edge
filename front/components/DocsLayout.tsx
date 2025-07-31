import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, Folder, FolderOpen, Github, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { DocStructure } from '@/lib/docs';
import { DocsLoader } from './DocsLoader';
import { SearchDropdown } from './SearchDropdown';
import { TableOfContents } from './TableOfContents';
import { TreeItem, TreeItemData } from './common/TreeItem';
import Image from 'next/image';

interface DocsLayoutProps {
  children: React.ReactNode;
  docStructure: DocStructure[];
  currentSlug?: string;
  loading?: boolean;
  tocContent?: string;
}

// Convert DocStructure to TreeItemData
function convertDocStructureToTreeData(docStructure: DocStructure[]): TreeItemData[] {
  return docStructure.map(item => ({
    id: item.path,
    name: item.name,
    path: item.type === 'file' ? `/docs/${item.path}` : undefined,
    type: item.type,
    children: item.children ? convertDocStructureToTreeData(item.children) : undefined
  }));
}

// Icon renderer for navigation
function renderNavIcon(item: TreeItemData, isOpen?: boolean) {
  if (item.type === 'directory' || item.children) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 flex-shrink-0" />
    ) : (
      <Folder className="h-4 w-4 flex-shrink-0" />
    );
  }
  return <FileText className="h-4 w-4 flex-shrink-0" />;
}

export function DocsLayout({ children, docStructure, currentSlug, loading = false, tocContent }: DocsLayoutProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-primary/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 h-16">
        <div className="w-full px-4 h-full">
          {/* Desktop Layout */}
          <div className="hidden lg:grid lg:grid-cols-5 items-center h-full">
            {/* Left: Logo aligned with sidebar */}
            <div className="col-span-1 flex items-center gap-3">
              <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.svg"
                  alt="1edge Logo"
                  width={100}
                  height={28}
                  className="h-7 w-auto"
                />
              </Link>
              <Badge variant="secondary" className="text-xs">
                Docs
              </Badge>
            </div>

            {/* Center: Search bar aligned left with content */}
            <div className="col-span-3 flex justify-start">
              <button 
                className="w-full max-w-md text-left text-muted-foreground bg-background border border-primary/50 rounded-lg px-4 py-2 text-sm flex items-center justify-between"
                onClick={() => setIsSearchOpen(true)}
              >
                <span>Search documentation...</span>
                <span className="text-xs bg-muted/50 px-2 py-1 rounded-md">⌘K</span>
              </button>
            </div>

            {/* Right: Social links + Back to App aligned with TOC */}
            <div className="col-span-1 flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <Link
                  href="https://t.me/oneedge_trading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Join our Telegram"
                >
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <Link
                  href="https://github.com/1edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="View on GitHub"
                >
                  <Github className="h-4 w-4" />
                </Link>
              </div>
              <div className="w-px h-4 bg-primary/50 mx-1" />
              <Link
                href="/"
                className="bg-primary hover:bg-primary/80 text-black font-medium px-4 py-2 rounded-md text-sm transition-colors"
              >
                App
              </Link>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden h-full flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Toggle navigation"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                  <Image
                    src="/logo.svg"
                    alt="1edge Logo"
                    width={100}
                    height={28}
                    className="h-7 w-auto"
                  />
                </Link>
                <Badge variant="secondary" className="text-xs">
                  Docs
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="https://t.me/oneedge_trading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="Join our Telegram"
                >
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <Link
                  href="https://github.com/1edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  title="View on GitHub"
                >
                  <Github className="h-4 w-4" />
                </Link>
                <div className="w-px h-4 bg-primary/50 mx-1" />
                <Link
                  href="/"
                  className="bg-primary hover:bg-primary/80 text-black font-medium px-4 py-2 rounded-md text-sm transition-colors"
                >
                  App
                </Link>
              </div>
            </div>

            <div className="mb-4">
              <button 
                className="w-full text-left text-muted-foreground bg-background border border-primary/50 rounded-lg px-4 py-2 text-sm flex items-center justify-between"
                onClick={() => setIsSearchOpen(true)}
              >
                <span>Search documentation...</span>
                <span className="text-xs bg-muted/50 px-2 py-1 rounded-md">⌘K</span>
              </button>
            </div>

            {mobileNavOpen && (
              <div className="border-t border-primary/50 bg-card/50 backdrop-blur-sm">
                <div className="p-4">
                  <div className="h-[60vh] overflow-y-auto">
                    <nav className="space-y-1">
                      {convertDocStructureToTreeData(docStructure).map((item) => (
                        <TreeItem
                          key={item.id}
                          item={item}
                          currentPath={currentSlug ? `/docs/${currentSlug}` : undefined}
                          onItemClick={() => setMobileNavOpen(false)}
                          showIcons={true}
                          renderIcon={renderNavIcon}
                        />
                      ))}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <SearchDropdown 
        isOpen={isSearchOpen} 
        query={searchQuery} 
        onQueryChange={setSearchQuery} 
        onClose={() => setIsSearchOpen(false)} 
      />

      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          {/* Sidebar - aligned with logo - hidden on mobile */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="bg-black border-r border-primary/50 h-full flex flex-col">
              <div className="p-4 border-b border-primary/50 flex-shrink-0">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Contents
                </h2>
              </div>
              <nav className="p-0 flex-grow overflow-y-auto">
                <div className="space-y-0.5 p-4">
                  {convertDocStructureToTreeData(docStructure).map((item) => (
                    <TreeItem
                      key={item.id}
                      item={item}
                      currentPath={currentSlug ? `/docs/${currentSlug}` : undefined}
                      showIcons={true}
                      renderIcon={renderNavIcon}
                    />
                  ))}
                </div>
              </nav>
            </div>
          </aside>

          {/* Main Content - centered, full width on mobile */}
          <main className="col-span-1 lg:col-span-3">
            <div className="min-h-[calc(100vh-4rem)]">
              {loading ? (
                <div className="bg-black h-full">
                  <DocsLoader />
                </div>
              ) : (
                <div className="bg-black h-full">
                  <div className="p-6">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      {children}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Table of Contents - aligned with social links - hidden on mobile */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="bg-black border-l border-primary/50 h-full flex flex-col">
              <div className="p-4 border-b border-primary/50 flex-shrink-0">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  On This Page
                </h2>
              </div>
              <nav className="p-0 flex-grow overflow-y-auto">
                <div className="p-4">
                  {tocContent ? (
                    <TableOfContents content={tocContent} />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No headings found
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}