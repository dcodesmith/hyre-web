import { DiscountType } from "@prisma/client";
import { CalendarIcon, Percent, PlusCircle, Tag, Trash2 } from "lucide-react";
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
import { formatCurrency } from "~/lib/utils";
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
      select: { id: true, make: true, model: true, year: true },
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
    const name = formData.get("name") as string | null;
    const discountType = formData.get("discountType") as string;
    const discountValue = Number(formData.get("discountValue"));
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const carId = formData.get("carId") as string | null;

    if (!discountType || !discountValue || !startDate || !endDate) {
      return data({ success: false, error: "All fields are required" }, { status: 400 });
    }

    if (!["PERCENTAGE", "FIXED_AMOUNT"].includes(discountType)) {
      return data({ success: false, error: "Invalid discount type" }, { status: 400 });
    }

    try {
      await createPromotion({
        ownerId: user.id,
        carId: carId === "all" ? null : carId,
        name: name || undefined,
        discountType: discountType as DiscountType,
        discountValue,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return data({ success: true });
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

type ActionResponse = { success: boolean; error?: string | null } | undefined;

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
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast({ title: "Error", description: fetcher.data.error, variant: "destructive" });
    }
  }, [fetcher.state, fetcher.data, toast]);

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Create discounts for individual cars or your entire fleet.
          </p>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button className="sm:w-auto w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Promotion
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[400px] w-full px-8 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Promotion</SheetTitle>
              <SheetDescription>Set up a discount for your fleet or a specific car.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <CreatePromotionForm cars={cars} isSubmitting={fetcher.state !== "idle"} csrfToken={csrfToken} />
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
        <div className="space-y-3">
          {promotions.map((promo) => {
            const status = getPromotionStatus(promo);
            const config = statusConfig[status];

            return (
              <div
                key={promo.id}
                className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">
                      {promo.name || "Unnamed Promotion"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${config.className} rounded border-none ring-1 ring-inset text-xs`}
                    >
                      {config.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      {promo.discountType === "PERCENTAGE"
                        ? `${promo.discountValue}% off`
                        : `${formatCurrency(promo.discountValue)} off`}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {new Date(promo.startDate).toLocaleDateString()} –{" "}
                      {new Date(promo.endDate).toLocaleDateString()}
                    </span>
                    <span>
                      {promo.car
                        ? `${promo.car.make} ${promo.car.model} ${promo.car.year}`
                        : "All cars"}
                    </span>
                  </div>
                </div>

                {promo.isActive && (
                  <fetcher.Form method="post">
                    <input type="hidden" name="csrf" value={csrfToken} />
                    <input type="hidden" name="intent" value="deactivate" />
                    <input type="hidden" name="promotionId" value={promo.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </fetcher.Form>
                )}
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
  cars: { id: string; make: string; model: string; year: number }[];
  isSubmitting: boolean;
  csrfToken: string;
}) {
  const fetcher = useFetcher({ key: "promotion" });

  return (
    <fetcher.Form method="post" className="space-y-4">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="intent" value="create" />

      <div className="space-y-2">
        <Label htmlFor="name">Promotion Name (optional)</Label>
        <Input id="name" name="name" placeholder="e.g. Easter Special" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="carId">Apply To</Label>
        <Select name="carId" defaultValue="all">
          <SelectTrigger>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="discountType">Discount Type</Label>
        <Select name="discountType" defaultValue="PERCENTAGE">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
            <SelectItem value="FIXED_AMOUNT">Fixed Amount (₦)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discountValue">Discount Value</Label>
        <Input
          id="discountValue"
          name="discountValue"
          type="number"
          min="1"
          step="any"
          required
          placeholder="e.g. 20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Promotion"}
      </Button>
    </fetcher.Form>
  );
}
