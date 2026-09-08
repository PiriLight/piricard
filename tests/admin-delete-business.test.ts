import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pre-deployment addition — permanent business deletion. This repo's Vitest
 * config runs a plain "node" environment (no jsdom, no live database), so a
 * real end-to-end delete cannot run here — supabase/tests/database/
 * 012_admin_delete_business_rpc.test.sql is the actual DB/RLS/cascade
 * coverage (run with `supabase test db`, blocked in this sandbox by the
 * same missing Docker daemon as every other pgTAP file in this repo — see
 * the phase report). What IS practical and worth pinning down here, in the
 * repo's own established style (source-content contract tests), is that
 * every required safeguard is actually WIRED UP in the app code: the
 * platform-admin-only RPC exists and is called with an identity pair, the
 * confirmation UI cannot be bypassed by construction, and the login
 * back-link is a real, deterministic Next.js `<Link>`.
 */

const ROOT = path.resolve(__dirname, "..");

async function read(relPath: string): Promise<string> {
  return readFile(path.join(ROOT, relPath), "utf8");
}

describe("admin_delete_business RPC migration", () => {
  const MIGRATION = "supabase/migrations/20260908120000_admin_delete_business_rpc.sql";

  it("is gated on security.is_platform_admin() before doing anything else", async () => {
    const sql = await read(MIGRATION);
    expect(sql).toMatch(/if not security\.is_platform_admin\(\) then/);
  });

  it("takes a business_id AND an expected_slug, and re-checks the live row's slug before deleting", async () => {
    const sql = await read(MIGRATION);
    expect(sql).toMatch(/admin_delete_business\(p_business_id uuid, p_expected_slug text\)/);
    expect(sql).toMatch(/select id, slug into v_current from public\.businesses where id = p_business_id/);
    expect(sql).toMatch(/v_current\.slug <> p_expected_slug/);
  });

  it("targets exactly one row by its immutable id — never by slug, name, or a broader predicate", async () => {
    const sql = await read(MIGRATION);
    expect(sql).toMatch(/delete from public\.businesses where id = p_business_id/);
    expect(sql).not.toMatch(/delete from public\.businesses where slug/);
    expect(sql).not.toMatch(/\bLIKE\b/i);
  });

  it("EXECUTE is revoked from public/anon and granted only to authenticated (RLS/grant model unchanged elsewhere)", async () => {
    const sql = await read(MIGRATION);
    expect(sql).toMatch(/revoke all on function public\.admin_delete_business\(uuid, text\) from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.admin_delete_business\(uuid, text\) to authenticated/);
  });

  it("is SECURITY DEFINER with an empty search_path, matching every other admin lifecycle RPC", async () => {
    const sql = await read(MIGRATION);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = ''/);
  });
});

describe("deleteBusinessAction (server action)", () => {
  const ACTIONS = "app/admin/(protected)/businesses/[id]/edit/actions.ts";

  it("re-fetches the current row and checks its slug BEFORE calling the RPC (stale-UI guard)", async () => {
    const source = await read(ACTIONS);
    const fnStart = source.indexOf("export async function deleteBusinessAction");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf("\n}", source.indexOf("admin_delete_business", fnStart)));
    expect(fnBody).toMatch(/\.from\("businesses"\)/);
    expect(fnBody).toMatch(/current\.slug !== expectedSlug/);
    expect(fnBody).toMatch(/\.rpc\("admin_delete_business"/);
    expect(fnBody).toMatch(/p_business_id: businessId/);
    expect(fnBody).toMatch(/p_expected_slug: expectedSlug/);
  });

  it("only attempts Storage cleanup AFTER the database delete has succeeded, and never fails the action on a Storage error", async () => {
    const source = await read(ACTIONS);
    const fnStart = source.indexOf("export async function deleteBusinessAction");
    const fnBody = source.slice(fnStart, source.length);
    const dbDeleteIndex = fnBody.indexOf('.rpc("admin_delete_business"');
    const storageCleanupIndex = fnBody.indexOf("deleteBusinessAssetsAction(businessId)");
    expect(dbDeleteIndex).toBeGreaterThan(-1);
    expect(storageCleanupIndex).toBeGreaterThan(dbDeleteIndex);
    // The Storage result is only ever read for its `failed` list (reported
    // back), never used to change the action's own success/error status.
    expect(fnBody).toMatch(/const \{ failed \} = await deleteBusinessAssetsAction/);
  });
});

describe("deleteBusinessAssetsAction (Storage cleanup)", () => {
  const STORAGE_ACTIONS = "app/admin/(protected)/businesses/storage-actions.ts";

  it("rejects anything that isn't a well-formed UUID before touching Storage at all", async () => {
    const source = await read(STORAGE_ACTIONS);
    expect(source).toMatch(/BUSINESS_ID_PATTERN = \/\^\[0-9a-f\]\{8\}-/);
    expect(source).toMatch(/if \(!BUSINESS_ID_PATTERN\.test\(businessId\)\) \{\s*return \{ removed: \[\], failed: \[\] \};/);
  });

  it("only ever lists/removes objects under businesses/{businessId}/, scoped per asset kind", async () => {
    const source = await read(STORAGE_ACTIONS);
    expect(source).toMatch(/businessAssetsPrefix\(businessId\)/);
    expect(source).toMatch(/ASSET_KINDS/);
  });

  it("re-verifies every candidate path with isBusinessOwnedAssetPath before adding it to the delete batch", async () => {
    const source = await read(STORAGE_ACTIONS);
    expect(source).toMatch(/if \(isBusinessOwnedAssetPath\(path, businessId\)\) candidatePaths\.push\(path\)/);
  });

  it("a Storage error is reported as `failed`, never thrown", async () => {
    const source = await read(STORAGE_ACTIONS);
    const fnStart = source.indexOf("export async function deleteBusinessAssetsAction");
    const fnBody = source.slice(fnStart);
    expect(fnBody).not.toMatch(/throw /);
    expect(fnBody).toMatch(/return \{ removed: \[\], failed: candidatePaths \};/);
  });
});

describe("DeleteBusinessSection (confirmation UX)", () => {
  const COMPONENT = "components/admin/business-editor/DeleteBusinessSection.tsx";

  it("never calls window.confirm — uses a real <dialog>", async () => {
    const source = await read(COMPONENT);
    expect(source).not.toMatch(/window\.confirm/);
    expect(source).toMatch(/<dialog/);
    expect(source).toMatch(/showModal\(\)/);
  });

  it("the destructive button is disabled until the typed text exactly equals the current slug", async () => {
    const source = await read(COMPONENT);
    expect(source).toMatch(/const canDelete = confirmText\.trim\(\) === slug;/);
    expect(source).toMatch(/disabled=\{!canDelete \|\| isPending\}/);
  });

  it("the dialog states the business name, the slug, and that the action is permanent", async () => {
    const source = await read(COMPONENT);
    expect(source).toMatch(/\{name\}/);
    expect(source).toMatch(/\{slug\}/);
    expect(source.toLowerCase()).toMatch(/permanentemente/);
    expect(source.toLowerCase()).toMatch(/não pode ser desfeita/);
  });

  it("is rendered inside a visually separated 'Zona de perigo' danger area", async () => {
    const source = await read(COMPONENT);
    expect(source).toMatch(/admin-danger-zone/);
    expect(source).toMatch(/Zona de perigo/);
  });

  it("is mounted from BusinessEditor using the last-known-persisted slug/name, not unsaved draft state", async () => {
    const editor = await read("components/admin/business-editor/BusinessEditor.tsx");
    expect(editor).toMatch(/<DeleteBusinessSection businessId=\{businessId\} slug=\{configBaseline\.slug\} name=\{contentBaseline\.name\} \/>/);
  });
});

describe("Admin login: deterministic back-to-site link", () => {
  it("links to '/' with a real Next.js <Link>, not router.back()/window.history", async () => {
    const source = await read("app/admin/login/page.tsx");
    expect(source).toMatch(/<Link href="\/" className="admin-back-to-site-link">/);
    expect(source).not.toMatch(/router\.back\(\)/);
    expect(source).not.toMatch(/history\.back\(\)/);
  });

  it("the link renders unconditionally (above every branch: normal / forgot-password / forbidden)", async () => {
    const source = await read("app/admin/login/page.tsx");
    const linkIndex = source.indexOf("admin-back-to-site-link");
    const branchIndex = source.indexOf('state.status === "forbidden"');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeLessThan(branchIndex);
  });
});
