import { SITE_ORIGIN } from "~/seo/metadata";

interface PaginationControlProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly searchParams: URLSearchParams;
}

function buildPageUrl(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams);
  params.set("page", String(page));

  return `${SITE_ORIGIN}/search?${params.toString()}`;
}

export function PaginationControl({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  searchParams,
}: PaginationControlProps) {
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNum) => pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 2,
  );

  return (
    <nav className="sr-only" aria-label="Pagination">
      {hasPreviousPage ? (
        <a href={buildPageUrl(searchParams, currentPage - 1)} rel="prev">
          Previous Page
        </a>
      ) : null}
      {hasNextPage ? (
        <a href={buildPageUrl(searchParams, currentPage + 1)} rel="next">
          Next Page
        </a>
      ) : null}
      {visiblePages.map((pageNum) => (
        <a key={pageNum} href={buildPageUrl(searchParams, pageNum)}>
          Page {pageNum}
        </a>
      ))}
    </nav>
  );
}
