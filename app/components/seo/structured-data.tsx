interface BreadcrumbItem {
  readonly name: string;
  readonly url: string;
}

interface FaqItem {
  readonly answer: string;
  readonly question: string;
}

function StructuredData({ value }: Readonly<{ value: object }>) {
  const json = JSON.stringify(value).replaceAll("<", String.raw`\u003c`);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script text; "<" is escaped above.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function BreadcrumbStructuredData({
  items,
}: Readonly<{ items: readonly BreadcrumbItem[] }>) {
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

export function FaqStructuredData({ items }: Readonly<{ items: readonly FaqItem[] }>) {
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
