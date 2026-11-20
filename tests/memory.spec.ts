import { expect, test, type Page } from "@playwright/test";

// The memory explorer's learning flows (React port of memory/).

const LESSONS = [
  "/memory/",
  "/memory/?lesson=opt",
  "/memory/?lesson=belady",
  "/memory/?lesson=clock",
];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const path of LESSONS) {
  test(`${path} steps to the end without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("#lcd-step")).toContainText("0");
    const next = page.locator('[data-action="next"]');
    while (await next.isEnabled()) await next.click();
    await expect(page.locator("#conclusion")).toBeVisible();
    await expect(page.locator("#now-pages")).toContainText("확인 문제");
    expect(errors).toEqual([]);
  });
}

test("lesson 01: steps, guided stop, keyboard", async ({ page }) => {
  await page.goto("/memory/");
  const step = page.locator("#lcd-step");
  await page.locator('[data-action="next"]').click();
  await expect(step).toContainText("1");
  await expect(page.locator("#status-text")).toHaveText(/1번째 A 접근 완료/);
  await expect(page.locator("#eyebrow")).toHaveText("핵심 장면 2/6 · FIFO");
  // Play stops at the next 핵심 장면 (4번째).
  await page.locator('[data-action="play"]').click();
  await expect(step).toContainText("4", { timeout: 15_000 });
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "재생");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ArrowLeft");
  await expect(step).toContainText("3");
  await page.keyboard.press("ArrowRight");
  await expect(step).toContainText("4");
  await page.keyboard.press("r");
  await expect(step).toContainText("0");
  await expect(page.locator('[data-action="play"]')).toContainText("학습 시작");
});

test("lesson 01: a victim prediction hides the answer until it is given", async ({ page }) => {
  await page.goto("/memory/?lesson=fifo-lru");
  await page.locator('#record-history button[data-seek="4"]').click();
  await expect(page.locator("#lcd-step")).toContainText("4");
  // The next access asks for the victim: no rank marks, no "다음 교체" sentence.
  await expect(page.locator("#memory-scene .mem-rank text")).toHaveCount(0);
  await page.locator('[data-tab="frames"]').click();
  await expect(page.locator("#frames-note")).toHaveText(
    "예측을 마치면 다음 교체 순서를 표시합니다.",
  );
  await page.locator('[data-tab="now"]').click();
  await page.locator('[data-action="predict"]').click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("5번째 접근은 페이지 D입니다. 어느 페이지를 내보낼까요?");
  await expect(sheet).not.toContainText("적재 1번째");
  await sheet.locator('[data-answer="B"]').click();
  await expect(sheet).toContainText("정답은 페이지 A입니다.");
  await expect(sheet).toContainText("적재 1번째");
  await sheet.locator('[data-action="quiz-continue"]').click();
  await expect(page.locator("#lcd-step")).toContainText("5");
  await expect(page.locator("#memory-scene .mem-rank text").first()).toBeAttached();
});

test("lesson 01: the outcome prediction masks what is in RAM", async ({ page }) => {
  await page.goto("/memory/");
  await page.locator('#record-history button[data-seek="5"]').click();
  await page.locator('[data-action="predict"]').click();
  await expect(page.getByRole("dialog")).toContainText("결과와 그 이유는?");
  await expect(page.locator("#memory-scene")).toHaveAttribute("data-masked", "true");
  await expect(page.locator("#memory-scene .mem-tokens")).toBeHidden();
  await page.getByRole("dialog").locator('[data-answer="fault-first"]').click();
  await expect(page.getByRole("dialog")).toContainText("맞았습니다.");
  await expect(page.locator("#memory-scene")).not.toHaveAttribute("data-masked", "true");
});

test("comparison: same numbers, replays a condition, returns to the fork", async ({ page }) => {
  await page.goto("/memory/?lesson=belady");
  await page.locator('[data-action="compare"]').first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("9부재");
  await expect(sheet).toContainText("10부재");
  await sheet.locator('[data-replay-mode="f4"]').click();
  await expect(page.locator('[data-mode="f4"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#memory-scene .mem-slot[data-slot]")).toHaveCount(4);
  await page.locator('[data-action="compare"]').first().click();
  await page.getByRole("dialog").locator('[data-action="turning-point"]').click();
  await expect(page.locator("#lcd-step")).toContainText("6");
});

test("clock: the hand and reference bits show in the scene", async ({ page }) => {
  await page.goto("/memory/?lesson=clock");
  await page.locator('#record-history button[data-seek="4"]').click();
  await expect(page.locator("#memory-scene .mem-hand")).toBeVisible();
  await expect(page.locator("#memory-scene")).toHaveAttribute("aria-label", /바늘은 프레임 1/);
});

test.describe("with motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("one access plays through its sub-stages and lands", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/memory/?lesson=clock");
    await page.locator('#record-history button[data-seek="3"]').click();
    await page.locator('[data-action="next"]').click();
    await expect(page.locator("#eyebrow")).toHaveText("4번째 접근 · 처리 중 · 클럭");
    await expect(page.locator('#stages [aria-current="step"]')).toBeAttached();
    await expect(page.locator("#status-text")).toHaveText(/참조 비트 1 → 0/, { timeout: 10_000 });
    await expect(page.locator("#status-text")).toHaveText(/4번째 D 접근 완료/, { timeout: 20_000 });
    await expect(page.locator("#lcd-counts")).toContainText("4부재");
    expect(errors).toEqual([]);
  });
});
