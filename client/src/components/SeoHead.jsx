import { useEffect } from 'react';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  buildOrganizationJsonLd,
  buildServicesJsonLd,
  buildWebSiteJsonLd,
  jsonLdForPage,
} from '../seo/siteMeta';

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function resolveJsonLd({ path, jsonLd, jsonLdKind }) {
  if (jsonLd === false) return null;
  if (Array.isArray(jsonLd)) return jsonLd;
  if (jsonLd && typeof jsonLd === 'object') return jsonLd;
  if (jsonLdKind === 'services') return buildServicesJsonLd();
  if (jsonLdKind === 'organization') return buildOrganizationJsonLd();
  if (jsonLdKind === 'website') return buildWebSiteJsonLd();
  return jsonLdForPage(path);
}

/**
 * SEO-хелпер: title, description, canonical, OG, JSON-LD.
 * @param {{ title?: string, description?: string, path?: string, noindex?: boolean, jsonLd?: boolean|object|array, jsonLdKind?: string }} props
 */
export default function SeoHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  noindex = false,
  jsonLd = false,
  jsonLdKind,
}) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const url = absoluteUrl(path);
    const robots = noindex ? 'noindex, nofollow' : 'index, follow';
    const ld = resolveJsonLd({ path, jsonLd, jsonLdKind });

    document.title = fullTitle;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:locale', 'ru_KZ');
    upsertMeta('property', 'og:image', OG_IMAGE);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', OG_IMAGE);

    upsertLink('canonical', url);
    upsertJsonLd('sg-jsonld', ld);

    return () => {
      upsertJsonLd('sg-jsonld', null);
    };
  }, [title, description, path, noindex, jsonLd, jsonLdKind]);

  return null;
}
