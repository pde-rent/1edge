import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

export interface TreeItemData {
  id: string;
  name: string;
  path?: string;
  type?: 'directory' | 'file';
  level?: number;
  children?: TreeItemData[];
}

interface TreeItemProps {
  item: TreeItemData;
  currentPath?: string;
  level?: number;
  onItemClick?: () => void;
  showIcons?: boolean;
  renderIcon?: (item: TreeItemData, isOpen?: boolean) => React.ReactNode;
  className?: string;
  showLoadingStates?: boolean;
}

export function TreeItem({ 
  item, 
  currentPath, 
  level = 0, 
  onItemClick, 
  showIcons = false,
  renderIcon,
  className,
  showLoadingStates = false
}: TreeItemProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(level < 2); // Auto-expand first 2 levels
  const [isNavigating, setIsNavigating] = React.useState(false);
  const isActive = currentPath === item.path || currentPath === item.id;
  const hasActiveChild = item.children?.some(child =>
    child.path === currentPath || child.id === currentPath ||
    child.children?.some(grandchild => grandchild.path === currentPath || grandchild.id === currentPath)
  );

  // Handle navigation with immediate loading state
  const handleNavigation = (path: string) => {
    if (showLoadingStates) {
      setIsNavigating(true);
      router.push(path);
    }
    onItemClick?.();
  };

  // Reset loading state when route changes
  React.useEffect(() => {
    if (!showLoadingStates) return;
    
    const handleRouteChangeComplete = () => {
      setIsNavigating(false);
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeComplete);
    };
  }, [router, showLoadingStates]);

  React.useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const paddingLeft = `${0.75 + level * 0.75}rem`;

  return (
    <div className={className}>
      {item.type === 'directory' || item.children ? (
        <div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'flex items-center gap-2 w-full text-left px-3 py-1 rounded-md text-sm transition-all duration-200 cursor-pointer group',
              hasActiveChild 
                ? 'bg-primary/10 text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
            )}
            style={{ paddingLeft }}
          >
            {showIcons && renderIcon && renderIcon(item, isOpen)}
            <span className="font-medium truncate">{item.name}</span>
          </button>
          {isOpen && item.children && (
            <div className="mt-0.5">
              {item.children.map((child) => (
                <TreeItem
                  key={child.path || child.id}
                  item={child}
                  currentPath={currentPath}
                  level={level + 1}
                  onItemClick={onItemClick}
                  showIcons={showIcons}
                  renderIcon={renderIcon}
                  showLoadingStates={showLoadingStates}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {item.path ? (
            showLoadingStates ? (
              <button
                onClick={() => handleNavigation(item.path!)}
                disabled={isNavigating}
                className={cn(
                  'flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 group cursor-pointer w-full text-left',
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-primary/5',
                  isNavigating && 'opacity-75'
                )}
                style={{ paddingLeft }}
              >
                {isNavigating ? (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                ) : (
                  showIcons && renderIcon && renderIcon(item)
                )}
                <span className="truncate">{item.name}</span>
              </button>
            ) : (
              <Link href={item.path} className="block" onClick={onItemClick}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-all duration-200 group cursor-pointer',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
                  )}
                  style={{ paddingLeft }}
                >
                  {showIcons && renderIcon && renderIcon(item)}
                  <span className="truncate">{item.name}</span>
                </div>
              </Link>
            )
          ) : (
            <button
              onClick={() => {
                // Handle click for non-link items (like TOC items)
                if (item.id && onItemClick) {
                  const element = document.getElementById(item.id);
                  if (element) {
                    element.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }
                }
                onItemClick?.();
              }}
              className={cn(
                'flex items-center gap-2 w-full text-left px-3 py-1 rounded-md text-sm transition-all duration-200 cursor-pointer',
                isActive
                  ? 'text-primary bg-primary/10 font-semibold border-l-2 border-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5 hover:border-l-2 hover:border-primary/30'
              )}
              style={{ paddingLeft }}
            >
              {showIcons && renderIcon && renderIcon(item)}
              <span className="truncate">{item.name}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}