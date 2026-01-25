import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  SITE_CONFIG,
  generateOrganizationSchema,
  generateSoftwareApplicationSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
} from '@/lib/seoConfig';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  structuredData?: object | object[];
  breadcrumbs?: { name: string; url: string }[];
}

/**
 * Enhanced SEO Component with comprehensive meta tags and structured data
 */
const SEOHead = ({
  title,
  description,
  canonical,
  keywords,
  ogType = 'website',
  ogImage = SITE_CONFIG.ogImage,
  noindex = false,
  structuredData,
  breadcrumbs,
}: SEOHeadProps) => {
  const location = useLocation();
  const fullCanonical = canonical || `${SITE_CONFIG.siteUrl}${location.pathname}`;
  const fullTitle = title.includes('Recouply') ? title : `${title} | Recouply.ai`;

  useEffect(() => {
    // Set document title
    document.title = fullTitle;

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

    // Helper to update or create link tag
    const updateLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (element) {
        element.setAttribute('href', href);
        if (attrs) {
          Object.entries(attrs).forEach(([key, value]) => {
            element!.setAttribute(key, value);
          });
        }
      } else {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        element.setAttribute('href', href);
        if (attrs) {
          Object.entries(attrs).forEach(([key, value]) => {
            element!.setAttribute(key, value);
          });
        }
        document.head.appendChild(element);
      }
    };

    // Primary meta tags
    updateMeta('description', description);
    updateMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    
    // Keywords
    if (keywords) {
      updateMeta('keywords', keywords);
    }

    // Author and publisher
    updateMeta('author', SITE_CONFIG.companyName);
    updateMeta('publisher', SITE_CONFIG.companyName);

    // Canonical URL
    updateLink('canonical', fullCanonical);

    // Open Graph tags
    updateMeta('og:title', fullTitle, true);
    updateMeta('og:description', description, true);
    updateMeta('og:type', ogType, true);
    updateMeta('og:image', ogImage, true);
    updateMeta('og:image:width', '1200', true);
    updateMeta('og:image:height', '630', true);
    updateMeta('og:image:alt', `${SITE_CONFIG.siteName} - Collection Intelligence Platform`, true);
    updateMeta('og:url', fullCanonical, true);
    updateMeta('og:site_name', SITE_CONFIG.siteName, true);
    updateMeta('og:locale', 'en_US', true);

    // Twitter Card tags
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:site', SITE_CONFIG.twitterHandle);
    updateMeta('twitter:creator', SITE_CONFIG.twitterHandle);
    updateMeta('twitter:title', fullTitle);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', ogImage);
    updateMeta('twitter:image:alt', `${SITE_CONFIG.siteName} - Collection Intelligence Platform`);

    // Additional SEO meta tags
    updateMeta('application-name', SITE_CONFIG.siteName);
    updateMeta('theme-color', '#3b82f6');
    updateMeta('msapplication-TileColor', '#3b82f6');

    // Mobile optimization
    updateMeta('format-detection', 'telephone=no');
    updateMeta('mobile-web-app-capable', 'yes');

    // Structured data injection
    const injectStructuredData = (id: string, data: object) => {
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (script) {
        script.textContent = JSON.stringify(data);
      } else {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      }
    };

    // Inject base structured data
    injectStructuredData('ld-organization', generateOrganizationSchema());
    injectStructuredData('ld-software', generateSoftwareApplicationSchema());
    injectStructuredData('ld-website', generateWebSiteSchema());

    // Inject breadcrumbs if provided
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbItems = [
        { name: 'Home', url: SITE_CONFIG.siteUrl },
        ...breadcrumbs,
      ];
      injectStructuredData('ld-breadcrumbs', generateBreadcrumbSchema(breadcrumbItems));
    }

    // Inject additional structured data
    if (structuredData) {
      const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];
      dataArray.forEach((data, index) => {
        injectStructuredData(`ld-custom-${index}`, data);
      });
    }

    // Cleanup on unmount
    return () => {
      // Remove custom structured data scripts on page change
      document.querySelectorAll('script[id^="ld-custom-"]').forEach((el) => el.remove());
      document.getElementById('ld-breadcrumbs')?.remove();
    };
  }, [fullTitle, description, fullCanonical, keywords, ogType, ogImage, noindex, structuredData, breadcrumbs]);

  return null;
};

export default SEOHead;
