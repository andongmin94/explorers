import { expect, test, type Page } from "@playwright/test";

// Keyboard and focus of the UI SDK parts (tabs, segmented control, toolbar,
// sheet, switcher menu) and of the playback shortcuts built on its shortcuts.
test.skip(({ isMobile }) => isMobile, "desktop layout");

const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.dataset.tab ?? el?.dataset.algorithm ?? el?.dataset.action ?? el?.textContent ?? "";
  });

test("tabs: arrows move focus, Enter selects, one tab stop", async ({ page }) => {
  await page.goto("/cpu/");
  const tabs = page.locator('[role="tablist"]').filter({ has: page.locator('[data-tab="now"]') });
  await page.locator('[data-tab="now"]').focus();
  await expect(tabs.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toBe("scenes");
  await expect(page.locator('[data-tab="now"]')).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-tab="scenes"]')).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  expect(await focused(page)).not.toBe("scenes");
  await page.keyboard.press("Home");
  expect(await focused(page)).toBe("now");
  await page.keyboard.press("ArrowLeft");
  expect(await focused(page)).not.toBe("now");
});

test("segmented control: a radio group, arrows check the next segment", async ({ page }) => {
  await page.goto("/cpu/?lesson=sjf");
  const group = page.getByRole("radiogroup").filter({ has: page.locator("[data-algorithm]") });
  await expect(group.getByRole("radio")).toHaveCount(2);
  await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await group.locator('[aria-checked="true"]').focus();
  const first = await focused(page);
  await page.keyboard.press("ArrowRight");
  const second = await focused(page);
  expect(second).not.toBe(first);
  await expect(group.locator(`[data-algorithm="${second}"]`)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator("#algo-tag")).toContainText(second.toUpperCase());
  await page.keyboard.press("ArrowLeft");
  await expect(group.locator(`[data-algorithm="${first}"]`)).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("transport toolbar: one tab stop, arrows between its keys", async ({ page }) => {
  await page.goto("/cpu/");
  const toolbar = page.getByRole("toolbar", { name: "재생" });
  await toolbar.locator('[data-action="play"]').focus();
  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toBe("step");
  await page.keyboard.press("ArrowLeft");
  expect(await focused(page)).toBe("play");
  await expect(page.locator("#clock")).toHaveText("0");
});

test("sheet: focus is trapped, Escape closes it and returns focus", async ({ page }) => {
  await page.goto("/cpu/");
  const opener = page.locator('[data-action="predict"]').first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toHaveAccessibleName(/다음 CPU/);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
      true,
    );
  }
  // Playback keys are paused while it is open (opening it seeks to the question).
  const clock = page.locator("#clock");
  await expect(clock).toHaveText("1");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("r");
  await page.waitForTimeout(500);
  await expect(clock).toHaveText("1");
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-answer="P2"]').focus();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
});

test("switcher menu: opens, typeahead, Escape returns to the trigger", async ({ page }) => {
  await page.goto("/protocol/");
  const trigger = page.getByRole("button", { name: /탐색기 선택/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "탐색기 목록" });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveCount(6);
  await expect(menu.getByRole("menuitem", { name: "프로토콜 탐색기" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "CPU 스케줄링 탐색기" })).toBeFocused();
  await page.keyboard.press("g");
  await expect(menu.getByRole("menuitem", { name: "Git 탐색기" })).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: "Git 탐색기" })).toHaveAttribute("href", "/git/");
  // The heading names the page; the menu is not inside it.
  expect(await page.evaluate(() => !!document.querySelector("h1 [role=menu]"))).toBe(false);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  // Escape went to the menu, not to the explorer (no view or step change).
  await expect(page.locator("#stage-step")).toHaveText("0/5");
});

test("playback shortcuts are ignored while typing or on a focused button", async ({ page }) => {
  await page.goto("/cpu/");
  const clock = page.locator("#clock");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "probe";
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("r ");
  await expect(page.locator("#probe")).toHaveValue("r ");
  await page.waitForTimeout(300);
  await expect(clock).toHaveText("0");
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "학습 시작");
  // A focused key keeps Space and the arrows for itself.
  await page.locator('[data-action="reset"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(clock).toHaveText("0");
  // With nothing focused they run.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(clock).toHaveText("1", { timeout: 10_000 });
  await page.keyboard.press("Shift+R");
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "학습 시작");
});

test("protocol: Escape closes the lesson drawer before anything else", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/protocol/");
  const key = page.locator('button[aria-controls="lessons"]');
  await key.click();
  await expect(key).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(key).toHaveAttribute("aria-expanded", "false");
  await expect(key).toBeFocused();
});
