import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { query } from "./db";
import { AppError } from "./validation";
import type { Entry, User } from "./types";
import type {
  MenuShare,
  MenuOrder,
  OrderStatus,
  SharedMenu,
} from "./menu-types";
import { parseOrder } from "./order-validation";
type ShareRow = {
  owner_id: string;
  token: string;
  title: string;
  entry_ids: string;
  enabled: number;
};
type OrderRow = {
  id: string;
  owner_id: string;
  data: string;
  status: OrderStatus;
  created_at: string;
};
const tokenPattern = /^[a-f0-9]{48}$/;
function shareView(row: ShareRow): MenuShare {
  return {
    title: row.title,
    token: row.token,
    entryIds: JSON.parse(row.entry_ids),
    enabled: !!row.enabled,
  };
}
export async function ownerShare(userId: string) {
  const row = (
    await query<ShareRow>("SELECT * FROM menu_shares WHERE owner_id=?", [
      userId,
    ])
  )[0];
  return row ? shareView(row) : null;
}
export async function saveShare(user: User, value: unknown) {
  const v = value as { title?: unknown; entryIds?: unknown; rotate?: unknown };
  if (
    typeof v?.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 60 ||
    !Array.isArray(v.entryIds) ||
    !v.entryIds.length ||
    v.entryIds.length > 100 ||
    v.entryIds.some(
      (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id),
    ) ||
    new Set(v.entryIds).size !== v.entryIds.length
  )
    throw new AppError("请填写菜单名称（最多 60 字），并选择 1–100 道公开菜品");
  const ids = v.entryIds as string[];
  const old = await ownerShare(user.id);
  const token =
    old && v.rotate !== true ? old.token : randomBytes(24).toString("hex");
  // Validate ownership/public visibility in the same statement that saves.
  const rows = await query<{ token: string }>(
    `INSERT INTO menu_shares(owner_id,token,title,entry_ids,enabled,updated_at)
    SELECT ?,?,?,?,1,? WHERE (SELECT COUNT(*) FROM entries WHERE json_extract(data,'$.ownerId')=? AND json_extract(data,'$.kind')='recipe' AND json_extract(data,'$.visibility')='public' AND id IN (SELECT value FROM json_each(?)))=?
    ON CONFLICT(owner_id) DO UPDATE SET token=excluded.token,title=excluded.title,entry_ids=excluded.entry_ids,enabled=1,updated_at=excluded.updated_at RETURNING token`,
    [
      user.id,
      token,
      v.title.trim(),
      JSON.stringify(ids),
      new Date().toISOString(),
      user.id,
      JSON.stringify(ids),
      ids.length,
    ],
  );
  if (!rows.length)
    throw new AppError("只能分享你自己的公开菜品；请刷新后重新选择", 409);
  return (await ownerShare(user.id))!;
}
export async function publicMenu(
  token: string,
): Promise<{ share: ShareRow; menu: SharedMenu }> {
  if (!tokenPattern.test(token)) throw new AppError("菜单不存在或已关闭", 404);
  const row = (
    await query<ShareRow & { author: string }>(
      "SELECT s.*,u.name AS author FROM menu_shares s JOIN users u ON u.id=s.owner_id WHERE s.token=? AND s.enabled=1",
      [token],
    )
  )[0];
  if (!row) throw new AppError("菜单不存在或已关闭", 404);
  const entries = await query<{ data: string }>(
    "SELECT data FROM entries WHERE json_extract(data,'$.ownerId')=? AND json_extract(data,'$.kind')='recipe' AND json_extract(data,'$.visibility')='public' AND id IN (SELECT value FROM json_each(?))",
    [row.owner_id, row.entry_ids],
  );
  const byId = new Map(
    entries.map((r) => {
      const e = JSON.parse(r.data) as Entry;
      return [e.id, e] as const;
    }),
  );
  return {
    share: row,
    menu: {
      title: row.title,
      author: row.author,
      dishes: (JSON.parse(row.entry_ids) as string[]).flatMap((id) => {
        const e = byId.get(id);
        return e
          ? [
              {
                id: e.id,
                name: e.name,
                cuisine: e.cuisine,
                description: e.review,
                photo: e.photos[0]?.url || null,
                minutes: e.recipe?.minutes ?? null,
                servings: e.recipe?.servings || 1,
              },
            ]
          : [];
      }),
    },
  };
}
export async function placeOrder(token: string, value: unknown) {
  const input = parseOrder(value);
  const { share, menu } = await publicMenu(token);
  const prior = (
    await query<OrderRow>(
      "SELECT * FROM menu_orders WHERE share_token=? AND request_id=?",
      [token, input.requestId],
    )
  )[0];
  const matches = (row: OrderRow) => {
    const data = JSON.parse(row.data) as MenuOrder;
    if (
      data.guestName !== input.guestName ||
      data.table !== input.table ||
      data.note !== input.note ||
      JSON.stringify(
        data.items.map(({ entryId, quantity }) => ({ entryId, quantity })),
      ) !== JSON.stringify(input.items)
    )
      throw new AppError("这次提交已处理，请重新选择菜单", 409);
    return { id: row.id, status: row.status, createdAt: row.created_at };
  };
  if (prior) return matches(prior);
  const items = input.items.map((item) => {
    const dish = menu.dishes.find((d) => d.id === item.entryId);
    if (!dish) throw new AppError("有菜品已下架，请刷新菜单后重新选择", 409);
    return { ...item, name: dish.name };
  });
  const id = randomUUID(),
    createdAt = new Date().toISOString();
  const { requestId, ...guest } = input;
  const data = { ...guest, items };
  const ids = JSON.stringify(items.map((i) => i.entryId));
  const inserted = await query<OrderRow>(
    `INSERT INTO menu_orders(id,owner_id,share_token,request_id,data,status,created_at)
    SELECT ?,?,?,?,?, 'pending',? WHERE EXISTS(SELECT 1 FROM menu_shares WHERE token=? AND enabled=1 AND owner_id=?)
    AND (SELECT COUNT(*) FROM entries e WHERE json_extract(e.data,'$.ownerId')=? AND json_extract(e.data,'$.kind')='recipe' AND json_extract(e.data,'$.visibility')='public'
      AND e.id IN (SELECT value FROM json_each(?)) AND e.id IN (SELECT value FROM json_each((SELECT entry_ids FROM menu_shares WHERE token=? AND enabled=1))))=?
    ON CONFLICT(share_token,request_id) DO NOTHING RETURNING *`,
    [
      id,
      share.owner_id,
      token,
      requestId,
      JSON.stringify(data),
      createdAt,
      token,
      share.owner_id,
      share.owner_id,
      ids,
      token,
      items.length,
    ],
  );
  if (inserted[0]) return matches(inserted[0]);
  const retry = (
    await query<OrderRow>(
      "SELECT * FROM menu_orders WHERE share_token=? AND request_id=?",
      [token, requestId],
    )
  )[0];
  if (retry) return matches(retry);
  throw new AppError("菜单已更新或关闭，请刷新后重试", 409);
}
export async function ownerOrders(userId: string): Promise<MenuOrder[]> {
  return (
    await query<OrderRow>(
      "SELECT * FROM menu_orders WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
      [userId],
    )
  ).map((row) => ({
    ...JSON.parse(row.data),
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
  }));
}
export async function changeOrder(userId: string, id: string, status: unknown) {
  if (
    !/^[a-f0-9-]{36}$/.test(id) ||
    !["accepted", "completed", "cancelled"].includes(String(status))
  )
    throw new AppError("订单或状态无效");
  const previous =
    status === "accepted"
      ? ["pending"]
      : status === "completed"
        ? ["accepted"]
        : ["pending", "accepted"];
  const rows = await query<{ id: string }>(
    "UPDATE menu_orders SET status=? WHERE id=? AND owner_id=? AND status IN (SELECT value FROM json_each(?)) RETURNING id",
    [String(status), id, userId, JSON.stringify(previous)],
  );
  if (!rows.length) throw new AppError("订单不存在或状态已变化，请刷新", 409);
}
