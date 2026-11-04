import { openDiaryTool } from "./toolbar-helpers";
import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { parseRecipes } from "../../lib/recipe-import";
import { DEMO_ENTRIES, DEMO_RECIPES } from "../../lib/demo";
import type { Entry, MealRecord } from "../../lib/types";
const headers = { Origin: "http://127.0.0.1:3100" };
async function signup(context: BrowserContext, name: string) {
  const r = await context.request.post("/api/session", {
    headers: { ...headers, "X-Forwarded-For": "198.51.100.44" },
    data: {
      action: "register",
      name,
      email: `${name}@example.com`,
      password: "Abcd1234",
    },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).user;
}
const draft = parseRecipes([
  {
    name: "番茄炒蛋",
    ingredients: "鸡蛋 3 个\n番茄 2 个",
    steps: "1. 鸡蛋炒熟。\n2. 番茄炒软后拌匀。",
    minutes: 15,
    servings: 2,
    difficulty: "简单",
  },
])[0];
test("inline AI drafts, article import, fun prices and repeated meal reviews persist with owner/photo permissions", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(90000);
  await signup(context, "assist-owner");
  const guest = await browser.newContext(),
    other = await browser.newContext();
  try {
    await signup(other, "assist-other");
    expect(
      (
        await guest.request.post("/api/recipes/assist", {
          headers,
          data: { mode: "name", content: "番茄炒蛋" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await context.request.post("/api/recipes/assist", {
          headers: { Origin: "https://attacker.invalid" },
          data: { mode: "name", content: "番茄炒蛋" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post("/api/recipes/assist", {
          headers,
          data: { mode: "article", content: "https://127.0.0.1/admin" },
        })
      ).status(),
    ).toBe(400);
    const writes: string[] = [];
    page.on("request", (r) => {
      if (
        /\/api\/entries(?:\/[^/]+)?$/.test(new URL(r.url()).pathname) &&
        r.method() !== "GET"
      )
        writes.push(r.method());
    });
    await page.goto("/menu");
    await page
      .getByRole("button", { name: "写下第一道菜", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await page.getByLabel("菜名", { exact: true }).fill("番茄炒蛋");
    await page
      .getByRole("button", { name: "AI 快速填入", exact: true })
      .click();
    await expect(
      page.getByLabel("快速填入 API 地址", { exact: true }),
    ).toHaveValue("https://api.deepseek.com");
    await page
      .getByLabel("快速填入 API Key", { exact: true })
      .fill("synthetic-inline-test-key");
    await page.getByLabel("快速填入 API Key", { exact: true }).press("Enter");
    await expect(form).toContainText("AI 接口已保存");
    expect(writes).toEqual([]);
    let finish: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/recipes/assist", async (route) => {
      await pending;
      await route.fulfill({
        json: {
          draft: { ...draft, visibility: "public", price: 999 },
          method: "name",
        },
      });
    });
    await page.getByLabel("价格金额", { exact: true }).fill("2");
    await page.getByLabel("价格单位", { exact: true }).selectOption("HUG");
    await page
      .getByRole("button", { name: "AI 快速填入", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "保存这份美味", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("做法步骤", { exact: true })
      .fill("这句是生成期间自己写的做法。");
    finish();
    await expect(page.getByLabel("食材与用量", { exact: true })).toHaveValue(
      draft.recipe!.ingredients,
    );
    await expect(page.getByLabel("做法步骤", { exact: true })).toHaveValue(
      "这句是生成期间自己写的做法。",
    );
    await expect(page.getByLabel("价格金额", { exact: true })).toHaveValue("2");
    await expect(
      page.getByRole("button", { name: "私人收藏 仅自己可见", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.unroute("**/api/recipes/assist");
    const source = {
      url: "https://www.xiaohongshu.com/explore/example",
      platform: "小红书",
      title: "平台上的家常菜",
    };
    await page.route("**/api/recipes/assist", (route) => {
      expect(route.request().postDataJSON().mode).toBe("article");
      return route.fulfill({
        json: {
          draft: { ...draft, name: "平台番茄炒蛋" },
          source,
          method: "structured",
        },
      });
    });
    await page
      .getByRole("button", { name: "文章菜谱导入", exact: true })
      .click();
    await page
      .getByLabel("文章链接或菜谱正文", { exact: true })
      .fill("小红书分享 https://www.xiaohongshu.com/explore/example");
    await page
      .getByRole("checkbox", { name: "替换已有内容", exact: true })
      .check();
    await page
      .getByRole("button", { name: "整理并填入表单", exact: true })
      .click();
    await expect(page.getByLabel("菜名", { exact: true })).toHaveValue(
      "平台番茄炒蛋",
    );
    await expect(form.getByRole("link", { name: /小红书/ })).toHaveAttribute(
      "href",
      source.url,
    );
    expect(writes).toEqual([]);
    await page
      .getByRole("button", { name: "保存这份美味", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(writes).toEqual(["POST"]);
    await page.reload();
    await expect(
      page.getByRole("article", { name: "菜品 平台番茄炒蛋", exact: true }),
    ).toContainText("2 个拥抱");
    let entry: Entry = (
      await (await context.request.get("/api/entries?scope=mine")).json()
    ).entries.find((e: Entry) => e.name === "平台番茄炒蛋");
    expect(entry.source).toEqual(source);
    const path = `/api/entries/${entry.id}/meals`;
    expect((await guest.request.get(path)).status()).toBe(404);
    expect((await other.request.get(path)).status()).toBe(404);
    expect(
      (
        await other.request.post(path, {
          headers,
          multipart: { record: JSON.stringify(draft) },
        })
      ).status(),
    ).toBe(404);
    await page
      .getByRole("button", { name: "平台番茄炒蛋", exact: true })
      .click();
    await page.getByRole("button", { name: "再吃一次", exact: true }).click();
    await page
      .getByLabel("这次的评价", { exact: true })
      .fill("第二次少放盐，更好吃了。");
    await page.getByRole("button", { name: "这次 3 星", exact: true }).click();
    await page.getByLabel("价格金额", { exact: true }).fill("1.5");
    await page.getByLabel("价格单位", { exact: true }).selectOption("TEA");
    const photo = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#f0644b" },
    })
      .png()
      .toBuffer();
    await page.getByLabel("这次用餐照片", { exact: true }).setInputFiles({
      name: "meal.png",
      mimeType: "image/png",
      buffer: photo,
    });
    await expect(
      page.getByAltText("这次用餐新照片 1", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "保存这次用餐", exact: true })
      .click();
    await expect(form.getByLabel("用餐统计", { exact: true })).toContainText(
      "2 次",
    );
    await expect(form.getByLabel("用餐统计", { exact: true })).toContainText(
      "4.0",
    );
    await expect(
      form.getByLabel("每次用餐评价", { exact: true }),
    ).toContainText("第二次少放盐，更好吃了。");
    let meals = await (await context.request.get(path)).json();
    expect(meals.stats.count).toBe(2);
    expect(meals.stats.averageRating).toBe(4);
    expect((await guest.request.get("/api/export?kind=recipe")).status()).toBe(
      401,
    );
    const exported = await (
      await context.request.get("/api/export?kind=recipe")
    ).json();
    expect(exported.mealRecords).toHaveLength(1);
    expect(exported.mealRecords[0].review).toBe("第二次少放盐，更好吃了。");
    expect(
      (await (await other.request.get("/api/export?kind=recipe")).json())
        .mealRecords,
    ).toHaveLength(0);
    const record: MealRecord = meals.records[0];
    expect(record.currency).toBe("TEA");
    expect(record.photos).toHaveLength(1);
    expect((await context.request.get(record.photos[0].url)).status()).toBe(
      200,
    );
    expect((await guest.request.get(record.photos[0].url)).status()).toBe(404);
    expect((await other.request.get(record.photos[0].url)).status()).toBe(404);
    expect(
      (
        await context.request.post(path, {
          headers: { Origin: "https://attacker.invalid" },
          multipart: { record: JSON.stringify(record) },
        })
      ).status(),
    ).toBe(403);
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "平台番茄炒蛋吃过 2 次，查看每次评价",
        exact: true,
      }),
    ).toBeVisible();
    await openDiaryTool(page, "吃过的统计");
    await expect(page.getByRole("dialog")).toContainText("累计吃过 / 次");
    await expect(page.getByRole("dialog")).toContainText("2 次");
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    entry = (
      await (await context.request.get(`/api/entries/${entry.id}`)).json()
    ).entry;
    const published = await context.request.put(`/api/entries/${entry.id}`, {
      headers,
      multipart: {
        entry: JSON.stringify({
          ...entry,
          visibility: "public",
          keepPhotoIds: [],
        }),
        updatedAt: entry.updatedAt,
      },
    });
    expect(published.status()).toBe(200);
    entry = (await published.json()).entry;
    expect((await guest.request.get(path)).status()).toBe(200);
    expect((await guest.request.get(record.photos[0].url)).status()).toBe(200);
    expect(
      (
        await other.request.delete(`${path}/${record.id}`, { headers })
      ).status(),
    ).toBe(404);
    const shared = await context.request.put("/api/menu-share", {
      headers,
      data: { title: "有趣价格菜单", entryIds: [entry.id] },
    });
    expect(shared.status()).toBe(200);
    const token = (await shared.json()).share.token;
    const publicMenu = await guest.request.get(`/api/menus/${token}`);
    expect((await publicMenu.json()).menu.dishes[0].priceLabel).toBe(
      "2 个拥抱",
    );
    // Pagination includes all repeats exactly once, even when dates match.
    const db = new DatabaseSync("/tmp/tabelog-e2e/diary.sqlite");
    try {
      const insert = db.prepare(
        "INSERT INTO meal_records(id,entry_id,data,visited_at,created_at) VALUES(?,?,?,?,?)",
      );
      for (let i = 0; i < 52; i++) {
        const r = {
          ...record,
          id: randomUUID(),
          review: `分页记录 ${i}`,
          photos: [],
          createdAt: `2025-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
          visitedAt: "2025-01-01",
        };
        insert.run(r.id, entry.id, JSON.stringify(r), r.visitedAt, r.createdAt);
      }
    } finally {
      db.close();
    }
    meals = await (await context.request.get(path)).json();
    expect(meals.records).toHaveLength(50);
    expect(meals.stats.count).toBe(54);
    const second = await (
      await context.request.get(
        `${path}?before=${encodeURIComponent(JSON.stringify(meals.next))}`,
      )
    ).json();
    expect(second.records).toHaveLength(3);
    expect(
      new Set([...meals.records, ...second.records].map((r) => r.id)).size,
    ).toBe(53);
    expect(
      (
        await context.request.delete(`${path}/${record.id}`, { headers })
      ).status(),
    ).toBe(200);
    expect((await guest.request.get(record.photos[0].url)).status()).toBe(404);
    // Restaurants use the same history and permission rules.
    const visit = await context.request.post("/api/entries", {
      headers,
      multipart: {
        entry: JSON.stringify({
          ...draft,
          kind: "visit",
          name: "常去的面馆",
          lat: 31.23,
          lng: 121.47,
          address: "上海",
          city: "上海",
          price: 25,
          currency: "CNY",
        }),
      },
    });
    expect(visit.status()).toBe(201);
    const store: Entry = (await visit.json()).entry;
    expect(
      (
        await context.request.post(`/api/entries/${store.id}/meals`, {
          headers,
          multipart: {
            record: JSON.stringify({
              visitedAt: "2025-01-01",
              rating: 4,
              review: "面条依旧筋道。",
              price: 1,
              currency: "CUSTOM",
              customUnit: "次洗碗",
            }),
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await (await context.request.get(`/api/entries/${store.id}`)).json())
        .entry.mealStats.count,
    ).toBe(2);
    expect(
      (
        await context.request.delete(`/api/entries/${entry.id}`, { headers })
      ).status(),
    ).toBe(200);
    expect((await guest.request.get(path)).status()).toBe(404);
    const check = new DatabaseSync("/tmp/tabelog-e2e/diary.sqlite");
    try {
      expect(
        (
          check
            .prepare("SELECT count(*) AS n FROM meal_records WHERE entry_id=?")
            .get(entry.id) as { n: number }
        ).n,
      ).toBe(0);
    } finally {
      check.close();
    }
  } finally {
    await guest.close();
    await other.close();
  }
});

test("random and favorite draws work in menu and map, and primary action lettering follows all themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/tile\.openstreetmap\.org|basemaps\.cartocdn\.com/, (r) =>
    r.abort(),
  );
  await page.goto("/menu");
  await openDiaryTool(page, "浏览示例日记");
  await openDiaryTool(page, "今天吃什么");
  await page.getByRole("button", { name: "收藏里吃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "收藏里吃", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "开始抽签", exact: true }).click();
  const name = await page
    .getByRole("list", { name: "抽签结果", exact: true })
    .locator("h3")
    .first()
    .textContent();
  expect(DEMO_RECIPES.filter((e) => e.favorite).map((e) => e.name)).toContain(
    name,
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page
    .getByLabel("搜索日记", { exact: true })
    .fill(DEMO_RECIPES.find((e) => !e.favorite)!.name);
  await openDiaryTool(page, "今天吃什么");
  await page.getByRole("button", { name: "收藏里吃", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("当前没有收藏的菜谱");
  await expect(
    page.getByRole("button", { name: "开始抽签", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "随机吃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开始抽签", exact: true }),
  ).toBeVisible();
  for (const theme of ["coral", "mint", "midnight", "lavender", "classic"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    expect(
      await page
        .getByRole("button", { name: "开始抽签", exact: true })
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(255, 255, 255)");
  }
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "美食地图", exact: true }).click();
  await openDiaryTool(page, "今天吃什么");
  await expect(page.getByRole("dialog")).toContainText("今天去哪吃");
  await expect(
    page.getByRole("radio", { name: "抽 2 道菜", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "收藏里吃", exact: true }).click();
  await page.getByRole("button", { name: "开始抽签", exact: true }).click();
  const store = await page
    .getByRole("list", { name: "抽签结果", exact: true })
    .locator("h3")
    .first()
    .textContent();
  expect(DEMO_ENTRIES.filter((e) => e.favorite).map((e) => e.name)).toContain(
    store,
  );
  await page.getByRole("button", { name: "去这家店", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".workspace-selected").filter({ hasText: store! }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(
      page.getByRole("button", { name: "菜单工具", exact: true }),
    ).toBeVisible();
  }
});
