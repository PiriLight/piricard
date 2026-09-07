import { describe, expect, it } from "vitest";
import { buildAssetPath, extractAssetPath, isPiricardAssetPath, PIRICARD_ASSETS_BUCKET, validateImageFile } from "@/lib/admin/storage";

/**
 * Phase 4H — Step 14 regression guard for the pure Storage helpers used by
 * the upload server actions (app/admin/(protected)/businesses/
 * storage-actions.ts). These live outside that "use server" file (every
 * export there must be an async function), which also makes them directly
 * unit-testable with no server/network context.
 */

describe("buildAssetPath", () => {
  it("is business-scoped and collision-safe across repeated calls", () => {
    const first = buildAssetPath("biz-1", "logo", "image/png");
    const second = buildAssetPath("biz-1", "logo", "image/png");

    expect(first).toMatch(/^businesses\/biz-1\/logo\/[0-9a-f-]+\.png$/);
    expect(second).toMatch(/^businesses\/biz-1\/logo\/[0-9a-f-]+\.png$/);
    // Same business, same kind, same mime type — must never collide.
    expect(first).not.toBe(second);
  });

  it("never places an asset at the bucket root — always under businesses/{key}/{kind}/", () => {
    const path = buildAssetPath("biz-1", "cover", "image/webp");
    expect(path.startsWith("businesses/biz-1/cover/")).toBe(true);
  });

  it("scopes different businesses to different, non-colliding prefixes", () => {
    const a = buildAssetPath("biz-a", "gallery", "image/jpeg");
    const b = buildAssetPath("biz-b", "gallery", "image/jpeg");
    expect(a.startsWith("businesses/biz-a/")).toBe(true);
    expect(b.startsWith("businesses/biz-b/")).toBe(true);
  });

  it("derives the extension from MIME type, not the original filename", () => {
    expect(buildAssetPath("biz-1", "logo", "image/jpeg")).toMatch(/\.jpg$/);
    expect(buildAssetPath("biz-1", "logo", "image/png")).toMatch(/\.png$/);
    expect(buildAssetPath("biz-1", "logo", "image/webp")).toMatch(/\.webp$/);
    expect(buildAssetPath("biz-1", "logo", "application/octet-stream")).toMatch(/\.bin$/);
  });
});

describe("validateImageFile", () => {
  it("accepts a valid small JPEG/PNG/WebP/GIF", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validateImageFile({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejects an unsupported MIME type", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1024 })).not.toBeNull();
    expect(validateImageFile({ type: "image/svg+xml", size: 1024 })).not.toBeNull();
    expect(validateImageFile({ type: "text/html", size: 1024 })).not.toBeNull();
  });

  it("rejects an oversized file (over the 5 MB limit)", () => {
    expect(validateImageFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
  });

  it("accepts a file exactly at the 5 MB limit", () => {
    expect(validateImageFile({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateImageFile({ type: "image/png", size: 0 })).not.toBeNull();
  });
});

describe("extractAssetPath / isPiricardAssetPath", () => {
  it("recognizes a bare relative path this app generated", () => {
    const path = "businesses/abc-123/logo/deadbeef-0000-0000-0000-000000000000.webp";
    expect(extractAssetPath(path)).toBe(path);
    expect(isPiricardAssetPath(path)).toBe(true);
  });

  it("extracts the relative path from a full public URL", () => {
    const path = "businesses/abc-123/cover/deadbeef-0000-0000-0000-000000000000.jpg";
    const url = `https://scneuxxgzlqcsxdzthxb.supabase.co/storage/v1/object/public/${PIRICARD_ASSETS_BUCKET}/${path}`;
    expect(extractAssetPath(url)).toBe(path);
    expect(isPiricardAssetPath(url)).toBe(true);
  });

  it("returns null for a legacy static path (never our own bucket)", () => {
    expect(extractAssetPath("/clients/autoformigal/logo/autoformigal-approved.jpg")).toBeNull();
    expect(isPiricardAssetPath("/clients/autoformigal/logo/autoformigal-approved.jpg")).toBe(false);
  });

  it("returns null for an arbitrary external URL a staff member typed in", () => {
    expect(extractAssetPath("https://example.com/some/photo.jpg")).toBeNull();
  });

  it("returns null for undefined/null/empty", () => {
    expect(extractAssetPath(undefined)).toBeNull();
    expect(extractAssetPath(null)).toBeNull();
    expect(extractAssetPath("")).toBeNull();
  });

  it("returns null for a URL from a DIFFERENT bucket (never assume ownership)", () => {
    const url = "https://scneuxxgzlqcsxdzthxb.supabase.co/storage/v1/object/public/some-other-bucket/businesses/abc/logo/x.png";
    expect(extractAssetPath(url)).toBeNull();
  });
});
