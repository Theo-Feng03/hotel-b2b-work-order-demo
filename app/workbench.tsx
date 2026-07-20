"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Action, can, initialWorkOrder, transition, users, WorkOrder, WorkOrderStatus } from "../lib/domain";

type EventType = "work_order" | "order" | "overseas" | "authorization" | "contact" | "system";
type TimelineEvent = { id: string; type: EventType; time: string; actor: string; action: string; content: string; result: string; outcome?: "failure" };
type Scenario = "normal" | "duplicate" | "order_error" | "record_error" | "permission" | "conflict" | "empty";
type ViewState = { keyword: string; status: string; assignee: string; from: string; to: string; page: number };

const statusMeta: Record<WorkOrderStatus, { label: string; tone: string }> = {
  pending_acceptance: { label: "待接收", tone: "amber" }, in_progress: { label: "进行中", tone: "blue" },
  pending_confirmation: { label: "待确认", tone: "violet" }, completed: { label: "已办结", tone: "green" },
};
const roleLabels: Record<string, string> = { domestic_customer_service: "国内客服", overseas_customer_service: "海外客服", operations: "运营/确认人", supervisor: "业务主管", finance: "财务人员", admin: "管理员" };
const finalResult = "酒店已确认保留2间 Deluxe King Room，入住日期为2026-07-22，离店日期为2026-07-25；酒店确认号为 HBR-731945。酒店回复邮件及确认摘要已记录，关联海外客服工单保留独立处理记录。";
const initialEvents: TimelineEvent[] = [
  { id: "e4", type: "contact", time: "2026-07-20 11:42", actor: "酒店预订部（虚构）", action: "回复邮件", content: "返回酒店确认号 HBR-731945", result: "已确认" },
  { id: "e3", type: "contact", time: "2026-07-20 11:16", actor: "Sofia Reed", action: "发送邮件", content: "补充 ATS-6928041 并再次请求确认号", result: "已发送" },
  { id: "e2", type: "authorization", time: "2026-07-20 10:22", actor: "孙悦", action: "更新授权摘要", content: "关联业务材料已收到，正在核对", result: "处理中" },
  { id: "e1", type: "work_order", time: "2026-07-20 09:32", actor: "陈岚", action: "创建国内客服工单", content: "关联订单 ORD-20260718-58321", result: "进入共享待接收池" },
];
const listRows = [
  ["WO-CN-20260720-0148", "临近入住，酒店尚未返回确认结果", "pending_acceptance", "ORD-20260718-58321", "Harborline Riverside Hotel", "2026-07-22", "未分配", "09:32"],
  ["WO-CN-20260720-0142", "酒店要求再次核对入住人拼写", "in_progress", "ORD-20260717-57904", "Lakewood Central Hotel", "2026-07-23", "林晓", "10:18"],
  ["WO-CN-20260720-0137", "客户请求补充酒店确认摘要", "pending_confirmation", "ORD-20260716-57188", "Seaport Grand Hotel", "2026-07-25", "周宁", "10:02"],
  ["WO-CN-20260719-0124", "酒店确认信息已回传", "completed", "ORD-20260715-56802", "Beacon Hill Suites", "2026-07-28", "林晓", "07-19 18:40"],
  ["WO-CN-20260720-0151", "关联订单信息暂时加载失败", "in_progress", "ORD-20260719-58911", "Boston Garden Inn", "2026-07-24", "周宁", "10:31"],
] as const;

function routeNow() { if (typeof window === "undefined") return "/dashboard"; return window.location.pathname === "/" ? "/dashboard" : window.location.pathname; }
function fmtNow() { return "2026-07-20 12:08"; }

export function Workbench() {
  const [route, setRoute] = useState("/dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("lin");
  const [order, setOrder] = useState<WorkOrder>(initialWorkOrder);
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewState>({ keyword: "", status: "", assignee: "all", from: "", to: "", page: 1 });
  const user = users.find(u => u.id === currentUserId) ?? users[0];

  useEffect(() => {
    setRoute(routeNow());
    const saved = localStorage.getItem("hotel-workbench-v1");
    if (saved) { try { const s = JSON.parse(saved); setOrder(s.order ?? initialWorkOrder); setEvents(s.events ?? initialEvents); setCurrentUserId(s.currentUserId ?? "lin"); setView(s.view ?? view); } catch {} }
    const pop = () => setRoute(routeNow()); window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => { localStorage.setItem("hotel-workbench-v1", JSON.stringify({ order, events, currentUserId, view })); }, [order, events, currentUserId, view]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);

  function go(path: string) { history.pushState({}, "", path); setRoute(path); setMobileNav(false); window.scrollTo(0, 0); }
  function append(action: string, content: string, result: string, outcome?: "failure") { setEvents(es => [{ id: crypto.randomUUID(), type: "work_order", time: fmtNow(), actor: user.name, action, content, result, outcome }, ...es]); }
  function perform(action: Action, content = "") {
    try {
      if (scenario === "conflict") throw new Error("工单状态已变化，已刷新到最新版本");
      if (action === "accept" && scenario === "duplicate") { append("重复领取", "周宁尝试接收工单", `领取失败，当前处理人为${order.assigneeId ? "林晓" : "其他客服"}`, "failure"); throw new Error("工单已由林晓接收，页面已刷新"); }
      const next = transition(order, action, user);
      if (action === "confirm") next.finalResult = finalResult;
      setOrder(next);
      const labels: Record<Action, [string, string]> = { accept: ["接收工单", "进入进行中"], record: ["添加处理记录", "记录成功"], submit: ["提交待确认", "进入待确认"], confirm: ["确认处理结果", "进入已办结"], return: ["退回继续处理", "回到进行中"] };
      append(labels[action][0], content || order.title, labels[action][1]); setToast(`${labels[action][0]}成功`);
    } catch (e) { setToast(e instanceof Error ? e.message : "操作失败"); }
  }
  function reset() { if (!confirm("确认重置全部 Demo 状态？当前演示进度将清除。")) return; localStorage.removeItem("hotel-workbench-v1"); setOrder(initialWorkOrder); setEvents(initialEvents); setCurrentUserId("lin"); setScenario("normal"); setView({ keyword: "", status: "", assignee: "all", from: "", to: "", page: 1 }); setToast("Demo 已恢复到待接收状态"); go("/dashboard"); }

  const title = route === "/dashboard" ? "国内客服工作台" : route === "/work-orders" ? "工单列表" : route.endsWith("/order") ? "关联订单" : route.endsWith("/related") ? "关联任务与联系" : route.endsWith("/action") ? "处理动作" : route.endsWith("/timeline") ? "结果与事实时间线" : "工单详情";
  return <div className="app-shell">
    <aside className={mobileNav ? "sidebar open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">H</span><div><b>旅协工单</b><small>Hotel Operations</small></div></div>
      <nav>
        <Nav label="工作台" icon="⌂" active={route === "/dashboard"} onClick={() => go("/dashboard")} />
        <Nav label="工单中心" icon="▤" active={route.startsWith("/work-orders")} onClick={() => go("/work-orders")} />
        <div className="nav-caption">协同模块</div>
        <Nav label="酒店订单" icon="◇" onClick={() => setToast("本次 Demo 未建设独立订单模块")} />
        <Nav label="海外协同" icon="◎" onClick={() => setToast("请从工单关联信息进入")} />
        <Nav label="授权任务" icon="◫" onClick={() => setToast("本次 Demo 仅展示授权摘要")} />
      </nav>
      <div className="sidebar-bottom"><span className="live-dot" /> 演示环境 <small>虚构数据 · v1.0</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="menu-btn" onClick={() => setMobileNav(!mobileNav)}>☰</button>
        <div className="crumb">客服运营 <span>/</span> {title}</div>
        <div className="top-actions">
          <span className="demo-pill">DEMO · 虚构数据</span>
          <select aria-label="切换演示角色" value={currentUserId} onChange={e => setCurrentUserId(e.target.value)}>{users.map(u => <option key={u.id} value={u.id}>{u.name} · {roleLabels[u.role]}</option>)}</select>
          <button className="ghost" onClick={reset}>↻ 重置 Demo</button>
        </div>
      </header>
      <div className="page">
        <div className="page-heading"><div><span className="eyebrow">HOTEL SERVICE OPERATIONS</span><h1>{title}</h1><p>{subtitle(route)}</p></div><ScenarioSelect value={scenario} onChange={setScenario} /></div>
        {route === "/dashboard" && <Dashboard go={go} />}
        {route === "/work-orders" && <WorkOrderList view={view} setView={setView} go={go} scenario={scenario} />}
        {route.match(/^\/work-orders\/[^/]+$/) && <Detail order={order} user={user} go={go} perform={perform} />}
        {route.endsWith("/order") && <OrderPage order={order} go={go} error={scenario === "order_error"} />}
        {route.endsWith("/related") && <RelatedPage go={go} />}
        {route.endsWith("/action") && <ActionPage order={order} user={user} perform={perform} go={go} recordError={scenario === "record_error"} />}
        {route.endsWith("/timeline") && <TimelinePage order={order} user={user} events={events} perform={perform} go={go} />}
      </div>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Nav({ label, icon, active, onClick }: { label: string; icon: string; active?: boolean; onClick: () => void }) { return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{icon}</span>{label}</button>; }
function subtitle(route: string) { if (route === "/dashboard") return "聚焦临近入住事项，快速完成跨团队协同闭环。"; if (route === "/work-orders") return "筛选、定位并处理国内客服工单。"; if (route.endsWith("/timeline")) return "核对结果，并追溯所有对象的关键事实。"; return "WO-CN-20260720-0148 · 临近入住，酒店尚未返回确认结果"; }
function ScenarioSelect({ value, onChange }: { value: Scenario; onChange: (s: Scenario) => void }) { return <label className="scenario">演示场景<select value={value} onChange={e => onChange(e.target.value as Scenario)}><option value="normal">正常主线</option><option value="duplicate">重复领取</option><option value="order_error">订单加载失败</option><option value="record_error">记录提交失败</option><option value="permission">权限不足</option><option value="conflict">状态已变化</option><option value="empty">列表无数据</option></select></label>; }
function Badge({ status }: { status: WorkOrderStatus }) { const s = statusMeta[status]; return <span className={`badge ${s.tone}`}><i />{s.label}</span>; }

function Dashboard({ go }: { go: (p: string) => void }) { const cards = [["我的待接收", "3", "需及时响应", "amber"], ["我的进行中", "5", "2 条今日更新", "blue"], ["等待确认", "2", "等待业务确认", "violet"], ["共享待接收池", "12", "临近入住 4 条", "teal"]]; return <>
  <section className="hero"><div><span className="hero-tag">7月20日 · 国内客服一组</span><h2>早上好，林晓</h2><p>今天有 <b>4 条临近入住工单</b>需要优先关注，建议先处理共享池中的酒店确认事项。</p><button className="primary" onClick={() => go("/work-orders")}>查看共享待接收池 →</button></div><div className="hero-focus"><small>今日焦点</small><b>距客人入住还有 2 天</b><span>Harborline Riverside Hotel</span><div className="progress"><i /></div><small>酒店确认信息已返回，等待国内客服处理</small></div></section>
  <div className="section-title"><div><h2>我的工作概览</h2><p>数字为 Demo 展示值，不代表实际业务规模</p></div><button className="text-btn" onClick={() => go("/work-orders")}>查看全部工单 →</button></div>
  <div className="metrics">{cards.map((c, i) => <button key={c[0]} className={`metric ${c[3]}`} onClick={() => go("/work-orders")}><span className="metric-icon">{["⌁","↗","✓","▤"][i]}</span><small>{c[0]}</small><strong>{c[1]}</strong><em>{c[2]}</em></button>)}</div>
  <div className="dashboard-grid"><section className="panel"><div className="panel-head"><h3>最近处理记录</h3><span>最近 6 条</span></div>{[["09:32","创建国内客服工单","陈岚","待接收"],["09:45","创建海外协同工单","陈岚","进行中"],["11:16","补充供应商订单号","Sofia Reed","已发送"]].map(x => <button className="activity" key={x[0]} onClick={() => go("/work-orders/WO-CN-20260720-0148")}><time>{x[0]}</time><span><b>{x[1]}</b><small>{x[2]} · WO-CN-20260720-0148</small></span><em>{x[3]}</em></button>)}</section><section className="panel priority"><div className="panel-head"><h3>优先关注</h3><span>按入住时间</span></div><div className="priority-card"><span className="urgent">距入住 2 天</span><h3>临近入住，酒店尚未返回确认结果</h3><p>海港滨河酒店 · Boston, MA</p><div><span>ORD-20260718-58321</span><Badge status="pending_acceptance" /></div><button className="secondary" onClick={() => go("/work-orders/WO-CN-20260720-0148")}>查看工单</button></div></section></div>
  </>; }

function WorkOrderList({ view, setView, go, scenario }: { view: ViewState; setView: (v: ViewState) => void; go: (p: string) => void; scenario: Scenario }) {
  const rows = useMemo(() => scenario === "empty" ? [] : listRows.filter(r => (!view.keyword || [r[0], r[3], r[4]].some(v => v.toLowerCase().includes(view.keyword.toLowerCase()))) && (!view.status || r[2] === view.status) && (view.assignee === "all" || (view.assignee === "mine" ? r[6] === "林晓" : r[6] === "未分配")) && (!view.from || r[5] >= view.from) && (!view.to || r[5] <= view.to)), [view, scenario]);
  const clear = () => setView({ keyword: "", status: "", assignee: "all", from: "", to: "", page: 1 });
  return <section className="panel list-panel"><div className="filters"><label className="search">⌕<input placeholder="搜索工单号、订单号或酒店" value={view.keyword} onChange={e => setView({ ...view, keyword: e.target.value, page: 1 })} /></label><select value={view.status} onChange={e => setView({ ...view, status: e.target.value })}><option value="">全部状态</option><option value="pending_acceptance">待接收</option><option value="in_progress">进行中</option><option value="pending_confirmation">待确认</option><option value="completed">已办结</option></select><select value={view.assignee} onChange={e => setView({ ...view, assignee: e.target.value })}><option value="all">全部处理人</option><option value="mine">我的工单</option><option value="unassigned">未分配</option></select><input type="date" value={view.from} onChange={e => setView({ ...view, from: e.target.value })} /><span className="dash">—</span><input type="date" value={view.to} onChange={e => setView({ ...view, to: e.target.value })} /><button className="ghost" onClick={clear}>清除</button></div>
  <div className="table-wrap"><table><thead><tr><th>工单 / 事项</th><th>状态</th><th>关联订单</th><th>入住日期</th><th>处理人</th><th>更新时间</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r[0]} onClick={() => go(`/work-orders/${r[0]}`)}><td><b>{r[0]}</b><span>{r[1]}</span></td><td><Badge status={r[0] === initialWorkOrder.id ? initialWorkOrder.status : r[2]} /></td><td><b>{r[3]}</b><span>{r[4]}</span></td><td>{r[5]}</td><td><span className="avatar tiny">{r[6][0]}</span>{r[6]}</td><td>{r[7]}</td><td>›</td></tr>)}</tbody></table></div>{rows.length === 0 ? <div className="empty"><span>⌕</span><h3>没有符合条件的工单</h3><p>调整筛选条件，或清除后查看全部工单。</p><button className="secondary" onClick={clear}>清除筛选</button></div> : <div className="pagination"><span>共 {rows.length} 条 · 每页 10 条</span><button disabled>‹</button><button className="active">1</button><button disabled>›</button></div>}</section>;
}

function Detail({ order, user, go, perform }: { order: WorkOrder; user: typeof users[number]; go: (p: string) => void; perform: (a: Action, c?: string) => void }) { const assignee = users.find(u => u.id === order.assigneeId); const allowed = can("accept", order, user) || can("record", order, user) || can("confirm", order, user); return <>
  <button className="back" onClick={() => go("/work-orders")}>← 返回工单列表</button><section className="ticket-header"><div><div className="ticket-id">{order.id} <Badge status={order.status} /></div><h2>{order.title}</h2><p>创建于 2026-07-20 09:32 · 最近更新 {order.updatedAt}</p></div><div className="ticket-owner"><span className="avatar">{assignee?.name[0] ?? "?"}</span><div><small>当前处理人</small><b>{assignee?.name ?? "未分配"}</b></div></div></section>
  <div className="detail-grid"><div><section className="panel body-panel"><h3>原始问题与期望结果</h3><div className="issue"><small>原始问题</small><p>{order.description}</p></div><div className="expect"><small>期望结果</small><p>{order.expectedResult}</p></div></section><section className="panel body-panel"><div className="panel-head"><h3>关联业务对象</h3><span>生命周期相互独立</span></div><div className="related-cards"><button onClick={() => go(`${base(order.id)}/order`)}><span className="object-icon">◇</span><small>关联订单 · 1</small><b>ORD-20260718-58321</b><em>已生成，待酒店确认</em><i>查看订单 →</i></button><button onClick={() => go(`${base(order.id)}/related`)}><span className="object-icon">◎</span><small>海外客服工单 · 1</small><b>WO-OS-20260720-0063</b><em>进行中 · Sofia Reed</em><i>查看协同 →</i></button><button onClick={() => go(`${base(order.id)}/related`)}><span className="object-icon">◫</span><small>授权任务 · 1</small><b>AUTH-20260720-0082</b><em>处理中 · 孙悦</em><i>查看摘要 →</i></button></div></section></div><aside><section className="panel next-panel"><span className="eyebrow">NEXT ACTION</span><h3>当前下一步</h3>{allowed ? <><p>{order.status === "pending_acceptance" ? "接收工单后，记录酒店确认结果并提交业务确认。" : order.status === "in_progress" ? "补充处理记录，确认内容完整后提交待确认。" : order.status === "pending_confirmation" ? "核对客服提交结果是否回答了原始需求。" : "工单已办结，可查看完整时间线。"}</p>{order.status === "pending_acceptance" && <button className="primary wide" onClick={() => { if (confirm("确认接收此工单？")) perform("accept"); }}>接收工单</button>}{order.status === "in_progress" && <button className="primary wide" onClick={() => go(`${base(order.id)}/action`)}>继续处理</button>}{order.status === "pending_confirmation" && <button className="primary wide" onClick={() => go(`${base(order.id)}/timeline`)}>进入结果确认</button>}</> : <div className="permission"><b>当前角色暂无可执行动作</b><p>{user.role === "finance" ? "财务人员可查看授权摘要，但无客服工单处理权限。" : "请切换至当前处理人、指定确认人或主管角色。"}</p></div>}<button className="secondary wide" onClick={() => go(`${base(order.id)}/timeline`)}>查看事实时间线</button></section><section className="panel recent"><div className="panel-head"><h3>最近处理记录</h3><button onClick={() => go(`${base(order.id)}/timeline`)}>全部</button></div><div className="mini-event"><i /><div><b>酒店返回确认号 HBR-731945</b><small>11:42 · 酒店预订部（虚构）</small></div></div><div className="mini-event"><i /><div><b>补充供应商订单号并再次请求确认</b><small>11:16 · Sofia Reed</small></div></div></section></aside></div>
  </>; }
function base(id: string) { return `/work-orders/${id}`; }

function OrderPage({ order, go, error }: { order: WorkOrder; go: (p: string) => void; error: boolean }) { return <><button className="back" onClick={() => go(base(order.id))}>← 返回工单详情</button><div className="status-separation"><div><small>国内客服工单状态</small><Badge status={order.status} /></div><span>独立生命周期，不自动联动</span><div><small>订单展示状态</small><b>已生成，待酒店确认</b></div></div>{error ? <section className="panel error-state"><span>!</span><h3>订单信息暂时加载失败</h3><p>这不会影响工单查看和处理记录。请稍后重试。</p><button className="secondary">重新加载</button></section> : <section className="panel body-panel"><div className="panel-head"><div><span className="eyebrow">ORDER CONTEXT</span><h3>ORD-20260718-58321</h3></div><span className="assumption">Demo 假设字段</span></div><div className="order-highlight"><div><small>入住日期</small><b>2026-07-22</b></div><span>→</span><div><small>离店日期</small><b>2026-07-25</b></div><div><small>入住时长</small><b>3 晚 · 2 间</b></div><div><small>酒店确认号</small><b className="confirm-no">HBR-731945</b></div></div><div className="info-grid">{[["客户订单号","CL-NA-884217"],["客户名称","NorthStar Travel LLC"],["酒店","Harborline Riverside Hotel（海港滨河酒店）"],["城市","Boston, MA"],["房型","Deluxe King Room"],["入住人","Alex Morgan 等2人"],["供应商","Atlas Hotel Supply Ltd."],["供应商订单号","ATS-6928041"],["退改摘要","以订单原始条款为准；Demo 不执行修改或退款"]].map((x,i) => <div className={i === 8 ? "span-2" : ""} key={x[0]}><small>{x[0]} {![0,5,7,8].includes(i) && <em>假设</em>}</small><b>{x[1]}</b></div>)}</div></section>}<div className="footer-actions"><button className="secondary" onClick={() => go(`${base(order.id)}/related`)}>查看关联任务与联系 →</button></div></>; }

function RelatedPage({ go }: { go: (p: string) => void }) { return <><button className="back" onClick={() => go(base(initialWorkOrder.id))}>← 返回工单详情</button><div className="related-layout"><div><section className="panel body-panel"><div className="panel-head"><div><span className="eyebrow">OVERSEAS WORK ORDER</span><h3>海外客服协同工单</h3></div><span className="badge blue"><i />进行中</span></div><h2 className="related-title">联系 Harborline Riverside Hotel 核实房间保留情况</h2><div className="info-grid compact"><div><small>工单编号</small><b>WO-OS-20260720-0063</b></div><div><small>当前处理人</small><b><span className="avatar tiny">S</span> Sofia Reed</b></div><div><small>最近进展</small><b>已发送邮件，等待酒店回复</b></div><div><small>更新时间</small><b>2026-07-20 11:16</b></div></div></section><section className="panel body-panel"><div className="panel-head"><div><span className="eyebrow">HOTEL CONTACT LOG</span><h3>酒店联系记录</h3></div><span>4 条邮件</span></div><div className="mail-timeline">{[["11:42","酒店预订部（虚构）","返回酒店确认号 HBR-731945","已确认"],["11:16","Sofia Reed","补充 ATS-6928041 并再次请求确认号","已发送"],["11:08","酒店预订部（虚构）","确认已保留两间房，要求补充供应商订单号","已回复"],["09:47","Sofia Reed","请求核实两间客房及入住人信息","已发送"]].map(m => <div className="mail" key={m[0]}><time>{m[0]}</time><i /><div><b>{m[1]} <em>邮件</em></b><p>{m[2]}</p></div><span>{m[3]}</span></div>)}</div></section></div><aside><section className="panel authorization"><span className="eyebrow">AUTHORIZATION</span><div className="auth-icon">◫</div><h3>关联授权任务</h3><b>AUTH-20260720-0082</b><dl><div><dt>当前进度</dt><dd><span className="badge amber"><i />处理中</span></dd></div><div><dt>当前处理人</dt><dd>孙悦 · 财务</dd></div><div><dt>最近更新</dt><dd>2026-07-20 10:22</dd></div></dl><div className="auth-summary"><small>结果摘要</small><p>关联业务材料已收到，正在核对</p></div><div className="warning">ℹ 授权业务含义未定义，本 Demo 仅展示摘要，不提供处理入口。</div></section></aside></div></>; }

function ActionPage({ order, user, perform, go, recordError }: { order: WorkOrder; user: typeof users[number]; perform: (a: Action, c?: string) => void; go: (p: string) => void; recordError: boolean }) { const [content, setContent] = useState(""); const [progress, setProgress] = useState(""); const [summary, setSummary] = useState(finalResult); const [errors, setErrors] = useState<string[]>([]); function record(e: FormEvent) { e.preventDefault(); const err = [!content && "处理内容", !progress && "处理结果/当前进展"].filter(Boolean) as string[]; setErrors(err); if (err.length) return; if (recordError) { setErrors(["模拟提交失败：输入已保留，请切换正常主线后重试"]); return; } perform("record", `${content}；${progress}`); setContent(""); setProgress(""); }
  if (order.status === "pending_acceptance") return <section className="panel centered-action"><span className="action-symbol">↘</span><h2>接收这张工单</h2><p>接收后你将成为明确处理人，工单状态进入“进行中”。</p><div className="summary-strip"><span><small>工单</small><b>{order.id}</b></span><span><small>当前处理人</small><b>未分配</b></span><span><small>版本</small><b>v{order.version}</b></span></div><button className="primary" onClick={() => { if (confirm("确认接收此工单？")) perform("accept"); }}>确认接收</button><button className="text-btn" onClick={() => go(base(order.id))}>返回详情</button></section>;
  return <><button className="back" onClick={() => go(base(order.id))}>← 返回工单详情</button><div className="action-grid"><form className="panel form-panel" onSubmit={record}><span className="eyebrow">PROCESSING RECORD</span><h2>添加处理记录</h2><p>记录已完成的工作和当前结果。保存后会写入事实时间线。</p><label>处理内容 <b>*</b><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="例如：核对酒店回复邮件和供应商订单号…" /></label><label>处理结果 / 当前进展 <b>*</b><textarea value={progress} onChange={e => setProgress(e.target.value)} placeholder="例如：已获得酒店确认号，信息完整…" /></label>{errors.length > 0 && <div className="form-error">请检查：{errors.join("、")}</div>}<div className="form-actions"><button className="primary" disabled={!can("record", order, user)}>保存处理记录</button></div></form><section className="panel form-panel submit-panel"><span className="eyebrow">SUBMIT FOR CONFIRMATION</span><h2>提交待确认</h2><p>确认最终摘要完整后，提交给需求发起人陈岚。</p><label>最终处理摘要 <b>*</b><textarea className="tall" value={summary} onChange={e => setSummary(e.target.value)} /></label><label>确认人 <b>*</b><select value="chen" disabled><option>陈岚 · 运营/需求发起人</option></select></label><div className="submit-note">提交后主工单进入“待确认”；订单、海外工单与授权任务状态不变。</div><button className="primary wide" disabled={!summary || !can("submit", order, user)} onClick={() => { if (confirm("确认提交处理结果给陈岚？")) { perform("submit", summary); go(`${base(order.id)}/timeline`); } }}>提交待确认 →</button></section></div></>; }

function TimelinePage({ order, user, events, perform, go }: { order: WorkOrder; user: typeof users[number]; events: TimelineEvent[]; perform: (a: Action, c?: string) => void; go: (p: string) => void }) { const [filter, setFilter] = useState("all"); const [opinion, setOpinion] = useState(""); const shown = filter === "all" ? events : events.filter(e => e.type === filter); return <><button className="back" onClick={() => go(base(order.id))}>← 返回工单详情</button>{order.status === "pending_confirmation" && <section className="confirmation-banner"><div><span className="eyebrow">RESULT CONFIRMATION</span><h2>处理结果等待确认</h2><p>请确认客服提交的结果是否已回答原始需求。</p></div><div><Badge status={order.status} /><span>确认人：陈岚</span></div></section>} {order.finalResult && <section className="completed-banner"><span>✓</span><div><small>最终处理结果</small><p>{order.finalResult}</p></div></section>}<div className="timeline-layout"><section className="panel timeline-panel"><div className="panel-head"><div><span className="eyebrow">FACT TIMELINE</span><h3>事实时间线</h3></div><span>{shown.length} 条事件 · 倒序</span></div><div className="timeline-filters">{[["all","全部"],["order","订单"],["work_order","国内工单"],["overseas","海外工单"],["authorization","授权"],["contact","联系记录"]].map(f => <button className={filter === f[0] ? "active" : ""} key={f[0]} onClick={() => setFilter(f[0])}>{f[1]}</button>)}</div>{shown.length ? <div className="events">{shown.map(e => <div className={e.outcome === "failure" ? "event failed" : "event"} key={e.id}><time>{e.time.split(" ")[1]}<small>{e.time.split(" ")[0]}</small></time><i /><div><span className={`object-tag ${e.type}`}>{eventLabel(e.type)}</span><h4>{e.action}</h4><p>{e.content}</p><small>{e.actor} · {e.result}</small></div></div>)}</div> : <div className="empty small"><h3>该对象暂无事件</h3></div>}</section><aside>{order.status === "pending_confirmation" ? <section className="panel confirm-panel"><span className="eyebrow">DECISION</span><h3>确认处理结果</h3><div className="result-box"><small>客服提交摘要</small><p>{finalResult}</p></div><label>确认意见 / 退回原因 <b>*</b><textarea value={opinion} onChange={e => setOpinion(e.target.value)} placeholder="填写确认意见或需补充的内容…" /></label>{can("confirm", order, user) ? <><button className="primary wide" disabled={!opinion} onClick={() => { if (confirm("确认办结此工单？")) perform("confirm", opinion); }}>✓ 确认并办结</button><button className="danger wide" disabled={!opinion} onClick={() => { if (confirm("确认退回继续处理？")) perform("return", opinion); }}>↩ 退回继续处理</button></> : <div className="permission"><b>当前用户不能确认</b><p>请切换至指定确认人陈岚或业务主管赵凯。处理人不能自审。</p></div>}</section> : <section className="panel next-panel"><h3>{order.status === "completed" ? "工单已办结" : "尚未提交确认"}</h3><p>{order.status === "completed" ? "所有关键动作已记录，不可编辑或删除。" : "请先由当前处理人填写最终摘要并提交待确认。"}</p>{order.status === "in_progress" && <button className="primary wide" onClick={() => go(`${base(order.id)}/action`)}>进入处理动作</button>}</section>}</aside></div></>; }
function eventLabel(t: EventType) { return ({ work_order: "国内工单", order: "订单", overseas: "海外工单", authorization: "授权", contact: "联系记录", system: "系统" })[t]; }
