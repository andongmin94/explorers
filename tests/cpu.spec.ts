import { expect, test, type Page } from "@playwright/test";

// The CPU explorer: 오개념 바로잡기, 직접 실험 and the reorganised deck.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const path of ["/cpu/", "/cpu/?lesson=sjf", "/cpu/?lesson=srtf", "/cpu/?lesson=custom"]) {
  test(`${path} runs to the end with misconceptions in 정리`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    const event = page.locator('[data-action="event"]');
    while (await event.isEnabled()) await event.click();
    await expect(page.locator("[data-conclusion]")).toBeVisible();
    await expect(page.locator("#now-pages")).toContainText("핵심 정리");
    expect(errors).toEqual([]);
  });
}

test("a misconception shows at its 핵심 장면", async ({ page }) => {
  await page.goto("/cpu/");
  // P2 arrives at 1 ms and first runs at 2 ms: the 2 ms scene sets it right.
  await page.locator("#seek").focus();
  await page.locator('[data-time="2"]').first().click();
  await expect(page.locator('#now-pages [data-misconception="arrive-run"]')).toBeAttached();
});

test("the deck: primary transport, quiet speed and seek", async ({ page }) => {
  await page.goto("/cpu/");
  await page.locator('[data-action="speed"] [aria-label="2배속"]').click();
  await expect(page.locator('[data-action="speed"] [aria-label="2배속"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator('[data-slot="deck-secondary"] #seek')).toBeAttached();
});

test("직접 실험: edit jobs, validate, run and share", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/cpu/?lesson=custom");
  await page.locator('header [data-action="custom"]').click();
  const sheet = page.getByRole("dialog");
  await sheet.locator('[data-preset="convoy"]').click();
  const bursts = sheet.locator('[data-custom="bursts"]').first();
  await bursts.fill("4 2");
  await expect(sheet.getByRole("alert").first()).toContainText("CPU 구간으로 끝나야");
  await expect(sheet.locator('[data-action="custom-run"]')).toBeDisabled();
  await bursts.fill("4 2 1");
  await sheet.locator('[data-action="custom-add-job"]').click();
  await sheet.locator('[data-action="custom-run"]').click();
  await expect(page).toHaveURL(/jobs=0%3A4-2-1/);
  await expect(page.locator('[role="radio"][data-algorithm="fcfs"]')).toBeAttached();
  await expect(page.locator('#scene [data-process="P5"]')).toBeAttached();
  expect(errors).toEqual([]);
});
