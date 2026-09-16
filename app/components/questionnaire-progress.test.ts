import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FLEET_CAR_ONBOARDING_STAGES } from "~/fleet/cars/fleet-car";
import { QuestionnaireProgress } from "./questionnaire-progress";

const carStages = FLEET_CAR_ONBOARDING_STAGES.map((stage, index) => ({
  ...stage,
  complete: index < 1,
}));

describe("QuestionnaireProgress", () => {
  it("renders an ordered list with aria-current on the active car onboarding stage", () => {
    const markup = renderToStaticMarkup(
      createElement(QuestionnaireProgress, {
        ariaLabel: "Car onboarding progress",
        currentStage: "documents",
        stages: carStages,
      }),
    );

    expect(markup).toContain("<ol");
    expect(markup).toContain('aria-label="Car onboarding progress"');
    expect(markup.match(/<li/g)).toHaveLength(5);
    expect(markup).toContain("Vehicle");
    expect(markup).toContain("Documents");
    expect(markup).toContain("Photos");
    expect(markup).toContain("Pricing");
    expect(markup).toContain("Submit");
    expect(markup).toContain("Vehicle<span");
    expect(markup).toContain(", completed");
    expect(markup).toContain(", current");
    expect(markup).toContain(", upcoming");
    expect(markup).toContain('aria-current="step"');
    expect(markup.indexOf("Documents")).toBeLessThan(markup.indexOf("Photos"));
  });

  it("does not mark completed or upcoming stages as the current step", () => {
    const markup = renderToStaticMarkup(
      createElement(QuestionnaireProgress, {
        ariaLabel: "Car onboarding progress",
        currentStage: "documents",
        stages: carStages,
      }),
    );

    expect((markup.match(/aria-current="step"/g) ?? []).length).toBe(1);
    const currentItem = markup.slice(markup.indexOf("<li"), markup.indexOf("</ol>"));
    const documentsItem = currentItem.split("<li").find((item) => item.includes("Documents"));
    expect(documentsItem).toContain('aria-current="step"');
    const vehicleItem = currentItem.split("<li").find((item) => item.includes("Vehicle"));
    expect(vehicleItem).not.toContain("aria-current");
  });
});
