# 实战踩坑清单

> 全部来自 NJMU-Helper（南医助手）从 1.9.x 到 2.0.15 的真实调试记录。按"症状 → 根因 → 修法"组织。

## 一、数据类

### 1. 所有考试名称一样

**症状**：列表里每场考试都叫"2026-2027学年第一学期期末考试"。
**根因**：`courseName` 取了 `ksmc`（考试批次名）。
**修法**：改取 `kcmc`（课程名），`ksmc` 仅兜底。**同时把缓存键升版**（`cache_exams_v2_<termId>`），否则用户端仍是旧错误数据。

### 2. 考场显示成三位数字

**根因**：用了 `cdbh`（场地编号）。**修法**：`cdmc`（场地名称）。

### 3. 切换学期后考试列表串台

**根因**：缓存用单一键 `KEY_EXAMS`，不同学期互相覆盖。
**修法**：`cache_exams_<termId>` 按学期隔离；读取时传入当前学期。

### 4. 成绩/考试只显示前 10 条

**根因**：请求缺 `queryModel.showCount`，正方默认每页 10 条。
**修法**：补 `showCount=100&currentPage=1&sortName=kssj`。

### 5. 核心 GPA 恒为 -1

**根因**：学校学业总评页本就不返回核心 GPA 字段。
**修法**：用必修 GPA 兜底，避免依赖该字段的"学位预警"规则失效。

## 二、性能类

### 6. 同一接口被请求两次

**症状**：日志里同一 URL 同一参数相隔 0ms 出现两条 POST。
**根因**：首页 `refreshAll` 与业务页 `aboutToAppear` 并发。
**修法**：
```ts
private static examsInflight: Map<string, Promise<ExamItem[]>> = new Map();
// 命中则复用，完成后 delete
```

### 7. 每次切 Tab 都卡一下

**根因**：`loadCachedXxx()` 每次都读大值文件 + `JSON.parse`（课表 116 条）。
**修法**：内存层 + 缓存时间戳失效：
```ts
if (mem !== null && stamp === lastCacheStamp) return mem;
```

### 8. 定时器泄漏

检查所有 `setInterval` 是否有对应 `clearInterval`，且放在 `aboutToDisappear`。
已知安全点：登录轮询（停止条件内自带 + 页面销毁清理）、动画 timer、今日课表 30s tick。

## 三、鸿蒙/ArkTS 类

### 9. `es2abc` 段错误（Signal 11 / core dumped）

**症状**：编译报 `Failed to execute es2abc`，无具体语法错误。
**根因**：单个 `@Builder` 渲染节点过多/嵌套过深（经验阈值：节点 > 80 或嵌套 > 5 层）。
**修法**：把多行文本合并为单个 `Text`（字符串拼接），减少嵌套 `Row`/`Column`。

### 10. `@Extend` 位置引起解析错乱

**症状**：报 `Declaration or statement expected` 但看不出问题。
**根因**：`@Extend(Text) function xxx()` 放在 `interface` 之后。
**修法**：移到文件顶部，或直接写样式不抽 `@Extend`。

### 11. `PixelMap.scale()` 返回值类型

**症状**：`Type 'void' is not assignable to type 'PixelMap'`。
**根因**：`scale(x, y)` 是**原地缩放**，返回 `Promise<void>`。
**修法**：`await pixel.scale(0.8, 0.8)`，不要再接返回值。

### 12. ShareKit 报 `IPC data is oversized`（code=1003702002）

**根因**：`systemShare.SharedData` 单条数据 200KB IPC 上限；整屏截图 1~3MB 必超。
**修法**（按优先级）：
1. 改用 `startAbility({ action:'ohos.want.action.sendData', type:'image/jpeg', uri })`，只传 URI
2. 若要存相册：`SaveButton` 安全控件 + `photoAccessHelper.createAsset()`
3. 纯图分享要压缩：先 `scale` 降分辨率再降 quality，目标 ≤170KB

### 13. `PhotoViewPicker` 没有 `save()`

当前 SDK 只有 `select()`。保存图片用 `createAsset()`（需安全控件授权）或 `ImageExport.showAssetsCreationDialog`。

### 14. 安全控件不支持通用属性

**症状**：`Property 'margin' does not exist on type 'SaveButtonAttribute'`。
**修法**：外层包 `Row(){ SaveButton(...) }.margin(...)`。

### 15. 接续后屏幕空白（不渲染）

**根因**：`aboutToAppear` 里预设 `currentIndex`，而 HdsTabs 把 `index` 当"初始页"，controller 未绑定前设非 0 → 内容区空。
**修法**：保持默认 0 启动 → 700ms 后**双通道**切页（`currentIndex = tab` + `tabsController.changeIndex(tab)`）→ 1200ms 校验 → 失败再试 → 仍失败 Toast 提示。

### 16. 接续指令发出但界面不动

**判据**：`onChange` 回调没触发。
**修法**：加 `onChange` 日志确认；若始终不触发，说明 controller 未就绪，延迟到 1s+ 再切。

### 17. 开源鸿蒙编译失败

**根因**：HMS Kit 是**编译期依赖**，无法用 `canIUse`/try 规避。
**必须物理替换**：
| Kit | 替换 |
|---|---|
| `@kit.UIDesignKit`（HdsTabs） | 原生 `Tabs` + `TabsController`，`.barFloatingStyle` 改 `.barHeight + .barBackgroundColor(Transparent)` |
| `@kit.DeviceSecurityKit`（dlpAntiPeep） | 移除，仅保留 `setWindowPrivacyMode` 后台遮挡 |
| `@kit.ShareKit` | `startAbility(sendData)` |

### 18. 改 bundleName 后签名失败

**症状**：`00303074 The bundleName in app.json5 does not match the SigningConfigs`。
**修法**：签名 profile 绑定包名，改包名必须重新申请证书；否则保持原包名。

## 四、体验类

### 19. 分享弹"选择打开方式"很难用

用户真实反馈：`sendData` 会弹应用选择器。
**修法**：主路径改为"直接保存到相册"，分享作为次要入口。

### 20. 长按手势与点击冲突

`LongPressGesture({ duration: 450 })` + `onClick` 可以共存；但**容器组件尾随闭包后不能再链式加属性**（如 `MaterialCard(...) { }` 后接 `.gesture()` 会编译失败）——把属性加到内层容器上。

### 21. 导出图片太丑

反面：整块深色底 + 白字，信息糊在一起。
正面：**深蓝渐变头部（统计条）+ 白色主体（列表）**，日期用徽章方块，行间细分割线，页脚水印。

---

*MIT 许可。若你迁移时遇到新坑，欢迎提 PR 补充。*
