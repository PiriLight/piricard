import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the Phase 4C anonymous public Supabase client
 * (lib/supabase/public.ts). The whole point of this module is that it can
 * NEVER inherit a user's session — these assertions pin down the exact
 * mechanism that guarantees that, so a future edit that accidentally wires
 * in cookies or session persistence fails a test instead of silently
 * reintroducing the privilege-leak this file exists to prevent.
 */

const createClientMock = vi.fn((...args: unknown[]) => {
  void args;
  return { __fake: "supabase-js client" };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

// `next/headers` must never even be imported by this module — importing it
// outside a request scope throws in real Next.js. Mocking it here means the
// test would fail loudly (unmocked import) if lib/supabase/public.ts ever
// started depending on it.
vi.mock("next/headers", () => {
  throw new Error("lib/supabase/public.ts must never import next/headers");
});

describe("getPublicSupabaseClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("constructs with the publishable key and no cookie/session persistence", async () => {
    const { getPublicSupabaseClient } = await import("@/lib/supabase/public");
    getPublicSupabaseClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_publishable_test");
    expect(options).toMatchObject({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    // No `cookies` adapter of any kind is passed — this client has no
    // mechanism to read or forward a browser/user session at all.
    expect(options).not.toHaveProperty("cookies");
  });

  it("never receives the secret/service-role key", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_should_never_be_used";
    const { getPublicSupabaseClient } = await import("@/lib/supabase/public");
    getPublicSupabaseClient();

    const [, key] = createClientMock.mock.calls[0]!;
    expect(key).toBe("sb_publishable_test");
    expect(key).not.toContain("secret");
  });

  it("reuses a single module-level instance across calls (safe: carries no per-request state)", async () => {
    const { getPublicSupabaseClient } = await import("@/lib/supabase/public");
    const first = getPublicSupabaseClient();
    const second = getPublicSupabaseClient();

    expect(second).toBe(first);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
