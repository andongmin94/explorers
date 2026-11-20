import { expect, test, type Page } from "@playwright/test";

// The transaction explorer's flows (React port): stepping, the guided stops,
// the predictions that hide their answers, the comparison and the keyboard.

/** Collect page errors and console errors while the test runs. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** Click 다음 사건 until the event counter reads `index`. */
async function stepTo(page: Page, index: number) {
  const count = page.locator("#step-count");
  for (let i = 0; i < 20; i++) {
    const now = Number(await count.textContent());
    if (now >= index) return;
    await page.locator('[data-action="next"]').click();
    await expect(count).toHaveText(String(now + 1).padStart(2, "0"), { timeout: 10_000 });
    await expect(page.locator('[data-action="next"]')).toBeEnabled({ timeout: 10_000 });
  }
}

test.use({ reducedMotion: "reduce" });

for (const path of [
  "/transaction/",
  "/transaction/deadlock.html",
  "/transaction/?lesson=repeatable-read",
  "/transaction/?lesson=write-skew",
]) {
  test(`${path} plays to the end without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("#eyebrow")).toContainText("시작 전");
    await page.locator('[data-action="guided"]').click();
    await page.locator('[data-action="play"]').click();
    await expect(page.locator('[data-role="conclusion"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#lesson-pages")).toContainText("핵심 정리");
    expect(errors).toEqual([]);
  });
}

test.describe("transaction lessons", () => {
  test("lost update: the prediction at T1's commit, then T2 writes 9", async ({ page }) => {
    await page.goto("/transaction/");
    await stepTo(page, 9);
    await page.locator('[data-action="predict"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("T2가 커밋한 뒤 최종 확정 재고는 몇 개일까요?");
    await expect(sheet).not.toContainText("정답");
    await sheet.locator('[data-answer="9"]').click();
    await expect(sheet).toContainText("맞았습니다.");
    await sheet.locator('[data-action="quiz-continue"]').click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#step-count")).toHaveText("10", { timeout: 10_000 });
    await expect(page.locator("#lesson-title")).toHaveText("T2가 기다린 뒤에도 9를 씀", {
      timeout: 10_000,
    });
  });

  test("deadlock: rollback, then T1's B is 19; same order commits both", async ({ page }) => {
    await page.goto("/transaction/deadlock.html");
    await stepTo(page, 8);
    await page.locator('[data-action="predict"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("T1의 B UPDATE가 재개되면 B의 미확정 값은?");
    await sheet.locator('[data-answer="19"]').click();
    await expect(sheet).toContainText("맞았습니다.");
    await sheet.locator('[data-action="quiz-continue"]').click();
    await expect(page.locator("#status")).toHaveText("T1이 B 잠금 보유 · 미확정 19", {
      timeout: 10_000,
    });
    await page.locator('header [data-action="compare"]').click();
    await expect(page.getByRole("dialog")).toContainText("커밋 2 · 롤백 0");
    await page.getByRole("dialog").locator('[data-action="try-other"]').click();
    await expect(page.locator('[data-order="same"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#step-count")).toHaveText("00");
  });

  test("repeatable read: the waiting UPDATE fails with 40001", async ({ page }) => {
    await page.goto("/transaction/?lesson=repeatable-read");
    await page.locator('[data-mode="rr"]').click();
    await expect(page.locator("#stage-tag")).toHaveText("REPEATABLE READ");
    await stepTo(page, 8);
    await expect(page.locator("#lesson-title")).toHaveText("T2의 UPDATE가 40001 오류로 실패");
  });

  test("keyboard: → steps, ← steps back, R resets", async ({ page }) => {
    await page.goto("/transaction/");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#step-count")).toHaveText("01");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#step-count")).toHaveText("02");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#step-count")).toHaveText("01");
    await page.keyboard.press("r");
    await expect(page.locator("#step-count")).toHaveText("00");
    await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "재생");
  });
});
