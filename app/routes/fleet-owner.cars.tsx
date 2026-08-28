import { type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { getFleetCars } from "~/api/fleet/cars/cars.server";
import { Button } from "~/components/ui/button";
import { FleetCarsList } from "~/fleet/cars/fleet-cars-list";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars";

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Cars | Tripdly",
    description: "View the cars in your Tripdly fleet.",
    path: "/fleet-owner/cars",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: Route.LoaderArgs) {
  const { data: cars } = await getFleetCars({ request });
  return { cars };
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function FleetOwnerCarsRoute({ loaderData }: Route.ComponentProps) {
  return <FleetCarsList cars={loaderData.cars} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load your cars</h2>
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
