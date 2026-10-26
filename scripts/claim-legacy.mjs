// Run only as the administrator with trusted access to the database.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
const userId = process.argv[2];
if (!userId || !/^[a-f0-9-]{36}$/.test(userId)) {
  console.error("Usage: npm run data:claim -- <existing-user-id>");
  process.exit(1);
}
let db;
async function query(sql, params) {
  if (
    process.env.STORAGE_MODE === "local" ||
    !process.env.CLOUDFLARE_D1_DATABASE_ID
  ) {
    const file = path.join(
      process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".data"),
      "diary.sqlite",
    );
    if (!existsSync(file))
      throw new Error(
        "Local database does not exist. Register an account first.",
      );
    db ||= new DatabaseSync(file);
    return db.prepare(sql).all(...params);
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN)
    throw new Error("Cloudflare configuration is missing.");
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await r.json();
  if (!r.ok || !data.success || !data.result?.[0]?.success)
    throw new Error(
      "D1 query failed. Check configuration and initialize the schema.",
    );
  return data.result[0].results;
}
try {
  const users = await query("SELECT id FROM users WHERE id=?", [userId]);
  if (!users.length)
    throw new Error("User not found. No entries were changed.");
  const rows = await query(
    "UPDATE entries SET data=json_set(data,'$.ownerId',?,'$.kind','visit','$.visibility','private') WHERE json_extract(data,'$.ownerId') IS NULL RETURNING id",
    [userId],
  );
  console.log(
    `Assigned ${rows.length} legacy entries to the selected account, all private. Existing owned entries were preserved.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
