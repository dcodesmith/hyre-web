import { redirect, useRevalidator } from "react-router";
import { AdminCarsList } from "~/admin/cars/admin-cars-list";
import { parseAdminCarsQuery, serializeAdminCarsQuery } from "~/admin/cars/admin-cars-url";
import { toAdminCarListItem } from "~/admin/cars/car-approval";
import { getAdminCars } from "~/api/admin/cars/cars.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.cars";

export const meta = () =>
  buildPageMetadata({
    title: "Car Reviews | Tripdly Admin",
    description: "Review Tripdly fleet vehicles and their submitted assets.",
    path: "/admin/cars",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: Route.LoaderArgs) {
  const query = parseAdminCarsQuery(new URL(request.url).searchParams);
  const { data } = await getAdminCars({ request, ...query });
  if (data.meta.totalPages > 0 && query.page > data.meta.totalPages) {
    const search = serializeAdminCarsQuery({
      ...query,
      page: data.meta.totalPages,
    }).toString();
    throw redirect(`/admin/cars${search ? `?${search}` : ""}`);
  }

  return {
    cars: data.cars.map(toAdminCarListItem),
    meta: data.meta,
    query,
  };
}

export default function AdminCarsRoute({ loaderData }: Route.ComponentProps) {
  return <AdminCarsList cars={loaderData.cars} meta={loaderData.meta} query={loaderData.query} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load car reviews</h2>
      <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
      <Button
        type="button"
        className="mt-5"
        disabled={revalidator.state !== "idle"}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state === "idle" ? "Retry" : "Retrying…"}
      </Button>
    </div>
  );
}
