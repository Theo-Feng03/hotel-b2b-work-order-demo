# 酒店 B2B 国内客服工单工作台

基于统一虚构数据实现的多页面 Web Demo，覆盖共享池发现、工单接收、关联信息查看、处理记录、提交确认、确认办结/退回与事实时间线。

在线演示：[GitHub Pages](https://theo-feng03.github.io/hotel-b2b-work-order-demo/)

## 本地运行

```bash
npm install
npm run dev
```

验证：

```bash
npm test
npm run build
npm run build:pages
```

全部业务状态保存在浏览器 LocalStorage 中。顶部“重置 Demo”可恢复初始待接收状态。
