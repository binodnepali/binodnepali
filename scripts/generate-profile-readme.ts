import { getProfile } from "../src/server/profile/service.ts";
import { profileToMarkdown } from "../src/server/profile/readmeMarkdown.ts";

const readmePath = new URL("../README.md", import.meta.url);

const siteOrigin = Deno.env.get("SITE_ORIGIN") ?? "https://binodnepali.me";
const markdown = profileToMarkdown(getProfile(), { siteOrigin });

await Deno.writeTextFile(readmePath, markdown);
console.log(`Wrote ${readmePath.pathname}`);
