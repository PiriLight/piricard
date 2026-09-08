import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * V1.1 — Gallery Upload + Live Preview Reliability.
 *
 * Root cause of the reported indefinitely-stuck "A enviar…" (see the phase
 * report for the full investigation): `ImageUploadField.handleFileChange`
 * had no try/catch around `await uploadBusinessImageAction(...)`, and a
 * real phone photo — comfortably inside this app's own 5 MB client-side
 * limit — routinely exceeded Next.js's separate, framework-level 1 MB
 * default cap on Server Action request bodies (verified against this
 * exact installed Next.js version's docs, not assumed). That thrown
 * rejection was never caught, so `status` stayed "uploading" forever.
 *
 * This repo's Vitest config runs a plain "node" environment (no jsdom, no
 * real file input/network), so these are source-content contract tests in
 * this repo's established style — see other tests in this file's siblings
 * for the same convention — plus the pure-logic reducer/preview-pipeline
 * tests in admin-module-editor-reducer.test.ts and
 * admin-preview-pipeline.test.ts, which exercise real code paths.
 */

const ROOT = path.resolve(__dirname, "..");

async function read(relPath: string): Promise<string> {
  return readFile(path.join(ROOT, relPath), "utf8");
}

describe("next.config.ts: Server Action body size limit", () => {
  it("raises bodySizeLimit above this app's own 5 MB client-side image limit", async () => {
    const source = await read("next.config.ts");
    expect(source).toMatch(/serverActions:\s*\{\s*bodySizeLimit:\s*"8mb"/);
  });
});

describe("ImageUploadField: upload can never hang forever", () => {
  const FILE = "components/admin/business-editor/ImageUploadField.tsx";

  it("every await in the upload path is inside a try/catch", async () => {
    const source = await read(FILE);
    const fnStart = source.indexOf("async function handleFileChange");
    const tryIndex = source.indexOf("try {", fnStart);
    const catchIndex = source.indexOf("} catch", fnStart);
    expect(tryIndex).toBeGreaterThan(-1);
    expect(catchIndex).toBeGreaterThan(tryIndex);
    const tryBlock = source.slice(tryIndex, catchIndex);
    expect(tryBlock).toMatch(/await normalizeToWebP/);
    expect(tryBlock).toMatch(/await Promise\.race/);
  });

  it("races the upload against a hard timeout, not an unbounded await", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/UPLOAD_TIMEOUT_MS/);
    expect(source).toMatch(/Promise\.race\(\[\s*uploadBusinessImageAction\(businessKey, kind, formData\),\s*uploadTimeout\(UPLOAD_TIMEOUT_MS\),\s*\]\)/);
  });

  it("the catch block always resolves status out of 'uploading' with a human-readable, non-technical message", async () => {
    const source = await read(FILE);
    const catchBody = source.slice(source.indexOf("} catch"), source.indexOf("} finally"));
    expect(catchBody).toMatch(/setStatus\("error"\)/);
    expect(catchBody).toMatch(/Não foi possível enviar a imagem\. Tenta novamente\./);
    expect(catchBody).not.toMatch(/error\.message/); // never surfaces a raw thrown error's own text
    expect(catchBody).not.toMatch(/error\.stack/);
  });

  it("the retained button is re-enabled the moment status leaves 'uploading' — no separate stuck disabled state", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/disabled=\{status === "uploading"\}/);
  });

  it("runs client-side validation (size/type) before ever touching the network", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/import \{ validateImageFile \} from "@\/lib\/admin\/storage"/);
    const fnStart = source.indexOf("async function handleFileChange");
    const validationIndex = source.indexOf("validateImageFile(file)", fnStart);
    const tryIndex = source.indexOf("try {", fnStart);
    expect(validationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(tryIndex); // before any network attempt
  });

  it("a client-validation rejection also exits the uploading state (never leaves onUploadingChange stuck true)", async () => {
    const source = await read(FILE);
    const fnStart = source.indexOf("async function handleFileChange");
    const validationBlock = source.slice(source.indexOf("if (clientValidationError)", fnStart), source.indexOf("try {", fnStart));
    expect(validationBlock).toMatch(/onUploadingChange\?\.\(false\)/);
  });

  it("onUploadingChange fires false in the finally block, guaranteeing exactly one false per upload attempt regardless of outcome", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/\} finally \{\s*onUploadingChange\?\.\(false\);\s*\}/);
  });

  it("a failed replacement never touches the existing already-saved reference — onUploaded is only called after confirmed success", async () => {
    const source = await read(FILE);
    // Exactly one call site, and it's the last statement of the success path.
    const occurrences = source.match(/onUploaded\(/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(source).toMatch(/setStatus\("idle"\);\s*onUploaded\(result\.publicUrl, result\.path\);/);
  });
});

describe("GallerySection: no fake placeholder, valid-image counting, path field demoted", () => {
  const FILE = "components/admin/business-editor/GallerySection.tsx";

  it("no longer shows the obsolete 'no upload yet' copy", async () => {
    const source = await read(FILE);
    expect(source).not.toMatch(/Sem upload nesta fase/);
  });

  it("the item count is the VALID (has-src) count, not the raw row count", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/const validCount = items\.filter\(isValidImage\)\.length;/);
    expect(source).toMatch(/\{validCount\}\/\{GALLERY_MAX_ITEMS\} imagens/);
  });

  it("the manual URL/path field is not the default, primary control — it's behind a secondary disclosure", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/const \[showUrlField, setShowUrlField\] = useState\(false\)/);
    expect(source).toMatch(/Usar URL externa/);
    // The old always-visible label/placeholder pairing is gone.
    expect(source).not.toMatch(/<label htmlFor=\{`gallery-src-\$\{index\}`\}>Caminho\/URL da imagem<\/label>/);
  });

  it("legacy/external URL editing still exists in the data model and UI — never removed, only demoted", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/patch: \{ src: event\.target\.value \|\| undefined \}/);
  });

  it("an item with no src renders the empty-card upload prompt, not a text input pre-filled with a fake path", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/admin-gallery-empty-card/);
    expect(source).toMatch(/Ainda sem imagem/);
  });

  it("shows a live activation badge reusing the same moduleActivation source of truth (no second source of truth)", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/Galeria — \{moduleEnabled \? "Ativa" : "Desativada"\}/);
    expect(source).toMatch(/onToggleModule\(!moduleEnabled\)/);
  });

  it("per-item validation errors render inline on the affected card", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/error=\{itemErrors\?\.\[index\]\}/);
    expect(source).toMatch(/\{error \? <p className="admin-field-error">\{error\}<\/p> : null\}/);
  });
});

describe("BusinessEditor: Save waits for pending gallery uploads, and reuses the real module-toggle action", () => {
  const FILE = "components/admin/business-editor/BusinessEditor.tsx";

  it("the content Save button is disabled while a gallery upload is in flight", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/disabled=\{isSaving \|\| !isContentDirty \|\| isGalleryUploading\}/);
  });

  it("the gallery module shortcut toggle calls the SAME setModuleEnabledAction RPC as the Módulos tab", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/import \{[\s\S]*setModuleEnabledAction[\s\S]*\} from "@\/app\/admin\/\(protected\)\/businesses\/\[id\]\/edit\/actions"/);
    expect(source).toMatch(/setModuleEnabledAction\(businessId, "gallery", enabled\)/);
    expect(source).toMatch(/handleModuleActivationChange\("gallery", enabled\)/);
  });

  it("the module-save error message names which module tab is actually affected", async () => {
    const source = await read(FILE);
    expect(source).toMatch(/function describeModuleSaveError/);
    expect(source).toMatch(/flagged\.push\("Galeria"\)/);
  });
});

describe("Bespoke profile Gallery support (Step 9 — mapping vs. missing renderer)", () => {
  it("OFTRacingProfile now renders BusinessPhotoGallery when gallery content exists", async () => {
    const source = await read("components/OFTRacingProfile.tsx");
    expect(source).toMatch(/import \{ BusinessPhotoGallery \} from "@\/components\/BusinessPhotoGallery"/);
    expect(source).toMatch(/business\.gallery\?\.length \? \(/);
    expect(source).toMatch(/<BusinessPhotoGallery businessName=\{business\.name\} images=\{business\.gallery\} \/>/);
  });

  it("BoiNaBrasaProfile (same latent gap, audited per Step 9's 'other module-capable profiles') now also supports Gallery", async () => {
    const source = await read("components/BoiNaBrasaProfile.tsx");
    expect(source).toMatch(/import \{ BusinessPhotoGallery \} from "@\/components\/BusinessPhotoGallery"/);
    expect(source).toMatch(/business\.gallery\?\.length \? \(/);
  });

  it("BeautyConnection360Profile already supported Gallery before this phase — confirmed unchanged, not a second design", async () => {
    const source = await read("components/BeautyConnection360Profile.tsx");
    expect(source).toMatch(/BusinessPhotoGallery/);
  });

  it("no bespoke profile invents a second gallery component — every one imports the same shared BusinessPhotoGallery", async () => {
    for (const file of ["components/AutoformigalProfile.tsx", "components/OFTRacingProfile.tsx", "components/BoiNaBrasaProfile.tsx", "components/BeautyConnection360Profile.tsx"]) {
      const source = await read(file);
      expect(source).toMatch(/from "@\/components\/BusinessPhotoGallery"/);
    }
  });
});
