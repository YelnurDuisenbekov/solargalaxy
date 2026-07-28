import pagesConfig from '../../seo/pages.json';
import { SITE_CONTACTS as CONTACTS } from './contacts';

/** Канонический домен и контакты для SEO / JSON-LD — только факты с сайта. */
export const SITE_ORIGIN = 'https://solargalaxy.kz';
export const SITE_NAME = 'Solar Galaxy';
export const OG_IMAGE = `${SITE_ORIGIN}/logo-full.png`;

export const SITE_CONTACTS = CONTACTS;

export const PAGE_META = pagesConfig;

export const DEFAULT_TITLE = PAGE_META['/'].title.includes(SITE_NAME)
  ? PAGE_META['/'].title
  : `${PAGE_META['/'].title} | ${SITE_NAME}`;
export const DEFAULT_DESCRIPTION = PAGE_META['/'].description;

export function pageMeta(path) {
  const key = path in PAGE_META ? path : '/';
  const raw = PAGE_META[key];
  const title = raw.title.includes(SITE_NAME) ? raw.title : `${raw.title} | ${SITE_NAME}`;
  return { ...raw, title, fullTitle: title };
}

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/logo-full.png`,
    image: OG_IMAGE,
    telephone: SITE_CONTACTS.phoneE164,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE_CONTACTS.streetAddress,
      addressLocality: SITE_CONTACTS.addressLocality,
      addressCountry: SITE_CONTACTS.addressCountry,
    },
    openingHours: SITE_CONTACTS.hours,
    areaServed: [
      { '@type': 'Country', name: 'Kazakhstan' },
      { '@type': 'City', name: 'Астана' },
      { '@type': 'City', name: 'Алматы' },
      { '@type': 'City', name: 'Шымкент' },
    ],
    sameAs: SITE_CONTACTS.sameAs.filter(Boolean),
  };
}

export function buildServicesJsonLd() {
  const services = [
    {
      name: 'Солнечные электростанции под ключ',
      description: 'Проектирование, поставка оборудования, монтаж и пусконаладка СЭС.',
    },
    {
      name: 'Сетевая солнечная электростанция',
      description: 'Подключение к сети, нет-митеринг и снижение расходов на электроэнергию.',
    },
    {
      name: 'Автономная солнечная электростанция',
      description: 'Энергонезависимость для удалённых объектов и сельхозкомплексов.',
    },
    {
      name: 'Гибридная солнечная электростанция',
      description: 'Сеть и аккумуляторы — резерв при отключениях и оптимальное использование генерации.',
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': services.map((s) => ({
      '@type': 'Service',
      name: s.name,
      description: s.description,
      provider: { '@id': `${SITE_ORIGIN}/#organization` },
      areaServed: { '@type': 'Country', name: 'Kazakhstan' },
      serviceType: s.name,
    })),
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: SITE_NAME,
    inLanguage: 'ru-KZ',
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  };
}

export function jsonLdForPage(path) {
  const kind = PAGE_META[path]?.jsonLd;
  if (kind === 'services') {
    return [buildOrganizationJsonLd(), buildWebSiteJsonLd(), buildServicesJsonLd()];
  }
  if (kind === 'organization') {
    return [buildOrganizationJsonLd(), buildWebSiteJsonLd()];
  }
  return null;
}
