import { getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  useFetcher,
  useLoaderData,
} from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useToast } from "~/hooks/use-toast";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { MAX_PROMOTION_PERCENTAGE, promotionSchema } from "~/schemas/promotion.schema";
import { prisma } from "~/modules/db/db.server";
import {
  createPromotion,
  deactivatePromotion,
  getOwnerPromotions,
} from "~/services/promotions.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");

  const [promotions, cars] = await Promise.all([
    getOwnerPromotions(user.id),
    prisma.car.findMany({
      where: { ownerId: user.id },
      select: { id: true, make: true, model: true, year: true, registrationNumber: true },
      orderBy: { make: "asc" },
    }),
  ]);

  const serialized = promotions.map((p) => ({
    ...p,
    discountValue: p.discountValue.toNumber(),
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return { promotions: serialized, cars };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const user = await requireUserWithRole(request, "fleetOwner");
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const submission = parseWithZod(formData, { schema: promotionSchema });

    if (submission.status !== "success") {
      return data({ success: false, submission: submission.reply() }, { status: 400 });
    }

    const { name, carId, discountValue, startDate, endDate } = submission.value;

    try {
      await createPromotion({
        ownerId: user.id,
        carId: carId === "all" ? null : carId,
        name: name || undefined,
        discountValue,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return data({ success: true, submission: submission.reply() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create promotion";
      return data({ success: false, error: message }, { status: 400 });
    }
  }

  if (intent === "deactivate") {
    const promotionId = formData.get("promotionId") as string;
    if (!promotionId) {
      return data({ success: false, error: "Promotion ID required" }, { status: 400 });
    }

    try {
      await deactivatePromotion(promotionId, user.id);
      return data({ success: true });
    } catch {
      return data({ success: false, error: "Failed to deactivate promotion" }, { status: 500 });
    }
  }

  return data({ success: false, error: "Invalid intent" }, { status: 400 });
}

function getPromotionStatus(promo: { isActive: boolean; startDate: string; endDate: string }) {
  if (!promo.isActive) return "inactive" as const;
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  if (now < start) return "upcoming" as const;
  if (now > end) return "expired" as const;
  return "active" as const;
}

const statusConfig = {
  active: { label: "Active", className: "bg-green-50 text-green-700 ring-green-600/10" },
  upcoming: { label: "Upcoming", className: "bg-blue-50 text-blue-700 ring-blue-600/10" },
  expired: { label: "Expired", className: "bg-gray-50 text-gray-600 ring-gray-500/10" },
  inactive: { label: "Inactive", className: "bg-red-50 text-red-600 ring-red-500/10" },
} as const;

type ActionResponse = { success: boolean; error?: string | null; submission?: unknown } | undefined;

export default function PromotionsPage() {
  const { promotions, cars } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<ActionResponse>({ key: "promotion" });
  const { toast } = useToast();
  const csrfToken = useAuthenticityToken();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsOpen(false);
      toast({ title: "Success", description: "Promotion saved successfully" });
    }
  }, [fetcher.state, fetcher.data, toast]);

  useEffect(() => {
    if (fetcher.state === "idle" && typeof fetcher.data?.error === "string") {
      toast({ title: "Error", description: fetcher.data.error, variant: "destructive" });
    }
  }, [fetcher.state, fetcher.data, toast]);

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Create discounts for individual cars or your entire fleet.
          </p>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button className="w-full sm:w-auto shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Promotion
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[400px] w-full px-8 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Promotion</SheetTitle>
              <SheetDescription>
                Set up a discount for your fleet or a specific car.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <CreatePromotionForm
                cars={cars}
                isSubmitting={fetcher.state !== "idle"}
                csrfToken={csrfToken}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {promotions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No promotions yet</p>
          <p className="text-sm mt-1">Create your first promotion to attract more bookings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {promotions.map((promo) => {
            const status = getPromotionStatus(promo);
            const config = statusConfig[status];

            return (
              <div key={promo.id} className="relative border rounded-lg p-4">
                {promo.isActive && (
                  <fetcher.Form method="post" className="absolute right-3 top-3">
                    <input type="hidden" name="csrf" value={csrfToken} />
                    <input type="hidden" name="intent" value="deactivate" />
                    <input type="hidden" name="promotionId" value={promo.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </fetcher.Form>
                )}

                <div className="flex items-center gap-2 mb-2 pr-10">
                  <span className="font-medium truncate">{promo.name || "Promotion"}</span>
                  <span className="flex font-semibold items-center gap-1">
                    {promo.discountValue}% off
                  </span>

                  <Badge
                    variant="outline"
                    className={`${config.className} shrink-0 rounded border-none ring-1 ring-inset text-xs`}
                  >
                    {config.label}
                  </Badge>
                </div>

                <div className="flex justify-between flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="text-black">
                    {promo.car
                      ? `${promo.car.make} ${promo.car.model} (${promo.car.registrationNumber})`
                      : "All cars"}
                  </span>

                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="sm:hidden">
                      {format(new Date(promo.startDate), "do MMM yy")} –{" "}
                      {format(new Date(promo.endDate), "do MMM yy")}
                    </span>
                    <span className="hidden sm:inline">
                      {format(new Date(promo.startDate), "do MMM yyyy")} –{" "}
                      {format(new Date(promo.endDate), "do MMM yyyy")}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreatePromotionForm({
  cars,
  isSubmitting,
  csrfToken,
}: {
  readonly cars: readonly { id: string; make: string; model: string; year: number }[];
  readonly isSubmitting: boolean;
  readonly csrfToken: string;
}) {
  const fetcher = useFetcher<ActionResponse>({ key: "promotion" });
  const lastResult = fetcher.data;

  const [form, { name, carId, discountValue, startDate, endDate }] = useForm({
    lastResult: fetcher.state === "idle" && lastResult?.submission ? lastResult.submission : null,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: promotionSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const errorClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="intent" value="create" />

      <div className="space-y-2">
        <Label htmlFor={name.id}>Promotion Name (optional)</Label>
        <Input
          id={name.id}
          name={name.name}
          placeholder="e.g. Easter Special"
          className={name.errors ? errorClasses : ""}
        />
        {name.errors && <p className="text-sm text-destructive">{name.errors.join(" ")}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={carId.id}>Apply To</Label>
        <Select name={carId.name} defaultValue="all">
          <SelectTrigger className={carId.errors ? errorClasses : ""}>
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cars</SelectItem>
            {cars.map((car) => (
              <SelectItem key={car.id} value={car.id}>
                {car.make} {car.model} {car.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {carId.errors && <p className="text-sm text-destructive">{carId.errors.join(" ")}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={discountValue.id}>Discount (%)</Label>
        <Input
          id={discountValue.id}
          name={discountValue.name}
          type="number"
          min="1"
          max={MAX_PROMOTION_PERCENTAGE}
          step="any"
          placeholder="e.g. 10"
          className={discountValue.errors ? errorClasses : ""}
        />
        {discountValue.errors ? (
          <p className="text-sm text-destructive">{discountValue.errors.join(" ")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Maximum {MAX_PROMOTION_PERCENTAGE}%. Applied to all booking types.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={startDate.id}>Start Date</Label>
          <Input
            id={startDate.id}
            name={startDate.name}
            type="date"
            className={startDate.errors ? errorClasses : ""}
          />
          {startDate.errors && (
            <p className="text-sm text-destructive">{startDate.errors.join(" ")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={endDate.id}>End Date</Label>
          <Input
            id={endDate.id}
            name={endDate.name}
            type="date"
            className={endDate.errors ? errorClasses : ""}
          />
          {endDate.errors && <p className="text-sm text-destructive">{endDate.errors.join(" ")}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Promotion"}
      </Button>
    </fetcher.Form>
  );
}
