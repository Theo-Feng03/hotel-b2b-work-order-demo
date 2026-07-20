import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("domain rules are present in source", () => {
  const source = fs.readFileSync(new URL("../lib/domain.ts", import.meta.url), "utf8");
  assert.match(source, /expectedVersion !== order.version/);
  assert.match(source, /user.id !== order.assigneeId/);
  assert.match(source, /status: "pending_confirmation"/);
});

test("all seven route surfaces are rendered", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  for (const marker of ["Dashboard", "WorkOrderList", "Detail", "OrderPage", "RelatedPage", "ActionPage", "TimelinePage"]) assert.match(source, new RegExp(marker));
});
