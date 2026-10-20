/**
 * 校园 App 适配层骨架（ArkTS）
 *
 * 用法：把三处 TODO 换成目标学校的真实值，其余逻辑可直接复用。
 * 设计原则：接口层与 UI 解耦——UI 只认 ExamItem / ScoreItem 这类模型，
 * 换学校只改本文件，页面一行不动。
 */
import { http } from '@kit.NetworkKit';
import { preferences } from '@kit.ArkData';

// ─────────────────────────── 1. 配置区（换学校只改这里）

export class SchoolConfig {
  /** TODO 1：目标学校教务域名 */
  static readonly BASE_URL: string = 'https://jwpt.example.edu.cn';

  /** TODO 2：各功能模块码（从抓包取，每校不同） */
  static readonly GNMKDM: Record<string, string> = {
    'kb': 'N2151',      // 课表
    'cj': 'N3051',      // 成绩
    'ks': 'N3423',      // 考试
    'kjbm': 'N2510',    // 等级考试
    'cdjy': 'N2155'     // 空教室
  };

  /** TODO 3：学期起点（用于周次计算，错一天整学期日期全错） */
  static readonly TERM_START: string = '2026-09-07';

  static readonly XQM_FALL: string = '3';
  static readonly XQM_SPRING: string = '12';
  static readonly XQM_SUMMER: string = '16';
}

// ─────────────────────────── 2. 模型（与 UI 约定，不要随意改名）

export interface ExamItem {
  id: string;
  courseName: string;
  date: string;       // yyyy-MM-dd
  timeRange: string;  // HH:mm-HH:mm
  location: string;
  seat: string;
  examType: string;
  teacher: string;
}

export interface ScoreItem {
  id: string;
  courseName: string;
  credit: number;
  scoreText: string;
  gpa: number;
}

// ─────────────────────────── 3. 缓存（按学期隔离 + 内存层）

class Store {
  private static p: preferences.Preferences | null = null;
  private static mem: Map<string, string> = new Map();

  static async init(ctx: Context): Promise<void> {
    Store.p = await preferences.getPreferences(ctx, 'school_adapter');
  }

  static key(module: string, termId: string): string {
    // 语义变更时给 module 加 _v2 后缀即可让旧缓存失效
    return `cache_${module}_${termId}`;
  }

  static get(module: string, termId: string): string {
    const k: string = Store.key(module, termId);
    if (Store.mem.has(k)) {
      return Store.mem.get(k) as string;
    }
    const raw: string = Store.p !== null ? (Store.p.getSync(k, '') as string) : '';
    if (raw.length > 0) {
      Store.mem.set(k, raw);
    }
    return raw;
  }

  static put(module: string, termId: string, value: string): void {
    const k: string = Store.key(module, termId);
    Store.mem.set(k, value);
    Store.p?.putSync(k, value);
    Store.p?.flush();
  }
}

// ─────────────────────────── 4. 单飞 + 请求

class Http {
  private static inflight: Map<string, Promise<string>> = new Map();

  /** 同 key 并发只发一次请求（首页刷新 + 页面初始化常见） */
  static async form(path: string, body: Record<string, string>): Promise<string> {
    const key: string = `${path}?${JSON.stringify(body)}`;
    const running: Promise<string> | undefined = Http.inflight.get(key);
    if (running !== undefined) {
      return running;
    }
    const task: Promise<string> = Http.doPost(path, body).finally(() => {
      Http.inflight.delete(key);
    });
    Http.inflight.set(key, task);
    return task;
  }

  private static async doPost(path: string, body: Record<string, string>): Promise<string> {
    const req: http.HttpRequest = http.createHttp();
    try {
      const parts: string[] = [];
      for (const k of Object.keys(body)) {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(body[k])}`);
      }
      const resp: http.HttpResponse = await req.request(`${SchoolConfig.BASE_URL}${path}`, {
        method: http.RequestMethod.POST,
        header: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 部分学校对移动 UA 返回更完整的 JSON
          'User-Agent': 'Mozilla/5.0 (Linux; HarmonyOS) AppleWebKit/537.36'
        },
        extraData: parts.join('&'),
        connectTimeout: 10000,
        readTimeout: 10000
      });
      return typeof resp.result === 'string' ? resp.result : '';
    } finally {
      req.destroy();
    }
  }
}

// ─────────────────────────── 5. 业务接口（字段映射在此集中处理）

export class SchoolApi {
  /** 考试安排 */
  static async getExams(xnm: string, xqm: string, termId: string): Promise<ExamItem[]> {
    const body: Record<string, string> = {
      'doType': 'query',
      'xnm': xnm,
      'xqm': xqm,
      // 缺这行只会返回前 10 条
      'queryModel.showCount': '100',
      'queryModel.currentPage': '1',
      'queryModel.sortName': 'kssj',
      'queryModel.sortOrder': 'asc'
    };
    const raw: string = await Http.form('/jwglxt/kwgl/kscx_cxXsksxxIndex.html', body);
    const root: Record<string, Object> = JSON.parse(raw) as Record<string, Object>;
    const items: Object[] = (root['items'] as Object[]) ?? [];
    const out: ExamItem[] = [];
    for (const it of items) {
      const o: Record<string, Object> = it as Record<string, Object>;
      const kcmc: string = String(o['kcmc'] ?? '');   // 课程名（别用 ksmc：那是批次名）
      const kssj: string = String(o['kssj'] ?? '');
      const parsed: string[] = SchoolApi.parseExamTime(kssj);
      out.push({
        id: `${kcmc}_${kssj}`,
        courseName: kcmc.length > 0 ? kcmc : String(o['ksmc'] ?? '未知考试'),
        date: parsed[0],
        timeRange: parsed[1],
        location: String(o['cdmc'] ?? o['cdbh'] ?? '待定'),  // cdmc 是楼名房号
        seat: String(o['zwh'] ?? '待定'),
        examType: String(o['ksxz'] ?? o['ksfs'] ?? '考试'),
        teacher: String(o['jsxm'] ?? '')
      });
    }
    Store.put('exams_v2', termId, JSON.stringify(out));
    return out;
  }

  /** 本地缓存（切学期不串台） */
  static getCachedExams(termId: string): ExamItem[] {
    const raw: string = Store.get('exams_v2', termId);
    if (raw.length === 0) {
      return [];
    }
    try {
      return JSON.parse(raw) as ExamItem[];
    } catch (e) {
      return [];
    }
  }

  /** 解析 "2026-12-10(14:00-16:00)" / "2026/1/5 9:00~11:00" */
  private static parseExamTime(s: string): string[] {
    const out: string[] = ['', ''];
    const dm: RegExpMatchArray | null = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dm !== null) {
      const mm: string = dm[2].length === 1 ? `0${dm[2]}` : dm[2];
      const dd: string = dm[3].length === 1 ? `0${dm[3]}` : dm[3];
      out[0] = `${dm[1]}-${mm}-${dd}`;
    }
    const tm: RegExpMatchArray | null = s.match(/(\d{1,2}:\d{2})\s*[-~至—–]\s*(\d{1,2}:\d{2})/);
    if (tm !== null) {
      out[1] = `${tm[1]}-${tm[2]}`;
    } else {
      const one: RegExpMatchArray | null = s.match(/(\d{1,2}:\d{2})/);
      if (one !== null) {
        out[1] = one[1];
      }
    }
    return out;
  }

  /** 学期 → (xnm, xqm)：termId 形如 "2026-2027-1" */
  static termParams(termId: string): string[] {
    const parts: string[] = termId.split('-');
    const idx: string = parts[parts.length - 1];
    const xqm: string = idx === '1' ? SchoolConfig.XQM_FALL
      : (idx === '2' ? SchoolConfig.XQM_SPRING : SchoolConfig.XQM_SUMMER);
    return [parts[0], xqm];
  }
}
