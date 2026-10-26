import "server-only";
import { mkdirSync, readFileSync } from "node:fs";
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
    localDb.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    localDb.exec(
      readFileSync(path.join(process.cwd(), "scripts/schema.sql"), "utf8"),
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

const selectEntries =
  "SELECT e.*, u.name AS author_name FROM entries e JOIN users u ON u.id = json_extract(e.data, '$.ownerId')";
function decode(row: Row & { author_name: string }): Entry {
  return { ...JSON.parse(row.data), authorName: row.author_name };
}
export async function listEntries(
  userId: string | null,
  scope: "mine" | "public",
) {
  const where =
    scope === "mine"
      ? "json_extract(e.data, '$.ownerId') = ?"
      : "json_extract(e.data, '$.visibility') = 'public'";
  return (
    await query<Row & { author_name: string }>(
      `${selectEntries} WHERE ${where} ORDER BY e.updated_at DESC`,
      scope === "mine" ? [userId] : [],
    )
  ).map(decode);
}
export async function getEntry(
  id: string,
  userId: string | null,
  ownerOnly = false,
) {
  const permission = ownerOnly
    ? "json_extract(e.data,'$.ownerId') = ?"
    : "(json_extract(e.data,'$.ownerId') = ? OR json_extract(e.data,'$.visibility') = 'public')";
  const rows = await query<Row & { author_name: string }>(
    `${selectEntries} WHERE e.id = ? AND ${permission}`,
    [id, userId],
  );
  return rows[0] ? decode(rows[0]) : null;
}
export async function canReadPhoto(id: string, userId: string | null) {
  const rows = await query<{ id: string }>(
    `${selectEntries} WHERE (json_extract(e.data,'$.ownerId') = ? OR json_extract(e.data,'$.visibility') = 'public') AND EXISTS (SELECT 1 FROM json_each(e.data,'$.photos') p WHERE json_extract(p.value,'$.id') = ?) LIMIT 1`,
    [userId, id],
  );
  return !!rows.length;
}
export async function insertEntry(entry: Entry) {
  await query("INSERT INTO entries (id,data,updated_at) VALUES (?,?,?)", [
    entry.id,
    JSON.stringify(entry),
    entry.updatedAt,
  ]);
}
export async function updateEntry(entry: Entry, previousUpdatedAt: string) {
  const rows = await query<{ id: string }>(
    "UPDATE entries SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ? AND json_extract(data,'$.ownerId') = ? RETURNING id",
    [
      JSON.stringify(entry),
      entry.updatedAt,
      entry.id,
      previousUpdatedAt,
      entry.ownerId,
    ],
  );
  if (!rows.length)
    throw new AppError("这篇记录已被其他窗口更新，请刷新后重试", 409);
}
export async function deleteEntry(
  id: string,
  ownerId: string,
  previousUpdatedAt: string,
) {
  const rows = await query<{ id: string }>(
    "DELETE FROM entries WHERE id = ? AND json_extract(data,'$.ownerId') = ? AND updated_at = ? RETURNING id",
    [id, ownerId, previousUpdatedAt],
  );
  if (!rows.length) throw new AppError("这篇记录已更新，请刷新后再删除", 409);
}
