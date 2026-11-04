import { AppError, parseEntry } from "./validation";
import type { EntryInput } from "./types";

export const MAX_IMPORT = 20;
// Accept our own exports and the small, documented AI recipe format. Ignore
// incoming ownership, photo references, visibility and IDs at this boundary.
export function parseRecipes(value: unknown): EntryInput[] {
  const object =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rows = Array.isArray(value)
    ? value
    : (object.recipes ?? object.entries);
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_IMPORT)
    throw new AppError(
      `请提供 1–${MAX_IMPORT} 道菜（JSON 数组或 recipes / entries 数组）`,
    );
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new AppError(`第 ${index + 1} 道菜格式不正确`);
    const v = raw as Record<string, unknown>;
    if (v.kind !== undefined && v.kind !== "recipe")
      throw new AppError("只能导入菜谱，请先移除探店记录");
    const r =
      v.recipe && typeof v.recipe === "object"
        ? (v.recipe as Record<string, unknown>)
        : v;
    const lines = (x: unknown) =>
      Array.isArray(x) && x.every((item) => typeof item === "string")
        ? x.join("\n")
        : x;
    try {
      return parseEntry({
        kind: "recipe",
        visibility: "private",
        name: v.name,
        cuisine: v.cuisine ?? "中餐",
        review: v.review ?? v.description ?? "",
        visitedAt: new Date().toISOString().slice(0, 10),
        rating: 5,
        favorite: false,
        recipe: {
          ingredients: lines(r.ingredients),
          steps: lines(r.steps),
          minutes: r.minutes ?? null,
          servings: r.servings ?? 2,
          difficulty: r.difficulty ?? "简单",
        },
      });
    } catch (e) {
      throw new AppError(
        `第 ${index + 1} 道菜：${e instanceof AppError ? e.message : "格式不正确"}`,
      );
    }
  });
}
export function parseRecipeText(text: string) {
  if (!text.trim() || text.length > 300000)
    throw new AppError("请粘贴 300,000 字符以内的菜谱 JSON");
  let raw: unknown;
  try {
    raw = JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new AppError("这不是有效的 JSON；普通文字请使用「AI 整理文字」");
  }
  return parseRecipes(raw);
}
