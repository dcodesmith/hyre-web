import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { BookingWithRelations } from "~/types";

interface ChauffeurSectionProps {
  readonly booking: BookingWithRelations;
}

export function ChauffeurSection({ booking }: ChauffeurSectionProps) {
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const csrfToken = useAuthenticityToken();

  if (booking.status !== "CONFIRMED") {
    return booking.chauffeur ? (
      <p className="font-medium">{booking.chauffeur.name}</p>
    ) : (
      <p className="font-medium text-gray-500">Not assigned</p>
    );
  }

  if (booking.chauffeur && !showForm) {
    return (
      <div>
        <p className="font-medium">{booking.chauffeur.name}</p>
        <Button
          type="button"
          variant="link"
          className="underline pl-0"
          onClick={() => setShowForm(true)}
        >
          Change Chauffeur
        </Button>
      </div>
    );
  }

  return (
    <fetcher.Form method="patch">
      <input type="hidden" name="csrf" value={csrfToken} />
      {fetcher.data?.error && <div className="text-sm text-red-600 mb-2">{fetcher.data.error}</div>}
      <Select name="chauffeurId">
        <SelectTrigger>
          <SelectValue placeholder={booking.chauffeur?.name || "Select a chauffeur"} />
        </SelectTrigger>
        <SelectContent>
          {booking.car.owner.chauffeurs.map((chauffeur) => (
            <SelectItem key={chauffeur.id} value={chauffeur.id}>
              {chauffeur.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center mt-2 gap-2">
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Assign Chauffeur" : "Assigning..."}
        </Button>
        {booking.chauffeurId && (
          <Button
            type="button"
            variant="link"
            className="underline"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </fetcher.Form>
  );
}
