import { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "profile";
  author?: string;
  schema?: Record<string, unknown>;
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_TITLE = "Panti Janda — Ruang Tumbuh & Komunitas Janda Indonesia";
const DEFAULT_DESCRIPTION =
  "Panti Janda adalah platform komunitas terpercaya untuk pemberdayaan perempuan janda di Indonesia: program wirausaha, seminar, akademi trading, kompetisi e-sport, bursa transfer pemain, galang dana, dan marketplace karya anggota.";
const DEFAULT_KEYWORDS =
  "panti janda, komunitas janda, wonder woman indonesia, pemberdayaan janda, kompetisi esport, bursa transfer esport, donasi janda, pelatihan wirausaha, akademi trading, web3 crypto";
const DEFAULT_IMAGE = "https://pantijanda.com/images/hero-community.webp";
const SITE_NAME = "Panti Janda";

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  canonical,
  image = DEFAULT_IMAGE,
  type = "website",
  author = "Panti Janda Community",
  schema,
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    // 1. Title
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    document.title = fullTitle;

    // Helper to set or create meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // 2. Standard Meta Tags
    setMeta("description", description);
    setMeta("keywords", keywords);
    setMeta("author", author);
    setMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");

    // 3. Open Graph Tags
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:type", type, true);
    setMeta("og:image", image, true);
    setMeta("og:site_name", SITE_NAME, true);
    const currentUrl = window.location.href;
    setMeta("og:url", canonical || currentUrl, true);
    setMeta("og:locale", "id_ID", true);

    // 4. Twitter Card Tags
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonical || currentUrl);

    // 6. JSON-LD Schema
    const scriptId = "seo-json-ld";
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;

    const baseSchema = schema ?? jsonLd ?? {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://pantijanda.com/#organization",
          name: "Panti Janda Indonesia",
          url: "https://pantijanda.com",
          logo: {
            "@type": "ImageObject",
            url: "https://pantijanda.com/images/hero-community.webp",
          },
          description: DEFAULT_DESCRIPTION,
          sameAs: ["https://instagram.com/pantijanda", "https://youtube.com/@pantijanda"],
        },
        {
          "@type": "WebSite",
          "@id": "https://pantijanda.com/#website",
          url: "https://pantijanda.com",
          name: SITE_NAME,
          description: DEFAULT_DESCRIPTION,
          publisher: { "@id": "https://pantijanda.com/#organization" },
          inLanguage: "id-ID",
        },
      ],
    };

    if (!scriptElement) {
      scriptElement = document.createElement("script");
      scriptElement.id = scriptId;
      scriptElement.type = "application/ld+json";
      document.head.appendChild(scriptElement);
    }
    scriptElement.textContent = JSON.stringify(baseSchema);

    return () => {
      // Keep title and metadata on unmount; next component will overwrite
    };
  }, [title, description, keywords, canonical, image, type, author, schema]);

  return null;
}
