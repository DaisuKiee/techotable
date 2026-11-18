import { useEffect } from 'react';

const SITE = 'CTU Daanbantayan Smart Timetabling System';
const ORIGIN = 'https://technotabler.cebutech.digital';

/**
 * Sets the tab title, meta description and canonical URL for one route.
 *
 * This is a single-page app, so without this every route would serve the tags
 * baked into index.html. Everything is restored on unmount, which keeps the
 * landing page's own tags intact when someone navigates back to it.
 */
export default function usePageMeta({ title, description, path }) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = `${title} | ${SITE}`;

    const descTag = document.querySelector('meta[name="description"]');
    const previousDesc = descTag?.getAttribute('content') ?? null;
    if (descTag && description) descTag.setAttribute('content', description);

    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonicalTag?.getAttribute('href') ?? null;
    if (canonicalTag && path) canonicalTag.setAttribute('href', `${ORIGIN}${path}`);

    return () => {
      document.title = previousTitle;
      if (descTag && previousDesc !== null) descTag.setAttribute('content', previousDesc);
      if (canonicalTag && previousCanonical !== null) canonicalTag.setAttribute('href', previousCanonical);
    };
  }, [title, description, path]);
}
