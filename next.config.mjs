import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;

// Durante o `next dev`, dá acesso ao D1 local e às demais configurações do wrangler.jsonc.
initOpenNextCloudflareForDev();
