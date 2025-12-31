/**
 * JSON-LD Structured Data Components for SEO
 * Implements Schema.org markup for better search engine visibility
 */

export interface OrganizationSchemaProps {
  name: string;
  url: string;
  logo: string;
  description: string;
  email?: string;
  phone?: string;
  address?: {
    streetAddress: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  sameAs?: string[]; // Social media URLs
}

export interface LocalBusinessSchemaProps extends OrganizationSchemaProps {
  priceRange: string;
  openingHours?: string[];
  geo?: {
    latitude: number;
    longitude: number;
  };
  areaServed?: string[];
}

export interface ServiceSchemaProps {
  name: string;
  description: string;
  provider: string;
  providerUrl: string;
  serviceType: string;
  areaServed: string[];
  priceRange?: string;
  image?: string;
}

export interface ProductSchemaProps {
  name: string;
  description: string;
  image: string;
  url: string;
  brand: string;
  offers: {
    price: number;
    priceCurrency: string;
    availability: "InStock" | "OutOfStock" | "PreOrder";
    priceValidUntil?: string;
  };
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

export interface BreadcrumbSchemaProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export interface FAQSchemaProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Organization Schema - For company-wide SEO
 */
export function OrganizationSchema({ data }: { data: OrganizationSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: data.name,
    url: data.url,
    logo: data.logo,
    description: data.description,
    ...(data.email && { email: data.email }),
    ...(data.phone && { telephone: data.phone }),
    ...(data.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: data.address.streetAddress,
        addressLocality: data.address.city,
        addressRegion: data.address.state,
        addressCountry: data.address.country,
        postalCode: data.address.postalCode,
      },
    }),
    ...(data.sameAs && { sameAs: data.sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * LocalBusiness Schema - For location-based SEO
 */
export function LocalBusinessSchema({ data }: { data: LocalBusinessSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${data.url}/#localbusiness`,
    name: data.name,
    url: data.url,
    logo: data.logo,
    image: data.logo,
    description: data.description,
    priceRange: data.priceRange,
    ...(data.email && { email: data.email }),
    ...(data.phone && { telephone: data.phone }),
    ...(data.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: data.address.streetAddress,
        addressLocality: data.address.city,
        addressRegion: data.address.state,
        addressCountry: data.address.country,
        postalCode: data.address.postalCode,
      },
    }),
    ...(data.geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: data.geo.latitude,
        longitude: data.geo.longitude,
      },
    }),
    ...(data.openingHours && { openingHoursSpecification: data.openingHours }),
    ...(data.areaServed && { areaServed: data.areaServed }),
    ...(data.sameAs && { sameAs: data.sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Service Schema - For service pages
 */
export function ServiceSchema({ data }: { data: ServiceSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: data.name,
    description: data.description,
    provider: {
      "@type": "Organization",
      name: data.provider,
      url: data.providerUrl,
    },
    serviceType: data.serviceType,
    areaServed: data.areaServed.map((area) => ({
      "@type": "City",
      name: area,
    })),
    ...(data.priceRange && { priceRange: data.priceRange }),
    ...(data.image && { image: data.image }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Product Schema - For individual car/vehicle pages
 */
export function ProductSchema({ data }: { data: ProductSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.name,
    description: data.description,
    image: data.image,
    url: data.url,
    brand: {
      "@type": "Brand",
      name: data.brand,
    },
    offers: {
      "@type": "Offer",
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency,
      availability: `https://schema.org/${data.offers.availability}`,
      ...(data.offers.priceValidUntil && {
        priceValidUntil: data.offers.priceValidUntil,
      }),
    },
    ...(data.aggregateRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: data.aggregateRating.ratingValue,
        reviewCount: data.aggregateRating.reviewCount,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Vehicle Schema - Specific for car rental/chauffeur
 */
export function VehicleSchema({
  data,
}: {
  data: {
    name: string;
    description: string;
    image: string;
    url: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    seatingCapacity: number;
    vehicleType: string;
    offers: {
      price: number;
      priceCurrency: string;
      availability: "InStock" | "OutOfStock";
    };
  };
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: data.name,
    description: data.description,
    image: data.image,
    url: data.url,
    brand: {
      "@type": "Brand",
      name: data.brand,
    },
    model: data.model,
    vehicleModelDate: data.year.toString(),
    color: data.color,
    seatingCapacity: data.seatingCapacity,
    vehicleConfiguration: data.vehicleType,
    offers: {
      "@type": "Offer",
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency,
      availability: `https://schema.org/${data.offers.availability}`,
      itemCondition: "https://schema.org/UsedCondition",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Breadcrumb Schema - For navigation structure
 */
export function BreadcrumbSchema({ data }: { data: BreadcrumbSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: data.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * FAQ Schema - For FAQ pages/sections
 */
export function FAQSchema({ data }: { data: FAQSchemaProps }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * WebSite Schema - For site-wide search
 */
export function WebSiteSchema({
  data,
}: {
  data: {
    name: string;
    url: string;
    description: string;
    searchUrl?: string;
  };
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: data.name,
    url: data.url,
    description: data.description,
    ...(data.searchUrl && {
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: data.searchUrl,
        },
        "query-input": "required name=search_term_string",
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
