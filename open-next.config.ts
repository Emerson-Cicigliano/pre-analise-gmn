import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// O app não usa páginas estáticas com revalidação, então não precisa de cache incremental (R2).
export default defineCloudflareConfig({});
