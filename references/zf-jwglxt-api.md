# 正方教务系统（jwglxt）接口清单

> 基于南京医科大学（jwpt.njmu.edu.cn）实测整理。正方各校部署版本不同，`gnmkdm` 与字段可能略有差异，**以自家抓包为准**。

## 公共约定

- Base：`https://jwpt.<学校域名>`
- 认证：Cookie `JSESSIONID`（教务）+ `CASTGC`（统一认证）
- 提交：`POST`，`Content-Type: application/x-www-form-urlencoded`
- UA：`Mozilla/5.0 (Linux; HarmonyOS) AppleWebKit/537.36 ...`（用移动 UA 部分接口更稳）
- 学期编码：`xnm`=学年起始年（如 `2026`），`xqm`= `3`(秋) / `12`(春) / `16`(小学期)

## 接口表

| 功能 | 端点 | 关键参数 | 返回 |
|---|---|---|---|
| 课表 | `/jwglxt/kbcx/xskbcx_cxXsgrkb.html` | `xnm`、`xqm`、`gnmkdm` | JSON `kbList[]` |
| 成绩 | `/jwglxt/cjcx/cjcx_cxDgXscj.html` | `doType=query`、`xnm`、`xqm`、`queryModel.showCount` | JSON `items[]` |
| 考试 | `/jwglxt/kwgl/kscx_cxXsksxxIndex.html` | `doType=query`、`xnm`、`xqm`、`queryModel.*` | JSON `items[]` |
| 等级考试 | `/jwglxt/kjgl/kjbm_cxXskjbm.html` | `xmlbfl=1001`（只能放 query） | JSON `items[]` |
| 空教室条件 | `/jwglxt/cdjy/cdjy_cxKxcdlb.html` | `gnmkdm=N2155` | HTML `<select>` |
| 空教室查询 | `/jwglxt/cdjy/cdjy_cxKxcd.html` | `xqh_id`、`lh`、`cdlb_id`、`cdmc` | HTML/JSON |
| 学业总评 | `/jwglxt/cjpmtj/cjpmtj_cxXsxytjdIndex.html` | 无 | HTML 直出 |
| 培养方案 | `/jwglxt/pyfa/...`（各校不同） | — | HTML |
| 消息 | `/jwglxt/xtgl/index_cxDbsy.html` | `doType=query`、`sfyy`、`sortName=cjsj ` | JSON `items[]` |
| 学生信息 | 含在课表 `xsxx` 字段 | — | — |
| 证件照 | `/jwglxt/xtgl/photo_cxXszp4.html` | `xh_id`、`zplx=rxhzp` | image/jpeg |

## 字段映射（易错项）

### 考试 `kscx_cxXsksxxIndex`

| 用途 | 正确字段 | 错误用法 | 症状 |
|---|---|---|---|
| 课程名 | `kcmc` | `ksmc` | 全部显示"2026-2027学年第一学期期末考试" |
| 考场 | `cdmc` | `cdbh` | 显示"0219"这种编号 |
| 类型 | `ksxz` | `ksfs` | 显示"闭卷"而不是"期末考试" |
| 时间 | `kssj`（`2026-12-10(14:00-16:00)`） | `split(' ')` | 日期/时间解析为空 |
| 座位 | `zwh` | — | — |
| 教师 | `jsxm` | — | — |

`kssj` 解析正则：
```ts
// 日期
/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
// 时间段（兼容 - ~ 至 — –）
/(\d{1,2}:\d{2})\s*[-~至—–]\s*(\d{1,2}:\d{2})/
```

### 成绩 `cjcx_cxDgXscj`

| 用途 | 字段 | 备注 |
|---|---|---|
| 课程名 | `kcmc` | |
| 成绩 | `cj` | 可能是数字或"优秀/合格/不合格" |
| 绩点 | `jd` | |
| 学分 | `xf` | |
| 课程性质 | `kcxzmc` | 必修/选修/核心… |
| 考试性质 | `ksxz` | 正常/重修 |

### 课表 `xskbcx_cxXsgrkb`

`kbList[]` 每项：`kcmc`(课程)、`xm`(教师)、`cdmc`(地点)、`xqj`(星期 1-7)、`jcs`(节次 "1-2")、`zcd`(周次 "1-16周(单)")、`kcb`(课程类别)。
`xsxx` 含学生信息：`XM`、`BJMC`、`ZYMC`、`NJDM_ID`。

**周次解析**：`1-16周(单)`、`1-4,6-7,9-15周` 这类要展开为周次数组，不能只取首尾。

## 请求参数通用坑

1. **缺少 `queryModel.showCount`** → 默认每页 10 条，成绩/考试被截断（用户以为"数据少了"）
2. **`sortName` 末尾带空格**（`'cjsj '`）才是有效排序，去掉会忽略排序
3. **`xmlbfl` 只能放 query string**，放 body 无效
4. **同一参数并发请求两次**（首页刷新 + 页面初始化）→ 加单飞锁

---

*本表由南医助手（NJMU-Helper）项目实践整理，MIT 许可，可自由用于其他学校的适配。*
