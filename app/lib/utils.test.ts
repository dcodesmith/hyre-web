import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional class names", () => {
    expect(cn("rounded-md", false && "hidden", { "text-white": true })).toBe(
      "rounded-md text-white",
    );
  });

  it("resolves Tailwind class conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
