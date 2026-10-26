import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { localMode } from "./config";
import type { Entry } from "./types";
import { AppError } from "./validation";
type Row = { id: string; data: string; updated_at: string };
let localDb: import("node:sqlite").DatabaseSync | undefined;
async function local() {
  if (!localDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const dir = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    localDb = new DatabaseSync(path.join(dir, "diary.sqlite"));
    localDb.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);",
    );
  }
  return localDb;
}
export async function query<T>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  if (localMode) return (await local()).prepare(sql).all(...params) as T[];
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    console.error("D1 request failed:", response.status);
    throw new AppError("暂时无法连接日记数据库，请稍后重试", 503);
  }
  const result = await response.json();
  if (!result.success || !result.result?.[0]?.success)
    throw new AppError(
      "数据库尚未初始化或查询失败，请运行 cloudflare:init",
      503,
    );
  return result.result[0].results as T[];
}
export async function listEntries() {
  const rows = await query<Row>(
    "SELECT * FROM entries ORDER BY updated_at DESC",
  );
  return rows.map((r) => JSON.parse(r.data) as Entry);
}
export async function getEntry(id: string) {
  const rows = await query<Row>("SELECT * FROM entries WHERE id = ?", [id]);
  return rows[0] ? (JSON.parse(rows[0].data) as Entry) : null;
}
export async function insertEntry(entry: Entry) {
  await query("INSERT INTO entries (id, data, updated_at) VALUES (?, ?, ?)", [
    entry.id,
    JSON.stringify(entry),
    entry.updatedAt,
  ]);
}
export async function updateEntry(entry: Entry, previousUpdatedAt: string) {
  const rows = await query<{ id: string }>(
    "UPDATE entries SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ? RETURNING id",
    [JSON.stringify(entry), entry.updatedAt, entry.id, previousUpdatedAt],
  );
  if (!rows.length)
    throw new AppError("这篇日记已被其他窗口更新，请刷新后重试", 409);
}
export async function deleteEntry(id: string) {
  return query("DELETE FROM entries WHERE id = ? RETURNING id", [id]);
}
