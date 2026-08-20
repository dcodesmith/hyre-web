import { HOME_FAQ_ITEMS } from "~/content/home";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { SITE_ORIGIN } from "~/seo/metadata";

interface BreadcrumbItem {
  readonly name: string;
  readonly url: string;
}

interface FaqItem {
  readonly answer: string;
  readonly question: string;
}

interface StructuredDataProps {
  readonly value: object;
}

interface BreadcrumbStructuredDataProps {
  readonly items: readonly BreadcrumbItem[];
}

interface FaqStructuredDataProps {
  readonly items: readonly FaqItem[];
}

function StructuredData({ value }: StructuredDataProps) {
  const json = JSON.stringify(value).replaceAll("<", String.raw`\u003c`);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script text; "<" is escaped above.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  return (
    <StructuredData
      value={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

export function FaqStructuredData({ items }: FaqStructuredDataProps) {
  return (
    <StructuredData
      value={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}

interface VehicleStructuredDataProps {
  readonly name: string;
  readonly description: string;
  readonly image: string;
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly color: string | null;
  readonly seatingCapacity: number;
  readonly vehicleType: string;
  readonly price: number;
}

export function VehicleStructuredData({
  name,
  description,
  image,
  url,
  brand,
  model,
  year,
  color,
  seatingCapacity,
  vehicleType,
  price,
}: VehicleStructuredDataProps) {
  return (
    <StructuredData
      value={{
        "@context": "https://schema.org",
        "@type": "Vehicle",
        name,
        description,
        image,
        url,
        brand: {
          "@type": "Brand",
          name: brand,
        },
        model,
        vehicleModelDate: String(year),
        color: color ?? undefined,
        seatingCapacity,
        vehicleConfiguration: vehicleType,
        offers: {
          "@type": "Offer",
          price,
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
      }}
    />
  );
}

export function HomeStructuredData() {
  return (
    <>
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: LEGAL_CONSTANTS.companyName,
          url: SITE_ORIGIN,
          logo: `${SITE_ORIGIN}/logo.svg`,
          image: `${SITE_ORIGIN}/og-image.jpg`,
          description:
            "Chauffeur-driven car hire for airport transfers, corporate travel, day trips, and special occasions in Lagos, Nigeria.",
          telephone: LEGAL_CONSTANTS.supportPhone,
          email: LEGAL_CONSTANTS.supportEmail,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Lagos",
            addressCountry: "NG",
          },
          areaServed: {
            "@type": "City",
            name: "Lagos",
          },
          priceRange: "₦₦",
        }}
      />
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: LEGAL_CONSTANTS.companyName,
          url: SITE_ORIGIN,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_ORIGIN}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Premium Chauffeur Service",
          serviceType: "Chauffeur Service",
          description:
            "Professional chauffeur and car hire service for corporate travel, airport transfers, and special occasions in Nigeria.",
          provider: {
            "@type": "Organization",
            name: LEGAL_CONSTANTS.companyName,
            url: SITE_ORIGIN,
          },
          areaServed: {
            "@type": "Country",
            name: "Nigeria",
          },
        }}
      />
      <FaqStructuredData items={HOME_FAQ_ITEMS} />
    </>
  );
}
