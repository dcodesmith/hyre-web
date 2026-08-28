import { data, isRouteErrorResponse, Link, useOutletContext, useRouteError } from "react-router";
import {
  type AdminCarActionData,
  adminCarActionSchema,
} from "~/admin/cars/admin-car-action-schema";
import { AdminCarDetail } from "~/admin/cars/admin-car-detail";
import { parseAdminCarsQuery } from "~/admin/cars/admin-cars-url";
import { toAdminCarDetailData } from "~/admin/cars/car-approval";
import {
  approveAdminCar,
  approveAdminCarDocument,
  approveAdminCarImage,
  getAdminCar,
  rejectAdminCarDocument,
  rejectAdminCarImage,
  setAdminCarCover,
} from "~/api/admin/cars/cars.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.cars.$carId";
import type { AdminOutletContext } from "./admin";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData?.car
      ? `${loaderData.car.year} ${loaderData.car.make} ${loaderData.car.model} | Car Review`
      : "Car Review | Tripdly Admin",
    description: "Review a Tripdly fleet vehicle and its submitted assets.",
    path: loaderData?.car ? `/admin/cars/${loaderData.car.id}` : "/admin/cars",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const { data: car } = await getAdminCar({ request, carId: params.carId });
    return {
      car: toAdminCarDetailData(car),
      query: parseAdminCarsQuery(new URL(request.url).searchParams),
    };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
    ) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }
    throw error;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = adminCarActionSchema.safeParse(Object.fromEntries(formData));

  if (!submission.success) {
    return data<AdminCarActionData>(
      { error: submission.error.issues[0]?.message ?? "Invalid review action" },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const action = submission.data;
    switch (action.intent) {
      case "approve-car":
        await approveAdminCar({ request, carId: params.carId });
        break;
      case "set-cover":
        await setAdminCarCover({
          request,
          carId: params.carId,
          imageId: action.assetId,
        });
        break;
      case "approve-image":
        await approveAdminCarImage({
          request,
          carId: params.carId,
          imageId: action.assetId,
        });
        break;
      case "reject-image":
        await rejectAdminCarImage({
          request,
          carId: params.carId,
          imageId: action.assetId,
          notes: action.notes,
        });
        break;
      case "approve-document":
        await approveAdminCarDocument({ request, documentId: action.assetId });
        break;
      case "reject-document":
        await rejectAdminCarDocument({
          request,
          documentId: action.assetId,
          notes: action.notes,
        });
        break;
    }

    return data<AdminCarActionData>({ success: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;
    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Unable to complete this review action. Please try again.";

    return data<AdminCarActionData>({ error: message }, { status, headers: NO_STORE });
  }
}

export default function AdminCarRoute({ loaderData }: Route.ComponentProps) {
  const { role } = useOutletContext<AdminOutletContext>();
  return <AdminCarDetail car={loaderData.car} query={loaderData.query} role={role} />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {notFound ? "Car not found" : "Unable to load this car"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? "This car is not available for review."
          : "Please return to car reviews and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/admin/cars">Back to car reviews</Link>
      </Button>
    </div>
  );
}
