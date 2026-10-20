# 统一认证（CAS）接入与降级策略

## 南医大实测链路

```
GET  /ICloudPortal/                    → 302 到 authserver
GET  authserver.njmu.edu.cn/authserver/login?service=...
POST authserver.njmu.edu.cn/authserver/login   （username/password/execution/_eventId）
     → Set-Cookie: CASTGC=...
GET  ...?ticket=ST-xxx                 → 302 回业务系统并下发 JSESSIONID
```

关键 Cookie：

| Cookie | 域 | 作用 | 有效期 |
|---|---|---|---|
| `CASTGC` | authserver | 统一认证主票据，**免密二次登录的关键** | 通常 7 天 |
| `JSESSIONID` | jwpt | 教务会话 | 30 分钟~2 小时 |
| `MULTIFACTOR_*` | authserver | 可信设备指纹（部分学校启用 MFA） | 设备绑定 |

## 三种接入方案（按成功率排序）

### 方案 A：直接登录 + 保留 CASTGC（推荐）

```
POST /authserver/login → 拿 CASTGC
GET  /jwglxt/...（带 Cookie）→ 拿业务数据
```
要点：
- 登录成功后把 CASTGC 与业务 Cookie 一起持久化
- 后续每次启动先用 CASTGC 静默换 ticket，失败再要求输密码
- 密码只在内存中出现，不要落盘

### 方案 B：WebView 登录 + 抓 Cookie

App 内嵌登录页，用户手动输一次，从 `onPageEnd` 的 URL/Cookie 提取会话。
适用于：**登录页有验证码 / 滑块 / MFA** 的学校。
实现要点：
- `domStorageAccess(true)`（正方前端依赖 localStorage）
- 登录成功后立刻 `WebCookieManager.getCookie()` 取全量 Cookie
- 轮询检测会话可用（每 1.5s 试一次业务接口），不依赖 URL 判定

### 方案 C：全 WebView（放弃 API）

适用判据：**登录后业务接口仍需前端 JS 生成的签名/水印/token**，或 MFA 无法绕过。
此时不要硬刚，直接内嵌网页版，保留原生壳（导航、返回、刷新）。
代价：无法做原生卡片、离线缓存、桌面小组件。

## 反例与教训（真实踩过）

| 做法 | 结果 |
|---|---|
| 用 URL 里的 `ticket=ST-xxx` 直接请求业务接口 | 失败：ticket 被前端首次请求消费，第二次 302 到登录页 |
| 从 localStorage 取会话做 AES-ECB 解密 | 失败：设备 OpenSSL 裁剪，`CryptoArchitectureKit` 不支持 ECB |
| 假定"有 CASTGC 就一定能免密" | 部分学校开了 MFA，仍会跳二次验证页 |
| WebView 里 `backward()` 逐层后退 | 用户体验差（退不出网页），应改为直接退出页面 |

## 多端接续（应用接续）注意事项

- `module.json5` 的 ability 需 `"continuable": true`
- `onContinue` 里**只放轻量状态**（Tab 序号 + 页面路由名），业务数据走各自缓存
- **不要依赖内存态**：接续是冷启动，`AppState.stack` 可能为空 → 状态要落持久化（preferences）
- 恢复 UI 时要等 controller 就绪再切页，否则指令发出但界面不动（见 pitfalls.md）

---

*MIT 许可，来源于 NJMU-Helper 项目实践。*
