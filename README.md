# 校园 App 学校适配指南（Campus App School Adapter）

一套把开源校园 App 迁移到**任意使用正方教务系统（jwglxt）的高校**的实战方法 + AI Skill。

> 来源：[NJMU-Helper（南医助手）](https://github.com/xiopeng32-ai/NJMU-Helper) 从 1.9.x 到 2.0.15 的真实适配过程。
> 所有"坑"都是调试日志里出现过的，不是推测。

## 这个仓库解决什么问题

拿到一个校园 App 的源码，想改成自己学校的 —— 通常卡在三个地方：

1. **不知道接口怎么抓**（登录后跳来跳去，找不到数据从哪来）
2. **字段对不上**（成绩为空、课表串学期、所有考试一个名）
3. **踩了平台坑**（鸿蒙编译崩溃、分享超限、多端接续白屏）

本仓库给出：**接口清单 + 字段映射表 + 21 条踩坑记录 + 可勾选的验收清单 + 适配层骨架代码**。

## 快速开始

### 方式一：作为 AI Skill 使用（推荐）

把 `SKILL.md` 和 `references/` 放进你的 AI 助手 skills 目录（WorkBuddy：`~/.workbuddy/skills/campus-app-school-adapter/`），然后：

```
帮我把这个校园 App 适配到 XX 大学，这是抓到的课表响应：[粘贴 JSON]
```

AI 会按 `references/zf-jwglxt-api.md` 逐字段核对，产出映射差异表，再改适配层。

### 方式二：人工照着做

按下面顺序：

1. **侦察** → `references/sso-cas.md`（判断走 API 还是 WebView）
2. **对接口** → `references/zf-jwglxt-api.md`（端点 + 参数 + 字段）
3. **写适配层** → `assets/adapter-skeleton.ts`（改 3 处 TODO 即可）
4. **避坑** → `references/pitfalls.md`
5. **验收** → `references/checklist.md`

## 文件结构

```
SKILL.md                          # 方法论主文档（四步工作流）
references/
  zf-jwglxt-api.md                # 正方教务接口表 + 字段映射 + 参数坑
  sso-cas.md                      # 统一认证三方案与降级策略
  pitfalls.md                     # 21 条实战踩坑（症状→根因→修法）
  checklist.md                    # 迁移验收清单（A~I 共 40+ 项）
assets/
  adapter-skeleton.ts             # ArkTS 适配层骨架（接口/映射/缓存/单飞）
```

## 覆盖范围

| 项 | 支持 |
|---|---|
| 教务系统 | 正方 jwglxt（国内高校主流） |
| 数据 | 课表、成绩、考试、等级考试、空教室、消息、学业总评、培养方案 |
| 认证 | CAS 统一认证（直接登录 / WebView 抓 Cookie / 全 WebView） |
| 平台 | HarmonyOS 手机 / 平板 / 2in1(PC) / 智慧屏(tv) / 开源鸿蒙(OpenHarmony) |
| 框架 | ArkTS / ArkUI（鸿蒙原生） |

## 三条最重要的经验

1. **90% 的工作在侦察和字段映射，不在 UI。** 接口层与 UI 解耦，换学校只改一个文件。
2. **缓存必须按学期隔离。** 单键缓存的必然结果是"切学期后数据串台"，而且用户会以为是接口坏了。
3. **HMS Kit 是编译期依赖。** 想支持开源鸿蒙，`canIUse` 和 try/catch 都没用，必须物理替换（见 pitfalls #17）。

## 贡献

欢迎补充你所在学校的差异（`gnmkdm`、字段、特殊鉴权）。提 PR 时请附：

- 学校（可匿名，写"某 211 高校"即可）
- 正方版本（页面底部或 `/jwglxt/xtgl/index_initMenu.html` 可见）
- 你遇到的差异 + 解决方式

## 许可

MIT。可自由用于商业/非商业项目，保留版权声明即可。

**免责**：本项目仅提供技术方法，不包含任何学校的账号、密码或私有数据。使用前请确认符合所在学校的信息系统使用规定，控制请求频率，不要给学校服务器造成压力。
