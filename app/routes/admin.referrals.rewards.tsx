import { type LoaderFunctionArgs, type ActionFunctionArgs, data } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link, useFetcher } from "@remix-run/react";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { LazyTable } from "~/components/Table/LazyTable";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { validateCSRF } from "~/utils/csrf-action.server";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ReferralRewardStatus, ReferralReward, User, Booking, Prisma } from "@prisma/client";
import { useAuthenticityToken } from "remix-utils/csrf/react";

type RewardWithRelations = ReferralReward & {
  referrer: Pick<User, "id" | "name" | "email">;
  referee: Pick<User, "id" | "name" | "email">;
  booking: Pick<Booking, "id" | "bookingReference">;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const parsedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
  const pageSize = 50;

  // Build where clause for filtering
  const where: Prisma.ReferralRewardWhereInput = {};

  if (search) {
    where.OR = [
      { booking: { bookingReference: { contains: search, mode: "insensitive" } } },
      {
        referrer: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
      {
        referee: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  if (status) {
    where.status = status as ReferralRewardStatus;
  }

  const [rewards, total] = await Promise.all([
    prisma.referralReward.findMany({
      where,
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        referee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingReference: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.referralReward.count({ where }),
  ]);

  // Get stats for filters
  const [totalCount, pendingCount, releasedCount, reversedCount, totalAmount] = await Promise.all([
    prisma.referralReward.count(),
    prisma.referralReward.count({ where: { status: "PENDING" } }),
    prisma.referralReward.count({ where: { status: "RELEASED" } }),
    prisma.referralReward.count({ where: { status: "REVERSED" } }),
    prisma.referralReward.aggregate({
      where: { status: "RELEASED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    rewards: rewards.map((r) => ({ ...r, amount: Number(r.amount) })),
    total,
    page,
    pageSize,
    search,
    status,
    stats: {
      total: totalCount,
      byStatus: {
        PENDING: pendingCount,
        RELEASED: releasedCount,
        REVERSED: reversedCount,
      },
      totalAmount: Number(totalAmount._sum.amount || 0),
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const rewardId = formData.get("rewardId") as string;
  const reason = formData.get("reason") as string;

  if (!rewardId) {
    return data({ success: false, error: "Reward ID is required" }, { status: 400 });
  }

  try {
    if (intent === "release") {
      await prisma.$transaction(async (tx) => {
        const current = await tx.referralReward.findUnique({
          where: { id: rewardId },
          include: { booking: true },
        });
        if (current?.status !== ReferralRewardStatus.PENDING) {
          throw new Error("Reward not found or not in PENDING state");
        }
        const reward = await tx.referralReward.update({
          where: { id: rewardId },
          data: {
            status: "RELEASED",
            processedAt: new Date(),
            reason: reason || "Manually released by admin",
          },
          include: { booking: true },
        });

        if (!reward) {
          throw new Error("Reward not found or already processed");
        }

        // Update booking status
        await tx.booking.update({
          where: { id: reward.bookingId },
          data: { referralStatus: "REWARDED" },
        });

        // Update referrer stats
        await tx.userReferralStats.upsert({
          where: { userId: reward.referrerUserId },
          create: {
            userId: reward.referrerUserId,
            totalRewardsGranted: reward.amount,
            totalRewardsPending: 0,
          },
          update: {
            totalRewardsGranted: { increment: reward.amount },
            totalRewardsPending: { decrement: reward.amount },
          },
        });
      });

      return { success: true, message: "Reward released successfully" };
    }

    if (intent === "reverse") {
      await prisma.$transaction(async (tx) => {
        // Fetch the existing reward to capture its previous status
        const existingReward = await tx.referralReward.findUnique({
          where: { id: rewardId },
        });

        if (!existingReward) {
          throw new Error("Reward not found");
        }

        const prevStatus = existingReward.status;

        // Update reward status
        await tx.referralReward.update({
          where: { id: rewardId },
          data: {
            status: "REVERSED",
            reason: reason || "Manually reversed by admin",
          },
        });

        // If it was already released, update referrer stats
        if (prevStatus === "RELEASED") {
          await tx.userReferralStats.update({
            where: { userId: existingReward.referrerUserId },
            data: {
              totalRewardsGranted: { decrement: existingReward.amount },
            },
          });
        }

        // Update booking status
        await tx.booking.update({
          where: { id: existingReward.bookingId },
          data: { referralStatus: "REVERSED" },
        });

        // If reward was pending, restore user's discount eligibility
        if (prevStatus === "PENDING") {
          await tx.user.update({
            where: { id: existingReward.refereeUserId },
            data: { referralDiscountUsed: false },
          });
        }
      });

      return { success: true, message: "Reward reversed successfully" };
    }

    return data({ success: false, error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return data(
      {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 },
    );
  }
}

const columnHelper = createColumnHelper<RewardWithRelations>();

const statusColorMap: Record<ReferralRewardStatus, string> = {
  PENDING: "text-yellow-600 border-yellow-600",
  RELEASED: "text-green-600 border-green-600",
  REVERSED: "text-red-600 border-red-600",
};

const columns = [
  columnHelper.accessor("booking.bookingReference", {
    id: "booking",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Booking" />,
    cell: (info) => (
      <Link
        to={`/admin/bookings/${info.row.original.booking.id}`}
        className="text-blue-600 hover:underline font-mono text-sm"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("referrer.name", {
    id: "referrer",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Referrer" />,
    cell: (info) => (
      <div>
        <div className="font-medium">{info.row.original.referrer.name || "Unnamed User"}</div>
        <div className="text-sm text-muted-foreground">{info.row.original.referrer.email}</div>
      </div>
    ),
  }),
  columnHelper.accessor("referee.name", {
    id: "referee",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Referee" />,
    cell: (info) => (
      <div>
        <div className="font-medium">{info.row.original.referee.name || "Unnamed User"}</div>
        <div className="text-sm text-muted-foreground">{info.row.original.referee.email}</div>
      </div>
    ),
  }),
  columnHelper.accessor("amount", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Amount" />,
    cell: (info) => <span className="font-medium">₦{info.getValue().toLocaleString()}</span>,
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: (info) => (
      <Badge variant="outline" className={statusColorMap[info.getValue()]}>
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("releaseCondition", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Release" />,
    cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("createdAt", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Created" />,
    cell: (info) => (
      <div>
        <div className="text-sm">{new Date(info.getValue()).toLocaleDateString()}</div>
        <div className="text-xs text-muted-foreground">
          {new Date(info.getValue()).toLocaleTimeString()}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("processedAt", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Processed" />,
    cell: (info) => (
      <div>
        {info.getValue() ? (
          <>
            <div className="text-sm">{new Date(info.getValue()).toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(info.getValue()).toLocaleTimeString()}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Not processed</span>
        )}
      </div>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: (info) => {
      const reward = info.row.original;
      return <RewardActions reward={reward} />;
    },
  }),
];

function RewardActions({ reward }: { readonly reward: RewardWithRelations }) {
  const fetcher = useFetcher();
  const isPending = fetcher.state !== "idle";
  const csrf = useAuthenticityToken();

  const handleAction = (intent: string, reason?: string) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("rewardId", reward.id);
    formData.set("csrf", csrf);

    if (reason) formData.set("reason", reason);

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <div className="flex gap-2">
      {reward.status === "PENDING" && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleAction("release")}
          >
            <CheckIcon className="h-3 w-3 mr-1" />
            Release
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              const reason = globalThis.window.prompt("Reason for reversal:");
              if (reason) handleAction("reverse", reason);
            }}
          >
            <XMarkIcon className="h-3 w-3 mr-1" />
            Reverse
          </Button>
        </>
      )}

      {reward.status === "RELEASED" && (
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => {
            const reason = globalThis.window.prompt("Reason for reversal:");
            if (reason) handleAction("reverse", reason);
          }}
        >
          <XMarkIcon className="h-3 w-3 mr-1" />
          Reverse
        </Button>
      )}

      {reward.status === "REVERSED" && (
        <span className="text-sm text-muted-foreground">No actions</span>
      )}
    </div>
  );
}

export default function AdminReferralRewards() {
  const { rewards, total, page, pageSize, search, status, stats } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const updateSearch = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete("page"); // Reset to first page
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/referrals">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Overview
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Referral Rewards</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} rewards • Page {page} of {Math.ceil(total / pageSize)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.byStatus.PENDING}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Released</div>
          <div className="text-2xl font-bold text-green-600">{stats.byStatus.RELEASED}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Paid</div>
          <div className="text-2xl font-bold">₦{stats.totalAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search by booking, name, or email..."
              className="pl-8 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => updateSearch("search", e.target.value)}
            />
          </div>
        </div>

        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={status}
          onChange={(e) => updateSearch("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="RELEASED">Released</option>
          <option value="REVERSED">Reversed</option>
        </select>

        {(search || status) && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchParams({});
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <LazyTable
          data={rewards}
          columns={columns}
          searchPlaceholder="Search rewards..."
          noResultsMessage="No referral rewards found."
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
          results
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => updateSearch("page", String(page - 1))}
          >
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total}
            onClick={() => updateSearch("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
