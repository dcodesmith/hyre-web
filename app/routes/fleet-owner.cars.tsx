import { redirect, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { getFleetCars } from "~/api/fleet/cars/cars.server";
import { Button } from "~/components/ui/button";
import { soleOwnerDriverCar } from "~/fleet/cars/fleet-car";
import { FleetCarsList } from "~/fleet/cars/fleet-cars-list";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Cars | Tripdly",
    description: "View the cars in your Tripdly fleet.",
    path: "/fleet-owner/cars",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const isOwnerDriver = context.get(fleetOwnerContext).onboarding.isOwnerDriver === true;
  const { data: cars } = await getFleetCars({ request });
  const car = soleOwnerDriverCar(isOwnerDriver, cars);

  if (car) {
    throw redirect(`/fleet-owner/cars/${car.id}`, { headers: NO_STORE });
  }

  return { cars, isOwnerDriver };
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
  return (
    <FleetCarsList
      allowAdd={!loaderData.isOwnerDriver || loaderData.cars.length === 0}
      cars={loaderData.cars}
    />
  );
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
