import { expect, test, type Page } from "@playwright/test";

/** Collect page errors and console errors while the test runs. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

for (const path of ["/disk/", "/disk/?lesson=scan-look", "/disk/?lesson=cscan"]) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#disk-scene svg")).toBeVisible();
    await expect(page.locator("#lesson-title")).toHaveText(/\?$/);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
}

test.describe("disk lesson", () => {
  test("plays one request through its four stages and lands", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/disk/");
    await expect(page.locator("#lcd-total")).toHaveText(/^0/);
    await page.locator('[data-action="next"]').click();
    await expect(page.locator("#eyebrow")).toHaveText(/처리 중/);
    await expect(page.locator("#status")).toHaveText("53 → 98 · 45칸 이동 완료", {
      timeout: 10_000,
    });
    await expect(page.locator("#lcd-head")).toHaveText(/^98/);
    await expect(page.locator("#lcd-total")).toHaveText(/^45/);
    await expect(page.locator("#log-count")).toHaveText("1");
    expect(errors).toEqual([]);
  });

  test("keyboard: → and ← move by a request, R resets", async ({ page }) => {
    await page.goto("/disk/?lesson=cscan&algo=cscan");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    // C-SCAN: 14 → 0 → 199 → 183, the return counted.
    await expect(page.locator("#status")).toHaveText("14 → 0 → 199 → 183 · 229칸 이동 완료");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#lcd-head")).toHaveText(/^14/);
    await page.keyboard.press("r");
    await expect(page.locator("#lcd-head")).toHaveText(/^53/);
  });

  test("a prediction hides the answer until it is given, then plays it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/disk/?lesson=scan-look");
    await page.locator('[data-action="predict"]').click();
    const sheet = page.locator('[data-slot="dialog-content"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-action="quiz-continue"]')).toHaveCount(0);
    await sheet.locator('[data-answer="3"]').click();
    await expect(sheet).toContainText("맞았습니다.");
    await sheet.locator('[data-action="quiz-continue"]').click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator("#status")).toHaveText("53 → 37 · 16칸 이동 완료", {
      timeout: 10_000,
    });
    expect(errors).toEqual([]);
  });

  test("the comparison shows both totals and switches method", async ({ page }) => {
    await page.goto("/disk/?lesson=cscan");
    await page.locator('[data-action="compare"]').first().click();
    const sheet = page.locator('[data-slot="dialog-content"]');
    await expect(sheet).toContainText("236");
    await expect(sheet).toContainText("386");
    await expect(sheet).toContainText("53 → 37 → 14 → (0) → (199) → 183");
    await sheet.locator('[data-action="try-other"]').click();
    await expect(page.locator('[data-algorithm="cscan"]')).toHaveAttribute("aria-checked", "true");
  });

  test("the end of a run shows 정리 with recall questions", async ({ page }) => {
    await page.goto("/disk/?algo=sstf&step=8");
    await expect(page.locator("#eyebrow")).toContainText("정리");
    await expect(page.locator("#lesson-title")).toHaveText("모든 요청 완료 · 236칸");
    await expect(page.locator('[data-action="compare"][data-conclusion]')).toBeVisible();
  });
});
