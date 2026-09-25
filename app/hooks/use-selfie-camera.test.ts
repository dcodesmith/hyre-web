import { describe, expect, it } from "vitest";

import { selfieFrameSize } from "./use-selfie-camera";

describe("selfieFrameSize", () => {
  it("keeps a frame that already fits", () => {
    expect(selfieFrameSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("fits a high-resolution frame inside 1024px", () => {
    expect(selfieFrameSize(4032, 3024)).toEqual({ width: 1024, height: 768 });
  });

  it("fits a tall frame inside 1024px", () => {
    expect(selfieFrameSize(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });
});
