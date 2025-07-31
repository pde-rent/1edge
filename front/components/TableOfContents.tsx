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

    const observerOptions = {
      rootMargin: '-80px 0px -80% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    }, observerOptions);

    // Find all heading elements
    tocItems.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [tocItems]);

  // Add IDs to headings in the DOM after render
  React.useEffect(() => {
    tocItems.forEach(({ id, text }) => {
      // Find heading elements by their text content
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => {
        if (heading.textContent?.trim() === text && !heading.id) {
          heading.id = id;
          heading.classList.add('scroll-mt-20'); // Add scroll offset
        }
      });
    });
  }, [tocItems]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
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
          currentPath={activeId}
          level={item.level} // Explicitly pass the level
          showIcons={false}
          onItemClick={() => scrollToHeading(item.id)}
        />
      ))}
    </div>
  );
}