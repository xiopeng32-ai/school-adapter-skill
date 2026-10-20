---
name: campus-app-school-adapter
description: 把开源校园 App（正方教务系统客户端）迁移到另一所学校。覆盖抓包侦察、统一认证（CAS）接入、教务字段映射、缓存与并发、鸿蒙多端适配（手机/平板/PC/智慧屏/开源鸿蒙）与上线审核的完整流程。触发词：适配学校、迁移学校、换学校、校园 App 二次开发、正方教务接入、教务接口对接、school adapter。
---

# 校园 App 学校适配 Skill

把一套已跑通的校园 App（以南医助手 / NJMU-Helper 为参考实现）迁移到目标学校。
核心结论先给：**90% 的工作量在"侦察接口"和"字段映射"，不在写 UI。**

## 什么时候用

- 拿到一个开源校园 App，想改成自己学校的
- 已有 App，换学校后接口全错（成绩为空、课表串学期、考试名不对）
- 需要判断"能不能纯 API 接入，还是要 WebView"

## 四步工作流

### 第 1 步：侦察（决定技术路线，别急着写代码）

必须回答三个问题：

| 问题 | 怎么查 | 决定什么 |
|---|---|---|
| 教务是不是正方（jwglxt）？ | 登录后看 URL 是否含 `/jwglxt/` | 决定能否复用现成接口层 |
| 统一认证是否强制 MFA / 二次验证？ | 用手机浏览器无痕登录一次 | 决定 API 直连 or WebView |
| 会话能否脱离浏览器复现？ | 抓 Cookie（JSESSIONID / CASTGC）后 curl 试一次 | 决定登录方案 |

抓包要点：
- UA 必须是移动端或与 WebView 一致的 UA，否则部分学校返回不同页面
- 表单提交 `Content-Type: application/x-www-form-urlencoded`
- 记下每个接口的 `gnmkdm`（功能模块代码，每校不同）与 `xnm/xqm`（学年/学期编码）

**判据**：若登录后 15 分钟内用 Cookie 能直接 curl 到 `/jwglxt/xskbcx_cxXsgrkb.html`（课表）并拿到 JSON，就走 API 直连；若被 MFA 拦截或返回登录页，改走 WebView（见 references/sso-cas.md 的降级策略）。

### 第 2 步：接口层（复用结构，替换参数）

参考 `references/zf-jwglxt-api.md` 的接口表，逐个替换：

1. **baseUrl**：`https://jwpt.<学校域名>`
2. **gnmkdm**：每个接口的功能模块码（各校不同，必须从抓包取）
3. **xnm/xqm 编码**：正方用 `xqm=3`（第一学期）/`12`（第二学期）/`16`（小学期），**不是 1/2**
4. **学期起点**：`term.startDate` 决定周次计算，错一天整学期课表日期全错

### 第 3 步：字段映射（最容易出错，逐条核对）

用真实响应体逐字段比对，**不要凭字段名猜**。见 `references/zf-jwglxt-api.md` 的映射表，重点：

- 考试：`kcmc`（课程名）≠ `ksmc`（考试批次名，如"2026-2027学年第一学期期末考试"）
- 考场：`cdmc`（"明达楼115"）≠ `cdbh`（场地编号"0219"）
- 考试类型：`ksxz`（期末/期中/补考）≠ `ksfs`（闭卷/开卷）
- 成绩：`cj` 可能是数字或"优秀/合格"，`jd` 是绩点，`xf` 学分
- 时间：`kssj` 形如 `2026-12-10(14:00-16:00)`，必须正则解析而不是按空格切

### 第 4 步：缓存与并发（决定"卡不卡"）

参考实现的做法：

| 问题 | 方案 |
|---|---|
| 切学期后数据串台 | 缓存键按学期隔离：`cache_exams_<termId>`，改字段后升版 `_v2` |
| 首页 + 页面并发同一接口 | 单飞锁：`Map<termId, Promise>`，同 key 复用进行中的请求 |
| 大列表反复解析 | 内存层 + `cacheTime` 时间戳失效 |
| 刷新风暴 | 全局节流 2s，页面级 `refreshing` 标记 |

## 平台适配（鸿蒙）

| 设备 | 关键点 |
|---|---|
| 手机/平板 | 断点 600vp + 横屏判定为大屏 |
| PC(2in1) | 窗口最小尺寸 420×620；底栏宽度随窗口档位；hover 态 |
| 智慧屏 | `deviceTypes` 加 `tv`；底栏图标 26vp/文字 14vp；遥控器焦点 `.focusable(true)` + `onKeyEvent`(ENTER/DPAD_CENTER) |
| 开源鸿蒙 | 移除华为专有 Kit（UIDesignKit / DeviceSecurityKit / ShareKit），详见 references/pitfalls.md |

## 上线前必查

见 `references/checklist.md`，其中最容易漏的三条：
1. 演示数据不得写入真实缓存（否则用户登录后看到假数据）
2. 权限申请要给"拒绝后仍可用"的降级路径（日历/相册/通知）
3. 应用名与图标不要直接沿用原项目（侵权 + 审核驳回）

## 参考文件

- `references/zf-jwglxt-api.md` — 正方教务接口清单与字段映射表
- `references/sso-cas.md` — 统一认证接入与 MFA 降级策略
- `references/pitfalls.md` — 实战踩坑（含 ArkTS/es2abc、ShareKit IPC、多端接续）
- `references/checklist.md` — 迁移检查清单（可勾选）
- `assets/adapter-skeleton.ts` — 适配层骨架代码（接口 + 映射 + 缓存）

## 使用方式

1. 先把目标学校的 3 个关键响应体（课表/成绩/考试）贴给我
2. 我按 `references/zf-jwglxt-api.md` 逐字段核对，产出映射差异表
3. 按差异表改适配层，不改 UI
4. 用 `references/checklist.md` 走一遍验收
