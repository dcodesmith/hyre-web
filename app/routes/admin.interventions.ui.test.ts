import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode; method?: string }) =>
    createElement("form", props, children),
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
    createElement("a", { ...props, href: to }, children),
}));
vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

import type { VerificationIntervention } from "~/api/admin/interventions/schema";
import type { Route } from "./+types/admin.interventions";
import AdminInterventionsRoute from "./admin.interventions";

const createdAt = "2026-09-26T12:00:00.000Z";
const licenceId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";
const faceId = "018f47a2-7b3c-7d4e-8f90-1234567894c2";
const ownerId = "018f47a2-7b3c-7d4e-8f90-1234567894c3";
const documentId = "018f47a2-7b3c-7d4e-8f90-1234567894c4";

const items: VerificationIntervention[] = [
  {
    id: licenceId,
    kind: "CHAUFFEUR_DRIVERS_LICENSE",
    status: "OPEN",
    applicantName: "Ada Lovelace",
    licenseLast4: "DE67",
    hasSelfie: false,
    hasNinPortrait: false,
    document: null,
    createdAt,
  },
  {
    id: faceId,
    kind: "CHAUFFEUR_FACE",
    status: "OPEN",
    applicantName: "Ada Lovelace",
    licenseLast4: null,
    hasSelfie: true,
    hasNinPortrait: true,
    document: null,
    createdAt,
  },
  {
    id: ownerId,
    kind: "OWNER_DRIVER_LICENSE",
    status: "OPEN",
    applicantName: "Grace Hopper",
    licenseLast4: "DE67",
    hasSelfie: false,
    hasNinPortrait: false,
    document: { id: documentId, userId: licenceId, status: "PENDING" },
    createdAt,
  },
];

const queue = {
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
};

const staffMatch = {
  id: "routes/admin" as const,
  params: {},
  pathname: "/admin",
  loaderData: {
    role: "staff" as const,
    user: {
      id: "018f47a2-7b3c-7d4e-8f90-1234567894c9",
      email: "staff@example.com",
      name: "Staff",
      roles: ["staff"],
    },
  },
  handle: undefined,
};

function render(
  actionData?: Route.ComponentProps["actionData"],
  meta: Route.ComponentProps["loaderData"]["meta"] = queue.meta,
  queueItems: VerificationIntervention[] = items,
) {
  const loaderData = { items: queueItems, meta };
  const props: Route.ComponentProps = {
    params: {},
    loaderData,
    actionData,
    matches: [
      {
        id: "root",
        params: {},
        pathname: "/",
        loaderData: undefined,
        handle: undefined,
      },
      staffMatch,
      {
        id: "routes/admin.interventions",
        params: {},
        pathname: "/admin/interventions",
        loaderData,
        handle: undefined,
      },
    ],
  };

  return renderToStaticMarkup(createElement(AdminInterventionsRoute, props));
}

describe("admin intervention review UI", () => {
  it("reveals a chauffeur licence only after the reveal action and requires attestation", () => {
    const hidden = render();
    expect(hidden).toContain("Reveal full licence number");
    expect(hidden).toContain("Ending DE67");
    expect(hidden).toContain("independent authoritative source");
    expect(hidden).not.toContain("ABC12345DE67");

    const revealed = render({ revealedInterventionId: licenceId, licenseNumber: "ABC12345DE67" });
    expect(revealed).toContain("ABC12345DE67");
    expect(revealed.match(/name="authoritativeSourceAttested"/g)).toHaveLength(1);
  });

  it("shows the selfie and NIN portrait side by side", () => {
    const markup = render();

    expect(markup).not.toContain("View evidence");
    expect(markup).toContain('class="grid gap-4 sm:grid-cols-2"');
    expect(markup).toContain(
      `src="/admin/interventions/${faceId}/evidence/selfie" alt="Submitted chauffeur selfie" loading="lazy" decoding="async"`,
    );
    expect(markup).toContain(
      `src="/admin/interventions/${faceId}/evidence/nin-portrait" alt="Official NIN portrait" loading="lazy" decoding="async"`,
    );
  });

  it("shows an owner document replacement bound to the intervention", () => {
    const markup = render();

    expect(markup).toContain(`/admin/documents/${documentId}`);
    expect(markup).toContain("Approve document as replacement");
    expect(markup).toContain(`name="interventionId" value="${ownerId}"`);
    expect(markup).not.toContain('name="documentId"');
    expect(markup).not.toMatch(/smile|mono|prembly/i);
    expect(markup).not.toContain("Take selfie");
  });

  it("offers a retake for an owner-driver face and does not show a retry count", () => {
    const ownerFaceId = "018f47a2-7b3c-7d4e-8f90-1234567894c5";
    const markup = render(undefined, { page: 1, limit: 20, total: 1, totalPages: 1 }, [
      {
        id: ownerFaceId,
        kind: "OWNER_DRIVER_FACE",
        status: "OPEN",
        applicantName: "Grace Hopper",
        licenseLast4: null,
        hasSelfie: true,
        hasNinPortrait: false,
        document: null,
        createdAt,
      },
    ]);

    expect(markup).toContain("Owner-driver face review");
    expect(markup).toContain("Request retake");
    expect(markup).toContain('value="request-retake"');
    expect(markup).toContain('placeholder="Retake notes"');
    expect(markup).toContain('aria-label="Retake notes"');
    expect(markup).toContain('placeholder="Rejection notes"');
    expect(markup).toContain('aria-label="Rejection notes"');
    expect(markup).toContain(`name="interventionId" value="${ownerFaceId}"`);
    expect(markup).not.toMatch(/retry/i);
    expect(markup).not.toContain("Reveal full licence number");
    expect(markup).not.toContain("independent authoritative source");
  });

  it("renders accessible pagination for additional review pages", () => {
    const singlePage = render();
    expect(singlePage).not.toContain("Verification intervention pagination");

    const markup = render(undefined, { page: 2, limit: 20, total: 41, totalPages: 3 });

    expect(markup).toContain('aria-label="Verification intervention pagination"');
    expect(markup).toContain("Page 2 of 3");
    expect(markup).toContain('href="/admin/interventions"');
    expect(markup).toContain('href="/admin/interventions?page=3"');
    expect(markup).toContain("Previous");
    expect(markup).toContain("Next");
  });
});
