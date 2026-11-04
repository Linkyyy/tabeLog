import { AppError } from "./validation";
export function parseOrder(value: unknown) {
  const v = value as Record<string, unknown> | null;
  const field = (key: string, max: number, required = false) => {
    const x = v?.[key] ?? "";
    if (
      typeof x !== "string" ||
      x.trim().length > max ||
      (required && !x.trim())
    )
      throw new AppError(
        `请正确填写${key === "guestName" ? "称呼" : key === "table" ? "桌号" : "备注"}`,
      );
    return x.trim();
  };
  if (typeof v?.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(v.requestId))
    throw new AppError("提交标识无效，请刷新重试");
  if (!Array.isArray(v.items) || !v.items.length || v.items.length > 20)
    throw new AppError("请选择 1–20 道菜");
  const items = v.items.map((raw) => {
    const x = raw as { entryId?: unknown; quantity?: unknown };
    if (
      !x ||
      typeof x.entryId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(x.entryId) ||
      !Number.isInteger(x.quantity) ||
      Number(x.quantity) < 1 ||
      Number(x.quantity) > 20
    )
      throw new AppError("菜品或份数不正确（每道菜最多 20 份）");
    return { entryId: x.entryId, quantity: Number(x.quantity) };
  });
  if (
    new Set(items.map((i) => i.entryId)).size !== items.length ||
    items.reduce((n, i) => n + i.quantity, 0) > 100
  )
    throw new AppError("请勿重复菜品，每单最多 100 份");
  return {
    requestId: v.requestId,
    guestName: field("guestName", 60, true),
    table: field("table", 30),
    note: field("note", 1000),
    items,
  };
}
