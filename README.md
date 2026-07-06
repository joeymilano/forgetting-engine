# 遗忘引擎 · The Forgetting Engine

> 互联网记住一切,但「被遗忘」才是人的权利。
> 一个专门负责「忘记」的机器 —— 你写下一段想放下的记忆,它把它逐层风化,
> 7 次之后变成一首几乎空白的诗,然后彻底消失。

访客写下一段记忆,LLM 把它逐步改写:细节脱落 → 名字模糊 → 情绪褪色 → 语序松动 → 只剩碎片 → 近乎空白的诗 → 最后的痕迹。
每层切换时,文字以 Canvas 粒子碎裂、飘散、再聚合的动效呈现。

**基调:安静、克制、仪式感。像纸张在时间里风化。**

---

## 技术栈(锁定)

| 层 | 选型 |
| --- | --- |
| 构建 | Vite 5 + 原生 TypeScript(不用 React/Vue) |
| 样式 | 原生 CSS 单文件 + CSS 变量 |
| 文字粒子 | Canvas 2D 自写粒子系统(`src/weathering.ts`) |
| 过渡 | CSS transition + Web Animations API |
| LLM | 智谱 GLM(`glm-4-flash`),经本地代理 / Vercel Function 转发 |
| 字体 | 霞鹜文楷 `LXGW WenKai`(CDN) |

运行时零第三方依赖。

---

## 本地开发

```bash
# 1. 安装依赖(仅 vite + typescript)
npm install

# 2. 配置 API Key
cp .env.example .env
# 在 .env 里填入 ZHIPU_API_KEY  (https://open.bigmodel.cn/)

# 3. 启动(前端 + 本地代理,两个终端)
npm run dev          # 前端  http://localhost:5173
npm run dev:server   # 代理  http://localhost:8787  (vite 已配 proxy 转发 /api)

# 或一键启动(macOS/Linux)
npm start
```

### 演示模式(面试现场保险)

不调 API、完全离线可用,从预置的三组高质量样例中随机取一组:

```
http://localhost:5173/?demo=1
```

---

## 部署(Cloudflare Pages)

前端静态 + 边缘函数,零配置即可上线:

1. 推送到 GitHub。
2. Cloudflare Dashboard → **Workers & Pages** → **创建应用程序** → **Pages** → 连接 GitHub 仓库。
3. 构建与部署设置:
   - **Framework preset**:`None`
   - **Build command**:`npm run build`
   - **Build output directory**:`dist`
   - **Root directory**:`/`(留空)
4. **Settings → Environment variables** 配置(生产环境):
   - `ZHIPU_API_KEY`(必填)
   - `GLM_MODEL`(可选,默认 `glm-4-flash`)
5. 部署。`functions/api/forget.ts` 自动成为边缘端点 `/api/forget`;
   `public/_redirects` 把所有非 `/api/`、非静态资源路径回退到 `index.html`。

仓库内的 `wrangler.jsonc` 会把 Pages 发布目录固定为 `dist`。如果使用 Wrangler
直接发布,请运行 `npm run deploy`;不要运行 `wrangler pages deploy .`,否则会把
TypeScript 源码当成网站发布,页面可见但所有交互都不会启动。

> Key 只存在于 Cloudflare 环境变量,前端代码与仓库中均无 Key。
>
> 也可用 Vercel 部署(`api/forget.ts` + `vercel.json` 已就绪),两者逻辑等价。


---

## 目录

```
forgetting-engine/
├── index.html
├── src/
│   ├── main.ts          # 状态机 + 流程编排
│   ├── stages.ts        # 七阶段视觉参数 + 文案
│   ├── llm.ts           # 调 LLM:清洗 / 校验 / 重试 / fallback
│   ├── fallback.ts      # 纯前端兜底退化算法(断网/限流)
│   ├── weathering.ts    # Canvas 粒子系统(文字碎裂/飘散/聚合)
│   ├── typewriter.ts    # 打字机浮现
│   ├── demo-data.ts     # 三组预置样例
│   └── style.css
├── functions/api/forget.ts  # Cloudflare Pages Function(部署用)
├── api/forget.ts            # Vercel Function(可选部署目标)
├── public/_redirects        # Cloudflare Pages SPA 回退
├── server.mjs               # 本地开发代理(等价逻辑)
├── vercel.json              # Vercel 可选配置
└── .env                     # ZHIPU_API_KEY(不提交)
```

---

## 伦理立场

**不保存** 是作品的一部分:用户输入不落库、不写 localStorage、不打日志正文。
页面上承诺了「它不会被保存」,代码里就真的做到了。

## 致谢 · 音乐

氛围 BGM 均为 **Scott Buckley** 创作,依 **CC-BY 4.0** 授权(可自由用于任何项目,含商用,需署名):

- *Amberlight* — 柔和怀旧钢琴,吉卜力般的暖意
- *Meanwhile* — 空灵梦境钢琴,苦乐参半的余韵
- *Penumbra* — 冰川般的弦乐冥想,饱含思念

> Music by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au
>
> 曲名与作者在页面底部「正在播放」处实时显示,作为署名。

## 禁止事项

不引入 React/Vue/Three.js/GSAP/Tailwind;不把 Key 写进前端;不加音效、彩色渐变、emoji、加载 spinner;
粒子转场未完成时不允许点击下一步。
