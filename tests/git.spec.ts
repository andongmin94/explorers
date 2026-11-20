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

for (const path of [
  "/git/",
  "/git/?lesson=auto-merge",
  "/git/?lesson=conflict",
  "/git/?lesson=rebase",
]) {
  test(`${path} loads without errors and fits the window`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("#lesson-title")).toHaveText(/\?$/);
    await page.waitForTimeout(500);
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflowX).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test.describe("Git lessons", () => {
  test("keyboard: → and ← move one event, R resets", async ({ page }) => {
    await page.goto("/git/");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#step-count")).toHaveText("02");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#step-count")).toHaveText("01");
    await page.keyboard.press("r");
    await expect(page.locator("#step-count")).toHaveText("00");
    await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "학습 시작");
  });

  test("a prediction hides the answer until it is given, then plays the event", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/git/?step=3");
    await page.locator('[data-action="predict"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("지금 git commit을 하면 main은 어느 커밋을 가리킬까요?");
    await expect(sheet).not.toContainText("정답");
    await sheet.locator('[data-answer="stay"]').click();
    await expect(sheet).toContainText("맞았습니다.");
    await sheet.locator('[data-action="verify"]').click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#step-count")).toHaveText("04");
    await expect(page.locator("#lesson-title")).toHaveText(/C1 생성/, { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("the conflict waits for a resolution, then git status stays unmerged", async ({ page }) => {
    await page.goto("/git/?lesson=conflict&step=9");
    const play = page.locator('[data-action="play"]');
    await expect(play).toHaveAttribute("aria-label", "해결안 선택");
    await expect(page.locator('[data-action="next"]')).toBeDisabled();
    await play.click();
    await expect(page.locator('[data-resolution="both"]')).toBeFocused();
    await page.locator('[data-resolution="ours"]').click();
    await expect(page.locator("#step-count")).toHaveText("10");
    // Prediction 10 is open: nothing says the file is still unresolved.
    await expect(page.locator("#lesson-title")).toHaveText("충돌 표시를 지운 파일", {
      timeout: 15_000,
    });
    await expect(page.locator("#terminal")).toHaveCount(0);
    await page.locator('[data-action="predict"]').click();
    await page.getByRole("dialog").locator('[data-answer="add"]').click();
    await page.getByRole("dialog").locator('[data-action="verify"]').click();
    await expect(page.locator("#terminal")).toContainText("You have unmerged paths.");
  });

  test("the comparison replays the other method from the fork", async ({ page }) => {
    await page.goto("/git/?lesson=rebase");
    await page.locator('[data-action="compare"]').first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("rebase와 merge");
    await sheet.locator('[data-compare="merge"]').click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#chosen-label")).toHaveText("merge (병합 커밋)", {
      timeout: 15_000,
    });
  });

  test("the end shows 정리 with recall questions", async ({ page }) => {
    await page.goto("/git/?lesson=auto-merge&step=9");
    await expect(page.locator("#eyebrow")).toHaveText(/^정리 · /);
    const recall = page.locator('[data-recall="auto-lines"] [data-choice="0"]');
    // On the console the 정리 pages: step through until the question shows.
    for (let i = 0; i < 4 && !(await recall.isVisible()); i++)
      await page.getByRole("button", { name: "다음 해설 쪽" }).click();
    await recall.click();
    await expect(page.getByText(/^맞았습니다\./)).toBeVisible();
  });
});
