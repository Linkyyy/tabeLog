import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { rm } from "node:fs/promises";
test.beforeAll(async () => {
  await rm("/tmp/tabelog-e2e", { recursive: true, force: true });
});
test("private diary: authenticate, upload, read, edit, filter, map, export and delete", async ({
  page,
  request,
}) => {
  // External map services are deliberately offline in this test; data CRUD must still work.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  expect((await request.get("/api/entries")).status()).toBe(401);
  await page.goto("/");
  await page.getByLabel("日记密码").fill("wrong-password");
  await page.getByRole("button", { name: "打开我的日记" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "密码不正确" }),
  ).toBeVisible();
  await page.getByLabel("日记密码").fill("tabelog-test-password");
  await page.getByRole("button", { name: "打开我的日记" }).click();
  await expect(
    page.getByRole("heading", { name: "第一口心动，从这里开始。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "写下第一篇日记" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.getByLabel("美食足迹地图").click({ position: { x: 180, y: 150 } });
  await expect(page.getByText("位置已选择", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "店铺名称" }).fill("测试 · 旬味食堂");
  await page
    .getByRole("textbox", { name: "详细地址" })
    .fill("上海市徐汇区武康路 12 号");
  await page.getByRole("textbox", { name: "城市", exact: true }).fill("上海");
  await page.getByText("精确位置 · WGS-84").click();
  await page.getByLabel("纬度", { exact: true }).fill("31.2069");
  await page.getByLabel("经度", { exact: true }).fill("121.4379");
  await page.getByRole("button", { name: "4 星", exact: true }).click();
  await page.getByRole("button", { name: "心头好", exact: true }).click();
  await page.getByLabel("人均消费", { exact: true }).fill("88");
  await page
    .getByRole("textbox", { name: "写给这顿饭的几句话" })
    .fill("烤鱼很好吃。\n下次还想再来！");
  const png = await sharp({
    create: { width: 96, height: 96, channels: 3, background: "#b95136" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("添加照片", { exact: true })
    .setInputFiles({ name: "dinner.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("新照片 1")).toBeVisible();
  await page.getByRole("button", { name: "保存这份美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "测试 · 旬味食堂", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "测试 · 旬味食堂", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("烤鱼很好吃。");
  const photo = page.getByAltText("测试 · 旬味食堂的照片 1");
  await expect(photo).toBeVisible();
  const src = await photo.getAttribute("src");
  expect(src).toMatch(/^\/api\/photos\//);
  const image = await page.request.get(src!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/webp");
  await page.getByRole("button", { name: "编辑日记" }).click();
  await page
    .getByRole("textbox", { name: "店铺名称" })
    .fill("测试 · 旬味食堂（再访）");
  await page.getByRole("button", { name: "保存这份美味" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("搜索日记").fill("找不到的小店");
  await expect(
    page.getByRole("heading", { name: "还没找到这份美味" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await page.getByRole("button", { name: "只看心头好" }).click();
  await expect(
    page.getByRole("button", { name: "测试 · 旬味食堂（再访）", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "地图视图", exact: true }).click();
  await expect(page.getByLabel("地图服务")).toBeVisible();
  await page.getByLabel("地图服务").selectOption("google");
  await expect(
    page.getByRole("status").filter({ hasText: "尚未配置密钥" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "使用 OpenStreetMap" }).click();
  await page.getByRole("button", { name: "卡片视图" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出日记", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^tabelog-.*\.json$/,
  );
  await page
    .getByRole("button", { name: "测试 · 旬味食堂（再访）", exact: true })
    .click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await page.request.get(src!)).status()).toBe(404);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByLabel("日记密码")).toBeVisible();
  expect((await page.request.get("/api/entries")).status()).toBe(401);
});
test("CSRF is rejected; responsive demo is separate from real entries", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/session", {
    data: { password: "tabelog-test-password" },
    headers: { Origin: "https://wrong.example" },
  });
  expect(response.status()).toBe(403);
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("日记密码").fill("tabelog-test-password");
  await page.getByRole("button", { name: "打开我的日记" }).click();
  await page.getByRole("button", { name: "先看看示例" }).click();
  await expect(page.getByText("你正在浏览示例日记")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "山野食堂", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-diary.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({
    path: "test-results/desktop-diary.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "回到我的日记", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第一口心动，从这里开始。" }),
  ).toBeVisible();
});
