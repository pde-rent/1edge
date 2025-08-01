import React from 'react';
import { cn } from '@/lib/utils';
import { TreeItem, TreeItemData } from './common/TreeItem';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
  const [tocItems, setTocItems] = React.useState<TocItem[]>([]);
  const [activeId, setActiveId] = React.useState<string>('');

  // Extract headings from markdown content
  React.useEffect(() => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Only include h1-h4 for cleaner TOC
      if (level <= 4) {
        items.push({ id, text, level });
      }
    }

    setTocItems(items);
  }, [content]);

  // Track active heading based on scroll position
  React.useEffect(() => {
    if (tocItems.length === 0) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const headingElements = tocItems.map(({ id }) => ({
        id,
        element: document.getElementById(id)
      })).filter(({ element }) => element !== null);

      if (headingElements.length === 0) return;

      // Find the heading that's currently in view
      let currentActiveId = '';
      
      // Check which heading is closest to the top of the viewport
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const { id, element } = headingElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          
          // If the heading is above the viewport center, it's the active one
          if (rect.top <= 200) { // 200px from top of viewport
            currentActiveId = id;
            break;
          }
        }
      }

      // If no heading is above the threshold, use the first one
      if (!currentActiveId && headingElements.length > 0) {
        currentActiveId = headingElements[0].id;
      }

      // Only update if the active ID has actually changed
      if (currentActiveId && currentActiveId !== activeId) {
        setActiveId(currentActiveId);
      }
    };

    // Throttle scroll events
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    // Initial call to set active heading on load
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [tocItems, activeId]);

  // Add IDs to headings in the DOM after render
  React.useEffect(() => {
    const timer = setTimeout(() => {
      tocItems.forEach(({ id, text }) => {
        // Find heading elements by their text content
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach((heading) => {
          if (heading.textContent?.trim() === text && !heading.id) {
            heading.id = id;
            heading.classList.add('scroll-mt-24'); // Add scroll offset for sticky header
            
            // Add a subtle hover effect
            heading.classList.add('transition-colors', 'duration-200', 'hover:text-primary', 'cursor-pointer');
            
            // Make headings clickable to update TOC
            heading.addEventListener('click', () => {
              setActiveId(id);
            });
          }
        });
      });
    }, 100); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, [tocItems]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Calculate position with offset for sticky header
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 100; // 100px offset for header and spacing
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update active ID immediately for better UX
      setActiveId(id);
    }
  };

  if (tocItems.length === 0) {
    return null;
  }

  // Convert TOC items to TreeItemData format
  const treeData: TreeItemData[] = tocItems.map(item => ({
    id: item.id,
    name: item.text,
    level: item.level - 1, // Adjust level for TreeItem component (h1=0, h2=1, h3=2, h4=3)
    type: 'file'
  }));

  return (
    <div className={cn('space-y-0.5', className)}>
      {treeData.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          currentPath={activeId} // Pass the active ID directly
          level={item.level}
          showIcons={false}
          onItemClick={() => scrollToHeading(item.id)}
        />
      ))}
    </div>
  );
}