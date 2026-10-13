/* unit-ledger.js — Ledger 纯逻辑用例（S1-04 10 条 + S1-05 11 条，共 21 条） */
(function () {
  'use strict';

  var L = Ledger;

  /* 造数助手：id / happenedAt(YYYY-MM-DD) / createdAt(ISO) / amount / category */
  function mk(id, happenedAt, createdAt, amount, category) {
    return { id: id, happenedAt: happenedAt, createdAt: createdAt, amount: amount, category: category };
  }

  T.test('groupByDate：空数组 → []', function () {
    T.eq(L.groupByDate([]).length, 0);
  });

  T.test('groupByDate：单条记录 → 1 组，date / subtotal 正确', function () {
    var g = L.groupByDate([mk('a', '2026-09-12', '2026-09-12T10:00:00.000Z', 50, 'food')]);
    T.eq(g.length, 1);
    T.eq(g[0].date, '2026-09-12');
    T.eq(g[0].subtotal, 50);
    T.eq(g[0].entries.length, 1);
  });

  T.test('groupByDate：三个不同日期 → 3 组，日期降序（最新在最上）', function () {
    var g = L.groupByDate([
      mk('a', '2026-09-10', '2026-09-10T10:00:00.000Z', 1, 'food'),
      mk('b', '2026-09-12', '2026-09-12T10:00:00.000Z', 2, 'food'),
      mk('c', '2026-09-11', '2026-09-11T10:00:00.000Z', 3, 'food')
    ]);
    T.eq(g.length, 3);
    T.eq(g[0].date, '2026-09-12');
    T.eq(g[1].date, '2026-09-11');
    T.eq(g[2].date, '2026-09-10');
  });

  T.test('groupByDate：同日多条同组，组内按 createdAt 降序', function () {
    var g = L.groupByDate([
      mk('a', '2026-09-12', '2026-09-12T02:00:00.000Z', 4, 'food'),
      mk('b', '2026-09-12', '2026-09-12T08:00:00.000Z', 5, 'food'),
      mk('c', '2026-09-12', '2026-09-12T05:00:00.000Z', 6, 'food')
    ]);
    T.eq(g.length, 1);
    T.eq(g[0].entries[0].id, 'b'); /* 08:00 最新在前 */
    T.eq(g[0].entries[1].id, 'c'); /* 05:00 */
    T.eq(g[0].entries[2].id, 'a'); /* 02:00 */
  });

  T.test('groupByDate：createdAt 并列时按 id 兜底，输出稳定', function () {
    var g = L.groupByDate([
      mk('a1', '2026-09-12', '2026-09-12T08:00:00.000Z', 1, 'food'),
      mk('b1', '2026-09-12', '2026-09-12T08:00:00.000Z', 2, 'food')
    ]);
    T.eq(g[0].entries[0].id, 'b1');
    T.eq(g[0].entries[1].id, 'a1');
  });

  T.test('subtotal：小数求和 round 到分，10.1 + 20.2 = 30.3 无浮点尾差', function () {
    var g = L.groupByDate([
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 10.1, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 20.2, 'food')
    ]);
    T.eq(g[0].subtotal, 30.3);
  });

  T.test('categorySummary：同类合并求和，按合计降序', function () {
    var g = L.groupByDate([
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 20, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 10, 'food'),
      mk('c', '2026-09-12', '2026-09-12T03:00:00.000Z', 5, 'transport')
    ]);
    T.eq(g[0].categorySummary.length, 2);
    T.eq(g[0].categorySummary[0].category, 'food');
    T.eq(g[0].categorySummary[0].total, 30);
    T.eq(g[0].categorySummary[1].category, 'transport');
    T.eq(g[0].categorySummary[1].total, 5);
  });

  T.test('categorySummary：合计 ≤ 0 的分类不出现', function () {
    var g = L.groupByDate([
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 0, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 8, 'transport')
    ]);
    T.eq(g[0].categorySummary.length, 1);
    T.eq(g[0].categorySummary[0].category, 'transport');
  });

  T.test('补记分叉：happenedAt=旧日期、createdAt=今天 → 归旧日期组', function () {
    var g = L.groupByDate([
      mk('a', '2026-08-30', '2026-09-12T06:00:00.000Z', 200, 'fuel'),
      mk('b', '2026-09-12', '2026-09-12T07:00:00.000Z', 10, 'food')
    ]);
    T.eq(g.length, 2);
    T.eq(g[0].date, '2026-09-12');
    T.eq(g[1].date, '2026-08-30');
    T.eq(g[1].entries[0].id, 'a'); /* 补记的 200 挂在 8 月 30 日组里 */
  });

  T.test('纯度：groupByDate 不修改传入数组', function () {
    var input = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 1, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 2, 'food')
    ];
    var snapshot = JSON.stringify(input);
    L.groupByDate(input);
    T.eq(JSON.stringify(input), snapshot);
  });

  /* ---------- S1-05：今日支出 / 累计支出 / TOP N 分类 + B-26 口径统一 ---------- */

  T.test('todaySpend：只统计 happenedAt=今天的条目', function () {
    var list = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 50, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 4, 'transport'),
      mk('c', '2026-09-11', '2026-09-12T03:00:00.000Z', 200, 'fuel')
    ];
    T.eq(L.todaySpend(list, '2026-09-12'), 54);
  });

  T.test('todaySpend：补记旧日期不计入；今天无条目 → 0（B-16 口径核心）', function () {
    var list = [
      mk('a', '2026-08-30', '2026-09-12T01:00:00.000Z', 200, 'fuel'),
      mk('b', '2026-09-10', '2026-09-12T02:00:00.000Z', 30, 'food')
    ];
    T.eq(L.todaySpend(list, '2026-09-12'), 0);
    T.eq(L.todaySpend([], '2026-09-12'), 0);
  });

  T.test('totalSpend：全部条目求和（含补记旧日期的钱），与日期字段无关', function () {
    var list = [
      mk('a', '2026-08-30', '2026-09-12T01:00:00.000Z', 200, 'fuel'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 54, 'food')
    ];
    T.eq(L.totalSpend(list), 254);
  });

  T.test('totalSpend：空数组 / null → 0', function () {
    T.eq(L.totalSpend([]), 0);
    T.eq(L.totalSpend(null), 0);
  });

  T.test('今日/累计支出小数 round 到分（10.1 + 20.2 = 30.3）', function () {
    var list = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 10.1, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 20.2, 'transport')
    ];
    T.eq(L.todaySpend(list, '2026-09-12'), 30.3);
    T.eq(L.totalSpend(list), 30.3);
  });

  T.test('topCategories：今日多类按合计降序，同额按键名稳定', function () {
    var list = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 5, 'transport'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 50, 'food'),
      mk('c', '2026-09-12', '2026-09-12T03:00:00.000Z', 20, 'food')
    ];
    var top = L.topCategories(list, '2026-09-12');
    T.eq(top.length, 2);
    T.eq(top[0].category, 'food');
    T.eq(top[0].total, 70);
    T.eq(top[1].category, 'transport');
    T.eq(top[1].total, 5);
  });

  T.test('topCategories：超过 3 类只取前 3，第 4 类截断', function () {
    var list = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 40, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 30, 'transport'),
      mk('c', '2026-09-12', '2026-09-12T03:00:00.000Z', 20, 'hotel'),
      mk('d', '2026-09-12', '2026-09-12T04:00:00.000Z', 10, 'shopping')
    ];
    var top = L.topCategories(list, '2026-09-12');
    T.eq(top.length, 3);
    T.eq(top[2].category, 'hotel');
  });

  T.test('topCategories：今日无消费 → []（空返回契约）；null 入参 → []', function () {
    var list = [mk('a', '2026-09-10', '2026-09-12T01:00:00.000Z', 50, 'food')];
    T.eq(L.topCategories(list, '2026-09-12').length, 0);
    T.eq(L.topCategories([], '2026-09-12').length, 0);
    T.eq(L.topCategories(null, '2026-09-12').length, 0);
  });

  T.test('topCategories：旧日期条目不出现（口径 = happenedAt）', function () {
    var list = [
      mk('a', '2026-09-11', '2026-09-12T01:00:00.000Z', 500, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 4, 'transport')
    ];
    var top = L.topCategories(list, '2026-09-12');
    T.eq(top.length, 1);
    T.eq(top[0].category, 'transport');
  });

  T.test('B-26 恒等式：sumAmounts ≡ Σ buildCategorySummary 各项 total（含 groupByDate 各组）', function () {
    var list = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 50, 'food'),
      mk('b', '2026-09-12', '2026-09-12T02:00:00.000Z', 4, 'transport'),
      mk('c', '2026-09-11', '2026-09-12T03:00:00.000Z', 200, 'fuel'),
      mk('d', '2026-09-12', '2026-09-12T04:00:00.000Z', 0, 'food'),
      mk('e', '2026-09-12', '2026-09-12T05:00:00.000Z', -10, 'food')
    ];
    var groups = L.groupByDate(list);
    for (var gi = 0; gi < groups.length; gi++) {
      var catTotal = L.sumAmounts(groups[gi].categorySummary.map(function (c) {
        return { amount: c.total };
      }));
      T.eq(groups[gi].subtotal, catTotal);
    }
    /* 今日集合同理 */
    var top = L.topCategories(list, '2026-09-12');
    var todayCatTotal = L.sumAmounts(top.map(function (c) { return { amount: c.total }; }));
    T.eq(L.todaySpend(list, '2026-09-12'), todayCatTotal);
    T.eq(L.todaySpend(list, '2026-09-12'), 54); /* 0 与 -10 被排除 */
  });

  T.test('B-26 非法值一致排除：0/负数/null/NaN/字符串在各聚合中结果一致', function () {
    var clean = [mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 50, 'food')];
    var dirty = [
      mk('a', '2026-09-12', '2026-09-12T01:00:00.000Z', 50, 'food'),
      mk('z', '2026-09-12', '2026-09-12T02:00:00.000Z', 0, 'transport'),
      mk('y', '2026-09-12', '2026-09-12T03:00:00.000Z', -5, 'transport'),
      mk('x', '2026-09-12', '2026-09-12T04:00:00.000Z', null, 'hotel'),
      mk('w', '2026-09-12', '2026-09-12T05:00:00.000Z', NaN, 'hotel'),
      mk('v', '2026-09-12', '2026-09-12T06:00:00.000Z', '30', 'shopping')
    ];
    T.eq(L.isValidAmount(0), false);
    T.eq(L.isValidAmount(-5), false);
    T.eq(L.isValidAmount(null), false);
    T.eq(L.isValidAmount(NaN), false);
    T.eq(L.isValidAmount('30'), false);
    T.eq(L.sumAmounts(dirty), L.sumAmounts(clean));
    T.eq(L.totalSpend(dirty), L.totalSpend(clean));
    T.eq(L.todaySpend(dirty, '2026-09-12'), L.todaySpend(clean, '2026-09-12'));
    T.eq(JSON.stringify(L.buildCategorySummary(dirty)), JSON.stringify(L.buildCategorySummary(clean)));
    T.eq(JSON.stringify(L.topCategories(dirty, '2026-09-12')), JSON.stringify(L.topCategories(clean, '2026-09-12')));
  });
})();
