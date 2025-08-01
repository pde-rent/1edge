import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const docsDirectory = path.join(process.cwd(), '../docs');

export interface DocFile {
  slug: string;
  title: string;
  content: string;
  frontMatter: Record<string, any>;
  category?: string | null;
}

export interface DocStructure {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DocStructure[];
}

function getAllFilesRecursively(dirPath: string, relativePath = ''): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    if (item.startsWith('.')) return; // Skip hidden files
    
    const fullPath = path.join(dirPath, item);
    const itemPath = relativePath ? path.join(relativePath, item) : item;
    
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getAllFilesRecursively(fullPath, itemPath));
    } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
      files.push(itemPath);
    }
  });
  
  return files;
}

export function getAllDocs(): DocFile[] {
  const fileList = getAllFilesRecursively(docsDirectory);
  
  return fileList.map(filePath => {
    const fullPath = path.join(docsDirectory, filePath);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    // Generate slug from file path
    const slug = filePath
      .replace(/\.mdx?$/, '')
      .replace(/\\/g, '/'); // Normalize path separators
    
    // Extract category from path
    const pathParts = slug.split('/');
    const category = pathParts.length > 1 ? pathParts[0] : null;
    
    // Use filename as title if not provided in frontmatter
    const title = data.title || path.basename(filePath, path.extname(filePath));
    
    return {
      slug,
      title,
      content,
      frontMatter: data,
      category,
    };
  });
}

export function getDocBySlug(slug: string): DocFile | null {
  try {
    const filePath = path.join(docsDirectory, `${slug}.md`);
    
    // Try .md first, then .mdx
    let fullPath = filePath;
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(docsDirectory, `${slug}.mdx`);
      if (!fs.existsSync(fullPath)) {
        return null;
      }
    }
    
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    const pathParts = slug.split('/');
    const category = pathParts.length > 1 ? pathParts[0] : null;
    const title = data.title || path.basename(slug);
    
    return {
      slug,
      title,
      content,
      frontMatter: data,
      category,
    };
  } catch (error) {
    return null;
  }
}

export function getDocStructure(): DocStructure[] {
  function buildStructure(dirPath: string, relativePath = ''): DocStructure[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const items = fs.readdirSync(dirPath);
    const structure: DocStructure[] = [];
    
    items.forEach(item => {
      if (item.startsWith('.')) return; // Skip hidden files
      
      const fullPath = path.join(dirPath, item);
      const itemPath = relativePath ? path.join(relativePath, item) : item;
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        structure.push({
          name: item,
          path: itemPath,
          type: 'directory',
          children: buildStructure(fullPath, itemPath),
        });
      } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
        const slug = itemPath.replace(/\.mdx?$/, '').replace(/\\/g, '/');
        structure.push({
          name: item.replace(/\.mdx?$/, ''),
          path: slug,
          type: 'file',
        });
      }
    });
    
    // Sort: directories first, then files, both alphabetically
    return structure.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
  
  return buildStructure(docsDirectory);
}

export function getDocCategories(): string[] {
  const docs = getAllDocs();
  const categories = new Set<string>();
  
  docs.forEach(doc => {
    if (doc.category) {
      categories.add(doc.category);
    }
  });
  
  return Array.from(categories).sort();
}