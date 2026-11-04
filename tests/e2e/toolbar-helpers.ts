import type { Page } from "@playwright/test";
export async function openDiaryTool(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "菜单工具", exact: true }).click();
  await button.click();
}
