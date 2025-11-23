import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Table } from "~/components/Table/Table";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { ReferralAttributionSource, ReferralAttribution, User, Prisma } from "@prisma/client";

type AttributionWithUsers = ReferralAttribution & {
  referee: Pick<User, "id" | "name" | "email" | "createdAt">;
  referrer: Pick<User, "id" | "name" | "email">;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const source = url.searchParams.get("source") || "";
  const parsedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
  const pageSize = 50;

  // Build where clause for filtering
  const where: Prisma.ReferralAttributionWhereInput = {};

  if (search) {
    where.OR = [
      { referralCode: { contains: search, mode: "insensitive" } },
      {
        referee: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
      {
        referrer: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  if (source) {
    where.source = source as ReferralAttributionSource;
  }

  const [attributions, total] = await Promise.all([
    prisma.referralAttribution.findMany({
      where,
      include: {
        referee: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        referrer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.referralAttribution.count({ where }),
  ]);

  // Get stats for filters
  const [totalCount, linkCount, manualCount, importCount] = await Promise.all([
    prisma.referralAttribution.count(),
    prisma.referralAttribution.count({ where: { source: "LINK" } }),
    prisma.referralAttribution.count({ where: { source: "MANUAL" } }),
    prisma.referralAttribution.count({ where: { source: "IMPORT" } }),
  ]);

  return {
    attributions,
    total,
    page,
    pageSize,
    search,
    source,
    stats: {
      total: totalCount,
      bySource: {
        LINK: linkCount,
        MANUAL: manualCount,
        IMPORT: importCount,
      },
    },
  };
}

const columnHelper = createColumnHelper<AttributionWithUsers>();

const sourceColorMap: Record<ReferralAttributionSource, string> = {
  LINK: "text-blue-600 border-blue-600",
  MANUAL: "text-green-600 border-green-600",
  IMPORT: "text-purple-600 border-purple-600",
};

const columns = [
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
  columnHelper.accessor("referralCode", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Code" />,
    cell: (info) => (
      <code className="px-2 py-1 bg-muted rounded text-sm font-mono">{info.getValue()}</code>
    ),
  }),
  columnHelper.accessor("source", {
    header: ({ column }) => <ColumnHeader column={column} title="Source" />,
    cell: (info) => (
      <Badge variant="outline" className={sourceColorMap[info.getValue()]}>
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("ipAddress", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="IP Address" />,
    cell: (info) => (
      <span className="text-sm font-mono text-muted-foreground">
        {info.getValue() || "Unknown"}
      </span>
    ),
  }),
  columnHelper.accessor("createdAt", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Date" />,
    cell: (info) => (
      <div>
        <div className="text-sm">{new Date(info.getValue()).toLocaleDateString()}</div>
        <div className="text-xs text-muted-foreground">
          {new Date(info.getValue()).toLocaleTimeString()}
        </div>
      </div>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: (info) => (
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/referrals/attributions/${info.row.original.id}`}>View Details</Link>
        </Button>
      </div>
    ),
  }),
];

export default function AdminReferralAttributions() {
  const { attributions, total, page, pageSize, search, source, stats } =
    useLoaderData<typeof loader>();
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
            <h1 className="text-2xl font-bold">Referral Attributions</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} attributions • Page {page} of {Math.ceil(total / pageSize)}
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
          <div className="text-sm font-medium text-muted-foreground">Link</div>
          <div className="text-2xl font-bold text-blue-600">{stats.bySource.LINK}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Manual</div>
          <div className="text-2xl font-bold text-green-600">{stats.bySource.MANUAL}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-medium text-muted-foreground">Import</div>
          <div className="text-2xl font-bold text-purple-600">{stats.bySource.IMPORT}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search by code, name, or email..."
              className="pl-8 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => updateSearch("search", e.target.value)}
            />
          </div>
        </div>

        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={source}
          onChange={(e) => updateSearch("source", e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="LINK">Link</option>
          <option value="MANUAL">Manual</option>
          <option value="IMPORT">Import</option>
        </select>

        {(search || source) && (
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
        <Table
          data={attributions}
          columns={columns}
          searchPlaceholder="Search attributions..."
          noResultsMessage="No referral attributions found."
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
