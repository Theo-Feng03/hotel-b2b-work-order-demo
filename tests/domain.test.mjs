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

test("GitHub Pages routes resolve independent work-order entities", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  const domain = fs.readFileSync(new URL("../lib/domain.ts", import.meta.url), "utf8");
  const fallback = fs.readFileSync(new URL("../pages/public/404.html", import.meta.url), "utf8");
  assert.match(source, /window\.location\.hash/);
  assert.match(source, /orders\[routeOrderId\]/);
  assert.match(source, /orders\[r\[0\]\]/);
  assert.match(source, /\[order\.id\]: next/);
  assert.match(source, /eventsByOrderId\[order\.id\]/);
  assert.match(domain, /initialWorkOrders: Record<string, WorkOrder>/);
  for (const id of ["0148", "0142", "0137", "0124", "0151"]) assert.match(domain, new RegExp(id));
  assert.match(fallback, /location\.replace/);
});

test("filter controls have accessible names", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  for (const label of ["选择演示场景", "筛选工单状态", "筛选处理人", "入住日期开始", "入住日期结束"]) assert.match(source, new RegExp(`aria-label="${label}"`));
});

test("all state-changing confirmations use the in-app dialog", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../app/ConfirmDialog.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /window\.confirm/);
  for (const id of ["confirm-accept-work-order", "confirm-submit-for-review", "confirm-close-work-order", "confirm-return-work-order", "confirm-reset-demo"]) assert.match(source, new RegExp(id));
  assert.match(dialog, /data-testid=/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /request\.trigger\?\.focus/);
  assert.match(dialog, /aria-busy/);
});

test("persisted snapshot includes cross-tab synchronization and review facts", () => {
  const source = fs.readFileSync(new URL("../app/workbench.tsx", import.meta.url), "utf8");
  const domain = fs.readFileSync(new URL("../lib/domain.ts", import.meta.url), "utf8");
  assert.match(source, /addEventListener\("storage"/);
  assert.match(source, /hotel-workbench-v2/);
  assert.match(source, /event\.key !== storageKey/);
  assert.match(source, /next\.finalSummary = content/);
  assert.match(domain, /reviewerId: string/);
});
