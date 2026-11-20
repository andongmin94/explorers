import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "../cn.ts";

test("cn keeps a theme font size beside a colour, and merges real conflicts", () => {
  assert.equal(cn("text-caption text-label-2"), "text-caption text-label-2");
  assert.equal(cn("text-caption", "text-body"), "text-body");
  assert.equal(cn("rounded-group", "rounded-panel"), "rounded-panel");
  assert.equal(cn("min-h-[460px]", "min-h-0"), "min-h-0");
});
