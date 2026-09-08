import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // V1.1 — root cause of the indefinitely-stuck "A enviar…" gallery/logo/
    // cover upload state: Next.js Server Actions cap the request body at
    // 1MB by default (verified against node_modules/next/dist/docs/01-app/
    // 02-guides/server-actions.md and .../config/next-config-js/
    // serverActions.md for this exact installed version, not assumed). This
    // app's own client-side validation (lib/admin/storage.ts,
    // MAX_FILE_BYTES) already allows images up to 5 MiB, and
    // uploadBusinessImageAction (app/admin/(protected)/businesses/
    // storage-actions.ts) is a Server Action that receives the whole file as
    // multipart FormData — so a real phone photo comfortably inside the
    // app's own advertised 5 MB limit was silently rejected by this
    // framework-level 1MB ceiling before ever reaching the action body.
    // 8mb leaves real headroom above the 5 MiB file limit plus the
    // multipart boundary/header overhead the docs call out.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    // Phase 4H — Supabase Storage-backed business assets (logo/cover/gallery)
    // are served as full public URLs from the project's own Storage host,
    // scoped to the piricard-assets bucket's public object path only (see
    // supabase/migrations/20260907150000_piricard_assets_storage.sql).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "scneuxxgzlqcsxdzthxb.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/piricard-assets/**",
        search: "",
      },
      // Local `supabase start` stack only — inert in production (nothing
      // public resolves to 127.0.0.1), kept so local admin testing against
      // the local Storage emulator can actually render uploaded images.
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "61321",
        pathname: "/storage/v1/object/public/piricard-assets/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
