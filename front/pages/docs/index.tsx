import React from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { DocsLayout } from '@/components/DocsLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, BookOpen, ExternalLink } from 'lucide-react';
import { getDocStructure, DocStructure } from '@/lib/docs';

interface DocsIndexProps {
  docStructure: DocStructure[];
}

export default function DocsIndex({ docStructure }: DocsIndexProps) {
  return (
    <DocsLayout docStructure={docStructure}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-left space-y-6 mb-12">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            1edge Documentation
          </h1>
          <p className="text-2xl text-muted-foreground">
            Advanced orders and market making strategies for 1inch's order book
          </p>
          <p className="text-lg text-muted-foreground">
            Automate complex trading strategies with time-weighted average price (TWAP),
            iceberg orders, range trading, momentum strategies, and more.
          </p>
        </div>

        {/* Main Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Link href="/docs/1edge/order-types" className="block">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg font-semibold border-primary text-primary hover:bg-primary/10"
            >
              <ArrowLeftRight style={{ width: '32px', height: '32px' }} />
              Order Types
            </Button>
          </Link>

          <Link href="/docs/1edge/user-guides" className="block">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg font-semibold border-primary text-primary hover:bg-primary/10"
            >
              <BookOpen style={{ width: '32px', height: '32px' }} />
              User Guides
            </Button>
          </Link>

          <a
            href="https://portal.1inch.dev/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button
              size="lg"
              variant="outline"
              className="w-full h-32 flex flex-col items-center justify-center gap-4 text-lg font-semibold border-primary text-primary hover:bg-primary/10"
            >
              <ExternalLink style={{ width: '32px', height: '32px' }} />
              1inch Docs
            </Button>
          </a>
        </div>
      </div>
    </DocsLayout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const docStructure = getDocStructure();

  return {
    props: {
      docStructure,
    },
  };
};
