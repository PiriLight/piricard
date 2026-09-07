import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
