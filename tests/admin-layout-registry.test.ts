import { describe, expect, it } from "vitest";
import { AVAILABLE_LAYOUTS, getLayoutOption, isAvailableLayout, LAYOUT_REGISTRY } from "@/lib/admin/layout-registry";

describe("layout registry", () => {
  it("offers exactly one available layout in V1: editorial", () => {
    expect(AVAILABLE_LAYOUTS.map((l) => l.value)).toEqual(["editorial"]);
  });

  it("marks every bespoke one-off layout as unavailable", () => {
    for (const value of ["workshop", "beauty", "restaurant", "racing"] as const) {
      const option = getLayoutOption(value);
      expect(option?.available).toBe(false);
      expect(option?.unavailableReason).toBeTruthy();
    }
  });

  it("marks compact as unavailable (shares the editorial rendering path, reserved for the minimal PiriLight profile)", () => {
    expect(getLayoutOption("compact")?.available).toBe(false);
  });

  it("isAvailableLayout only accepts the available registry entries", () => {
    expect(isAvailableLayout("editorial")).toBe(true);
    expect(isAvailableLayout("restaurant")).toBe(false);
    expect(isAvailableLayout("not-a-real-layout")).toBe(false);
  });

  it("every registry entry has a stable value, label and description", () => {
    for (const option of LAYOUT_REGISTRY) {
      expect(option.value).toBeTruthy();
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
    }
  });
});
