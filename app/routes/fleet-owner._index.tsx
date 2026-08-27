import { useOutletContext } from "react-router";

import type { FleetOwnerOutletContext } from "./fleet-owner";

export default function FleetOwnerIndex() {
  const user = useOutletContext<FleetOwnerOutletContext>();

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-6 py-16">
      <p className="text-[11px] font-medium tracking-[0.18em] text-[#B8922A] uppercase">
        Fleet Manager
      </p>
      <h1 className="mt-3 wrap-break-word text-4xl font-light text-balance">
        Welcome, {user.name ?? "Fleet Owner"}
      </h1>
      <p className="mt-3 break-all text-sm text-neutral-500">{user.email}</p>
    </div>
  );
}
