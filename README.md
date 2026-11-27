# Trace Studio 源码工程 · V1.6

当前网页版本的源码备份。工程为纯前端应用，文件和粘贴内容在浏览器本地解析，不需要后端或账号密钥。

## 本地运行

准备 Node.js 22。仓库同时带 `pnpm-lock.yaml` 和 `package-lock.json`，pnpm、npm 任一都能装（推荐使用下方 npm 命令）：

```bash
npm ci
npm run dev
```

终端会显示本地访问地址，通常为 `http://localhost:5173`。如端口被占用，以终端实际地址为准。页面中的“演示数据”可直接体验功能。

## 测试和构建

```bash
npm test
npm run build
```

构建输出在 `dist/`，可交给静态网站服务部署。请通过 HTTP 服务访问，不要双击源码 `index.html`；直接使用 `file://` 打开构建目录也可能受到浏览器模块与 Worker 限制。

若希望在本机查看构建版本：

```bash
npx vite preview --host 127.0.0.1
```

按终端提示打开地址。源码中的开发命令绑定所有网络接口；只想本机访问时可使用 `pnpm exec vite --host 127.0.0.1`。

## 上手三步

1. 打开或粘贴 JSON / JSONL：页面顶部「打开」选文件，或点「粘贴」贴文本；JSON 整段算一条，JSONL 每行一条。想先看效果，用欢迎页的「演示数据」。
2. 看轨迹：中间「执行轨迹」栏按角色渲染，USER 靠右、ASSISTANT 靠左，工具调用单独成块；左侧选题导航按条切换记录。
3. 配结果栏：在原始 JSON 树里把某个字段点「结果1 / 结果2」，右侧就按结构树展示；字段值是 message_index（或配置过的 round_index 等别名）时会渲染成蓝色 M# 链接，点击跳到轨迹对应的一条。

## 部署

执行 `npm run build` 后，将 `dist/` 部署到静态网站服务。下文也提供单文件构建方式。

## 工程结构

- `src/`：界面、JSON 树、轨迹渲染、解析 Worker、搜索、索引识别、角色筛选与日夜主题。
- `tests/`：60 项自动化测试，以及少量人工构造的测试样例。
- `scripts/verify-real.ts`：可选的文件解析检查脚本。例如 `pnpm exec tsx scripts/verify-real.ts /绝对路径/样例.jsonl`，它只输出解析统计，不修改文件。
- `package.json`、`pnpm-lock.yaml`：依赖与锁定版本。
- `vite.config.ts`、`tsconfig.json`、CSS 配置和 `index.html`：开发与构建配置。
- `site.meta`：站点描述元数据，本地运行不依赖它。

## 当前功能

- 打开或粘贴 JSON / JSONL，支持替换和追加；JSON 整段作为一条记录。
- 可收起选题导航、按 ID 切换记录、拖动调整分栏宽度和移动预览栏顺序。
- 配置轨迹、结果1、结果2字段；支持 messages、常见 inputs 和工具调用／返回内容。
- 原始 JSON 和结果的逐字段复制、全部展开／收起，轨迹逐消息查看原文。
- 各栏独立搜索和当前题整体搜索，命中计数与上下条定位。
- message_index 与 call_index 分色跳转，轮次标识可新增、停用、恢复并记住。
- 轨迹角色多选，隐藏角色不改原始编号。
- 日间／夜间模式；大数组和长消息分批展示。

## 备份范围与注意事项

本包包含 V1.6 实际源码、依赖锁文件和测试，不包含 `node_modules/`、Git 历史、构建产物、缓存、平台部署记录或用户上传的业务轨迹。示例中的安全测试字符串用于验证 HTML 清理，不会作为页面脚本执行。

主题与轮次标识保存在当前网站的浏览器本地存储，不同域名和本地开发地址不共享这些设置。刷新后需要重新打开或粘贴数据。

这是静态源码备份，不会自动跟随在线网页更新。之后升级功能时，需要保存新源码或合并修改，再重新构建。

打包前当前源码已通过60项自动化测试和生产构建。V1.6以界面功能版本为准，保留原工程 `package.json` 的包版本号，不为备份修改它。

## 单文件构建（用于公开链接发布）

`npm run build` 之后，`scripts/build-singlefile.py` 会把 `dist/` 里的 JS、CSS 和 parser worker 内联进一个 HTML，产出可直接托管的单文件版本：

```bash
npm run build
python3 scripts/build-singlefile.py dist TraceStudio.html
```

产物 `TraceStudio.html` 不依赖同目录的 `assets/`，可以整份上传到静态托管（当前线上版本即由此构建后发布）。

## 线上版本

- 公开链接：https://bytedance.doubao.link/app/app_17jvpvuq13n
- 打包产物不入库，`dist/` 与 `node_modules/` 已在 `.gitignore` 中忽略；需要时按上面命令重新构建。

## 许可证

项目源码采用 [MIT](LICENSE)。第三方代码保留其原许可证，见 [第三方许可](THIRD_PARTY_NOTICES.txt)。
