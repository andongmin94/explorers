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

  test("a 핵심 장면 shows its 오개념 note in the 해설", async ({ page }) => {
    await page.goto("/disk/?lesson=cscan&algo=cscan&step=3");
    const note = page.locator('[data-misconception="cscan-return"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText("229칸");
  });
});

test.describe("disk 직접 실험", () => {
  test("validates the input, applies it to the URL and runs it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/disk/?lesson=custom");
    await expect(page.locator("#lesson-title")).toHaveText("SSTF와 LOOK, 어느 쪽이 덜 움직일까?");
    await page.locator('[data-action="edit-input"]').first().click();
    const sheet = page.locator('[data-slot="dialog-content"]');
    await expect(sheet).toBeVisible();
    const queue = sheet.getByLabel("요청 큐 (도착 순서)");
    await queue.fill("10, 300");
    await sheet.locator('[data-action="apply-input"]').click();
    await expect(sheet).toContainText("‘300’은 0부터 199까지의 정수가 아닙니다");
    await queue.fill("120, 90, 150, 70");
    await sheet.getByLabel("시작 헤드").fill("100");
    await sheet.locator('[data-pick="a-scan"]').click();
    await sheet.locator('[data-action="apply-input"]').click();
    await expect(page).toHaveURL(
      /lesson=custom&head=100&max=199&dir=down&q=120,90,150,70&algs=scan,look/,
    );
    await expect(page.locator("#lesson-title")).toHaveText("SCAN과 LOOK, 어느 쪽이 덜 움직일까?");
    await expect(page.locator("#lcd-head")).toHaveText(/^100/);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#status")).toHaveText("100 → 90 · 10칸 이동 완료");
    expect(errors).toEqual([]);
  });

  test("a broken query falls back to the default input and says why", async ({ page }) => {
    await page.goto("/disk/?lesson=custom&head=999&q=5");
    await expect(page.locator("#custom-input-problem")).toContainText("기본 입력으로 엽니다");
    await expect(page.locator("#lcd-head")).toHaveText(/^53/);
  });
});
