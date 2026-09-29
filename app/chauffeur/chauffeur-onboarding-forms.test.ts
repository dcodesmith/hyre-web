import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
    createElement("a", { ...props, href: to }, children),
  useNavigation: () => ({ state: "idle" }),
}));

import { chauffeurDrivingFormSchema } from "./chauffeur-onboarding-form-schema";
import { ChauffeurDrivingForm } from "./chauffeur-onboarding-forms";

const idempotencyKey = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";

function selfieError(): SubmissionResult<string[]> {
  const body = new FormData();
  body.set("driversLicenseNumber", "ABC12345DE67");
  body.set("idempotencyKey", idempotencyKey);
  const parsed = parseWithZod(body, { schema: chauffeurDrivingFormSchema });
  if (parsed.status !== "error") {
    return { status: "error", error: { selfie: ["Take a clear selfie"] } };
  }

  return {
    status: "error",
    error: parsed.error ?? { selfie: ["Take a clear selfie"] },
  };
}

function render(includeSelfieError: boolean) {
  return renderToStaticMarkup(
    createElement(ChauffeurDrivingForm, {
      idempotencyKey,
      actionData: includeSelfieError
        ? {
            intent: "verify-driving",
            submission: selfieError(),
            idempotencyKey,
            revalidate: false,
          }
        : undefined,
    }),
  );
}

function fileInput(markup: string) {
  return markup.match(/<input[^>]*type="file"[^>]*>/)?.[0] ?? "";
}

function selfieButton(markup: string) {
  return markup.match(/<button[^>]*>[\s\S]*?Take selfie<\/button>/)?.[0] ?? "";
}

describe("chauffeur selfie control", () => {
  it("puts the invalid selfie state on the button and fieldset", () => {
    const markup = render(true);
    const button = selfieButton(markup);
    const input = fileInput(markup);

    expect(markup).toContain('data-invalid="true"');
    expect(button).toContain('aria-invalid="true"');
    expect(button).toMatch(/aria-describedby="[^"]*-description/);
    expect(button).toContain("chauffeur-driving-selfie-error");
    expect(input).not.toContain("hidden");
    expect(input).not.toMatch(/aria-invalid=/);
    expect(input).not.toMatch(/aria-describedby=/);
  });

  it("keeps a valid selfie file input free of the button description", () => {
    const markup = render(false);
    const button = selfieButton(markup);
    const input = fileInput(markup);

    expect(markup).toContain('data-invalid="false"');
    expect(button).toMatch(/aria-describedby="[^"]*-description/);
    expect(button).not.toMatch(/aria-invalid=/);
    expect(input).toContain('type="file"');
    expect(input).not.toContain("hidden");
    expect(input).not.toMatch(/aria-invalid=/);
    expect(input).not.toMatch(/aria-describedby=/);
  });
});
