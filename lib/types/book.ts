/**
 * MMSR Publications V2 — Book Module Type Definitions
 */

export interface Book {
  id: string;
  slug?: string;
  /** Standardized MMSR public ID (MMSR-BOK-1931-NNNNNN), issued by the backend. */
  publicId?: string | null;
  title: string;
  subtitle?: string;
  authors?: string;
  editors?: string;
  isbn: string;
  doi?: string;
  category: string;
  categorySlug?: string;
  price: number;
  salePrice?: number;
  rating: number;
  reviewsCount?: number;
  pages: number;
  publishYear: number;
  publisher?: string;
  language: string;
  binding?: 'Hardcover' | 'Paperback' | 'eBook' | 'Digital PDF' | string;
  description: string;
  tableOfContents?: string[];
  authorBio?: string;
  authorDesignation?: string;
  authorAffiliation?: string;
  authorPhoto?: string;
  coverImage?: string;
  coverImageWebp?: string;
  coverImageThumb?: string;
  samplePdfUrl?: string;
  isBestSeller?: boolean;
  isOpenAccess?: boolean;
  stockStatus: 'In Stock' | 'Pre-Order' | 'Out of Stock';
  stock?: number;
  created_at?: string;
}

export interface BookFilterOptions {
  search?: string;
  category?: string;
  publicationType?: string;
  minPrice?: number;
  maxPrice?: number;
  year?: number;
  language?: string;
  availability?: string;
  sortBy?: 'newest' | 'popular' | 'price_low' | 'price_high' | 'title_asc' | 'rating';
  page?: number;
  limit?: number;
}

export interface BookCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface BooksResponse {
  books: Book[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Chapter Types ────────────────────────────────────────────────────────────

export interface ChapterAuthor {
  id: number;
  /** Standardized MMSR public ID (MMSR-CAU-1931-NNNNNN). */
  public_id?: string | null;
  name: string;
  affiliation?: string;
  designation?: string;
  bio?: string;
  photo?: string;
}

export interface ChapterSection {
  id: number;
  /** Standardized MMSR public ID (MMSR-SEC-1931-NNNNNN). */
  public_id?: string | null;
  chapter: number;
  display_order: number;
  title: string;
  preview_content?: string;
  full_content?: string;
  status: 'draft' | 'published' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface BookChapter {
  id: number;
  /** Standardized MMSR public ID (MMSR-CHP-1931-NNNNNN). */
  public_id?: string | null;
  book: number;
  chapter_number: number;
  title: string;
  slug: string;
  description?: string;
  authors: ChapterAuthor[];
  author_names_raw?: string;
  status: 'draft' | 'published' | 'archived';
  access_mode: 'paid' | 'open_access' | 'preview_only';
  sample_content?: string;
  doi?: string;
  page_range?: string;
  publication_date?: string;
  sections: ChapterSection[];
  created_at?: string;
  updated_at?: string;
}

