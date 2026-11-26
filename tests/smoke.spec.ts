import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/protocol/",
  "/cpu/",
  "/cpu/?lesson=sjf",
  "/cpu/?lesson=srtf",
  "/memory/",
  "/transaction/",
  "/transaction/deadlock.html",
  "/disk/",
  "/git/",
];

/** Collect page errors and console errors while the test runs. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

for (const path of PAGES) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
}

test("protocol: the start screen shows the lesson's network at rest, and reset returns to it", async ({
  page,
}) => {
  await page.goto("/protocol/");
  const shown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<SVGGElement>("svg.network .node")]
        .filter((node) => getComputedStyle(node).opacity === "1")
        .map((node) => node.dataset.node)
        .sort(),
    );
  const cables = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll<SVGGElement>("svg.network .link")].filter(
          (link) => link.style.visibility !== "hidden",
        ).length,
    );
  const lesson = ["client", "dns", "internet", "router", "web"];
  await expect.poll(shown).toEqual(lesson);
  await expect.poll(cables).toBeGreaterThanOrEqual(4);
  await page.locator('[data-action="toggle"]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-action="reset"]').click();
  await expect.poll(shown, { timeout: 5_000 }).toEqual(lesson);
  await expect.poll(cables).toBeGreaterThanOrEqual(4);
});

test.describe("CPU lesson", () => {
  test("steps, plays a move and pauses at a guided stop", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/cpu/");
    const clock = page.locator("#clock");
    await expect(clock).toHaveText("0");
    await page.locator('[data-action="step"]').click();
    // The arrival moves P1 to the queue, then to the CPU.
    await expect(page.locator("#status-text")).toHaveText(/P1 실행 중/, { timeout: 10_000 });
    await page.locator('[data-action="step"]').click();
    await expect(clock).toHaveText("1");
    // Play (once the move has landed): the guided switch stops at the next 핵심 장면 (2 ms).
    const play = page.locator('[data-action="play"]');
    await expect(play).toHaveAttribute("aria-label", "이어서 재생", { timeout: 10_000 });
    await play.click();
    await expect(clock).toHaveText("2", { timeout: 15_000 });
    await expect(page.locator('[data-action="play"]')).toHaveAttribute(
      "aria-label",
      "이어서 재생",
      { timeout: 15_000 },
    );
    await expect(page.locator("#explanation")).toContainText("핵심 장면 2/7");
    expect(errors).toEqual([]);
  });

  test("keyboard: → steps, ← steps back, R resets", async ({ page }) => {
    await page.goto("/cpu/");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#clock")).toHaveText("1", { timeout: 10_000 });
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#clock")).toHaveText("0");
    await page.keyboard.press("r");
    await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "학습 시작");
  });

  test("a prediction hides the answer until it is given", async ({ page }) => {
    await page.goto("/cpu/");
    await page.locator('[data-action="predict"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("2 ms, 다음 CPU는 누구에게 돌아갈까요?");
    await expect(sheet).not.toContainText("정답");
    await sheet.locator('[data-answer="P2"]').click();
    await expect(sheet).toContainText("맞았습니다.");
    await sheet.locator('[data-number="1"]').click();
    await sheet.locator('[data-action="quiz-continue"]').click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#clock")).toHaveText("2", { timeout: 10_000 });
  });

  test("the comparison opens and switches method", async ({ page }) => {
    await page.goto("/cpu/?lesson=sjf");
    await page.locator('header [data-action="compare"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("SJF의 평균 대기가 3 ms 짧습니다");
    await sheet.locator('[data-action="try-other"]').click();
    await expect(page.locator("#algo-tag")).toHaveText("SJF · 비선점");
  });
});
