export function buildRobotsTxt({
  origin,
  allowIndexing,
  privatePaths = [],
}: {
  readonly origin: string;
  readonly allowIndexing: boolean;
  readonly privatePaths?: readonly string[];
}) {
  if (!allowIndexing) {
    return "User-agent: *\nDisallow: /\n";
  }

  const disallows = privatePaths
    .flatMap((path) => [`Disallow: ${path}`, `Disallow: ${path}/`])
    .join("\n");

  return `User-agent: *
Content-Signal: ai-train=no, search=yes, ai-input=no
Allow: /
${disallows}

Sitemap: ${origin}/sitemap.xml
`;
}
