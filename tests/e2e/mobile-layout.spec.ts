import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("welcome and studio remain usable on a phone viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Starter workflows" })).toBeVisible();
  await expect(page.locator(".template-card").first()).toBeVisible();
  expect(
    await page
      .locator(".template-card")
      .first()
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth;
      }),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page
    .getByRole("button", { name: /open .* in studio/i })
    .first()
    .click();
  await expect(page.getByLabel("Mobile editor controls")).toBeVisible();
  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();
  await expect(page.getByLabel("Compile target").last()).toBeVisible();

  await page.getByRole("button", { name: "Toggle library" }).click();
  await expect(page.getByLabel("Node and template palette")).toBeVisible();
  const paletteBox = await page.getByLabel("Node and template palette").boundingBox();
  expect(paletteBox?.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Close open panel" }).click();
  await expect(page.getByLabel("Node and template palette")).toBeHidden();

  await page.getByRole("button", { name: "YAML source view" }).last().click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await page.getByRole("button", { name: "Compile" }).click();
  await expect(page.getByLabel("Compiled workflow output")).toBeVisible();

  const outputBox = await page.getByLabel("Compiled workflow output").boundingBox();
  expect(outputBox?.x).toBeGreaterThanOrEqual(0);
  expect((outputBox?.x ?? 0) + (outputBox?.width ?? 0)).toBeLessThanOrEqual(390);
});
