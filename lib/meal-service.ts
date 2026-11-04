import "server-only";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { savePhoto, removePhoto } from "./storage";
import { parseMealRecord, AppError } from "./validation";
import { firstMeal, mealStats } from "./meal-records";
import type { Entry, MealRecord, Photo } from "./types";
export async function readMeals(
  entry: Entry,
  before?: { date: string; created: string; id: string },
) {
  const rows = await query<{
    id: string;
    data: string;
    created_at: string;
    visited_at: string;
  }>(
    `SELECT id,data,created_at,visited_at FROM meal_records WHERE entry_id=? ${before ? "AND (visited_at < ? OR (visited_at = ? AND (created_at < ? OR (created_at = ? AND id < ?))))" : ""} ORDER BY visited_at DESC,created_at DESC,id DESC LIMIT 51`,
    [
      entry.id,
      ...(before
        ? [before.date, before.date, before.created, before.created, before.id]
        : []),
    ],
  );
  const totals = await query<{
    count: number;
    ratingTotal: number;
    lastEatenAt: string | null;
  }>(
    "SELECT COUNT(*) as count,COALESCE(SUM(json_extract(data,'$.rating')),0) as ratingTotal,MAX(visited_at) as lastEatenAt FROM meal_records WHERE entry_id=?",
    [entry.id],
  );
  const more = rows.length > 50,
    last = rows[Math.min(49, rows.length - 1)];
  return {
    records: rows.slice(0, 50).map((row) => JSON.parse(row.data) as MealRecord),
    initial: firstMeal(entry),
    stats: mealStats(entry, totals[0]),
    next: more
      ? { date: last.visited_at, created: last.created_at, id: last.id }
      : null,
  };
}
export async function writeMeal(request: Request, entry: Entry) {
  if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024)
    throw new AppError("上传内容过大，请减少照片后重试", 413);
  const body = await request.formData();
  let raw: unknown;
  try {
    raw = JSON.parse(String(body.get("record")));
  } catch {
    throw new AppError("用餐记录格式不正确");
  }
  const input = parseMealRecord(raw),
    files = body.getAll("photos");
  if (files.length > 6 || files.some((f) => !(f instanceof File)))
    throw new AppError("每次最多上传 6 张照片");
  const uploads: Photo[] = [];
  try {
    for (const file of files) uploads.push(await savePhoto(file as File));
    const record: MealRecord = {
      ...input,
      id: randomUUID(),
      entryId: entry.id,
      photos: uploads,
      createdAt: new Date().toISOString(),
    };
    await query(
      "INSERT INTO meal_records(id,entry_id,data,visited_at,created_at) VALUES(?,?,?,?,?)",
      [
        record.id,
        entry.id,
        JSON.stringify(record),
        record.visitedAt,
        record.createdAt,
      ],
    );
    return record;
  } catch (error) {
    await Promise.all(uploads.map((p) => removePhoto(p.id)));
    throw error;
  }
}
