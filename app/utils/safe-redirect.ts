export function safeRedirect(to: unknown, defaultRedirect = "/"): string {
  if (typeof to !== "string") {
    return defaultRedirect;
  }

  // Strip CRLF and whitespace to prevent header injection or prefix tricks
  const safeTo = to.replace(/[\r\n]/g, "").trim();

  // Must start with a single slash (no protocol, no '//' host-relative)
  if (!safeTo.startsWith("/") || safeTo.startsWith("//")) {
    return defaultRedirect;
  }

  // Disallow URL schemes (e.g., "http:", "javascript:")
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(to)) {
    return defaultRedirect;
  }

  return safeTo;
}
