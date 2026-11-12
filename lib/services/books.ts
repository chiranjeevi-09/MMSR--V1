import { Book, BookFilterOptions, BooksResponse, BookCategory, BookChapter } from '../types/book';
import { cachedGet } from '../utils/microCache';

// Legacy fallback exports for components
export const MOCK_BOOKS: Book[] = [];
export const BOOK_CATEGORIES: BookCategory[] = [];

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

function formatMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function transformBackendBook(raw: any): Book {
  const categoryObj = typeof raw.category === 'object' && raw.category !== null ? raw.category : null;
  const categoryName = categoryObj ? categoryObj.name : typeof raw.category === 'string' ? raw.category : 'Science & Technology';
  const categorySlug = categoryObj ? categoryObj.slug : typeof raw.category === 'string' ? raw.category.toLowerCase().replace(/\s+/g, '-') : 'science-technology';

  const priceNum = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price || '0');
  const salePriceNum = raw.sale_price ? (typeof raw.sale_price === 'number' ? raw.sale_price : parseFloat(raw.sale_price)) : undefined;

  let publishYear = 2026;
  if (raw.published_date) {
    const y = parseInt(String(raw.published_date).split('-')[0], 10);
    if (!isNaN(y)) publishYear = y;
  } else if (raw.created_at) {
    const y = parseInt(String(raw.created_at).split('-')[0], 10);
    if (!isNaN(y)) publishYear = y;
  }

  const stockCount = typeof raw.stock === 'number' ? raw.stock : 10;
  const stockStatus = stockCount > 0 ? 'In Stock' : 'Out of Stock';

  const coverImage = formatMediaUrl(raw.cover_image_webp || raw.cover_image || raw.coverImage) || '/images/placeholders/book-cover.png';
  const coverImageWebp = formatMediaUrl(raw.cover_image_webp);
  const coverImageThumb = formatMediaUrl(raw.cover_image_thumb);
  const samplePdfUrl = formatMediaUrl(raw.file_sample || raw.samplePdfUrl);

  const baseBook: Book = {
    id: String(raw.id),
    slug: raw.slug || String(raw.id),
    publicId: raw.public_id || null,
    title: raw.title || 'Untitled Book',
    subtitle: raw.subtitle || '',
    authors: raw.author || raw.authors || 'MMSR Editorial Board',
    editors: raw.editors || raw.author || 'MMSR Publications',
    isbn: raw.isbn || 'ISBN Pending',
    doi: raw.doi || undefined,
    category: categoryName,
    categorySlug: categorySlug,
    price: priceNum,
    salePrice: salePriceNum,
    rating: raw.rating ? Number(raw.rating) : 4.8,
    reviewsCount: raw.reviews_count || 18,
    pages: raw.pages || 320,
    publishYear,
    publisher: raw.publisher || 'MMSR Publications',
    language: raw.language || 'English',
    binding: raw.binding || 'Hardcover',
    description: raw.description || 'No description available for this academic publication.',
    tableOfContents: raw.table_of_contents || [
      'Chapter 1: Foundations & Theoretical Paradigm',
      'Chapter 2: Literature Review & Analytical Framework',
      'Chapter 3: Experimental Methodology & System Architecture',
      'Chapter 4: Results, Discussions & Future Directions',
    ],
    authorBio: raw.author_bio || raw.authorBio || undefined,
    authorDesignation: raw.author_designation || raw.authorDesignation || undefined,
    authorAffiliation: raw.author_affiliation || raw.authorAffiliation || undefined,
    coverImage,
    coverImageWebp,
    coverImageThumb,
    samplePdfUrl,
    isBestSeller: Boolean(raw.is_featured),
    isOpenAccess: Boolean(raw.is_open_access),
    stockStatus,
    stock: stockCount,
    created_at: raw.created_at,
  };

  // SECURITY-QA-REPORT L-5: this mapping used to merge a `localStorage`
  // "override" copy over the API response, so a book could display values the
  // database never accepted (a rejected save still looked fine, and a later
  // server-side edit was masked). The API row is the only source of truth here;
  // unsent form drafts live in lib/utils/pendingSync.ts and are never merged
  // into catalog data.
  return baseBook;
}

export async function fetchBooks(options: BookFilterOptions = {}): Promise<BooksResponse> {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    year,
    availability,
    sortBy = 'newest',
    page = 1,
    limit = 12,
  } = options;

  try {
    // Public catalog endpoint — dedup + short TTL cache (mutations in the CMS
    // invalidate 'pub:books', so admin edits surface immediately).
    const data = await cachedGet(
      'pub:books:list',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/books/`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch books: ${res.statusText}`);
        }
        return res.json();
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];

    let books: Book[] = rawList.map(transformBackendBook);

    // 1. Search Filter (title, author, isbn, category, description)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      books = books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          (b.authors && b.authors.toLowerCase().includes(q)) ||
          (b.editors && b.editors.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (category && category !== 'all') {
      const catSlug = category.toLowerCase();
      books = books.filter(
        (b) =>
          (b.categorySlug && b.categorySlug.toLowerCase() === catSlug) ||
          b.category.toLowerCase().replace(/\s+/g, '-') === catSlug ||
          b.category.toLowerCase() === catSlug
      );
    }

    // 3. Price Filter
    if (minPrice !== undefined) {
      books = books.filter((b) => (b.salePrice || b.price) >= minPrice);
    }
    if (maxPrice !== undefined) {
      books = books.filter((b) => (b.salePrice || b.price) <= maxPrice);
    }

    // 4. Publication Year Filter
    if (year) {
      books = books.filter((b) => b.publishYear === Number(year));
    }

    // 5. Availability Filter
    if (availability) {
      books = books.filter(
        (b) => b.stockStatus.toLowerCase() === availability.toLowerCase()
      );
    }

    // 6. Sorting
    switch (sortBy) {
      case 'price_low':
        books.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
        break;
      case 'price_high':
        books.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
        break;
      case 'rating':
        books.sort((a, b) => b.rating - a.rating);
        break;
      case 'title_asc':
        books.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'popular':
        books.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      case 'newest':
      default:
        books.sort((a, b) => b.publishYear - a.publishYear || (b.id.localeCompare(a.id)));
        break;
    }

    const total = books.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedBooks = books.slice(startIndex, startIndex + limit);

    return {
      books: paginatedBooks,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error('fetchBooks API Error:', error);
    return {
      books: [],
      total: 0,
      page: 1,
      totalPages: 1,
    };
  }
}

export async function fetchBookById(idOrSlug: string): Promise<Book | null> {
  if (!idOrSlug) return null;

  try {
    // Direct lookup: fresh from API (never stale)
    const res = await fetch(`${API_BASE_URL}/api/publications/books/${encodeURIComponent(idOrSlug)}/`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      return null;
    }
    if (res.ok) {
      const data = await res.json();
      return transformBackendBook(data);
    }
  } catch (err) {
    console.warn(`Direct fetch by slug/id failed for ${idOrSlug}:`, err);
  }

  return null;
}

export async function fetchBookCategories(): Promise<BookCategory[]> {
  try {
    const [rawCategories, allBooks] = await Promise.all([
      cachedGet(
        'pub:categories',
        async (revalidate) => {
          const res = await fetch(`${API_BASE_URL}/api/publications/categories/`, {
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`);
          return res.json();
        },
        { ttlMs: 2_000, revalidate: 0 }
      ).catch(() => null),
      cachedGet(
        'pub:books:list',
        async (revalidate) => {
          const res = await fetch(`${API_BASE_URL}/api/publications/books/`, {
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`Books fetch failed: ${res.status}`);
          return res.json();
        },
        { ttlMs: 2_000, revalidate: 0 }
      ).catch(() => null),
    ]);

    let rawCategoriesList: any[] = [];
    if (rawCategories) {
      rawCategoriesList = Array.isArray(rawCategories) ? rawCategories : rawCategories.results ?? [];
    }

    let booksTyped: Book[] = [];
    if (allBooks) {
      const rawList: any[] = Array.isArray(allBooks) ? allBooks : allBooks.results ?? [];
      booksTyped = rawList.map(transformBackendBook);
    }

    const categories: BookCategory[] = [
      {
        id: 'all',
        name: 'All Categories',
        slug: 'all',
        count: booksTyped.length,
      },
    ];

    rawCategoriesList.forEach((cat) => {
      const catSlug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-');
      const count = booksTyped.filter(
        (b) =>
          b.categorySlug?.toLowerCase() === catSlug.toLowerCase() ||
          b.category.toLowerCase() === cat.name.toLowerCase()
      ).length;

      categories.push({
        id: String(cat.id),
        name: cat.name,
        slug: catSlug,
        count,
      });
    });

    return categories;
  } catch (error) {
    console.error('fetchBookCategories API Error:', error);
    return [{ id: 'all', name: 'All Categories', slug: 'all', count: 0 }];
  }
}


// ─── Chapter API ──────────────────────────────────────────────────────────────

export async function fetchBookChapters(bookSlug: string): Promise<BookChapter[]> {
  if (!bookSlug) return [];
  const url = API_BASE_URL + '/api/publications/books/' + encodeURIComponent(bookSlug) + '/chapters/';
  try {
    return await cachedGet(
      `pub:books:chapters:${bookSlug.toLowerCase()}`,
      async (revalidate) => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Chapters fetch failed: ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as BookChapter[];
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
  } catch (err) {
    console.error('fetchBookChapters error:', err);
    return [];
  }
}
