/**
 * Dynamic SEO composable - generates page-specific meta tags with relevant keywords
 * and content to improve discoverability for search variations (Better SEQTA, DesQTA, etc.)
 */
export function useDynamicSeo(options?: {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
}) {
  const config = useConfig();
  const route = useRoute();
  const { page } = useContent();

  const siteConfig = computed(() => config.value.site as {
    name: string;
    description: string;
    keywords?: string[];
    url?: string;
    ogImage?: string;
  });

  const siteUrl = computed(() => siteConfig.value.url || 'https://docs.betterseqta.org');
  const canonicalUrl = computed(() => {
    const path = route.path === '/' ? '' : route.path;
    return `${siteUrl.value}${path}`;
  });

  /** Extract topic keywords from URL path (e.g. /betterseqta/desqta/user-guide → desqta, user guide) */
  const pathKeywords = computed(() => {
    const segments = route.path.split('/').filter(Boolean);
    return segments
      .map(s => s.replace(/-/g, ' '))
      .filter(s => s.length > 1 && !/^\d+$/.test(s));
  });

  /** Build page-specific keywords from title, path, and optional frontmatter */
  const pageKeywords = computed(() => {
    const base = siteConfig.value.keywords || [];
    const fromPage = options?.keywords || (page.value as { keywords?: string[] })?.keywords || [];
    const fromTitle = options?.title || page.value?.title
      ? [options?.title || page.value?.title].filter(Boolean)
      : [];
    const fromPath = pathKeywords.value;
    return [...new Set([...base, ...fromPage, ...fromTitle, ...fromPath])];
  });

  const metaTitle = computed(() => {
    const title = options?.title ?? page.value?.title ?? 'Documentation';
    return `${title} - ${siteConfig.value.name}`;
  });

  const metaDescription = computed(() => {
    const desc = options?.description ?? page.value?.description ?? siteConfig.value.description;
    return desc?.slice(0, 160) || siteConfig.value.description;
  });

  const ogImage = computed(() => {
    const img = options?.image ?? siteConfig.value.ogImage;
    return img?.startsWith('http') ? img : `${siteUrl.value}${img?.startsWith('/') ? '' : '/'}${img || '/hero.png'}`;
  });

  useSeoMeta({
    title: metaTitle,
    description: metaDescription,
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogImage,
    ogUrl: canonicalUrl,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: metaTitle,
    twitterDescription: metaDescription,
    twitterImage: ogImage,
  });

  useHead({
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
    meta: [
      { name: 'keywords', content: computed(() => pageKeywords.value.join(', ')) },
    ],
  });

  /** JSON-LD structured data for better search understanding */
  const jsonLd = computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: options?.title ?? page.value?.title ?? siteConfig.value.name,
    description: metaDescription.value,
    url: canonicalUrl.value,
    publisher: {
      '@type': 'Organization',
      name: 'BetterSEQTA',
      url: 'https://betterseqta.org',
    },
    keywords: pageKeywords.value.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl.value,
    },
  }));

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() => JSON.stringify(jsonLd.value)),
      },
    ],
  });
}
