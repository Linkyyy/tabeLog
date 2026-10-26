import { test, expect, type BrowserContext } from "@playwright/test";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
const origin = "http://127.0.0.1:3100";
const headers = { Origin: origin };
const password = "a-test-password-12345";
const legacyId = "00000000-0000-0000-0000-000000000001";

async function signup(context: BrowserContext, email: string, name: string) {
  const r = await context.request.post("/api/session", {
    headers,
    data: { action: "register", name, email, password },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).user;
}
async function photo() {
  return sharp({
    create: { width: 90, height: 90, channels: 3, background: "#b95136" },
  })
    .png()
    .toBuffer();
}
test("two modules, real registration/login, restaurant map and private illustrated recipe", async ({
  page,
}) => {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByLabel("昵称", { exact: true }).fill("小厨同学");
  await page.getByLabel("邮箱", { exact: true }).fill("chef@example.com");
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "注册并开始记录" }).click();
  await expect(
    page.getByRole("heading", { name: "第一口心动，从这里开始。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "写下第一篇日记" }).click();
  await expect(
    page.getByRole("dialog").locator(".leaflet-container"),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByLabel("美食足迹地图")
    .click({ position: { x: 180, y: 150 } });
  await page.getByLabel("店铺名称").fill("旬味食堂");
  await page.getByLabel("城市", { exact: true }).fill("上海");
  await page.getByLabel("详细地址").fill("上海市武康路");
  await page.getByRole("button", { name: "保存这份美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "旬味食堂", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "你的拿手菜，值得被记住。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "写下第一道菜" }).click();
  await expect(page.getByLabel("美食足迹地图")).toHaveCount(0);
  await page.getByLabel("菜名").fill("番茄牛腩 · 我的拿手菜");
  await page.getByLabel("食材与用量").fill("牛腩 500 克\n番茄 3 个");
  await page
    .getByLabel("做法步骤")
    .fill("牛腩焯水。\n番茄炒出汁，加入牛腩慢炖。");
  await page.getByLabel("用时（分钟）").fill("90");
  await page
    .getByRole("textbox", { name: "写给这顿饭的几句话" })
    .fill("慢慢炖的幸福。");
  await page.getByLabel("添加照片", { exact: true }).setInputFiles({
    name: "beef.png",
    mimeType: "image/png",
    buffer: await photo(),
  });
  await expect(page.getByAltText("新照片 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "私人收藏 仅自己可见" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "保存这份美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await page
    .getByRole("button", { name: "番茄牛腩 · 我的拿手菜", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("牛腩 500 克");
  await expect(page.getByRole("dialog")).toContainText("90 分钟");
  await expect(
    page.getByAltText("番茄牛腩 · 我的拿手菜的照片 1"),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑日记" }).click();
  await page.getByLabel("菜名").fill("番茄牛腩 · 再做一次");
  await page.getByRole("button", { name: "公开分享 所有人可见" }).click();
  await page.getByRole("button", { name: "保存这份美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("搜索日记").fill("找不到的菜");
  await expect(
    page.getByRole("heading", { name: "还没找到这份美味" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出日记", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/tabelog-recipe/);
  await page
    .getByRole("button", { name: "番茄牛腩 · 再做一次", exact: true })
    .click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill("chef@example.com");
  await page.getByLabel("密码", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "邮箱或密码不正确" }),
  ).toBeVisible();
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "探店日记", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "旬味食堂", exact: true }),
  ).toBeVisible();
});
test("private/public access isolation, photos, ownership, share revocation, session revocation and legacy privacy", async ({
  browser,
}) => {
  const alice = await browser.newContext(),
    bob = await browser.newContext(),
    guest = await browser.newContext();
  try {
    const a = await signup(alice, "alice@example.com", "Alice厨房"),
      b = await signup(bob, "bob@example.com", "Bob食客");
    const input = {
      kind: "recipe",
      visibility: "private",
      name: "私人的炖牛肉",
      cuisine: "中餐",
      rating: 5,
      visitedAt: "2026-01-01",
      review: "不公开的厨房笔记",
      favorite: true,
      recipe: {
        ingredients: "牛肉 500 克",
        steps: "焯水后慢炖。",
        minutes: 90,
        servings: 2,
        difficulty: "简单",
      },
    };
    const create = await alice.request.post("/api/entries", {
      headers,
      multipart: {
        entry: JSON.stringify({ ...input, ownerId: b.id }),
        photos: {
          name: "dinner.png",
          mimeType: "image/png",
          buffer: await photo(),
        },
      },
    });
    expect(create.status()).toBe(201);
    let entry = (await create.json()).entry;
    expect(entry.ownerId).toBe(a.id);
    const image = entry.photos[0].url;
    expect((await guest.request.get("/api/entries")).status()).toBe(401);
    expect((await guest.request.get(`/api/entries/${entry.id}`)).status()).toBe(
      404,
    );
    expect((await bob.request.get(`/api/entries/${entry.id}`)).status()).toBe(
      404,
    );
    expect((await guest.request.get(image)).status()).toBe(404);
    expect((await bob.request.get(image)).status()).toBe(404);
    expect((await alice.request.get(image)).status()).toBe(200);
    expect(
      (await guest.request.get("/api/entries?scope=public")).status(),
    ).toBe(200);
    expect(
      (await (await bob.request.get("/api/entries")).json()).entries,
    ).toEqual([]);
    expect(
      (
        await bob.request.put(`/api/entries/${entry.id}`, {
          headers,
          multipart: {
            entry: JSON.stringify({ ...input, ownerId: b.id }),
            updatedAt: entry.updatedAt,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await bob.request.delete(`/api/entries/${entry.id}`, { headers })
      ).status(),
    ).toBe(404);
    expect((await alice.request.get(`/api/entries/${legacyId}`)).status()).toBe(
      404,
    );
    const update = await alice.request.put(`/api/entries/${entry.id}`, {
      headers,
      multipart: {
        entry: JSON.stringify({
          ...input,
          visibility: "public",
          keepPhotoIds: entry.photos.map((p: { id: string }) => p.id),
        }),
        updatedAt: entry.updatedAt,
      },
    });
    expect(update.status()).toBe(200);
    const old = entry;
    entry = (await update.json()).entry;
    expect((await guest.request.get(`/share/${entry.id}`)).status()).toBe(200);
    const publicImage = await guest.request.get(image);
    expect(publicImage.status()).toBe(200);
    expect(publicImage.headers()["cache-control"]).toContain("no-store");
    const publicList = (
      await (await guest.request.get("/api/entries?scope=public")).json()
    ).entries;
    expect(
      publicList.some((e: { id: string }) => e.id === entry.id),
    ).toBeTruthy();
    expect(JSON.stringify(publicList)).not.toContain("alice@example.com");
    const reader = await bob.newPage();
    await reader.goto("/");
    await reader
      .getByRole("button", { name: "美味广场", exact: false })
      .click();
    await reader.getByRole("button", { name: "我的菜单", exact: true }).click();
    await reader.getByRole("button", { name: entry.name, exact: true }).click();
    await expect(reader.getByRole("button", { name: "编辑日记" })).toHaveCount(
      0,
    );
    await reader.close();
    expect(
      (
        await alice.request.put(`/api/entries/${entry.id}`, {
          headers,
          multipart: {
            entry: JSON.stringify({ ...input, keepPhotoIds: [] }),
            updatedAt: old.updatedAt,
          },
        })
      ).status(),
    ).toBe(409);
    const privatize = await alice.request.put(`/api/entries/${entry.id}`, {
      headers,
      multipart: {
        entry: JSON.stringify({
          ...input,
          keepPhotoIds: entry.photos.map((p: { id: string }) => p.id),
        }),
        updatedAt: entry.updatedAt,
      },
    });
    expect(privatize.status()).toBe(200);
    expect((await guest.request.get(`/share/${entry.id}`)).status()).toBe(404);
    expect((await guest.request.get(image)).status()).toBe(404);
    expect((await bob.request.get(image)).status()).toBe(404);
    expect(
      (
        await alice.request.delete(`/api/entries/${entry.id}`, { headers })
      ).status(),
    ).toBe(200);
    expect((await alice.request.get(image)).status()).toBe(404);
    const cookie = await alice.cookies();
    await alice.request.delete("/api/session", { headers });
    await alice.addCookies(cookie);
    expect((await alice.request.get("/api/entries")).status()).toBe(401);
    expect(
      (
        await guest.request.post("/api/session", {
          headers: { Origin: "https://wrong.example" },
          data: { action: "login", email: "alice@example.com", password },
        })
      ).status(),
    ).toBe(403);
    const db = new DatabaseSync("/tmp/tabelog-e2e/diary.sqlite", {
      readOnly: true,
    });
    expect(
      db.prepare("SELECT id FROM entries WHERE id=?").get(legacyId),
    ).toBeTruthy();
    db.close();
  } finally {
    await alice.close();
    await bob.close();
    await guest.close();
  }
});
test("responsive module previews and login prompt without polluting real records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await page.getByRole("button", { name: "浏览示例日记", exact: true }).click();
  await expect(page.getByText("你正在浏览示例菜谱")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "番茄慢炖牛腩", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/mobile-menu.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "番茄慢炖牛腩", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("食材清单");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "回到真实记录", exact: true }).click();
  await page.getByRole("button", { name: "我的空间", exact: false }).click();
  await expect(page.getByLabel("邮箱", { exact: true })).toBeVisible();
});

test("mobile ordering keeps quantities through filters and module switches; exports the chosen recipes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await page.getByRole("button", { name: "浏览示例日记", exact: true }).click();
  const beef = page.getByRole("article", {
    name: "菜品 番茄慢炖牛腩",
    exact: true,
  });
  await beef
    .getByRole("button", { name: "加入菜单 番茄慢炖牛腩", exact: true })
    .click();
  await beef
    .getByRole("button", { name: "增加一份 番茄慢炖牛腩", exact: true })
    .click();
  await page
    .getByRole("complementary", { name: "菜品分类" })
    .getByRole("button", { name: /甜点/ })
    .click();
  await expect(beef).toHaveCount(0);
  await page
    .getByRole("button", { name: "加入菜单 抹茶巴斯克", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "已选菜单" })).toContainText(
    "已选 2 道菜，共 3 份",
  );
  await page.getByLabel("搜索日记").fill("不存在的甜点");
  await expect(
    page.getByRole("heading", { name: "还没找到这份美味" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "已选菜单" })).toContainText(
    "共 3 份",
  );
  await page.getByRole("button", { name: "清除筛选" }).click();
  await page.getByRole("button", { name: "查看菜单", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("番茄慢炖牛腩");
  await expect(dialog).toContainText("抹茶巴斯克");
  await expect(dialog).not.toContainText("一人份的日式咖喱");
  await dialog
    .getByRole("button", { name: "减少一份 番茄慢炖牛腩", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "导出备菜清单", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^tabelog-menu-/);
  const { readFile } = await import("node:fs/promises");
  const text = await readFile((await file.path())!, "utf8");
  expect(text).toContain("番茄慢炖牛腩 × 1 份");
  expect(text).toContain("牛腩 500 克");
  expect(text).not.toContain("一人份的日式咖喱");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "探店日记", exact: true }).click();
  await expect(page.getByRole("region", { name: "店铺地图" })).toBeVisible();
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await expect(page.getByRole("region", { name: "已选菜单" })).toContainText(
    "已选 2 道菜，共 2 份",
  );
  await page.getByRole("button", { name: "查看菜单", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "清空", exact: true })
    .click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看菜单", exact: true }),
  ).toBeDisabled();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("map is above the list on phone and desktop; markers and store rows select each other", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "浏览示例日记", exact: true }).click();
  const map = page.getByRole("region", { name: "店铺地图" });
  const list = page.getByLabel("店铺列表", { exact: true });
  await expect(map.locator(".leaflet-container")).toBeVisible();
  let mapBox = await map.boundingBox(),
    listBox = await list.boundingBox();
  expect(mapBox!.y + mapBox!.height).toBeLessThan(listBox!.y);
  await map.locator("button.map-pin").filter({ hasText: "5" }).first().click();
  await expect(
    page.getByRole("article", { name: "店铺 巷口的面包房", exact: true }),
  ).toHaveAttribute("data-selected", "true");
  const second = page.getByRole("article", {
    name: "店铺 山野食堂",
    exact: true,
  });
  await second
    .getByRole("button", { name: "地图定位 山野食堂", exact: true })
    .click();
  await expect(second).toHaveAttribute("data-selected", "true");
  await expect(
    map.locator('button.map-pin[aria-label="地图店铺：山野食堂"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    map.getByRole("button", { name: "查看选中店铺 山野食堂", exact: true }),
  ).toBeVisible();
  await map
    .getByRole("button", { name: "查看选中店铺 山野食堂", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("山野食堂");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("地图服务").selectOption("google");
  await expect(
    map.getByRole("status").filter({ hasText: "尚未配置密钥" }),
  ).toBeVisible();
  await map
    .getByRole("button", { name: "使用 OpenStreetMap", exact: true })
    .click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  mapBox = await map.boundingBox();
  listBox = await list.boundingBox();
  expect(mapBox!.y + mapBox!.height).toBeLessThan(listBox!.y);
  const rows = list.getByRole("article");
  const first = await rows.nth(0).boundingBox(),
    next = await rows.nth(1).boundingBox();
  expect(Math.abs(first!.y - next!.y)).toBeLessThan(2);
  expect(next!.x).toBeGreaterThan(first!.x);
  await page.getByRole("button", { name: "我的菜单", exact: true }).click();
  await page
    .getByRole("article", { name: "菜品 番茄慢炖牛腩", exact: true })
    .getByRole("button", { name: "加入菜单 番茄慢炖牛腩", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "今日已选菜单" }),
  ).toContainText("番茄慢炖牛腩");
  await expect(
    page
      .getByRole("complementary", { name: "今日已选菜单" })
      .getByRole("button", { name: "导出备菜清单", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "已选菜单" }),
  ).not.toBeVisible();
});
