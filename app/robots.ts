import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL;

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/home',
          '/books',
          '/books/*',
          '/journals',
          '/journals/*',
          '/conference',
          '/conference/*',
          '/services',
          '/contact',
          '/publish-chapter',
          '/submit-manuscript',
        ],
        disallow: [
          '/admin/',
          '/admin/*',
          '/dashboard/',
          '/dashboard/*',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/api/',
          '/checkout',
          '/payment/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
