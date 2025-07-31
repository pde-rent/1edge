import React from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import { DocsLayout } from '@/components/DocsLayout';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { getAllDocs, getDocBySlug, getDocStructure, DocFile, DocStructure } from '@/lib/docs';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';

interface DocPageProps {
  doc: DocFile;
  docStructure: DocStructure[];
}

export default function DocPage({ doc, docStructure }: DocPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handleRouteChangeStart = () => setIsLoading(true);
    const handleRouteChangeComplete = () => setIsLoading(false);
    const handleRouteChangeError = () => setIsLoading(false);

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router]);

  if (!doc) {
    return (
      <DocsLayout docStructure={docStructure}>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-foreground mb-4">Document Not Found</h1>
          <p className="text-muted-foreground">
            The requested documentation page could not be found.
          </p>
        </div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout
      docStructure={docStructure}
      currentSlug={doc.slug}
      loading={isLoading}
      tocContent={doc.content}
    >
      <div className="space-y-6">
        {/* Document metadata */}
        {
        // (doc.category || doc.frontMatter.author || doc.frontMatter.date) && (
          // <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-4">
          //   {doc.category && (
          //     <div className="flex items-center gap-2">
          //       <Badge variant="secondary">{doc.category}</Badge>
          //     </div>
          //   )}
          //   {doc.frontMatter.author && (
          //     <div className="flex items-center gap-2">
          //       <User className="h-4 w-4" />
          //       <span>{doc.frontMatter.author}</span>
          //     </div>
          //   )}
          //   {doc.frontMatter.date && (
          //     <div className="flex items-center gap-2">
          //       <Calendar className="h-4 w-4" />
          //       <span>{new Date(doc.frontMatter.date).toLocaleDateString()}</span>
          //     </div>
          //   )}
          // </div>
        // )
        }

        {/* Document content */}
        <MarkdownRenderer
          content={doc.content}
          title={doc.title}
          frontMatter={doc.frontMatter}
        />
      </div>
    </DocsLayout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = getAllDocs();

  const paths = docs.map((doc) => ({
    params: {
      slug: doc.slug.split('/'),
    },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = Array.isArray(params?.slug) ? params.slug.join('/') : params?.slug || '';

  const doc = getDocBySlug(slug);
  const docStructure = getDocStructure();

  if (!doc) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      doc,
      docStructure,
    },
  };
};
