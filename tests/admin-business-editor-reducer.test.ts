import { describe, expect, it } from "vitest";
import { businessDraftReducer, createInitialDraft, ensureWeekHours, WEEKDAYS } from "@/components/admin/business-editor/reducer";
import { getBusinessBySlug } from "@/lib/businesses";

const sampleBusiness = getBusinessBySlug("autoformigal")!;

describe("ensureWeekHours", () => {
  it("produces exactly one row per weekday, Monday through Sunday", () => {
    const hours = ensureWeekHours(sampleBusiness.hours);
    expect(hours).toHaveLength(7);
    expect(hours.map((h) => h.days[0])).toEqual(WEEKDAYS.map((w) => w.day));
  });

  it("defaults every day to closed when no hours exist yet", () => {
    const hours = ensureWeekHours(undefined);
    expect(hours).toHaveLength(7);
    expect(hours.every((h) => h.periods.length === 0)).toBe(true);
  });

  it("collapses a stored day to at most one period", () => {
    const hours = ensureWeekHours([{ label: "Segunda", days: [1], periods: [{ open: "09:00", close: "13:00" }] }]);
    const monday = hours.find((h) => h.days[0] === 1);
    expect(monday?.periods).toEqual([{ open: "09:00", close: "13:00" }]);
  });
});

describe("businessDraftReducer", () => {
  const draft = createInitialDraft(sampleBusiness);

  it("updates a content field immutably", () => {
    const next = businessDraftReducer(draft, { type: "SET_CONTENT_FIELD", field: "name", value: "Novo Nome" });
    expect(next.name).toBe("Novo Nome");
    expect(draft.name).toBe(sampleBusiness.name); // original untouched
  });

  it("toggles an hours row closed/open", () => {
    const closed = businessDraftReducer(draft, { type: "SET_HOUR_CLOSED", index: 0, closed: true });
    expect(closed.hours?.[0].periods).toEqual([]);

    const reopened = businessDraftReducer(closed, { type: "SET_HOUR_CLOSED", index: 0, closed: false });
    expect(reopened.hours?.[0].periods).toHaveLength(1);
  });

  it("adds, updates, reorders and removes a social link", () => {
    const withLink = businessDraftReducer(draft, { type: "ADD_SOCIAL_LINK" });
    expect(withLink.socialLinks).toHaveLength((draft.socialLinks?.length ?? 0) + 1);

    const lastIndex = (withLink.socialLinks?.length ?? 1) - 1;
    const updated = businessDraftReducer(withLink, {
      type: "UPDATE_SOCIAL_LINK",
      index: lastIndex,
      patch: { url: "https://example.com" },
    });
    expect(updated.socialLinks?.[lastIndex].url).toBe("https://example.com");

    const removed = businessDraftReducer(updated, { type: "REMOVE_SOCIAL_LINK", index: lastIndex });
    expect(removed.socialLinks).toHaveLength(draft.socialLinks?.length ?? 0);
  });

  it("moves a social link up and down without losing entries", () => {
    const twoLinks = businessDraftReducer(businessDraftReducer(draft, { type: "ADD_SOCIAL_LINK" }), { type: "ADD_SOCIAL_LINK" });
    const platformsBefore = twoLinks.socialLinks?.map((l) => l.platform);
    const moved = businessDraftReducer(twoLinks, { type: "MOVE_SOCIAL_LINK", index: 0, direction: "down" });
    expect(moved.socialLinks).toHaveLength(twoLinks.socialLinks?.length ?? 0);
    expect(moved.socialLinks?.map((l) => l.platform).sort()).toEqual([...(platformsBefore ?? [])].sort());
  });
});
