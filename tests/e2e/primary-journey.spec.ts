import { expect, test } from "@playwright/test";

test("template to repair to compiled workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /design agent workflows visually/i })).toBeVisible();
  await page.getByRole("button", { name: /open draft, critique/i }).click();
  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();
  await page.getByRole("button", { name: /yaml/i }).click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await page.getByRole("button", { name: /compile/i }).click();
  await expect(page.getByRole("heading", { name: /compiled prompt/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /copy prompt/i })).toBeEnabled();
});
