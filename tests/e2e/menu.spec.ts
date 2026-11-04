import { openDiaryTool } from "./toolbar-helpers";
import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import jsQR from "jsqr";
import type { Entry, User } from "../../lib/types";
import { parseRecipes } from "../../lib/recipe-import";
import type { MenuShare, MenuOrder } from "../../lib/menu-types";
const origin = "http://127.0.0.1:3100",
  headers = { Origin: origin };
const dish = {
  name: "清炒时蔬",
  cuisine: "中餐",
  description: "清爽的家常味道",
  ingredients: "西兰花 200 克\n胡萝卜 1 根",
  steps: "1. 洗净切块。\n2. 热锅翻炒至熟。",
  minutes: 15,
  servings: 2,
  difficulty: "简单",
};
async function signup(context: BrowserContext, prefix: string): Promise<User> {
  const response = await context.request.post("/api/session", {
    headers,
    data: {
      action: "register",
      name: prefix,
      email: `${prefix}@example.com`,
      password: "MenuTest12345",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).user;
}
async function importDish(context: BrowserContext, name: string) {
  const r = await context.request.post("/api/recipes/import", {
    headers,
    data: { recipes: [{ ...dish, name }] },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).entries[0] as Entry;
}
async function publish(context: BrowserContext, entry: Entry) {
  const r = await context.request.put(`/api/entries/${entry.id}`, {
    headers,
    multipart: {
      entry: JSON.stringify({
        ...entry,
        visibility: "public",
        keepPhotoIds: entry.photos.map((p) => p.id),
      }),
      updatedAt: entry.updatedAt,
    },
  });
  expect(r.status()).toBe(200);
  return (await r.json()).entry as Entry;
}

test("AI configuration is encrypted and owner-only; batch imports are private and atomic", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    other = await browser.newContext(),
    guest = await browser.newContext();
  try {
    const user = await signup(owner, "ai-owner");
    await signup(other, "ai-other");
    for (const path of [
      "/api/ai/settings",
      "/api/menu-share",
      "/api/menu-orders",
    ])
      expect((await guest.request.get(path)).status()).toBe(401);
    expect(
      (
        await guest.request.post("/api/recipes/import", {
          headers,
          data: { recipes: [dish] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await guest.request.post("/api/ai/generate", {
          headers,
          data: { prompt: "晚餐", count: 1, mode: "generate" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await owner.request.post("/api/ai/generate", {
          headers,
          data: { prompt: "晚餐", count: 1, mode: "generate" },
        })
      ).status(),
    ).toBe(400);
    const config = {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      apiKey: "synthetic-encryption-test-key",
    };
    expect(
      (
        await owner.request.put("/api/ai/settings", {
          headers: { Origin: "https://attacker.test" },
          data: config,
        })
      ).status(),
    ).toBe(403);
    const save = await owner.request.put("/api/ai/settings", {
      headers,
      data: config,
    });
    expect(save.status()).toBe(200);
    expect(await save.text()).not.toContain(config.apiKey);
    const read = await owner.request.get("/api/ai/settings");
    expect(read.headers()["cache-control"]).toContain("no-store");
    expect((await read.json()).settings).toEqual({
      provider: "deepseek",
      baseUrl: config.baseUrl,
      model: "deepseek-chat",
      hasKey: true,
    });
    expect(
      (await (await other.request.get("/api/ai/settings")).json()).settings,
    ).toBeNull();
    const db = new DatabaseSync("/tmp/tabelog-e2e/diary.sqlite");
    const row = db
      .prepare("SELECT data,encrypted_key FROM ai_settings WHERE user_id=?")
      .get(user.id) as { data: string; encrypted_key: string };
    db.close();
    expect(row.data + row.encrypted_key).not.toContain(config.apiKey);
    expect(row.encrypted_key.split(".")).toHaveLength(3);
    expect(
      (
        await owner.request.put("/api/ai/settings", {
          headers,
          data: { ...config, apiKey: "", model: "deepseek-reasoner" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await owner.request.put("/api/ai/settings", {
          headers,
          data: {
            ...config,
            provider: "custom",
            baseUrl: "https://127.0.0.1/v1",
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await owner.request.put("/api/ai/settings", {
          headers,
          data: {
            ...config,
            provider: "openai",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "",
          },
        })
      ).status(),
    ).toBe(400);
    const valid = await importDish(owner, "私人的导入菜谱");
    expect(valid.ownerId).toBe(user.id);
    expect(valid.visibility).toBe("private");
    expect(
      (
        await owner.request.post("/api/recipes/import", {
          headers,
          data: { recipes: [dish, { ...dish, steps: "" }] },
        })
      ).status(),
    ).toBe(400);
    const own = (await (await owner.request.get("/api/entries")).json())
      .entries as Entry[];
    expect(own).toHaveLength(1);
    expect((await guest.request.get(`/api/entries/${valid.id}`)).status()).toBe(
      404,
    );
    const imported = await owner.request.post("/api/recipes/import", {
      headers,
      data: {
        entries: [
          {
            ...dish,
            id: randomUUID(),
            ownerId: "foreign",
            visibility: "public",
            photos: [{ id: randomUUID(), url: "https://attacker.test/photo" }],
          },
        ],
      },
    });
    expect(imported.status()).toBe(201);
    const result = (await imported.json()).entries[0];
    expect(result.visibility).toBe("private");
    expect(result.ownerId).toBe(user.id);
    expect(result.photos).toEqual([]);
    expect(
      (await owner.request.delete("/api/ai/settings", { headers })).status(),
    ).toBe(200);
    expect(
      (await (await owner.request.get("/api/ai/settings")).json()).settings,
    ).toBeNull();
  } finally {
    await owner.close();
    await other.close();
    await guest.close();
  }
});

test("recipe tools preview controlled AI output, edit and import it, and directly import a JSON file", async ({
  page,
  context,
}) => {
  await signup(context, "studio-ui");
  await page.route(/(tile\.openstreetmap\.org|basemaps\.cartocdn\.com)/, (r) =>
    r.abort(),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "我的菜单", exact: true }).click();
  await openDiaryTool(page, "AI 生成 / 导入");
  await page.getByRole("button", { name: "接口设置", exact: true }).click();
  await expect(page.getByLabel("API 基础地址", { exact: true })).toHaveValue(
    "https://api.deepseek.com",
  );
  await page
    .getByLabel("API Key", { exact: true })
    .fill("synthetic-ui-test-key");
  await page.getByRole("button", { name: "保存接口", exact: true }).click();
  // This controlled response tests the browser workflow, not a live provider.
  await page.route("**/api/ai/generate", async (route) => {
    expect(route.request().postDataJSON().mode).toBe("generate");
    await route.fulfill({
      json: {
        recipes: parseRecipes({ recipes: [{ ...dish, name: "AI 家常晚餐" }] }),
      },
    });
  });
  await page
    .getByRole("textbox", { name: "菜单需求", exact: true })
    .fill("用西兰花和胡萝卜做晚餐");
  await page.getByRole("button", { name: "生成菜单", exact: true }).click();
  await expect(page.getByRole("heading", { name: /预览菜谱/ })).toBeVisible();
  await page.getByLabel("菜名", { exact: true }).fill("编辑后的时蔬");
  await page.getByRole("button", { name: "保存 1 道菜到我的菜单" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "编辑后的时蔬", exact: true }),
  ).toBeVisible();
  await openDiaryTool(page, "AI 生成 / 导入");
  await page.getByRole("button", { name: "快速导入", exact: true }).click();
  await page.getByLabel("导入菜谱文件", { exact: true }).setInputFiles({
    name: "recipes.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ recipes: [{ ...dish, name: "文件里的家常菜" }] }),
    ),
  });
  await page.getByRole("button", { name: "解析 JSON", exact: true }).click();
  await page.getByRole("button", { name: "保存 1 道菜到我的菜单" }).click();
  await expect(
    page.getByRole("button", { name: "文件里的家常菜", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "我的菜单", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑后的时蔬", exact: true }),
  ).toBeVisible();
  const entries = (await (await context.request.get("/api/entries")).json())
    .entries as Entry[];
  expect(entries).toHaveLength(2);
  expect(entries.every((e) => e.visibility === "private")).toBe(true);
});

test("QR menu opens on phones, submits real guest orders and the owner processes them", async ({
  browser,
}) => {
  const owner = await browser.newContext(),
    guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await signup(owner, "qr-ui");
    const entry = await publish(
      owner,
      await importDish(owner, "朋友想吃的时蔬"),
    );
    await importDish(owner, "私人厨房实验");
    const page = await owner.newPage();
    await page.route(
      /(tile\.openstreetmap\.org|basemaps\.cartocdn\.com)/,
      (r) => r.abort(),
    );
    await page.goto("/");
    await page.getByRole("link", { name: "我的菜单", exact: true }).click();
    await openDiaryTool(page, "点餐二维码");
    await expect(
      page.getByLabel("分享 私人厨房实验", { exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("点餐菜单名称", { exact: true })
      .fill("周末来我家吃饭");
    await page
      .getByRole("button", { name: "开启扫码点餐", exact: true })
      .click();
    const qr = page.getByAltText("菜单点餐二维码", { exact: true });
    await expect(qr).toBeVisible();
    const src = await qr.getAttribute("src");
    const pixels = await sharp(Buffer.from(src!.split(",")[1], "base64"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(pixels.data),
      pixels.info.width,
      pixels.info.height,
    );
    expect(decoded).toBeTruthy();
    const link = await page
      .getByLabel("点餐链接", { exact: true })
      .inputValue();
    expect(decoded!.data).toBe(link);
    const download = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "下载二维码 PNG", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("tabelog-menu-qr.png");
    const phone = await guest.newPage();
    const errors: string[] = [];
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.goto(link);
    await expect(
      phone.getByRole("heading", { name: "周末来我家吃饭" }),
    ).toBeVisible();
    await expect(phone.getByText("私人厨房实验")).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await phone.setViewportSize({ width, height: 844 });
      expect(
        await phone.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone
      .getByRole("button", { name: `加一份 ${entry.name}`, exact: true })
      .click();
    await phone.getByRole("button", { name: "选好了", exact: true }).click();
    await phone.getByLabel("怎么称呼你", { exact: true }).fill("小林");
    await phone
      .getByLabel("桌号 / 用餐位置（选填）", { exact: true })
      .fill("客厅");
    await phone
      .getByLabel("口味与忌口（选填）", { exact: true })
      .fill("少盐，谢谢");
    await phone.getByRole("button", { name: "提交点餐", exact: true }).click();
    await expect(phone.locator(".order-receipt")).toContainText("点餐已送达");
    expect(errors).toEqual([]);
    await page.getByRole("button", { name: "点餐订单", exact: true }).click();
    await expect(page.getByText("小林", { exact: true })).toBeVisible();
    await expect(
      page.getByText("备注：少盐，谢谢", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "接单，开始准备", exact: true })
      .click();
    await expect(page.getByText("准备中", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "标记已完成", exact: true }).click();
    await expect(page.getByText("已完成", { exact: true })).toBeVisible();
  } finally {
    await owner.close();
    await guest.close();
  }
});

test("shared menus enforce ownership, live public visibility, idempotency, state transitions and link revocation", async ({
  browser,
}) => {
  const alice = await browser.newContext(),
    bob = await browser.newContext(),
    guest = await browser.newContext();
  try {
    await signup(alice, "share-alice");
    await signup(bob, "share-bob");
    const priv = await importDish(alice, "不可分享的私房菜"),
      pub = await publish(alice, await importDish(alice, "可点的菜")),
      foreign = await publish(bob, await importDish(bob, "别人的菜"));
    const save = async (ids: string[], rotate = false) =>
      alice.request.put("/api/menu-share", {
        headers,
        data: { title: "Alice 的厨房", entryIds: ids, rotate },
      });
    expect((await save([priv.id])).status()).toBe(409);
    expect((await save([foreign.id])).status()).toBe(409);
    const r = await save([pub.id]);
    expect(r.status()).toBe(200);
    const share = (await r.json()).share as MenuShare;
    const response = await guest.request.get(`/api/menus/${share.token}`);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const raw = await response.text();
    expect(raw).not.toContain("share-alice@example.com");
    expect(raw).not.toContain("ingredients");
    expect(raw).not.toContain(priv.name);
    expect(JSON.parse(raw).menu.dishes).toHaveLength(1);
    const payload = {
      requestId: randomUUID(),
      guestName: "食客",
      table: "桌 1",
      note: "不要辣",
      items: [{ entryId: pub.id, quantity: 2 }],
    };
    const post = (data: unknown) =>
      guest.request.post(`/api/menus/${share.token}/orders`, { headers, data });
    expect(
      (
        await guest.request.post(`/api/menus/${share.token}/orders`, {
          headers: { Origin: "https://attacker.test" },
          data: payload,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await post({ ...payload, items: [{ entryId: priv.id, quantity: 1 }] })
      ).status(),
    ).toBe(409);
    expect(
      (
        await post({
          ...payload,
          items: [{ entryId: foreign.id, quantity: 1 }],
        })
      ).status(),
    ).toBe(409);
    const [first, retry] = await Promise.all([post(payload), post(payload)]);
    expect(first.status()).toBe(201);
    expect(retry.status()).toBe(201);
    const receipt = (await first.json()).order;
    expect((await retry.json()).order.id).toBe(receipt.id);
    expect((await post({ ...payload, note: "篡改" })).status()).toBe(409);
    expect((await guest.request.get("/api/menu-orders")).status()).toBe(401);
    expect(
      (await (await bob.request.get("/api/menu-orders")).json()).orders,
    ).toEqual([]);
    const orders = (await (await alice.request.get("/api/menu-orders")).json())
      .orders as MenuOrder[];
    expect(orders).toHaveLength(1);
    expect(orders[0].items[0].name).toBe(pub.name);
    const patch = (who: BrowserContext, status: string) =>
      who.request.patch(`/api/menu-orders/${receipt.id}`, {
        headers,
        data: { status },
      });
    expect((await patch(bob, "accepted")).status()).toBe(409);
    expect((await patch(alice, "completed")).status()).toBe(409);
    expect((await patch(alice, "accepted")).status()).toBe(200);
    expect((await patch(alice, "completed")).status()).toBe(200);
    expect((await patch(alice, "cancelled")).status()).toBe(409);
    const hide = await alice.request.put(`/api/entries/${pub.id}`, {
      headers,
      multipart: {
        entry: JSON.stringify({
          ...pub,
          visibility: "private",
          keepPhotoIds: [],
        }),
        updatedAt: pub.updatedAt,
      },
    });
    expect(hide.status()).toBe(200);
    const hidden = (await hide.json()).entry as Entry;
    expect(
      (await (await guest.request.get(`/api/menus/${share.token}`)).json()).menu
        .dishes,
    ).toEqual([]);
    expect((await post({ ...payload, requestId: randomUUID() })).status()).toBe(
      409,
    );
    await publish(alice, hidden);
    const rotated = (await (await save([pub.id], true)).json())
      .share as MenuShare;
    expect(rotated.token).not.toBe(share.token);
    expect(
      (await guest.request.get(`/api/menus/${share.token}`)).status(),
    ).toBe(404);
    expect((await post({ ...payload, requestId: randomUUID() })).status()).toBe(
      404,
    );
    expect(
      (await guest.request.get(`/api/menus/${rotated.token}`)).status(),
    ).toBe(200);
    expect(
      (await alice.request.delete("/api/menu-share", { headers })).status(),
    ).toBe(200);
    expect(
      (await guest.request.get(`/api/menus/${rotated.token}`)).status(),
    ).toBe(404);
    expect(
      (
        await guest.request.post(`/api/menus/${rotated.token}/orders`, {
          headers,
          data: payload,
        })
      ).status(),
    ).toBe(404);
  } finally {
    await alice.close();
    await bob.close();
    await guest.close();
  }
});
