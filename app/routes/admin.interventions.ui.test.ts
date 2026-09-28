import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const faceEvidence = vi.hoisted(() => ({
  visible: false,
  toggle: undefined as (() => void) | undefined,
}));

function captureEvidenceToggle(props: unknown) {
  if (!props || typeof props !== "object") return;
  const candidate = props as { "aria-controls"?: unknown; onClick?: unknown };
  if (
    typeof candidate["aria-controls"] === "string" &&
    candidate["aria-controls"].endsWith("-evidence") &&
    typeof candidate.onClick === "function"
  ) {
    const onClick = candidate.onClick;
    faceEvidence.toggle = () => {
      Reflect.apply(onClick, undefined, []);
    };
  }
}

vi.mock("react/jsx-runtime", async () => {
  const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
  return {
    ...actual,
    jsx: (type: unknown, props: unknown, key: unknown) => {
      captureEvidenceToggle(props);
      return actual.jsx(type as never, props as never, key as never);
    },
    jsxs: (type: unknown, props: unknown, key: unknown) => {
      captureEvidenceToggle(props);
      return actual.jsxs(type as never, props as never, key as never);
    },
  };
});

vi.mock("react/jsx-dev-runtime", async () => {
  const actual =
    await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
  return {
    ...actual,
    jsxDEV: (
      type: unknown,
      props: unknown,
      key: unknown,
      isStatic: boolean,
      source: unknown,
      self: unknown,
    ) => {
      captureEvidenceToggle(props);
      return actual.jsxDEV(
        type as never,
        props as never,
        key as never,
        isStatic,
        source as never,
        self as never,
      );
    },
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: () => [
      faceEvidence.visible,
      (update: boolean | ((current: boolean) => boolean)) => {
        faceEvidence.visible = typeof update === "function" ? update(faceEvidence.visible) : update;
      },
    ],
  };
});

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
    retryAttempt: 0,
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
    retryAttempt: 1,
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
    retryAttempt: 0,
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
) {
  const loaderData = { items, meta };
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
  beforeEach(() => {
    faceEvidence.visible = false;
    faceEvidence.toggle = undefined;
  });

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

  it("loads face evidence only after view evidence and unmounts it when hidden", () => {
    const hidden = render();

    expect(hidden).toContain("View evidence");
    expect(hidden).toContain('aria-expanded="false"');
    expect(hidden).not.toContain(`/admin/interventions/${faceId}/evidence/`);
    expect(faceEvidence.toggle).toEqual(expect.any(Function));

    faceEvidence.toggle?.();
    const shown = render();

    expect(shown).toContain("Hide evidence");
    expect(shown).toContain('aria-expanded="true"');
    expect(shown).toContain(
      `src="/admin/interventions/${faceId}/evidence/selfie" alt="Submitted chauffeur selfie" loading="lazy" decoding="async"`,
    );
    expect(shown).toContain(
      `src="/admin/interventions/${faceId}/evidence/nin-portrait" alt="Official NIN portrait" loading="lazy" decoding="async"`,
    );

    faceEvidence.toggle?.();
    const hiddenAgain = render();

    expect(hiddenAgain).toContain("View evidence");
    expect(hiddenAgain).not.toContain(`/admin/interventions/${faceId}/evidence/`);
    expect(hiddenAgain).not.toContain("<img");
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
