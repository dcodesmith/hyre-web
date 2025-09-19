import { Car, CarApprovalStatus, FleetOwnerStatus, User } from "@prisma/client";
import { MoreHorizontal } from "lucide-react";
import { Row } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "../ui/button";

interface AdminCarRowActionsProps<TData> {
  readonly row: Row<TData>;
  readonly onUpdateStatus: (id: string, status: CarApprovalStatus) => void;
}

interface AdminFleetOwnerRowActionsProps<TData> {
  readonly row: Row<TData>;
  readonly onUpdateStatus: (id: string, status: FleetOwnerStatus) => void;
}

export function AdminCarRowActions<TData>({ row, onUpdateStatus }: AdminCarRowActionsProps<Car>) {
  const car = row.original;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {car.approvalStatus !== "APPROVED" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(car.id, "APPROVED")}>
            Approve
          </DropdownMenuItem>
        )}
        {car.approvalStatus !== "REJECTED" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(car.id, "REJECTED")}>
            Reject
          </DropdownMenuItem>
        )}
        {car.approvalStatus !== "PENDING" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(car.id, "PENDING")}>
            Mark as Pending
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminFleetOwnerRowActions<TData>({
  row,
  onUpdateStatus,
}: AdminFleetOwnerRowActionsProps<User>) {
  const owner = row.original;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {owner.fleetOwnerStatus !== "APPROVED" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(owner.id, "APPROVED")}>
            Approve
          </DropdownMenuItem>
        )}
        {owner.fleetOwnerStatus !== "ON_HOLD" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(owner.id, "ON_HOLD")}>
            Put on Hold
          </DropdownMenuItem>
        )}
        {owner.fleetOwnerStatus !== "ARCHIVED" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(owner.id, "ARCHIVED")}>
            Archive
          </DropdownMenuItem>
        )}
        {owner.fleetOwnerStatus !== "PROCESSING" && (
          <DropdownMenuItem onClick={() => onUpdateStatus(owner.id, "PROCESSING")}>
            Mark as Processing
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
