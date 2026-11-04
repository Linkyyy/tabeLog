import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { DEMO_RECIPES, DEMO_ENTRIES } from "../../lib/demo";
import { openDiaryTool } from "./toolbar-helpers";
test("one toolbar row and one content scroll keep long menus, filters and dropdown actions usable", async ({
  page,
}) => {
  test.setTimeout(60000);
  const entries = Array.from({ length: 40 }, (_, i) => ({
    ...DEMO_RECIPES[i % DEMO_RECIPES.length],
    id: randomUUID(),
    name: `菜谱 ${i + 1}`,
    visibility: "public",
  }));
  const stores = Array.from({ length: 40 }, (_, i) => ({
    ...DEMO_ENTRIES[i % DEMO_ENTRIES.length],
    id: randomUUID(),
    name: `店铺 ${i + 1}`,
    visibility: "public",
  }));
  await page.route("**/api/entries?scope=public", (route) =>
    route.fulfill({ json: { entries: [...entries, ...stores] } }),
  );
  await page.route(
    /tile\.openstreetmap\.org|basemaps\.cartocdn\.com/,
    (route) => route.abort(),
  );
  await page.goto("/menu");
  await expect(
    page.getByRole("article", { name: "菜品 菜谱 1", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 568 });
    const controls = page
      .getByRole("main", { name: "我的菜单", exact: true })
      .locator(".unified-toolbar");
    const boxes = await controls
      .locator(
        ".toolbar-select,.compact-search-trigger,.favorites-filter,.diary-tools>summary",
      )
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { y: r.y + r.height / 2, x: r.x, right: r.right };
        }),
      );
    expect(
      Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)),
    ).toBeLessThan(5);
    expect(boxes.every((b) => b.x >= 0 && b.right <= width)).toBe(true);
    await expect(
      page.getByRole("button", { name: "今天吃什么", exact: true }),
    ).toHaveCount(0);
    // Hidden native details children are not in the accessible tree.
    await page.getByRole("button", { name: "菜单工具", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "今天吃什么", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "今天吃什么", exact: true })
      .press("Escape");
    const scrolls = await page
      .getByRole("main", { name: "我的菜单", exact: true })
      .evaluate((root) =>
        Array.from(root.querySelectorAll<HTMLElement>("*"))
          .filter((node) => {
            const r = node.getBoundingClientRect(),
              style = getComputedStyle(node);
            return (
              r.width &&
              r.height &&
              ["auto", "scroll"].includes(style.overflowY) &&
              node.scrollHeight > node.clientHeight + 1
            );
          })
          .map((node) => node.id || node.className),
      );
    expect(scrolls).toEqual(["menu-scroll-content"]);
  }
  // Filling the desktop basket must not introduce a second scroll container.
  await page.setViewportSize({ width: 1440, height: 568 });
  for (let i = 1; i <= 20; i++)
    await page
      .getByRole("button", { name: `加入菜单 菜谱 ${i}`, exact: true })
      .click();
  expect(
    await page
      .locator(".desktop-basket .basket-items")
      .evaluate((node) => getComputedStyle(node).overflowY),
  ).toBe("visible");
  await page
    .locator(".menu-scroll")
    .evaluate((node) => (node.scrollTop = node.scrollHeight));
  await expect(page.locator(".dish-row").last()).toBeInViewport();
  await page.locator(".menu-scroll").evaluate((node) => (node.scrollTop = 0));
  await openDiaryTool(page, "今天吃什么");
  await expect(page.getByRole("dialog")).toContainText("今天吃什么");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "美食地图", exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page
    .getByRole("slider", { name: "清单抽屉高度", exact: true })
    .press("End");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 568 });
    const controls = page
      .getByRole("region", { name: "店铺抽屉", exact: true })
      .locator(".unified-toolbar");
    const rects = await controls
      .locator(
        ".toolbar-select,.compact-search-trigger,.favorites-filter,.diary-tools>summary,.sheet-snap-buttons",
      )
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { x: r.x, right: r.right, y: r.y + r.height / 2 };
        }),
      );
    expect(rects.every((r) => r.x >= 0 && r.right <= width)).toBe(true);
    expect(
      Math.max(...rects.map((r) => r.y)) - Math.min(...rects.map((r) => r.y)),
    ).toBeLessThan(5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.getByLabel("料理分类", { exact: true }).selectOption("咖啡");
  await expect(
    page.getByRole("article", { name: "店铺 店铺 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "店铺 店铺 2", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await page
    .getByRole("slider", { name: "清单抽屉高度", exact: true })
    .press("Home");
  await openDiaryTool(page, "今天吃什么");
  await expect(page.getByRole("dialog")).toContainText("今天去哪吃");
});
