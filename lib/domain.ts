export type WorkOrderStatus = "pending_acceptance" | "in_progress" | "pending_confirmation" | "completed";
export type Role = "domestic_customer_service" | "overseas_customer_service" | "operations" | "supervisor" | "finance" | "admin";
export type Action = "accept" | "record" | "submit" | "confirm" | "return";

export interface User { id: string; name: string; role: Role; team: string }
export interface WorkOrder { id: string; title: string; description: string; expectedResult: string; status: WorkOrderStatus; assigneeId: string | null; confirmerId: string; reviewerId: string; finalSummary?: string; finalResult?: string; version: number; updatedAt: string }

export const users: User[] = [
  { id: "lin", name: "林晓", role: "domestic_customer_service", team: "国内客服一组" },
  { id: "zhou", name: "周宁", role: "domestic_customer_service", team: "国内客服一组" },
  { id: "chen", name: "陈岚", role: "operations", team: "酒店订单运营" },
  { id: "sofia", name: "Sofia Reed", role: "overseas_customer_service", team: "北美酒店协同" },
  { id: "zhao", name: "赵凯", role: "supervisor", team: "客服主管" },
  { id: "sun", name: "孙悦", role: "finance", team: "财务" },
  { id: "admin", name: "系统管理员", role: "admin", team: "系统管理" },
];

export const initialWorkOrder: WorkOrder = {
  id: "WO-CN-20260720-0148", title: "临近入住，酒店尚未返回确认结果",
  description: "客户询问两间客房是否已由酒店确认，目前订单详情中尚无酒店确认号，请协助核实并回传结果。",
  expectedResult: "获得酒店确认结果，并将确认摘要回写到工单。", status: "pending_acceptance",
  assigneeId: null, confirmerId: "chen", reviewerId: "chen", version: 1, updatedAt: "2026-07-20 09:32",
};

export const initialWorkOrders: Record<string, WorkOrder> = {
  [initialWorkOrder.id]: initialWorkOrder,
  "WO-CN-20260720-0142": {
    id: "WO-CN-20260720-0142", title: "酒店要求再次核对入住人拼写",
    description: "酒店要求核对两位入住人的英文姓名拼写，请确认后回传。",
    expectedResult: "完成入住人拼写核对并记录酒店反馈。", status: "in_progress",
    assigneeId: "lin", confirmerId: "chen", reviewerId: "chen", version: 3, updatedAt: "2026-07-20 10:18",
  },
  "WO-CN-20260720-0137": {
    id: "WO-CN-20260720-0137", title: "客户请求补充酒店确认摘要",
    description: "客户希望获得包含房型、入住日期和确认号的完整确认摘要。",
    expectedResult: "补充确认摘要并提交需求方确认。", status: "pending_confirmation",
    assigneeId: "zhou", confirmerId: "chen", reviewerId: "chen", version: 4, updatedAt: "2026-07-20 10:02",
    finalSummary: "已补充房型、入住日期及酒店确认号，等待需求方确认。",
  },
  "WO-CN-20260719-0124": {
    id: "WO-CN-20260719-0124", title: "酒店确认信息已回传",
    description: "酒店确认信息已收到，需要完成内部记录和闭环。",
    expectedResult: "确认信息完整并办结工单。", status: "completed",
    assigneeId: "lin", confirmerId: "chen", reviewerId: "chen", version: 6, updatedAt: "2026-07-19 18:40",
    finalSummary: "酒店确认信息已完整记录。", finalResult: "确认信息完整，工单已办结。",
  },
  "WO-CN-20260720-0151": {
    id: "WO-CN-20260720-0151", title: "关联订单信息暂时加载失败",
    description: "关联订单区域暂时无法加载，需要排查并补充订单信息。",
    expectedResult: "恢复订单信息展示并记录处理结果。", status: "in_progress",
    assigneeId: "zhou", confirmerId: "chen", reviewerId: "chen", version: 2, updatedAt: "2026-07-20 10:31",
  },
};

export function can(action: Action, order: WorkOrder, user: User): boolean {
  const supervisor = user.role === "supervisor";
  if (action === "accept") return order.status === "pending_acceptance" && !order.assigneeId && (user.role === "domestic_customer_service" || supervisor);
  if (action === "record" || action === "submit") return order.status === "in_progress" && (order.assigneeId === user.id || supervisor);
  if (action === "confirm" || action === "return") return order.status === "pending_confirmation" && user.id !== order.assigneeId && (order.confirmerId === user.id || supervisor);
  return false;
}

export function transition(order: WorkOrder, action: Action, user: User, expectedVersion = order.version): WorkOrder {
  if (expectedVersion !== order.version) throw new Error("工单状态已更新，请刷新后重试");
  if (!can(action, order, user)) throw new Error("当前角色或工单状态不允许此操作");
  const next = { ...order, version: order.version + 1, updatedAt: "2026-07-20 12:08" };
  if (action === "accept") return { ...next, status: "in_progress", assigneeId: user.id };
  if (action === "submit") return { ...next, status: "pending_confirmation" };
  if (action === "confirm") return { ...next, status: "completed" };
  if (action === "return") return { ...next, status: "in_progress" };
  return next;
}
