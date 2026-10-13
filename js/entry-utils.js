/*
 * entry-utils.js — 账单录入表单的纯逻辑（S1-02，无 DOM、无 IndexedDB 依赖）
 * 与 profiles.js / parser.js 同模式：纯函数，可直接单元测试。
 *
 * 职责：
 *   1. 本地日期的 YYYY-MM-DD 生成与偏移（happenedAt 字段用，取设备本地时区）
 *   2. 金额输入校验（AC7：必须为 > 0 的有效数字）
 *   3. 日期合法性 / 未来日期判定（AC8：不允许选未来）
 *   4. 阅踪筛选：日期范围校验与地点精确匹配（S3-08，纯函数供单测）
 *   5. 旅程快照推导：从筛选结果集推导存卷四字段（S3-08 批 2，DESIGN_SPEC 3.10）
 *   6. YMD 边界推导：结果集实际最早/最晚合法日期（S3-08 批 3，存卷与导出文件名共用）
 *
 * 注意：所有日期用本地 getFullYear/getMonth/getDate，绝不使用 toISOString（UTC），
 *       否则临近午夜时「今天」会偏一天（详见交付报告「最可能失败的一处」）。
 */
(function (global) {
  'use strict';

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* 把 Date 对象格式化为本地时区的 YYYY-MM-DD */
  function dateToYMD(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /* 今天（本地时区）的 YYYY-MM-DD */
  function todayYMD() {
    return dateToYMD(new Date());
  }

  /*
   * 在某个 YYYY-MM-DD 基础上加减天数，返回新的 YYYY-MM-DD（纯函数，可测跨年/跨月）。
   * 实现：把 ymd 拆成 Date（本地时区正午，避开夏令时边界的小时偏移），
   *       加 days*86400000 毫秒，再格式化回本地日期。
   */
  function addDaysYMD(ymd, days) {
    var parts = String(ymd).split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1; /* 月份从 0 开始 */
    var d = parseInt(parts[2], 10);
    var base = new Date(y, m, d, 12, 0, 0); /* 正午构造，规避夏令时 */
    base.setTime(base.getTime() + days * 86400000);
    return dateToYMD(base);
  }

  /* 相对今天偏移 offset 天的 YYYY-MM-DD；0=今天，-1=昨天，-2=前天 */
  function shiftDateYMD(offset) {
    return addDaysYMD(todayYMD(), offset);
  }

  /*
   * 金额校验（AC7）：
   *   输入为字符串（来自 <input type=number> 的 value）。
   *   返回：有效数字（> 0）→ 该数字；否则（空 / 非数字 / ≤ 0 / NaN）→ null。
   *   不做四舍五入到分——展示与写库由调用层处理，这里只判合法。
   */
  function parseAmount(input) {
    if (input == null) {
      return null;
    }
    var s = String(input).trim();
    if (s === '') {
      return null;
    }
    var n = Number(s);
    if (!isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }

  /* YYYY-MM-DD 是否合法（月份 1-12、日期在该月范围内） */
  function isValidYMD(ymd) {
    var parts = String(ymd).split('-');
    if (parts.length !== 3) {
      return false;
    }
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) {
      return false;
    }
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return false;
    }
    /* 用 Date 反推校验：若解析后月份/日期与输入不一致，说明非法（如 2026-02-30） */
    var dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  /* 是否为未来日期（严格大于今天），本地时区比较 */
  function isFutureYMD(ymd) {
    if (!isValidYMD(ymd)) {
      return false; /* 非法日期不算未来，由 isValidYMD 单独拦截 */
    }
    return String(ymd) > todayYMD();
  }

  /*
   * YYYY-MM-DD → 「YYYY年M月D日」（S3-07 账簿行日期；2026-09-20 人拍板全站带年份，
   * DESIGN_SPEC 9.2，阅踪页日期组头共用此格式）。
   * 非法输入（isValidYMD 判定，含 2026-02-30 这类格式对但日历无的值）→ ''，
   * 由渲染层决定兜底展示。纯函数。
   */
  function formatDayMD(ymd) {
    if (!isValidYMD(ymd)) {
      return '';
    }
    var parts = String(ymd).split('-');
    return parts[0] + '年' + parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
  }

  /*
   * 阅踪筛选日期范围校验（S3-08）：两端均可空（日期可单用，DESIGN_SPEC 3.5）。
   * 填了必须 isValidYMD；两端都填必须 起 ≤ 止（YYYY-MM-DD 字典序 = 日历序）。
   * 不拦未来日期：筛选未来 = 查空，无害（原生 date 也不加 max，2026-09-20 人拍板）。
   * 返回：合法 → ''；非法 → 可读错误文案（调用方 toast）。纯函数。
   */
  function validateRangeYMD(from, to) {
    var hasFrom = typeof from === 'string' && from !== '';
    var hasTo = typeof to === 'string' && to !== '';
    if (hasFrom && !isValidYMD(from)) {
      return '起始日期无效';
    }
    if (hasTo && !isValidYMD(to)) {
      return '结束日期无效';
    }
    if (hasFrom && hasTo && from > to) {
      return '起始日期不能晚于结束日期';
    }
    return '';
  }

  /*
   * 阅踪地点筛选（S3-08）：精确匹配（DESIGN_SPEC 3.10：地点按精确字符串分组，
   * 不做归一化）。query trim 后为空 = 不过滤（原数组返回）；entry.location 缺失
   * （老数据 undefined）与非空 query 不相等，自然排除。不修改传入数组。纯函数。
   */
  function matchLocation(entries, query) {
    if (!entries) {
      return [];
    }
    var q = typeof query === 'string' ? query.trim() : '';
    if (q === '') {
      return entries;
    }
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].location === q) {
        out.push(entries[i]);
      }
    }
    return out;
  }

  /*
   * 当天主地点（deriveJourneyLabel 内部助手）：该天 createdAt 降序首条非空 location，
   * 全天无 → 兜底词。与 app.js renderDayGroup 的账簿主行选点规则同口径
   * （2026-09-20 人拍板①）。规则双写是已知代价：本模块不依赖 Ledger/DOM，
   * 两处各自独立实现，改口径须两处同步（unit-entry-utils 有用例锁死本侧）。
   */
  function pickDayLocation(entries, day, fallback) {
    var best = null;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.happenedAt !== day) {
        continue;
      }
      var loc = e.location;
      if (typeof loc !== 'string' || loc === '') {
        continue;
      }
      if (best === null || String(e.createdAt || '') > String(best.createdAt || '')) {
        best = e;
      }
    }
    return best ? best.location : fallback;
  }

  /*
   * YMD 边界推导（S3-08 批 3 新增）：取结果集实际最早/最晚合法日期（YYYY-MM-DD 字典序）。
   * 输出 { fromYmd, toYmd } | null。
   *   - null 判据（唯一实现，deriveJourneyLabel 的判据与这里逐字一致靠复用保证）：
   *     空数组 / 无一条 isValidYMD 的 happenedAt → null
   *   - 脏日期记录不参与边界；不修改传入数组、不依赖传入顺序（内部自扫 min/max 日）
   * 边界扫描逻辑与 deriveJourneyLabel 共用：本函数为唯一实现，deriveJourneyLabel
   * （批 2 存卷）内部调用本函数取边界，消双写；批 3 导出文件名同用本函数
   * （双边/单边筛选恒用结果实际边界、非筛选框原文——同存卷拍板②口径）。纯函数。
   */
  function deriveYMDRange(entries) {
    if (!entries || entries.length === 0) {
      return null;
    }
    var minDay = null;
    var maxDay = null;
    for (var i = 0; i < entries.length; i++) {
      var day = entries[i].happenedAt;
      if (!isValidYMD(day)) {
        continue; /* 脏日期记录不参与边界 */
      }
      if (minDay === null || day < minDay) {
        minDay = day;
      }
      if (maxDay === null || day > maxDay) {
        maxDay = day;
      }
    }
    if (minDay === null) {
      return null;
    }
    return { fromYmd: minDay, toYmd: maxDay };
  }

  /*
   * 旅程快照推导（S3-08 批 2，DESIGN_SPEC 3.10）：从阅踪当前结果集推导存卷四字段。
   * 输入：结果集（matchLocation 过滤后，任意顺序；去重存卷由调用方防重入，不去重）。
   * 输出：{ fromYmd, toYmd, startLoc, endLoc } | null。
   *   - 空数组 / 无一条 isValidYMD 的 happenedAt → null（null 判据收敛在
   *     deriveYMDRange 单处实现；存卷按钮置灰是主防线，此为纯函数层双保险，
   *     调用方拿 null 不落库）
   *   - fromYmd / toYmd = 结果集实际最早/最晚日期（2026-09-20 人拍板②：存实际边界，
   *     非筛选框原文——单边开区间时原文为空串，存原文会存出残缺区间）
   *   - 起点 = fromYmd 当天的 location；终点 = toYmd 当天的 location；不往前找：
   *     只看当天，不借前后日期的地点（当天无地点即 "在途"，DESIGN_SPEC 3.10）
   *   - location 非字符串/空串（含老数据 undefined）→ "在途"（DESIGN_SPEC 5 兜底词）
   *   - 不修改传入数组、不依赖传入顺序（边界扫描共用 deriveYMDRange，批 3 抽出）。纯函数。
   */
  function deriveJourneyLabel(entries) {
    var FALLBACK = '在途';
    var bounds = deriveYMDRange(entries);
    if (!bounds) {
      return null;
    }
    return {
      fromYmd: bounds.fromYmd,
      toYmd: bounds.toYmd,
      startLoc: pickDayLocation(entries, bounds.fromYmd, FALLBACK),
      endLoc: pickDayLocation(entries, bounds.toYmd, FALLBACK)
    };
  }

  global.EntryUtils = {
    todayYMD: todayYMD,
    dateToYMD: dateToYMD,
    addDaysYMD: addDaysYMD,
    shiftDateYMD: shiftDateYMD,
    parseAmount: parseAmount,
    isValidYMD: isValidYMD,
    isFutureYMD: isFutureYMD,
    formatDayMD: formatDayMD,
    validateRangeYMD: validateRangeYMD,
    matchLocation: matchLocation,
    deriveJourneyLabel: deriveJourneyLabel,
    deriveYMDRange: deriveYMDRange
  };
})(window);
