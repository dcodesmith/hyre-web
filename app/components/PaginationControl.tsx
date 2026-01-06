interface PaginationControlProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly searchParams: URLSearchParams;
  readonly baseUrl: string;
}

export function PaginationControl({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  searchParams,
  baseUrl,
}: PaginationControlProps) {
  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `${baseUrl}/search?${params.toString()}`;
  };

  return (
    <nav className="sr-only" aria-label="Pagination">
      {hasPreviousPage && (
        <a href={buildPageUrl(currentPage - 1)} rel="prev">
          Previous Page
        </a>
      )}
      {hasNextPage && (
        <a href={buildPageUrl(currentPage + 1)} rel="next">
          Next Page
        </a>
      )}
      {/* Sliding window: first, last, and pages around current for better crawlability without DOM bloat */}
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(
          (pageNum) =>
            pageNum === 1 ||
            pageNum === totalPages ||
            Math.abs(pageNum - currentPage) <= 2
        )
        .map((pageNum) => (
          <a key={pageNum} href={buildPageUrl(pageNum)}>
            Page {pageNum}
          </a>
        ))}
    </nav>
  );
}
