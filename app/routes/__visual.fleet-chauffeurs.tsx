import { useSearchParams } from "react-router";

import type { FleetOwnerChauffeur } from "~/api/chauffeurs/schema";
import { FleetChauffeursPage } from "~/fleet/chauffeurs/fleet-chauffeurs-page";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";

const fixtureChauffeurs = [
  {
    id: "invite-1",
    chauffeurId: "chauffeur-1",
    name: "Bola Adebayo",
    email: "bola@example.com",
    phoneNumber: "+2348011111111",
    status: "APPROVED",
    isActive: true,
    image: null,
    invitedAt: "2026-08-01T12:00:00.000Z",
  },
  {
    id: "invite-2",
    chauffeurId: "chauffeur-2",
    name: "Chioma Okeke",
    email: "chioma@example.com",
    phoneNumber: "+2348022222222",
    status: "APPROVED",
    isActive: false,
    image: null,
    invitedAt: "2026-08-08T12:00:00.000Z",
  },
  {
    id: "invite-3",
    chauffeurId: null,
    name: "Tunde Bakare",
    email: "tunde@example.com",
    phoneNumber: "+2348033333333",
    status: "INVITED",
    isActive: false,
    image: null,
    invitedAt: "2026-08-20T12:00:00.000Z",
  },
] satisfies FleetOwnerChauffeur[];

const complianceRequirements = [
  { type: "LASDRI", label: "LASDRI card", required: false },
  { type: "LASRRA", label: "LASRRA card", required: false },
  { type: "DRIVER_BADGE", label: "Lagos driver badge", required: false },
] as const;

export default function FleetChauffeursFixture() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get("state");
  const isOwnerDriver = state === "owner-driver";
  const chauffeurs = state === "empty" || isOwnerDriver ? [] : fixtureChauffeurs;

  return (
    <FleetChauffeursPage
      chauffeurs={chauffeurs}
      complianceRequirements={complianceRequirements}
      idempotencyKey={IDEMPOTENCY_KEY}
      isOwnerDriver={isOwnerDriver}
      page={1}
      total={chauffeurs.length}
      totalPages={1}
    />
  );
}
