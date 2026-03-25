import { type LoaderFunctionArgs, type MetaFunction, Link, useLoaderData } from "react-router";
import { getPublicPartnerBySlug } from "~/services/partners.server";
import { generateMetaTags } from "~/utils/seo";
import { env } from "~/utils/server/env.server";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const baseUrl = loaderData?.ENV?.DOMAIN ?? "http://localhost:5173";
  const slug = loaderData?.partner.publicSlug;
  const partnerDisplayName = loaderData?.partner.name ?? (slug ? `@${slug}` : "Partner");
  const partnerUrl = slug ? `${baseUrl}/partners/${slug}` : `${baseUrl}/partners`;

  return generateMetaTags({
    title: `${partnerDisplayName} Fleet | Tripdly`,
    description: `Browse ${partnerDisplayName}'s verified fleet on Tripdly.`,
    url: partnerUrl,
    canonical: partnerUrl,
    image: `${baseUrl}/og-image.jpg`,
  });
};

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Partner slug is required", { status: 404 });
  }

  const partner = await getPublicPartnerBySlug(slug);
  if (!partner) {
    throw new Response("Partner not found", { status: 404 });
  }

  return {
    partner,
    ENV: {
      DOMAIN: env.DOMAIN,
    },
  };
}

export default function PartnerPublicFleetPage() {
  const { partner } = useLoaderData<typeof loader>();
  const partnerDisplayName = partner.name ?? `@${partner.publicSlug}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Partner Fleet
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{partnerDisplayName}</h1>
        <p className="text-gray-600">
          {partner.carsCount} verified {partner.carsCount === 1 ? "vehicle" : "vehicles"}
          {partner.city ? ` in ${partner.city}` : ""}.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 space-y-3">
        <p className="text-gray-700">
          This partner page is now live and publicly accessible. In PR3, we will replace this shell
          with the full homepage-style vehicle browsing experience scoped to this partner.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
          >
            Back to Home
          </Link>
          <Link
            to="/search"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Browse all vehicles
          </Link>
        </div>
      </div>
    </div>
  );
}
