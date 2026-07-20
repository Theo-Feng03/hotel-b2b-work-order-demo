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

test("GitHub Pages routes and the primary work order use shared state", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  const fallback = fs.readFileSync(new URL("../pages/public/404.html", import.meta.url), "utf8");
  assert.match(source, /window\.location\.hash/);
  assert.match(source, /listRows\.map\(r => r\[0\] === order\.id/);
  assert.doesNotMatch(source, /r\[0\] === initialWorkOrder\.id \? initialWorkOrder\.status/);
  assert.match(fallback, /location\.replace/);
});

test("filter controls have accessible names", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  for (const label of ["选择演示场景", "筛选工单状态", "筛选处理人", "入住日期开始", "入住日期结束"]) assert.match(source, new RegExp(`aria-label="${label}"`));
});
