import { Mail, Phone, Search } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FAQ_CATEGORIES, FAQ_ITEMS } from "~/content/faq";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { cn } from "~/lib/utils";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import { BreadcrumbStructuredData, FaqStructuredData } from "~/seo/structured-data";

export const meta = () =>
  buildPageMetadata({
    title: "FAQ - Frequently Asked Questions | Tripdly Chauffeur Service",
    description:
      "Find answers to common questions about Tripdly's chauffeur service in Nigeria. Learn about booking, pricing, vehicles, airport transfers, and more.",
    path: "/faq",
  });

export { staticPageHeaders as headers } from "~/seo/metadata";

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = normalizedQuery
    ? FAQ_CATEGORIES.flatMap((category) => {
        const questions = category.questions.filter(
          (item) =>
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery),
        );

        return questions.length > 0 ? [{ ...category, questions }] : [];
      })
    : FAQ_CATEGORIES;

  return (
    <div className="w-full">
      <FaqStructuredData items={FAQ_ITEMS} />
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_ORIGIN },
          { name: "FAQ", url: `${SITE_ORIGIN}/faq` },
        ]}
      />

      <section className="border-b bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">Frequently Asked Questions</h1>
          <p className="mb-8 text-lg text-gray-600">
            Find answers to common questions about our chauffeur service.
          </p>

          <div className="relative mx-auto max-w-md">
            <label htmlFor="faq-search" className="sr-only">
              Search frequently asked questions
            </label>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-400"
            />
            <input
              id="faq-search"
              type="search"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              className="w-full rounded-lg border border-gray-300 py-3 pr-4 pl-10 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            />
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-4">
          {normalizedQuery ? (
            <FaqSearchResults query={searchQuery} categories={filteredCategories} />
          ) : (
            <Tabs
              defaultValue={FAQ_CATEGORIES[0].id}
              orientation="vertical"
              className="flex flex-col gap-8 md:flex-row"
            >
              <TabsList className="h-auto w-full shrink-0 gap-1 overflow-x-auto bg-transparent p-0 md:sticky md:top-21.25 md:w-64 md:self-start md:overflow-x-visible">
                {FAQ_CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className={cn(
                      "w-full scroll-mb-24 justify-start rounded-lg px-4 py-2 whitespace-nowrap transition-colors md:scroll-mb-0 md:whitespace-normal",
                      "data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-none",
                      "data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-100",
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      {category.name}
                      <span className="ml-2 text-sm opacity-60">({category.questions.length})</span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="min-w-0 flex-1">
                {FAQ_CATEGORIES.map((category) => (
                  <TabsContent key={category.id} value={category.id}>
                    <h2 className="mb-6 text-xl font-semibold">{category.name}</h2>
                    <FaqAccordion categoryId={category.id} questions={category.questions} />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
        </div>
      </section>

      <section className="border-t bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold">Still Have Questions?</h2>
          <p className="mb-8 text-gray-600">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="outline" size="lg">
              <a href={`mailto:${LEGAL_CONSTANTS.supportEmail}`}>
                <Mail data-icon="inline-start" />
                Email Us
              </a>
            </Button>
            <Button asChild size="lg">
              <a href={`tel:${LEGAL_CONSTANTS.supportPhone}`}>
                <Phone data-icon="inline-start" />
                Call Support
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

type FaqQuestion = (typeof FAQ_ITEMS)[number];

interface FaqAccordionProps {
  readonly categoryId: string;
  readonly questions: readonly FaqQuestion[];
}

interface FaqSearchCategory {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly FaqQuestion[];
}

interface FaqSearchResultsProps {
  readonly categories: readonly FaqSearchCategory[];
  readonly query: string;
}

function FaqAccordion({ categoryId, questions }: FaqAccordionProps) {
  return (
    <Accordion type="multiple" className="rounded-lg border bg-white">
      {questions.map((item, index) => (
        <AccordionItem
          key={item.question}
          value={`${categoryId}-${index}`}
          className="border-b border-gray-200 px-6 last:border-0"
        >
          <AccordionTrigger className="text-left hover:no-underline">
            <span className="min-w-0 flex-1 pr-4 font-medium text-gray-900">{item.question}</span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="leading-relaxed text-gray-600">{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function FaqSearchResults({ query, categories }: FaqSearchResultsProps) {
  return (
    <div aria-live="polite">
      <h2 className="mb-6 text-lg font-semibold">
        Search results for &ldquo;{query.trim()}&rdquo;
      </h2>
      {categories.length > 0 ? (
        categories.map((category) => (
          <div key={category.id} className="mb-8">
            <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
              {category.name}
            </h3>
            <FaqAccordion categoryId={category.id} questions={category.questions} />
          </div>
        ))
      ) : (
        <p className="text-gray-500">No questions found matching your search.</p>
      )}
    </div>
  );
}
