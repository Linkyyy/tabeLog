import { readFile } from "node:fs/promises";
const required = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CLOUDFLARE_API_TOKEN",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing configuration: ${missing.join(", ")}`);
  process.exit(1);
}
const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
try {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const result = await response.json();
  if (
    !response.ok ||
    !result.success ||
    !result.result?.every((r) => r.success)
  ) {
    console.error(
      `D1 initialization failed (HTTP ${response.status}). Check account, database ID and token permissions.`,
    );
    process.exit(1);
  }
  console.log("D1 schema initialized. Existing entries were preserved.");
} catch (error) {
  console.error("Cannot reach Cloudflare D1:", error.name);
  process.exit(1);
}
