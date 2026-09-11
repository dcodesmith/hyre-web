import { describe, expect, it } from "vitest";

import {
  chauffeurPagePath,
  parseChauffeursPage,
  toApiChauffeurSearchParams,
} from "./chauffeurs-url";

describe("fleet chauffeurs URL state", () => {
  it("parses a positive page and defaults invalid values to 1", () => {
    expect(parseChauffeursPage(new URLSearchParams("page=3"))).toBe(3);
    expect(parseChauffeursPage(new URLSearchParams())).toBe(1);
    expect(parseChauffeursPage(new URLSearchParams("page=-1"))).toBe(1);
    expect(parseChauffeursPage(new URLSearchParams("page=abc"))).toBe(1);
  });

  it("omits page 1 from the browser path and always sends the API page size", () => {
    expect(chauffeurPagePath(1)).toBe("/fleet-owner/chauffeurs");
    expect(chauffeurPagePath(2)).toBe("/fleet-owner/chauffeurs?page=2");
    expect(toApiChauffeurSearchParams(2).toString()).toBe("page=2&limit=20");
  });
});
