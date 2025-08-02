import { Index } from "flexsearch";

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url: string;
  category?: string;
  headings: Array<{
    level: number;
    text: string;
    anchor: string;
  }>;
  excerpt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  category?: string;
  excerpt?: string;
  matchedText?: string;
  score: number;
}

class SearchService {
  private index: Index;
  private documents: Map<string, SearchDocument> = new Map();
  private initialized = false;

  constructor() {
    this.index = new Index({
      preset: "performance",
      tokenize: "forward",
      cache: 100,
      resolution: 9,
    });
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const response = await fetch("/search-index.json");
      if (!response.ok) {
        throw new Error(`Failed to load search index: ${response.statusText}`);
      }

      const documents: SearchDocument[] = await response.json();

      // Clear existing data
      this.documents.clear();

      // Index all documents
      documents.forEach((doc, index) => {
        this.documents.set(doc.id, doc);

        // Create searchable content combining title, content, and category
        const searchableContent = [
          doc.title,
          doc.content,
          doc.category,
          doc.headings.map((h) => h.text).join(" "),
        ]
          .filter(Boolean)
          .join(" ");

        this.index.add(index, searchableContent);
      });

      this.initialized = true;
      console.log(
        `Search index initialized with ${documents.length} documents`,
      );
    } catch (error) {
      console.error("Failed to initialize search:", error);
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!query.trim() || query.length < 2) {
      return [];
    }

    try {
      const results = this.index.search(query, { limit: limit * 2 }); // Get more results for filtering
      const searchResults: SearchResult[] = [];
      const documentsArray = Array.from(this.documents.values());

      for (const resultIndex of results) {
        const doc = documentsArray[resultIndex as number];
        if (!doc) continue;

        // Calculate a simple relevance score
        const titleMatch = doc.title
          .toLowerCase()
          .includes(query.toLowerCase());
        const contentMatch = doc.content
          .toLowerCase()
          .includes(query.toLowerCase());
        const score = (titleMatch ? 10 : 0) + (contentMatch ? 5 : 1);

        // Find matched text for highlighting
        const matchedText = this.findMatchedText(doc, query);

        searchResults.push({
          id: doc.id,
          title: doc.title,
          url: doc.url,
          category: doc.category,
          excerpt: doc.excerpt,
          matchedText,
          score,
        });
      }

      // Sort by score and remove duplicates
      const uniqueResults = new Map<string, SearchResult>();
      searchResults
        .sort((a, b) => b.score - a.score)
        .forEach((result) => {
          if (!uniqueResults.has(result.url)) {
            uniqueResults.set(result.url, result);
          }
        });

      return Array.from(uniqueResults.values()).slice(0, limit);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  private findMatchedText(doc: SearchDocument, query: string): string {
    const queryLower = query.toLowerCase();
    const content = doc.content.toLowerCase();
    const queryIndex = content.indexOf(queryLower);

    if (queryIndex === -1) {
      return doc.excerpt || doc.content.substring(0, 100) + "...";
    }

    // Get context around the match
    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(doc.content.length, queryIndex + query.length + 50);
    const context = doc.content.substring(start, end);

    return (
      (start > 0 ? "..." : "") +
      context +
      (end < doc.content.length ? "..." : "")
    );
  }

  highlightMatches(text: string, query: string): string {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")})`,
      "gi",
    );
    return text.replace(
      regex,
      '<mark class="bg-primary/20 text-primary font-medium">$1</mark>',
    );
  }
}

// Export singleton instance
export const searchService = new SearchService();
