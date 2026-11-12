import {
  Journal,
  JournalIssue,
  JournalArticle,
  ArticleAccessState,
  UserJournalAccess,
  JournalFilterOptions,
  JournalsResponse,
  JournalDiscipline,
} from '../types/journal';
import { cachedGet } from '../utils/microCache';
import { purgeLegacyOverrides } from '../utils/pendingSync';

// Legacy fallback exports for components
export const MOCK_JOURNALS: Journal[] = [];
export const JOURNAL_DISCIPLINES: JournalDiscipline[] = [];

// SECURITY-QA-REPORT L-5: `mmsr_journal_override_<id|slug>` used to hold an
// operator's unsent Aims & Scope / editorial board and was merged over the API
// row on every read. Nothing writes it any more; the first journal transformed
// in a page load drops whatever a previous visit left behind.
let legacyJournalOverridesPurged = false;
function purgeLegacyJournalOverrides(): void {
  if (legacyJournalOverridesPurged || typeof window === 'undefined' || !window.localStorage) return;
  legacyJournalOverridesPurged = true;
  purgeLegacyOverrides('mmsr_journal_override_');
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

function formatMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function transformBackendJournal(raw: any): Journal {
  purgeLegacyJournalOverrides();
  const categoryObj = typeof raw.category === 'object' && raw.category !== null ? raw.category : null;
  const categoryName = categoryObj ? categoryObj.name : typeof raw.category === 'string' ? raw.category : 'Science & Technology';
  const categorySlug = categoryObj ? categoryObj.slug : typeof raw.category === 'string' ? raw.category.toLowerCase().replace(/\s+/g, '-') : 'science-technology';

  const coverUrl = formatMediaUrl(raw.cover_image_webp || raw.cover_image || raw.cover) || '/images/placeholders/journal-cover.png';
  const coverWebp = formatMediaUrl(raw.cover_image_webp);
  const coverThumb = formatMediaUrl(raw.cover_image_thumb);

  const rawIssues: any[] = Array.isArray(raw.issues) ? raw.issues : [];
  const transformedIssues: JournalIssue[] = rawIssues.map((iss: any) => {
    // Use authoritative DB fields first; fall back to title parsing
    let vol: number;
    let num: number;

    if (iss.volume_number !== null && iss.volume_number !== undefined) {
      vol = Number(iss.volume_number);
    } else if (iss.title) {
      const matchVol = iss.title.match(/vol(?:ume)?\s*(\d+)/i);
      vol = matchVol ? parseInt(matchVol[1], 10) : 1;
    } else {
      vol = 1;
    }

    if (iss.issue_number !== null && iss.issue_number !== undefined) {
      num = Number(iss.issue_number);
    } else if (iss.title) {
      const matchIss = iss.title.match(/issue\s*(\d+)/i);
      num = matchIss ? parseInt(matchIss[1], 10) : 1;
    } else {
      num = 1;
    }

    let year = 2026;
    if (iss.publication_date) {
      const y = parseInt(String(iss.publication_date).split('-')[0], 10);
      if (!isNaN(y)) year = y;
    }

    return {
      id: String(iss.id),
      publicId: iss.public_id || null,
      volume: vol,
      issue: num,
      volumeNumber: iss.volume_number !== null && iss.volume_number !== undefined ? Number(iss.volume_number) : null,
      issueNumber: iss.issue_number !== null && iss.issue_number !== undefined ? Number(iss.issue_number) : null,
      year,
      publicationDate: iss.publication_date || '2026',
      cover: formatMediaUrl(iss.cover_image_webp || iss.cover_image || iss.cover),
      coverWebp: formatMediaUrl(iss.cover_image_webp),
      coverThumb: formatMediaUrl(iss.cover_image_thumb),
      articleCount: Array.isArray(iss.articles) ? iss.articles.filter((a: any) => a.status === 'published' || !a.status).length : (iss.stock || 0),
      doi: `10.5281/mmsr.${raw.slug || 'journal'}.v${vol}i${num}`,
      samplePdfUrl: formatMediaUrl(iss.file_digital || iss.sample_pdf || iss.samplePdfUrl),
      digitalFileName: iss.file_digital_name || iss.digitalFileName || null,
      price: typeof iss.price === 'number' ? iss.price : parseFloat(iss.price || '299.00'),
      pricePrint: iss.price_print !== undefined && iss.price_print !== null ? parseFloat(String(iss.price_print)) : undefined,
      priceBundle: iss.price_bundle !== undefined && iss.price_bundle !== null ? parseFloat(String(iss.price_bundle)) : undefined,
      stock: typeof iss.stock === 'number' ? iss.stock : 0,
      hasDigital: Boolean(iss.file_digital),
      supportedFormats: Array.isArray(iss.supported_formats)
        ? iss.supported_formats.map((sf: any) => ({
            format: sf.format,
            name: sf.name,
            price: typeof sf.price === 'number' ? sf.price : parseFloat(String(sf.price || '0')),
            available: Boolean(sf.available),
            description: sf.description,
          }))
        : undefined,
      title: iss.title,
      articles: Array.isArray(iss.articles)
        ? iss.articles
            .filter((a: any) => !a.status || a.status === 'published')
            .map((a: any) => transformBackendArticle(a))
        : undefined,
    };
  });

  const latestIssue = transformedIssues[0];

    const rawIndexedIn = raw.indexed_in;
    let indexedInArr: string[] = ['Google Scholar', 'Crossref', 'DOAJ', 'ResearchGate'];
    if (typeof rawIndexedIn === 'string' && rawIndexedIn.trim()) {
      indexedInArr = rawIndexedIn.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(rawIndexedIn) && rawIndexedIn.length > 0) {
      indexedInArr = rawIndexedIn;
    }

  // Server columns first (SECURITY-QA-REPORT L-5). Aims/scope/board/impact used
  // to exist only in a `mmsr_journal_override_*` localStorage copy, so the CMS
  // showed content the database had never accepted and no other visitor could
  // ever see it. `description` stays as the fallback sentence for rows that
  // predate the columns.
  let aimsText = raw.aims_scope || raw.aims || raw.description
    || 'Promoting rapid dissemination of peer-reviewed scientific discoveries.';
  let scopeArr: string[] = [
    'Multidisciplinary Research & Innovation',
    'Peer-Reviewed Scientific Studies',
    'Interdisciplinary Engineering & Medical Systems',
    'Open Access Publishing Standards',
  ];

  if (Array.isArray(raw.scope_topics) && raw.scope_topics.length > 0) {
    scopeArr = raw.scope_topics.map((s: any) => String(s).trim()).filter(Boolean);
  } else if (typeof raw.scope_topics === 'string' && raw.scope_topics.trim()) {
    scopeArr = raw.scope_topics.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
  }

  const baseJournal: Journal = {
    id: String(raw.id),
    slug: raw.slug || String(raw.id),
    publicId: raw.public_id || null,
    title: raw.title || 'Untitled Journal',
    shortTitle: raw.short_title || raw.title?.split(' ').map((w: string) => w[0]).join('').slice(0, 5) || 'IJSR',
    description: raw.description || 'A peer-reviewed open-access journal covering multidisciplinary academic research.',
    aims: aimsText,
    scope: scopeArr,
      cover: coverUrl,
    coverWebp,
    coverThumb,
      issn: raw.issn || 'Pending',
      eissn: raw.eissn || (raw.issn ? `${raw.issn}-E` : 'Pending'),
      doiPrefix: raw.doi_prefix || `10.5281/mmsr.${raw.slug || 'journal'}`,
      discipline: categoryName,
      category: categoryName,
      categorySlug: categorySlug,
      editor: raw.editor || 'MMSR Editorial Board',
      publisher: raw.publisher || 'MMSR Publications',
      frequency: raw.frequency || 'Quarterly',
      volume: latestIssue ? latestIssue.volume : 1,
      issue: latestIssue ? latestIssue.issue : 1,
      year: latestIssue ? latestIssue.year : 2026,
      // Derive open-access purely from real data. Backend only treats a journal
      // as fully open when access_type is exactly "Open Access" (a "Hybrid"
      // journal still has paid articles). Never default to true.
      openAccess: raw.open_access !== undefined
        ? Boolean(raw.open_access)
        : (raw.access_type === 'Open Access'),
      isFeatured: Boolean(raw.is_featured),
      subscriptionPriceAnnual: typeof raw.subscription_price_annual === 'number'
        ? raw.subscription_price_annual
        : parseFloat(raw.subscription_price_annual || '2999.00'),
      indexedIn: indexedInArr,
      impactMetric: raw.impact_factor || raw.impact_metric || '3.95',
      reviewTime: raw.review_time || '21 Days',
      acceptanceRate: raw.acceptance_rate || '25%',
      articlesPublished: Array.isArray(raw.articles)
        ? raw.articles.filter((a: any) => !a.status || a.status === 'published').length
        : transformedIssues.reduce((sum: number, it: any) => sum + (it.articleCount || 0), 0),
      totalIssues: transformedIssues.length,
      totalVolumes: transformedIssues.reduce(
        (max: number, it: any) => Math.max(max, it.volumeNumber ?? it.volume ?? 0),
        0,
      ),
      accessType: raw.access_type || (raw.open_access === false ? 'Subscription' : 'Open Access'),
      issues: transformedIssues,
      articles: raw.articles || [],
      // Stored server-side as snake_case objects; `researchAreas` is the shape
      // the journal pages and the CMS rows already render.
      editorialBoard: Array.isArray(raw.editorial_board) && raw.editorial_board.length > 0
        ? raw.editorial_board.map((m: any, idx: number) => ({
            id: m.id || `ed-${idx + 1}`,
            name: m.name || 'Editorial Board Member',
            role: m.role || 'Editorial Board Member',
            institution: m.institution || 'MMSR Editorial Council',
            country: m.country || 'International',
            researchAreas: m.research_areas || m.researchAreas || ['Academic Research'],
          }))
        : [
            {
              id: 'ed-1',
              name: raw.editor || 'Dr. S. Ramanujan',
              role: 'Editor-in-Chief',
              institution: 'MMSR Editorial Council',
              country: 'India',
              researchAreas: [categoryName, 'Interdisciplinary Research'],
            },
          ],
    };

    return baseJournal;
  }

  export async function fetchJournals(options: JournalFilterOptions = {}): Promise<JournalsResponse> {
    const {
      search,
      discipline,
      openAccess,
      indexed,
      frequency,
      sortBy = 'newest',
      page = 1,
      limit = 12,
    } = options;

    try {
      // Public catalog endpoint — dedup + short TTL cache (CMS journal
      // mutations invalidate 'pub:journals').
      const data = await cachedGet(
        'pub:journals:list',
        async (revalidate) => {
          const res = await fetch(`${API_BASE_URL}/api/publications/journals/`, {
            cache: 'no-store',
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch journals: ${res.statusText}`);
          }
          return res.json();
        },
        { ttlMs: 2_000, revalidate: 0 }
      );
      const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];

      let journals: Journal[] = rawList.map(transformBackendJournal);

      // 1. Search Filter (title, shortTitle, issn, eissn, discipline, description, publisher)
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        journals = journals.filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.shortTitle.toLowerCase().includes(q) ||
            j.issn.toLowerCase().includes(q) ||
            j.eissn.toLowerCase().includes(q) ||
            j.discipline.toLowerCase().includes(q) ||
            j.publisher.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q)
        );
      }

      // 2. Discipline / Category Filter
      if (discipline && discipline !== 'all') {
        const discSlug = discipline.toLowerCase();
        journals = journals.filter(
          (j) =>
            (j.categorySlug && j.categorySlug.toLowerCase() === discSlug) ||
            j.discipline.toLowerCase().replace(/\s+/g, '-') === discSlug ||
            j.discipline.toLowerCase() === discSlug
        );
      }

      // 3. Open Access Filter
      if (openAccess !== undefined) {
        journals = journals.filter((j) => j.openAccess === openAccess);
      }

      // 4. Indexed Filter
      if (indexed) {
        journals = journals.filter((j) => {
          const list = Array.isArray(j.indexedIn) ? j.indexedIn : [];
          return list.some((idx) => idx.toLowerCase().includes(indexed.toLowerCase()));
        });
      }

    // 5. Frequency Filter
    if (frequency) {
      journals = journals.filter(
        (j) => j.frequency.toLowerCase() === frequency.toLowerCase()
      );
    }

    // 6. Sorting
    switch (sortBy) {
      case 'title_asc':
        journals.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'impact':
        journals.sort((a, b) => parseFloat(b.impactMetric || '0') - parseFloat(a.impactMetric || '0'));
        break;
      case 'popular':
        journals.sort((a, b) => (b.articlesPublished || 0) - (a.articlesPublished || 0));
        break;
      case 'recent_issue':
        journals.sort((a, b) => (b.issues?.length || 0) - (a.issues?.length || 0));
        break;
      case 'newest':
      default:
        journals.sort((a, b) => b.year - a.year || b.id.localeCompare(a.id));
        break;
    }

    const total = journals.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedJournals = journals.slice(startIndex, startIndex + limit);

    return {
      journals: paginatedJournals,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error('fetchJournals API Error:', error);
    return {
      journals: [],
      total: 0,
      page: 1,
      totalPages: 1,
    };
  }
}

export async function fetchJournalBySlug(slugOrId: string): Promise<Journal | null> {
  if (!slugOrId) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/publications/journals/${encodeURIComponent(slugOrId)}/`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      return null;
    }
    if (res.ok) {
      const data = await res.json();
      return transformBackendJournal(data);
    }
  } catch (err) {
    console.warn(`Direct fetch by slug failed for ${slugOrId}:`, err);
  }

  return null;
}

export async function fetchJournalDisciplines(): Promise<JournalDiscipline[]> {
  try {
    const [rawCategories, rawJournalsData] = await Promise.all([
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
        'pub:journals:list',
        async (revalidate) => {
          const res = await fetch(`${API_BASE_URL}/api/publications/journals/`, {
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`Journals fetch failed: ${res.status}`);
          return res.json();
        },
        { ttlMs: 2_000, revalidate: 0 }
      ).catch(() => null),
    ]);

    let rawCategoriesList: any[] = [];
    if (rawCategories) {
      rawCategoriesList = Array.isArray(rawCategories) ? rawCategories : rawCategories.results ?? [];
    }

    let allJournals: Journal[] = [];
    if (rawJournalsData) {
      const rawList: any[] = Array.isArray(rawJournalsData) ? rawJournalsData : rawJournalsData.results ?? [];
      allJournals = rawList.map(transformBackendJournal);
    }

    const disciplines: JournalDiscipline[] = [
      {
        id: 'all',
        name: 'All Disciplines',
        slug: 'all',
        count: allJournals.length,
      },
    ];

    rawCategoriesList.forEach((cat) => {
      const catSlug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-');
      const count = allJournals.filter(
        (j) =>
          j.categorySlug?.toLowerCase() === catSlug.toLowerCase() ||
          j.discipline.toLowerCase() === cat.name.toLowerCase()
      ).length;

      disciplines.push({
        id: String(cat.id),
        name: cat.name,
        slug: catSlug,
        count,
      });
    });

    return disciplines;
  } catch (error) {
    console.error('fetchJournalDisciplines API Error:', error);
    return [{ id: 'all', name: 'All Disciplines', slug: 'all', count: 0 }];
  }
}

export async function fetchJournalIssues(journalIdOrSlug: string): Promise<JournalIssue[]> {
  try {
    // Public issues list — dedup + short TTL cache (issue mutations
    // invalidate 'pub:journals').
    const data = await cachedGet(
      'pub:journals:issues',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/issues/`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch issues: ${res.statusText}`);
        }
        return res.json();
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];

    // Also fetch current journal details to get its numeric ID
    const journal = await fetchJournalBySlug(journalIdOrSlug);
    const journalIdStr = journal ? journal.id : journalIdOrSlug;

    const matchedIssues = rawList.filter((iss: any) => String(iss.journal) === String(journalIdStr));

    return matchedIssues.map((iss: any) => {
      // Use authoritative DB fields first; fall back to title parsing
      let vol: number;
      let num: number;

      if (iss.volume_number !== null && iss.volume_number !== undefined) {
        vol = Number(iss.volume_number);
      } else if (iss.title) {
        const matchVol = iss.title.match(/vol(?:ume)?\s*(\d+)/i);
        vol = matchVol ? parseInt(matchVol[1], 10) : 1;
      } else {
        vol = 1;
      }

      if (iss.issue_number !== null && iss.issue_number !== undefined) {
        num = Number(iss.issue_number);
      } else if (iss.title) {
        const matchIss = iss.title.match(/issue\s*(\d+)/i);
        num = matchIss ? parseInt(matchIss[1], 10) : 1;
      } else {
        num = 1;
      }

      let year = 2026;
      if (iss.publication_date) {
        const y = parseInt(String(iss.publication_date).split('-')[0], 10);
        if (!isNaN(y)) year = y;
      }

      return {
        id: String(iss.id),
        publicId: iss.public_id || null,
        volume: vol,
        issue: num,
        volumeNumber: iss.volume_number !== null && iss.volume_number !== undefined ? Number(iss.volume_number) : null,
        issueNumber: iss.issue_number !== null && iss.issue_number !== undefined ? Number(iss.issue_number) : null,
        year,
        publicationDate: iss.publication_date || '2026',
        cover: formatMediaUrl(iss.cover_image || iss.cover),
        articleCount: Array.isArray(iss.articles) ? iss.articles.filter((a: any) => a.status === 'published' || !a.status).length : (iss.stock || 0),
        doi: `10.5281/mmsr.${journal?.slug || 'journal'}.v${vol}i${num}`,
        samplePdfUrl: formatMediaUrl(iss.file_digital || iss.sample_pdf || iss.samplePdfUrl),
        digitalFileName: iss.file_digital_name || iss.digitalFileName || null,
        price: typeof iss.price === 'number' ? iss.price : parseFloat(iss.price || '299.00'),
        pricePrint: iss.price_print !== undefined && iss.price_print !== null ? parseFloat(String(iss.price_print)) : undefined,
        priceBundle: iss.price_bundle !== undefined && iss.price_bundle !== null ? parseFloat(String(iss.price_bundle)) : undefined,
        stock: typeof iss.stock === 'number' ? iss.stock : 0,
        hasDigital: Boolean(iss.file_digital),
        supportedFormats: Array.isArray(iss.supported_formats)
          ? iss.supported_formats.map((sf: any) => ({
              format: sf.format,
              name: sf.name,
              price: typeof sf.price === 'number' ? sf.price : parseFloat(String(sf.price || '0')),
              available: Boolean(sf.available),
              description: sf.description,
            }))
          : undefined,
        title: iss.title,
      };
    });
  } catch (error) {
    console.error('fetchJournalIssues Error:', error);
    return [];
  }
}


export function transformBackendArticle(raw: any): JournalArticle {
  // M2M authors list can be empty even when a raw author-name string exists,
  // so fall back to author_names_raw (then a default) whenever the list is blank.
  const m2mNames = Array.isArray(raw.authors)
    ? raw.authors.map((a: any) => (typeof a === 'object' ? a.name : String(a))).filter(Boolean).join(', ')
    : '';
  const authorNames = m2mNames || raw.author_names_raw || 'MMSR Research Authors';

  return {
    id: String(raw.id),
    slug: raw.slug || String(raw.id),
    publicId: raw.public_id || null,
    journalId: raw.journal ? String(raw.journal) : undefined,
    issueId: raw.issue ? String(raw.issue) : undefined,
    title: raw.title || 'Untitled Article',
    authors: authorNames,
    authorNamesRaw: raw.author_names_raw,
    institution: raw.institution || 'Department of Research',
    doi: raw.doi || `10.5281/mmsr.article.${raw.id}`,
    publicationDate: raw.publication_date || '2026',
    abstract: raw.abstract || '',
    pageRange: raw.page_range || 'pp. 1–10',
    status: raw.status || 'published',
    accessMode: raw.access_mode || 'paid',
    pdfUrl: formatMediaUrl(raw.file_pdf),
    price: raw.price != null ? Number(raw.price) : null,
    hasFullText: Boolean(raw.has_full_text),
  };
}


export async function fetchArticleAccessState(articleId: string, token?: string): Promise<ArticleAccessState | null> {
  if (!articleId) return null;

  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/publications/articles/${articleId}/access/`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const d = await res.json();
    return {
      articleId: d.article_id,
      articleSlug: d.article_slug,
      isOpenAccess: Boolean(d.is_open_access),
      hasActiveSubscription: Boolean(d.has_active_subscription),
      hasArticlePurchase: Boolean(d.has_article_purchase),
      canAccessFullText: Boolean(d.can_access_full_text),
      canAccessPdf: Boolean(d.can_access_pdf),
      accessReason: d.access_reason || '',
      requiresLogin: Boolean(d.requires_login),
      articlePdfAvailable: Boolean(d.article_pdf_available),
      articlePrice: d.article_price != null ? Number(d.article_price) : null,
      hasFullText: Boolean(d.has_full_text),
    };
  } catch (err) {
    console.error('fetchArticleAccessState Error:', err);
    return null;
  }
}


export async function fetchArticleFullText(articleId: string, token?: string): Promise<{ fullText?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/publications/articles/${articleId}/fulltext/`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) return { error: 'Authentication required. Please sign in to read this article.' };
      if (res.status === 403) return { error: 'Access denied. Purchase this article or subscribe to the journal to read the full text.' };
      if (res.status === 404) return { error: 'No full-text content available for this article.' };
      return { error: 'Failed to retrieve article content.' };
    }

    const data = await res.json();
    return { fullText: data.full_text || '' };
  } catch (err: any) {
    return { error: err?.message || 'Network error while retrieving article content.' };
  }
}


export async function fetchArticleBySlug(slugOrId: string): Promise<JournalArticle | null> {
  if (!slugOrId) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/publications/articles/${encodeURIComponent(slugOrId)}/`, { cache: 'no-store' });
    if (res.ok) {
      const art = await res.json();
      return transformBackendArticle(art);
    }
  } catch (err) {
    console.warn(`Direct article fetch by slug failed for ${slugOrId}`, err);
  }

  try {
    const listRes = await fetch(`${API_BASE_URL}/api/publications/articles/`, { cache: 'no-store' });
    if (listRes.ok) {
      const data = await listRes.json();
      const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
      // Match priority: id → exact slug → case-insensitive slug. Article
      // slugs are not unique, so an exact match must win over a fuzzy one
      // (e.g. 'Sample' vs 'sample' must not resolve to the same record).
      const match =
        rawList.find((a: any) => String(a.id) === String(slugOrId)) ||
        rawList.find((a: any) => a.slug && a.slug === slugOrId) ||
        rawList.find((a: any) => a.slug && a.slug.toLowerCase() === slugOrId.toLowerCase());
      if (match) return transformBackendArticle(match);
    }
  } catch (err) {
    console.error('Fallback article lookup failed:', err);
  }

  return null;
}


export async function fetchArticlesForIssue(issueId: string): Promise<JournalArticle[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/publications/articles/?issue=${encodeURIComponent(issueId)}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch articles for issue ${issueId}`);
    }
    const data = await res.json();
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
    return rawList.map(transformBackendArticle);
  } catch (err) {
    console.error('fetchArticlesForIssue Error:', err);
    return [];
  }
}


export async function fetchArticlesForJournal(journalId: string): Promise<JournalArticle[]> {
  if (!journalId) return [];
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/publications/articles/?journal=${encodeURIComponent(journalId)}&status=published`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
    return rawList.map(transformBackendArticle);
  } catch (err) {
    console.error('fetchArticlesForJournal Error:', err);
    return [];
  }
}


export async function fetchUserJournalAccess(token: string): Promise<UserJournalAccess[]> {
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE_URL}/api/publications/user-access/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Your session has expired. Please sign in again to view your journal library.');
      }
      throw new Error(`Failed to load journal access records (HTTP ${res.status}).`);
    }

    const data = await res.json();
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];

    return rawList.map((item: any) => ({
      id: String(item.id),
      publicId: item.public_id ?? null,
      user: item.user,
      journal: item.journal,
      journalTitle: item.journal_title || 'Journal Access',
      journalSlug: item.journal_slug,
      journalPublicId: item.journal_public_id ?? null,
      issue: item.issue,
      issueTitle: item.issue_title,
      issuePublicId: item.issue_public_id ?? null,
      issueVolume: item.issue_volume,
      issueNumber: item.issue_number,
      article: item.article,
      articleTitle: item.article_title,
      articleSlug: item.article_slug,
      articlePublicId: item.article_public_id ?? null,
      accessType: item.access_type || 'issue',
      startDate: item.start_date,
      endDate: item.end_date,
      isActive: Boolean(item.is_active),
      isValid: item.is_valid !== undefined ? Boolean(item.is_valid) : Boolean(item.is_active),
      grantedAt: item.granted_at,
    }));
  } catch (error: any) {
    console.error('fetchUserJournalAccess Error:', error);
    throw error;
  }
}


export async function downloadArticlePdf(articleId: string, token?: string): Promise<{ blob?: Blob; filename?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/publications/articles/${articleId}/pdf/`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) return { error: 'Authentication required. Please sign in to access this protected PDF.' };
      if (res.status === 403) return { error: 'Access denied. Active issue purchase or annual subscription required.' };
      if (res.status === 404) return { error: 'PDF file not available or article not published.' };
      return { error: 'Failed to retrieve protected PDF file.' };
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    let filename = `article_${articleId}.pdf`;
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }

    return { blob, filename };
  } catch (err: any) {
    return { error: err?.message || 'Network error while retrieving PDF.' };
  }
}

// Open the persisted complete-issue PDF in the browser's native viewer.
// Uses the same protected endpoint as download so access rules are respected.
export async function openIssuePdf(
  issueId: string,
  token?: string
): Promise<{ error?: string }> {
  const res = await downloadIssuePdf(issueId, token);
  if (res.error) return { error: res.error };
  if (!res.blob) return { error: 'No complete issue PDF is available for this issue.' };

  const url = window.URL.createObjectURL(res.blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    window.URL.revokeObjectURL(url);
    return { error: 'Your browser blocked the PDF popup. Please allow popups and try again.' };
  }
  // Give the new tab time to load the blob before releasing it.
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  return {};
}


export async function downloadIssuePdf(issueId: string, token?: string): Promise<{ blob?: Blob; filename?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/api/publications/issues/${issueId}/pdf/`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) return { error: 'Authentication required. Please sign in to access this protected PDF.' };
      if (res.status === 403) return { error: 'Access denied. An active subscription to this journal is required to open or download the complete issue PDF.' };
      if (res.status === 404) return { error: 'PDF file not available for this issue.' };
      return { error: 'Failed to retrieve protected issue PDF file.' };
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    let filename = `issue_${issueId}.pdf`;
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }

    return { blob, filename };
  } catch (err: any) {
    return { error: err?.message || 'Network error while retrieving PDF.' };
  }
}


