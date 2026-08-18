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
