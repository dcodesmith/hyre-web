import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ChevronLeftIcon, ChevronRightIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import type {
  AdminStaffListItem,
  AdminStaffListResponse,
  AdminStaffStatus,
} from "~/api/admin/staff/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type StaffActionData, staffFormSchema } from "./staff-form-schema";
import { type StaffQuery, serializeStaffQuery } from "./staff-url";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Africa/Lagos",
});

const filters: readonly { label: string; value?: AdminStaffStatus }[] = [
  { label: "All" },
  { label: "Active", value: "active" },
  { label: "Revoked", value: "revoked" },
];

function staffHref(query: StaffQuery) {
  const search = serializeStaffQuery(query).toString();
  return search ? `/admin/staff?${search}` : "/admin/staff";
}

function StaffActionFeedback({ data }: { readonly data?: StaffActionData }) {
  if (!data?.error && !data?.success) {
    return null;
  }

  return (
    <p
      className={`max-w-56 text-right text-xs ${data.error ? "text-destructive" : "text-muted-foreground"}`}
      role={data.error ? "alert" : "status"}
    >
      {data.error ?? data.success}
    </p>
  );
}

function StaffActionButton({ staff }: { readonly staff: AdminStaffListItem }) {
  const fetcher = useFetcher<StaffActionData>();
  const intent = staff.status === "active" ? "revoke" : "reinstate";
  const pending = fetcher.state !== "idle";
  const formId = `${intent}-staff-${staff.id}`;
  const label = `${intent === "revoke" ? "Revoke" : "Reinstate"} ${staff.name ?? staff.email}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <fetcher.Form id={formId} method="post">
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="staffId" value={staff.id} />
      </fetcher.Form>
      {intent === "revoke" ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              aria-label={label}
            >
              {pending ? "Saving…" : "Revoke"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke staff access?</AlertDialogTitle>
              <AlertDialogDescription>
                {staff.name ?? staff.email} will immediately lose access to staff tools. You can
                reinstate access later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" form={formId} variant="destructive">
                Revoke access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          type="submit"
          form={formId}
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={label}
        >
          {pending ? "Saving…" : "Reinstate"}
        </Button>
      )}
      <StaffActionFeedback data={fetcher.data} />
    </div>
  );
}

function AddStaffDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<StaffActionData>();
  const [form, fields] = useForm({
    id: "add-staff-form",
    lastResult: fetcher.data?.submission,
    constraint: getZodConstraint(staffFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: staffFormSchema });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Staff sign in with an email code. This does not send an invite.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" aria-label="Add staff member" {...getFormProps(form)}>
          <input type="hidden" name="intent" value="create" />
          <div className="flex flex-col gap-5">
            <Field data-invalid={Boolean(fields.name.errors)}>
              <FieldLabel htmlFor={fields.name.id}>Full Name</FieldLabel>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                autoComplete="name"
                placeholder="John Doe"
              />
              <FieldError id={fields.name.errorId}>{fields.name.errors?.join(", ")}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fields.email.errors)}>
              <FieldLabel htmlFor={fields.email.id}>Email</FieldLabel>
              <Input
                {...getInputProps(fields.email, { type: "email" })}
                autoComplete="email"
                placeholder="email@example.com"
              />
              <FieldError id={fields.email.errorId}>{fields.email.errors?.join(", ")}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fields.phoneNumber.errors)}>
              <FieldLabel htmlFor={fields.phoneNumber.id}>Phone Number</FieldLabel>
              <Input
                {...getInputProps(fields.phoneNumber, { type: "tel" })}
                autoComplete="tel"
                placeholder="+1234567890"
              />
              <FieldError id={fields.phoneNumber.errorId}>
                {fields.phoneNumber.errors?.join(", ")}
              </FieldError>
            </Field>
            {fetcher.data?.error || fetcher.data?.success ? (
              <Alert
                variant={fetcher.data.error ? "destructive" : "default"}
                role={fetcher.data.error ? "alert" : "status"}
              >
                <AlertTitle>{fetcher.data.error ? "Staff not added" : "Staff added"}</AlertTitle>
                <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={fetcher.state !== "idle"}>
                {fetcher.state === "idle" ? "Add Staff" : "Adding…"}
              </Button>
            </DialogFooter>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function Pagination({
  meta,
  query,
}: {
  readonly meta: AdminStaffListResponse["meta"];
  readonly query: StaffQuery;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Staff pagination"
      className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end"
    >
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Page {meta.page} of {meta.totalPages} · {meta.total} staff
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button asChild={meta.page > 1} disabled={meta.page <= 1} size="sm" variant="outline">
          {meta.page > 1 ? (
            <Link to={staffHref({ ...query, page: meta.page - 1 })}>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </span>
          )}
        </Button>
        <Button
          asChild={meta.page < meta.totalPages}
          disabled={meta.page >= meta.totalPages}
          size="sm"
          variant="outline"
        >
          {meta.page < meta.totalPages ? (
            <Link to={staffHref({ ...query, page: meta.page + 1 })}>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}

export function AdminStaffPage({
  staff,
  meta,
  query,
}: {
  readonly staff: readonly AdminStaffListItem[];
  readonly meta: AdminStaffListResponse["meta"];
  readonly query: StaffQuery;
}) {
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  return (
    <section aria-labelledby="staff-heading" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="staff-heading" className="text-2xl font-semibold tracking-tight">
            Staff Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage staff access to approval tools.
          </p>
        </div>
        <Button type="button" onClick={() => setIsAddStaffOpen(true)}>
          <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
          Add Staff
        </Button>
      </div>

      <nav className="flex gap-2" aria-label="Filter staff by status">
        {filters.map((filter) => {
          const active = query.status === filter.value;
          return (
            <Button key={filter.label} asChild size="sm" variant={active ? "default" : "outline"}>
              <Link
                to={staffHref({ ...query, status: filter.value, page: 1 })}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      {staff.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border p-6 text-center">
          <h3 className="font-semibold">No staff found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.status
              ? `There are no ${query.status} staff members.`
              : "Add a staff member to get started."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <caption className="sr-only">Staff members</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name ?? "—"}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phoneNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status === "active" ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell>{dateFormatter.format(new Date(member.createdAt))}</TableCell>
                    <TableCell className="text-right">
                      <StaffActionButton staff={member} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={meta} query={query} />
        </>
      )}

      {isAddStaffOpen ? (
        <AddStaffDialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen} />
      ) : null}
    </section>
  );
}
