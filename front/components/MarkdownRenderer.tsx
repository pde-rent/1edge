import React from 'react';
import { marked } from 'marked';
import Prism from 'prismjs';
import mermaid from 'mermaid';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { THEME } from '../../common/constants';

// Import Prism languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-docker';

// Import Prism theme
import 'prismjs/themes/prism-dark.css';

// Initialize Mermaid
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: THEME.mermaid.primaryColor,
      primaryTextColor: THEME.mermaid.primaryTextColor,
      primaryBorderColor: THEME.mermaid.primaryBorderColor,
      lineColor: THEME.mermaid.lineColor,
      sectionBkgColor: THEME.mermaid.sectionBkgColor,
      altSectionBkgColor: THEME.mermaid.altSectionBkgColor,
      gridColor: THEME.mermaid.gridColor,
      secondaryColor: THEME.mermaid.secondaryColor,
      tertiaryColor: THEME.mermaid.tertiaryColor,
    },
  });
}

// Create custom renderer for marked
const renderer = new marked.Renderer();

// Override code rendering for syntax highlighting and Mermaid
renderer.code = function({ text, lang, escaped }) {
  // Handle Mermaid diagrams
  if (lang === 'mermaid' || text.match(/^graph|^sequenceDiagram|^flowchart/)) {
    const id = Math.random().toString(36).substring(7);
    return `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent(text)}" data-id="${id}"></div>`;
  }
  
  // Handle syntax highlighting with Prism
  if (lang && Prism.languages[lang]) {
    try {
      const highlighted = Prism.highlight(text, Prism.languages[lang], lang);
      return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.error('Prism highlighting error:', err);
    }
  }
  
  // Fallback for unknown languages
  return `<pre><code class="language-${lang || 'text'}">${escaped ? text : text}</code></pre>`;
};

// Configure marked with custom renderer
marked.setOptions({
  renderer: renderer,
  breaks: true,
  gfm: true,
});

// Code block component with copy functionality
function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = React.useState(false);
  const language = className?.replace('language-', '') || 'text';
  
  const copyToClipboard = async () => {
    if (typeof children === 'string') {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="relative group mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <Badge variant="outline" className="text-xs">
          {language}
        </Badge>
        <button
          onClick={copyToClipboard}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
      <ScrollArea className="max-h-96">
        <pre className="p-4 overflow-x-auto">
          <code className={`text-sm font-mono ${className}`} {...props}>
            {children}
          </code>
        </pre>
      </ScrollArea>
    </Card>
  );
}

interface MarkdownRendererProps {
  content: string;
  title?: string;
  frontMatter?: Record<string, any>;
}

// Mermaid component
function MermaidDiagram({ chart }: { chart: string }) {
  const elementId = React.useId();
  const [svg, setSvg] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      mermaid.render(`mermaid-${elementId}`, chart)
        .then((result) => {
          setSvg(result.svg);
          setError('');
        })
        .catch((err) => {
          console.error('Mermaid rendering error:', err);
          setError('Failed to render diagram');
        });
    }
  }, [chart, elementId]);

  if (error) {
    return (
      <Card className="p-4 mb-4 border-destructive/50">
        <p className="text-destructive text-sm">Error rendering Mermaid diagram: {error}</p>
        <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
          <code>{chart}</code>
        </pre>
      </Card>
    );
  }

  if (!svg) {
    return (
      <Card className="p-4 mb-4">
        <div className="text-muted-foreground text-sm">Rendering diagram...</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4">
      <div className="mermaid-container" dangerouslySetInnerHTML={{ __html: svg }} />
    </Card>
  );
}

// Enhanced table component
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto mb-6">
      <div className="border rounded-lg">
        <table className="w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}

export function MarkdownRenderer({ content, title, frontMatter }: MarkdownRendererProps) {
  const [renderedContent, setRenderedContent] = React.useState<string>('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Convert markdown to HTML using marked with our custom renderer
    const processContent = async () => {
      const htmlContent = await marked(content);
      setRenderedContent(htmlContent);
    };
    processContent();
  }, [content]);

  React.useEffect(() => {
    if (containerRef.current && renderedContent) {
      // Process Mermaid placeholders
      const mermaidPlaceholders = containerRef.current.querySelectorAll('.mermaid-placeholder');
      mermaidPlaceholders.forEach((placeholder, index) => {
        const mermaidCode = decodeURIComponent(placeholder.getAttribute('data-mermaid') || '');
        const id = placeholder.getAttribute('data-id') || `mermaid-${index}`;
        
        if (typeof window !== 'undefined' && mermaidCode) {
          mermaid.render(`mermaid-${id}`, mermaidCode)
            .then((result) => {
              const mermaidContainer = document.createElement('div');
              mermaidContainer.className = 'mermaid-diagram-container bg-muted/30 p-4 rounded-lg mb-4 overflow-x-auto';
              mermaidContainer.innerHTML = result.svg;
              placeholder.parentNode?.replaceChild(mermaidContainer, placeholder);
            })
            .catch((err) => {
              console.error('Mermaid rendering error:', err);
              const errorContainer = document.createElement('div');
              errorContainer.className = 'bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4';
              errorContainer.innerHTML = `
                <p class="text-destructive text-sm mb-2">Error rendering Mermaid diagram</p>
                <pre class="text-xs text-muted-foreground overflow-x-auto"><code>${mermaidCode}</code></pre>
              `;
              placeholder.parentNode?.replaceChild(errorContainer, placeholder);
            });
        }
      });

      // Apply Prism syntax highlighting to any code blocks
      if (typeof window !== 'undefined' && window.Prism) {
        window.Prism.highlightAll();
      }
    }
  }, [renderedContent]);

  return (
    <div className="max-w-none">
      {title && !content.startsWith('# ') && (
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-6 border-b pb-4">
          {title}
        </h1>
      )}
      
      {frontMatter?.description && (
        <p className="text-xl text-muted-foreground mb-8 italic">
          {frontMatter.description}
        </p>
      )}
      
      <div 
        ref={containerRef}
        className="markdown-content max-w-none
          [&>h1]:text-4xl [&>h1]:font-bold [&>h1]:tracking-tight [&>h1]:text-foreground [&>h1]:mb-6 [&>h1]:border-b [&>h1]:pb-4 [&>h1]:scroll-mt-20
          [&>h2]:text-3xl [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:text-foreground [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:border-b [&>h2]:pb-2 [&>h2]:scroll-mt-20
          [&>h3]:text-2xl [&>h3]:font-semibold [&>h3]:text-foreground [&>h3]:mt-6 [&>h3]:mb-3 [&>h3]:scroll-mt-20
          [&>h4]:text-xl [&>h4]:font-semibold [&>h4]:text-foreground [&>h4]:mt-5 [&>h4]:mb-2 [&>h4]:scroll-mt-20
          [&>h5]:text-lg [&>h5]:font-semibold [&>h5]:text-foreground [&>h5]:mt-4 [&>h5]:mb-2 [&>h5]:scroll-mt-20
          [&>h6]:text-base [&>h6]:font-semibold [&>h6]:text-foreground [&>h6]:mt-3 [&>h6]:mb-1 [&>h6]:scroll-mt-20
          [&>p]:text-muted-foreground [&>p]:leading-7 [&>p]:mb-4
          [&>ul]:list-disc [&>ul]:list-outside [&>ul]:space-y-2 [&>ul]:text-muted-foreground [&>ul]:mb-4 [&>ul]:ml-6
          [&>ol]:list-decimal [&>ol]:list-outside [&>ol]:space-y-2 [&>ol]:text-muted-foreground [&>ol]:mb-4 [&>ol]:ml-6
          [&>li]:leading-7 [&>li]:text-muted-foreground
          [&>blockquote]:border-l-4 [&>blockquote]:border-primary/25 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>blockquote]:bg-muted/30 [&>blockquote]:p-4 [&>blockquote]:rounded-r-lg [&>blockquote]:mb-4
          [&>table]:w-full [&>table]:text-sm [&>table]:border-collapse [&>table]:mb-6
          [&>table]:border [&>table]:border-border [&>table]:rounded-lg [&>table]:overflow-hidden
          [&>thead]:bg-muted/50
          [&>th]:p-3 [&>th]:text-left [&>th]:font-semibold [&>th]:text-foreground [&>th]:border-b [&>th]:border-border
          [&>td]:p-3 [&>td]:text-muted-foreground [&>td]:border-b [&>td]:border-border/50
          [&>tr:last-child>td]:border-b-0
          [&>a]:text-primary [&>a]:hover:text-primary/80 [&>a]:underline [&>a]:underline-offset-4 [&>a]:transition-colors
          [&>code]:bg-muted [&>code]:px-2 [&>code]:py-1 [&>code]:rounded-md [&>code]:text-sm [&>code]:font-mono [&>code]:text-foreground
          [&>pre]:bg-primary/20 [&>pre]:border-0 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:mb-4 [&>pre]:font-mono
          [&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:border-0
          [&>hr]:border-border [&>hr]:my-8
          [&>strong]:font-semibold [&>strong]:text-foreground
          [&>em]:italic"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  );
}