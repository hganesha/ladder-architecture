import { expect, test } from "@playwright/test";

test.use({ launchOptions: { channel: "chrome" } });

test("group primitive contains members and exposes an aggregate boundary", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();
  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();

  await page.getByRole("button", { name: /group bounded sequential or parallel phase/i }).click();
  await expect(page.getByLabel("Group: Execution group")).toBeVisible();
  await page.getByRole("button", { name: /agent one focused role and prompt/i }).click();
  await page.getByRole("button", { name: /agent one focused role and prompt/i }).click();

  const group = page.getByLabel("Group: Execution group");
  await expect(group).toContainText("2 members");
  await expect(group).toContainText("aggregate exit");
  await expect(page.locator(".group-internal-edge")).toHaveCount(4);
  const groupBox = await group.boundingBox();
  const memberBoxes = await page
    .locator(".task-node")
    .filter({ hasText: "Agent" })
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      }),
    );
  expect(groupBox).not.toBeNull();
  for (const member of memberBoxes) {
    expect(member.left).toBeGreaterThan(groupBox?.x ?? 0);
    expect(member.top).toBeGreaterThan(groupBox?.y ?? 0);
    expect(member.right).toBeLessThan((groupBox?.x ?? 0) + (groupBox?.width ?? 0));
    expect(member.bottom).toBeLessThan((groupBox?.y ?? 0) + (groupBox?.height ?? 0));
  }

  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({ path: "artifacts/qa/group-primitive.png", fullPage: true });
});
