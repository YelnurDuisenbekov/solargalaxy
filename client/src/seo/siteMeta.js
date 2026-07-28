/** Канонический домен и контакты для SEO / JSON-LD — только факты с сайта. */
export const SITE_ORIGIN = 'https://solargalaxy.kz';
export const SITE_NAME = 'Solar Galaxy';
export const DEFAULT_TITLE = 'Solar Galaxy — СЭС под ключ в Казахстане';
export const DEFAULT_DESCRIPTION =
  'Солнечные электростанции под ключ в Казахстане: проектирование, поставка, монтаж и пусконаладка. Офис в Шымкенте, работаем по всей стране.';

export const SITE_CONTACTS = {
  phone: '+7 700 330 1999',
  phoneE164: '+77003301999',
  city: 'Шымкент',
  streetAddress: 'ул. Байтурсынова 85 (БЦ Орда), каб. 210',
  addressLocality: 'Шымкент',
  addressCountry: 'KZ',
  hours: 'Mo-Fr 09:00-18:00',
  hoursDisplay: 'Пн–Пт: 9:00–18:00',
};

export const OG_IMAGE = `${SITE_ORIGIN}/logo-full.png`;

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
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
    areaServed: {
      '@type': 'Country',
      name: 'Kazakhstan',
    },
    sameAs: [],
  };
}
