import type { EntryInput } from "./types";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function parseEntry(value: unknown): EntryInput {
  if (!value || typeof value !== "object") throw new AppError("记录格式不正确");
  const v = { ...value } as Record<string, unknown>;
  const kind = v.kind ?? "visit",
    visibility = v.visibility ?? "private";
  if (!["visit", "recipe"].includes(String(kind)))
    throw new AppError("请选择探店或我的菜单");
  if (!["private", "public"].includes(String(visibility)))
    throw new AppError("请选择私人或公开");
  let recipe: EntryInput["recipe"];
  if (kind === "recipe") {
    const r = v.recipe as Record<string, unknown> | undefined;
    if (
      !r ||
      typeof r.ingredients !== "string" ||
      !r.ingredients.trim() ||
      r.ingredients.length > 5000 ||
      typeof r.steps !== "string" ||
      !r.steps.trim() ||
      r.steps.length > 10000
    )
      throw new AppError(
        "请填写食材和做法步骤（食材最多 5000 字，步骤最多 10000 字）",
      );
    if (
      r.minutes !== null &&
      (typeof r.minutes !== "number" ||
        !Number.isInteger(r.minutes) ||
        r.minutes < 1 ||
        r.minutes > 1440)
    )
      throw new AppError("烹饪用时应为 1–1440 分钟");
    if (
      typeof r.servings !== "number" ||
      !Number.isInteger(r.servings) ||
      r.servings < 1 ||
      r.servings > 100
    )
      throw new AppError("份量应为 1–100 人份");
    if (!["简单", "进阶", "挑战"].includes(String(r.difficulty)))
      throw new AppError("请选择烹饪难度");
    recipe = {
      ingredients: r.ingredients.trim(),
      steps: r.steps.trim(),
      minutes: r.minutes as number | null,
      servings: r.servings,
      difficulty: r.difficulty as "简单" | "进阶" | "挑战",
    };
    Object.assign(v, {
      lat: 0,
      lng: 0,
      address: "",
      city: "",
      price: null,
      currency: "CNY",
    });
  }
  const str = (key: string, max: number, required = false) => {
    if (typeof v[key] !== "string") throw new AppError(`${key} 格式不正确`);
    const s = (v[key] as string).trim();
    if ((required && !s) || s.length > max)
      throw new AppError(`${key} 不能为空或超出长度限制`);
    return s;
  };
  const name = str("name", 100, true),
    address = str("address", 300),
    city = str("city", 80);
  const cuisine = str("cuisine", 40, true),
    review = str("review", 10000);
  const visitedAt = str("visitedAt", 10, true);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(visitedAt) ||
    !Number.isFinite(Date.parse(visitedAt)) ||
    new Date(visitedAt).toISOString().slice(0, 10) !== visitedAt
  )
    throw new AppError("请选择有效的记录日期");
  if (visitedAt > new Date(Date.now() + 86400000).toISOString().slice(0, 10))
    throw new AppError("记录日期不能是未来");
  const { lat, lng, rating, price, currency, favorite, keepPhotoIds } = v;
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    Math.abs(lng) > 180
  )
    throw new AppError("请选择有效的地图位置");
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  )
    throw new AppError("评分应为 1 至 5 星");
  if (
    price !== null &&
    (typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 1000000)
  )
    throw new AppError("人均消费格式不正确");
  if (!["CNY", "JPY", "USD"].includes(String(currency)))
    throw new AppError("不支持的币种");
  if (typeof favorite !== "boolean") throw new AppError("收藏状态格式不正确");
  if (
    keepPhotoIds !== undefined &&
    (!Array.isArray(keepPhotoIds) ||
      keepPhotoIds.length > 6 ||
      keepPhotoIds.some(
        (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id),
      ) ||
      new Set(keepPhotoIds).size !== keepPhotoIds.length)
  )
    throw new AppError("照片信息不正确");
  return {
    kind: kind as EntryInput["kind"],
    visibility: visibility as EntryInput["visibility"],
    recipe,
    name,
    address,
    city,
    cuisine,
    review,
    visitedAt,
    lat,
    lng,
    rating,
    price: price as number | null,
    currency: currency as EntryInput["currency"],
    favorite,
    keepPhotoIds: keepPhotoIds as string[] | undefined,
  };
}
