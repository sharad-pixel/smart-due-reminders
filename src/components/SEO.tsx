import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * SEO Component for dynamic page-specific meta tags
 * Use this on each page to set unique title, description, and other SEO attributes
 */
const SEO = ({
  title,
  description,
  canonical,
  keywords,
  ogType = 'website',
  ogImage = 'https://recouply.ai/og-image.png',
  noindex = false,
}: SEOProps) => {
  useEffect(() => {
    // Set document title
    document.title = title.includes('Recouply') ? title : `${title} | Recouply.ai`;

    // Helper to update or create meta tag
    const updateMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (element) {
        element.setAttribute('content', content);
      } else {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        element.setAttribute('content', content);
        document.head.appendChild(element);
      }
    };

    // Update meta description
    updateMeta('description', description);

    // Update keywords if provided
    if (keywords) {
      updateMeta('keywords', keywords);
    }

    // Update robots
    updateMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Update canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      if (canonicalEl) {
        canonicalEl.setAttribute('href', canonical);
      } else {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        canonicalEl.setAttribute('href', canonical);
        document.head.appendChild(canonicalEl);
      }
    }

    // Update Open Graph tags
    updateMeta('og:title', title, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', ogType, true);
    updateMeta('og:image', ogImage, true);
    if (canonical) {
      updateMeta('og:url', canonical, true);
    }

    // Update Twitter tags
    updateMeta('twitter:title', title);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', ogImage);

    // Cleanup function to reset title on unmount (optional)
    return () => {
      // Title will be overwritten by next page, no cleanup needed
    };
  }, [title, description, canonical, keywords, ogType, ogImage, noindex]);

  return null;
};

export default SEO;
