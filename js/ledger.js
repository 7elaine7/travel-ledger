/*
 * ledger.js — 账本纯逻辑（S1-04/S1-05）：按日期分组、组内排序、本日小计、
 * 分类聚合、今日/累计支出、今日 TOP N 分类。
 * 只聚合 category 键与金额数值，不维护任何图标/名称映射；
 * 图标与名称由渲染层从 Parser.CATEGORY_META 取（防 B-19 式映射漂移）。
 * 日期口径（人拍板 2026-09-12）：分组 / 本日小计 / 今日支出 = happenedAt；
 * 组内排序 = createdAt 降序，同值按 id 兜底；累计支出 = 全量求和（B-16）。
 * 金额口径（B-26，人拍板 2026-09-12）：isValidAmount 为唯一有效金额判定，
 * 求和与分类聚合共用，保证"总额 ≡ 分类合计"恒等式。纯函数，不修改传入数组。
 */
(function (global) {
  'use strict';

  /* 金额 round 到分，规避浮点尾差（10.1 + 20.2 = 30.29999…） */
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  /*
   * 唯一有效金额判定（B-26，2026-09-12 人拍板）：有限数字且 > 0。
   * MVP 只有支出、无收入录入入口；0/负数/null/NaN/字符串均为非法/脏数据，
   * sumAmounts 与 buildCategorySummary 必须共用此判定，
   * 否则"总额 ≠ 分类合计"（B-26）。将来做收入需整体重议，不在此预设。
   *
   * 恒等式前提（S1-05 review P2-1 核实，2026-09-12）：输入金额已由 db 层
   * addEntry 规范化为分精度（Math.round(amount*100)/100，见 db.js），
   * 故入库金额恒为 2dp，"单条 ×N ≡ 小计/合计"真实成立，聚合层无需再 round 输入。
   */
  function isValidAmount(a) {
    return typeof a === 'number' && isFinite(a) && a > 0;
  }

  function sumAmounts(entries) {
    if (!entries) {
      return 0;
    }
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      if (isValidAmount(entries[i].amount)) {
        total += entries[i].amount;
      }
    }
    return round2(total);
  }

  /* 组内排序：createdAt 降序（同日新写的在上），createdAt 并列时按 id 兜底保证输出稳定 */
  function sortEntries(list) {
    return list.slice().sort(function (a, b) {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt < b.createdAt ? 1 : -1;
      }
      var ida = String(a.id);
      var idb = String(b.id);
      if (ida === idb) {
        return 0;
      }
      return ida < idb ? 1 : -1;
    });
  }

  /*
   * 分类聚合：仅保留当日合计 > 0 的分类（AC：无消费的分类不显示），
   * 按合计降序、同额按键名稳定排序。返回 [{category, total}]，不含图标/名称。
   */
  function buildCategorySummary(entries) {
    var totals = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (isValidAmount(e.amount)) {
        var key = e.category;
        totals[key] = (Object.prototype.hasOwnProperty.call(totals, key) ? totals[key] : 0) + e.amount;
      }
    }
    var list = [];
    for (var k in totals) {
      if (Object.prototype.hasOwnProperty.call(totals, k)) {
        list.push({ category: k, total: round2(totals[k]) });
      }
    }
    list.sort(function (a, b) {
      if (a.total !== b.total) {
        return b.total - a.total;
      }
      return a.category < b.category ? -1 : (a.category > b.category ? 1 : 0);
    });
    return list;
  }

  /*
   * 分组主入口：happenedAt 为分组键（YYYY-MM-DD 字符串比较即时间序），
   * 组按日期降序（最新在最上）。返回：
   * [{ date, entries(组内已排序), subtotal, categorySummary }]
   */
  function groupByDate(entries) {
    if (!entries || entries.length === 0) {
      return [];
    }
    var buckets = {};
    var dates = [];
    for (var i = 0; i < entries.length; i++) {
      var date = entries[i].happenedAt;
      if (!buckets[date]) {
        buckets[date] = [];
        dates.push(date);
      }
      buckets[date].push(entries[i]);
    }
    dates.sort(function (a, b) {
      return a < b ? 1 : (a > b ? -1 : 0);
    });
    var groups = [];
    for (var j = 0; j < dates.length; j++) {
      var list = sortEntries(buckets[dates[j]]);
      groups.push({
        date: dates[j],
        entries: list,
        subtotal: sumAmounts(list),
        categorySummary: buildCategorySummary(list)
      });
    }
    return groups;
  }

  /*
   * 今日支出（S1-05，B-16 口径 = happenedAt）：只统计消费发生日 == todayYmd 的条目。
   * 补记旧日期的钱不计入今天。todayYmd 由调用方传入（本地 YYYY-MM-DD），
   * 函数内不 new Date()，保证纯函数可测、确定性。
   */
  function todaySpend(entries, todayYmd) {
    if (!entries) {
      return 0;
    }
    var todays = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].happenedAt === todayYmd) {
        todays.push(entries[i]);
      }
    }
    return sumAmounts(todays);
  }

  /*
   * 累计支出（S1-05，B-16）：当前账户全量条目求和，与 happenedAt/createdAt 无关——
   * 补记旧日期的钱照样增加累计。
   */
  function totalSpend(entries) {
    return sumAmounts(entries);
  }

  /*
   * 今日 TOP N 分类（S1-05）：先按 happenedAt=todayYmd 过滤，再复用
   * buildCategorySummary（已按合计降序、同额按键名排序），取前 n 条（默认 3）。
   * 今日无消费 → []，由渲染层显示"今日暂无消费"（空返回契约）。
   */
  function topCategories(entries, todayYmd, n) {
    if (!entries) {
      return [];
    }
    var limit = (typeof n === 'number' && isFinite(n) && n >= 0) ? n : 3;
    var todays = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].happenedAt === todayYmd) {
        todays.push(entries[i]);
      }
    }
    return buildCategorySummary(todays).slice(0, limit);
  }

  global.Ledger = {
    groupByDate: groupByDate,
    sumAmounts: sumAmounts,
    buildCategorySummary: buildCategorySummary,
    isValidAmount: isValidAmount,
    todaySpend: todaySpend,
    totalSpend: totalSpend,
    topCategories: topCategories
  };
})(window);
