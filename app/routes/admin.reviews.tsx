import { parseWithZod } from "@conform-to/zod/v4";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import { Link, useLoaderData, useSubmit, useSearchParams } from "@remix-run/react";
import { createColumnHelper, type ColumnDef, type Row } from "@tanstack/react-table";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Eye, EyeOff, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Table } from "~/components/Table/Table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import {
  getAllReviewsForAdmin,
  hideReview,
  showReview,
  softDeleteReview,
} from "~/services/reviews.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { ReviewModerationSchema } from "~/schemas/admin.schema";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
  const isVisible = url.searchParams.get("isVisible");
  const rating = url.searchParams.get("rating");
  const search = url.searchParams.get("search") || undefined;
  const moderated = url.searchParams.get("moderated");

  const filters = {
    isVisible: isVisible === null ? undefined : isVisible === "true",
    rating: rating ? Number.parseInt(rating, 10) : undefined,
    search,
    moderated: moderated === null ? undefined : moderated === "true",
  };

  const result = await getAllReviewsForAdmin(filters, page, limit);

  return { reviews: result };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const { user } = await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: ReviewModerationSchema });

  if (submission.status !== "success") {
    return data(
      {
        success: false,
        error: "Invalid form data",
        submission: submission.reply(),
      },
      { status: 400 },
    );
  }

  const { reviewId, intent, moderationNotes } = submission.value;

  try {
    switch (intent) {
      case "hide":
        await hideReview(reviewId, user.id, moderationNotes);
        break;
      case "show":
        await showReview(reviewId, user.id, moderationNotes);
        break;
      case "delete":
        await softDeleteReview(reviewId, user.id, moderationNotes);
        break;
    }

    return { success: true };
  } catch (error) {
    return data(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to moderate review",
      },
      { status: 500 },
    );
  }
}

// Row type for the table - matches serialized loader data
type ReviewRow = {
  id: string;
  bookingId: string;
  userId: string;
  overallRating: number;
  carRating: number;
  chauffeurRating: number | null;
  serviceRating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderationNotes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  booking: {
    car: {
      id: string;
      make: string;
      model: string;
      ownerId: string;
    };
    chauffeur: {
      id: string;
      name: string | null;
    } | null;
  };
  moderator: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

const columnHelper = createColumnHelper<ReviewRow>();

const columns = [
  columnHelper.display({
    id: "customer",
    enableColumnFilter: false,
    header: "Customer",
    cell: (info) => {
      const review = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{review.user.name || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">{review.user.email}</span>
        </div>
      );
    },
  }),
  columnHelper.display({
    id: "car",
    enableColumnFilter: false,
    header: "Car",
    cell: (info) => {
      const car = info.row.original.booking.car;
      return (
        <Link
          to={`/admin/owners/${car.ownerId}/cars/${car.id}`}
          className="text-blue-600 hover:underline"
        >
          {car.make} {car.model}
        </Link>
      );
    },
  }),
  columnHelper.accessor("overallRating", {
    header: ({ column }) => <ColumnHeader column={column} title="Overall" />,
    cell: (info) => {
      const rating = info.getValue();
      return (
        <div className="flex items-center gap-1">
          <span className="font-medium">{rating}</span>
          <span className="text-yellow-500">★</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("carRating", {
    header: ({ column }) => <ColumnHeader column={column} title="Car" />,
    cell: (info) => {
      const rating = info.getValue();
      return (
        <div className="flex items-center gap-1">
          <span className="font-medium">{rating}</span>
          <span className="text-yellow-500">★</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("chauffeurRating", {
    header: ({ column }) => <ColumnHeader column={column} title="Chauffeur" />,
    cell: (info) => {
      const rating = info.getValue();
      if (rating === null) {
        return <span className="text-muted-foreground text-sm">N/A</span>;
      }
      return (
        <div className="flex items-center gap-1">
          <span className="font-medium">{rating}</span>
          <span className="text-yellow-500">★</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("serviceRating", {
    header: ({ column }) => <ColumnHeader column={column} title="Service" />,
    cell: (info) => {
      const rating = info.getValue();
      return (
        <div className="flex items-center gap-1">
          <span className="font-medium">{rating}</span>
          <span className="text-yellow-500">★</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("comment", {
    enableColumnFilter: false,
    header: "Comment",
    cell: (info) => {
      const comment = info.getValue();
      if (!comment) {
        return <span className="text-muted-foreground text-sm">No comment</span>;
      }
      return (
        <div className="max-w-xs truncate text-sm" title={comment}>
          {comment}
        </div>
      );
    },
  }),
  columnHelper.accessor("isVisible", {
    header: "Status",
    cell: (info) => {
      const isVisible = info.getValue();
      return (
        <Badge variant={isVisible ? "default" : "secondary"}>
          {isVisible ? "Visible" : "Hidden"}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => <ColumnHeader column={column} title="Created" />,
    cell: (info) => {
      const date = new Date(info.getValue());
      return <span className="text-sm">{date.toLocaleDateString()}</span>;
    },
    enableColumnFilter: false,
  }),
  columnHelper.accessor("id", {
    enableColumnFilter: false,
    header: "Actions",
    cell: ({ row }) => <ReviewActionsCell row={row} />,
  }),
];

function ReviewActionsCell({ row }: { readonly row: Row<ReviewRow> }) {
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();
  const review = row.original;

  const handleModeration = (intent: "hide" | "show" | "delete") => {
    if (intent === "delete") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this review? This action cannot be undone.",
      );
      if (!confirmed) return;
    }

    const formData = new FormData();
    formData.append("reviewId", review.id);
    formData.append("intent", intent);
    formData.append("csrf", csrfToken);
    submit(formData, { method: "POST" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {review.isVisible ? (
          <DropdownMenuItem onClick={() => handleModeration("hide")}>
            <EyeOff className="mr-2 h-4 w-4" />
            Hide Review
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => handleModeration("show")}>
            <Eye className="mr-2 h-4 w-4" />
            Show Review
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => handleModeration("delete")}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Review
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ServerPaginationProps = {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

function ServerPagination({ pagination }: ServerPaginationProps) {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(newPage));
    submit(newParams, { method: "GET" });
  };

  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-sm text-muted-foreground">
        Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
        reviews
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={!pagination.hasPreviousPage}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <div className="text-sm">
          Page {pagination.page} of {pagination.totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={!pagination.hasNextPage}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ReviewFilters() {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "" || value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.delete("page"); // Reset to page 1 when filters change
    submit(newParams, { method: "GET" });
  };

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          placeholder="Search by comment or name..."
          defaultValue={searchParams.get("search") || ""}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleFilterChange("search", event.currentTarget.value);
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select
          value={searchParams.get("isVisible") || "all"}
          onValueChange={(value) => handleFilterChange("isVisible", value)}
        >
          <SelectTrigger id="visibility">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Visible</SelectItem>
            <SelectItem value="false">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rating">Rating</Label>
        <Select
          value={searchParams.get("rating") || "all"}
          onValueChange={(value) => handleFilterChange("rating", value)}
        >
          <SelectTrigger id="rating">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="moderated">Moderated</Label>
        <Select
          value={searchParams.get("moderated") || "all"}
          onValueChange={(value) => handleFilterChange("moderated", value)}
        >
          <SelectTrigger id="moderated">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Moderated</SelectItem>
            <SelectItem value="false">Not Moderated</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function AdminReviewsPage() {
  const { reviews } = useLoaderData<typeof loader>();

  // Cast to ReviewRow[] since Remix serializes dates to strings at runtime
  const reviewData = reviews.reviews as unknown as ReviewRow[];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Review Moderation</h1>
        <p className="text-muted-foreground mt-2">
          Manage and moderate customer reviews. Hide inappropriate content, restore hidden reviews,
          or delete reviews entirely.
        </p>
      </div>

      <ReviewFilters />

      {reviews.reviews.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No reviews found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table
            hideColumnViewOptions
            columns={columns as ColumnDef<ReviewRow>[]}
            data={reviewData}
          />
        </div>
      )}

      <ServerPagination pagination={reviews.pagination} />
    </div>
  );
}
