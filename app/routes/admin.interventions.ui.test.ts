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
import type { Route as DetailRoute } from "./+types/admin.interventions.$interventionId";
import AdminInterventionsRoute from "./admin.interventions";
import AdminInterventionRoute from "./admin.interventions.$interventionId";

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

function renderList(
  meta: Route.ComponentProps["loaderData"]["meta"] = {
    page: 1,
    limit: 20,
    total: items.length,
    totalPages: 1,
  },
  queueItems: VerificationIntervention[] = items,
) {
  const loaderData = { items: queueItems, meta };
  const props: Route.ComponentProps = {
    params: {},
    loaderData,
    actionData: undefined,
    matches: [] as unknown as Route.ComponentProps["matches"],
  };
  return renderToStaticMarkup(createElement(AdminInterventionsRoute, props));
}

function renderDetail(
  intervention: VerificationIntervention,
  actionData?: DetailRoute.ComponentProps["actionData"],
) {
  const props: DetailRoute.ComponentProps = {
    params: { interventionId: intervention.id },
    loaderData: intervention,
    actionData,
    matches: [] as unknown as DetailRoute.ComponentProps["matches"],
  };
  return renderToStaticMarkup(createElement(AdminInterventionRoute, props));
}

describe("admin intervention queue", () => {
  it("links each open review to its own page", () => {
    const markup = renderList();

    expect(markup).toContain(`href="/admin/interventions/${licenceId}"`);
    expect(markup).toContain(`href="/admin/interventions/${faceId}"`);
    expect(markup).toContain("Chauffeur licence review");
    expect(markup).toContain("Chauffeur face review");
    expect(markup).not.toContain("Approve");
    expect(markup).not.toContain("/evidence/");
  });

  it("renders accessible pagination for additional review pages", () => {
    expect(renderList()).not.toContain("Verification intervention pagination");

    const markup = renderList({ page: 2, limit: 20, total: 41, totalPages: 3 });

    expect(markup).toContain('aria-label="Verification intervention pagination"');
    expect(markup).toContain("Page 2 of 3");
    expect(markup).toContain('href="/admin/interventions"');
    expect(markup).toContain('href="/admin/interventions?page=3"');
  });
});

describe("admin intervention review UI", () => {
  it("reveals a chauffeur licence only after the reveal action and requires attestation", () => {
    const hidden = renderDetail(items[0]);
    expect(hidden).toContain("Reveal full licence number");
    expect(hidden).toContain("Ending DE67");
    expect(hidden).toContain("independent authoritative source");
    expect(hidden).not.toContain("ABC12345DE67");

    const revealed = renderDetail(items[0], { licenseNumber: "ABC12345DE67" });
    expect(revealed).toContain("ABC12345DE67");
    expect(revealed.match(/name="authoritativeSourceAttested"/g)).toHaveLength(1);
  });

  it("shows the selfie and NIN portrait side by side", () => {
    const markup = renderDetail(items[1]);

    expect(markup).toContain('class="grid gap-4 sm:grid-cols-2"');
    expect(markup).toContain(
      `src="/admin/interventions/${faceId}/evidence/selfie" alt="Submitted chauffeur selfie" loading="lazy" decoding="async"`,
    );
    expect(markup).toContain(
      `src="/admin/interventions/${faceId}/evidence/nin-portrait" alt="Official NIN portrait" loading="lazy" decoding="async"`,
    );
  });

  it("shows an owner document replacement bound to the intervention", () => {
    const markup = renderDetail(items[2]);

    expect(markup).toContain(`/admin/documents/${documentId}`);
    expect(markup).toContain("Approve document as replacement");
    expect(markup).toContain('value="approve-document"');
    expect(markup).not.toContain('name="documentId"');
    expect(markup).not.toContain('name="interventionId"');
    expect(markup).not.toMatch(/smile|mono|prembly/i);
  });

  it("offers a retake for an owner-driver face and does not show a retry count", () => {
    const markup = renderDetail({
      id: "018f47a2-7b3c-7d4e-8f90-1234567894c5",
      kind: "OWNER_DRIVER_FACE",
      status: "OPEN",
      applicantName: "Grace Hopper",
      licenseLast4: null,
      hasSelfie: true,
      hasNinPortrait: false,
      document: null,
      createdAt,
    });

    expect(markup).toContain("Owner-driver face review");
    expect(markup).toContain("Request retake");
    expect(markup).toContain('value="request-retake"');
    expect(markup).toContain('placeholder="Retake notes"');
    expect(markup).toContain('aria-label="Retake notes"');
    expect(markup).toContain('placeholder="Rejection notes"');
    expect(markup).toContain('aria-label="Rejection notes"');
    expect(markup).not.toMatch(/retry/i);
    expect(markup).not.toContain("Reveal full licence number");
    expect(markup).not.toContain("independent authoritative source");
  });

  it("hides evidence and actions once the review is no longer open", () => {
    const markup = renderDetail({ ...items[1], status: "APPROVED" });

    expect(markup).toContain("APPROVED");
    expect(markup).not.toContain("/evidence/");
    expect(markup).not.toContain("Approve");
    expect(markup).not.toContain("Request retake");
  });
});
