import React from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { DocsLayout } from '@/components/DocsLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Folder, ExternalLink } from 'lucide-react';
import { getAllDocs, getDocStructure, DocFile, DocStructure } from '@/lib/docs';

interface DocsIndexProps {
  docStructure: DocStructure[];
  recentDocs: DocFile[];
  categories: string[];
}

export default function DocsIndex({ docStructure, recentDocs, categories }: DocsIndexProps) {
  return (
    <DocsLayout docStructure={docStructure}>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            1edge Documentation
          </h1>
          <p className="text-xl text-muted-foreground">
            Comprehensive guide to 1edge's advanced order management system for decentralized trading
          </p>
        </div>

        {/* Quick Start Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/docs/1edge/README">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">Getting Started</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Learn the basics of 1edge and get up and running quickly
                </p>
                <Badge variant="secondary" className="text-xs">
                  Essential
                </Badge>
              </div>
            </Link>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/docs/1edge/architecture">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Folder className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground">Architecture</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Understand the system architecture and core components
                </p>
                <Badge variant="outline" className="text-xs">
                  Technical
                </Badge>
              </div>
            </Link>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/docs/1edge/order-types">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">Order Types</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Explore advanced order types and trading strategies
                </p>
                <Badge variant="outline" className="text-xs">
                  Trading
                </Badge>
              </div>
            </Link>
          </Card>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Documentation Categories</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1edge Platform */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">1edge Platform</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Core platform documentation, architecture, and services
                </p>
                <div className="space-y-2">
                  {docStructure
                    .find(item => item.name === '1edge')
                    ?.children?.slice(0, 5)
                    .map((doc) => (
                      <Link key={doc.path} href={`/docs/${doc.path}`}>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                          <FileText className="h-4 w-4" />
                          <span>{doc.name}</span>
                        </div>
                      </Link>
                    ))
                  }
                </div>
                <Link href="/docs/1edge/README">
                  <div className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                    <span>View all 1edge docs</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </Card>

            {/* 1inch Integration */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Folder className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">1inch Integration</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  1inch Limit Order Protocol integration and APIs
                </p>
                <div className="space-y-2">
                  {docStructure
                    .find(item => item.name === '1inch')
                    ?.children?.slice(0, 3)
                    .map((doc) => (
                      <Link key={doc.path} href={`/docs/${doc.path}`}>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                          <FileText className="h-4 w-4" />
                          <span>{doc.name}</span>
                        </div>
                      </Link>
                    ))
                  }
                </div>
                <Link href="/docs/1inch/README">
                  <div className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                    <span>View all 1inch docs</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* All Categories */}
        {categories.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Browse by Category</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link key={category} href={`/docs/${category}`}>
                  <Badge variant="outline" className="hover:bg-muted transition-colors">
                    {category}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DocsLayout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const allDocs = getAllDocs();
  const docStructure = getDocStructure();
  
  // Get recent docs (limit to 6)
  const recentDocs = allDocs.slice(0, 6);
  
  // Get unique categories
  const categories = Array.from(new Set(allDocs.map(doc => doc.category).filter(Boolean)));

  return {
    props: {
      docStructure,
      recentDocs,
      categories,
    },
  };
};