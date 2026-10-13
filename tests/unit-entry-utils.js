/* unit-entry-utils.js — EntryUtils 纯逻辑用例（S1-02 起；S3-07 加 formatDayMD；
   S3-08 加 validateRangeYMD/matchLocation；批 2 加 deriveJourneyLabel，共 44 条） */
(function () {
  'use strict';

  var U = EntryUtils;

  /* ---- 日期：5 条 ---- */

  T.test('todayYMD：返回 YYYY-MM-DD 且与本地今天一致', function () {
    var s = U.todayYMD();
    T.ok(/^\d{4}-\d{2}-\d{2}$/.test(s), '格式应为 YYYY-MM-DD，实际 ' + s);
    var now = new Date();
    var expected = now.getFullYear() + '-'
      + (now.getMonth() < 9 ? '0' : '') + (now.getMonth() + 1) + '-'
      + (now.getDate() < 10 ? '0' : '') + now.getDate();
    T.eq(s, expected);
  });

  T.test('addDaysYMD：偏移 0 天等于原日期', function () {
    var today = U.todayYMD();
    T.eq(U.addDaysYMD(today, 0), today);
  });

  T.test('addDaysYMD：偏移 -1 天是昨天', function () {
    var today = U.todayYMD();
    var parts = today.split('-');
    var y = +parts[0], m = +parts[1] - 1, d = +parts[2];
    var yest = new Date(y, m, d - 1, 12, 0, 0);
    var expected = yest.getFullYear() + '-'
      + (yest.getMonth() < 9 ? '0' : '') + (yest.getMonth() + 1) + '-'
      + (yest.getDate() < 10 ? '0' : '') + yest.getDate();
    T.eq(U.addDaysYMD(today, -1), expected);
  });

  T.test('addDaysYMD：偏移 -2 天是前天', function () {
    var today = U.todayYMD();
    var parts = today.split('-');
    var y = +parts[0], m = +parts[1] - 1, d = +parts[2];
    var by = new Date(y, m, d - 2, 12, 0, 0);
    var expected = by.getFullYear() + '-'
      + (by.getMonth() < 9 ? '0' : '') + (by.getMonth() + 1) + '-'
      + (by.getDate() < 10 ? '0' : '') + by.getDate();
    T.eq(U.addDaysYMD(today, -2), expected);
  });

  T.test('addDaysYMD：跨年边界 2026-01-01 -1 天 = 2025-12-31', function () {
    T.eq(U.addDaysYMD('2026-01-01', -1), '2025-12-31');
  });

  /* ---- 金额：7 条 ---- */

  T.test('parseAmount：整数 50 → 50', function () {
    T.eq(U.parseAmount('50'), 50);
  });

  T.test('parseAmount：小数 50.5 → 50.5', function () {
    T.eq(U.parseAmount('50.5'), 50.5);
  });

  T.test('parseAmount：空字符串 → null', function () {
    T.eq(U.parseAmount(''), null);
  });

  T.test('parseAmount：非数字 abc → null', function () {
    T.eq(U.parseAmount('abc'), null);
  });

  T.test('parseAmount：0 → null（必须 > 0）', function () {
    T.eq(U.parseAmount('0'), null);
  });

  T.test('parseAmount：负数 -5 → null', function () {
    T.eq(U.parseAmount('-5'), null);
  });

  T.test('parseAmount：首尾空格自动 trim，12 → 12', function () {
    T.eq(U.parseAmount('  12  '), 12);
  });

  /* ---- 日期校验：2 条 ---- */

  T.test('isFutureYMD：明天为 true，今天/昨天为 false', function () {
    T.eq(U.isFutureYMD(U.addDaysYMD(U.todayYMD(), 1)), true);
    T.eq(U.isFutureYMD(U.todayYMD()), false);
    T.eq(U.isFutureYMD(U.addDaysYMD(U.todayYMD(), -1)), false);
  });

  T.test('isValidYMD：合法日期 true，非法月/日 false', function () {
    T.eq(U.isValidYMD('2026-09-12'), true);
    T.eq(U.isValidYMD('2026-13-40'), false);
    T.eq(U.isValidYMD('2026-02-30'), false);
  });

  /* ---- formatDayMD（S3-07 账簿行日期；S3-08 决策 2 起带年份，DESIGN_SPEC 9.2）：6 条 ---- */

  T.test('formatDayMD：两位月个位日去前导零，2026-10-01 → 2026年10月1日', function () {
    T.eq(U.formatDayMD('2026-10-01'), '2026年10月1日');
  });

  T.test('formatDayMD：两位月两位日，2026-09-28 → 2026年9月28日', function () {
    T.eq(U.formatDayMD('2026-09-28'), '2026年9月28日');
  });

  T.test('formatDayMD：个位月个位日，2026-01-05 → 2026年1月5日', function () {
    T.eq(U.formatDayMD('2026-01-05'), '2026年1月5日');
  });

  T.test('formatDayMD：年末边界，2026-12-31 → 2026年12月31日', function () {
    T.eq(U.formatDayMD('2026-12-31'), '2026年12月31日');
  });

  T.test('formatDayMD：格式对但日历无（2026-02-30）→ 空串', function () {
    T.eq(U.formatDayMD('2026-02-30'), '');
  });

  T.test('formatDayMD：空串与乱串 → 空串', function () {
    T.eq(U.formatDayMD(''), '');
    T.eq(U.formatDayMD('abc'), '');
  });

  /* ---- validateRangeYMD（S3-08 阅踪筛选范围校验）：6 条 ---- */

  T.test('validateRangeYMD：两端均空 → 合法（日期可单用）', function () {
    T.eq(U.validateRangeYMD('', ''), '');
  });

  T.test('validateRangeYMD：只填起始 → 合法', function () {
    T.eq(U.validateRangeYMD('2026-09-01', ''), '');
  });

  T.test('validateRangeYMD：只填结束 → 合法', function () {
    T.eq(U.validateRangeYMD('', '2026-09-30'), '');
  });

  T.test('validateRangeYMD：起 ≤ 止（含同日）→ 合法', function () {
    T.eq(U.validateRangeYMD('2026-09-01', '2026-09-30'), '');
    T.eq(U.validateRangeYMD('2026-09-15', '2026-09-15'), '');
  });

  T.test('validateRangeYMD：起 > 止 → 拒绝', function () {
    T.eq(U.validateRangeYMD('2026-09-30', '2026-09-01'), '起始日期不能晚于结束日期');
  });

  T.test('validateRangeYMD：填了但非法日期 → 拒绝', function () {
    T.eq(U.validateRangeYMD('2026-02-30', ''), '起始日期无效');
    T.eq(U.validateRangeYMD('', '2026-13-01'), '结束日期无效');
  });

  /* ---- matchLocation（S3-08 阅踪地点筛选，精确匹配）：4 条 ---- */

  T.test('matchLocation：空 query（含纯空格）不过滤，原数组返回', function () {
    var list = [{ location: '敦煌' }, { location: '' }];
    T.eq(U.matchLocation(list, ''), list);
    T.eq(U.matchLocation(list, '   '), list);
  });

  T.test('matchLocation：精确命中只留该条', function () {
    var list = [{ location: '敦煌' }, { location: '兰州' }];
    T.eq(U.matchLocation(list, '敦煌').length, 1);
    T.eq(U.matchLocation(list, '敦煌')[0].location, '敦煌');
  });

  T.test('matchLocation：query 首尾空格 trim 后匹配', function () {
    var list = [{ location: '敦煌' }];
    T.eq(U.matchLocation(list, ' 敦煌 ').length, 1);
  });

  T.test('matchLocation：无命中 → 空数组；location 缺失（老数据）被非空 query 排除', function () {
    T.eq(U.matchLocation([{ location: '敦煌' }], '兰州').length, 0);
    T.eq(U.matchLocation([{}], '兰州').length, 0);
  });

  /* ---- deriveJourneyLabel（S3-08 批 2 旅程快照推导，DESIGN_SPEC 3.10）：14 条 ---- */

  T.test('deriveJourneyLabel：空数组 → null（调用方不落库）', function () {
    T.eq(U.deriveJourneyLabel([]), null);
  });

  T.test('deriveJourneyLabel：null / undefined → null（纯函数防御）', function () {
    T.eq(U.deriveJourneyLabel(null), null);
  });

  T.test('deriveJourneyLabel：happenedAt 全非法 → null', function () {
    T.eq(U.deriveJourneyLabel([
      { happenedAt: '2026-02-30', location: '兰州' },
      { happenedAt: '乱串', location: '敦煌' }
    ]), null);
  });

  T.test('deriveJourneyLabel：单笔有地点 → from=to=该日、start=end=该地名（渲染层折叠为单个地名）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-05', location: '敦煌', createdAt: '2026-09-05T10:00:00.000Z' }
    ]);
    T.eq(out.fromYmd, '2026-09-05');
    T.eq(out.toYmd, '2026-09-05');
    T.eq(out.startLoc, '敦煌');
    T.eq(out.endLoc, '敦煌');
  });

  T.test('deriveJourneyLabel：单笔无地点（空串 / undefined 老数据）→ start=end=「在途」', function () {
    var empty = U.deriveJourneyLabel([{ happenedAt: '2026-09-05', location: '' }]);
    T.eq(empty.startLoc, '在途');
    T.eq(empty.endLoc, '在途');
    var missing = U.deriveJourneyLabel([{ happenedAt: '2026-09-05' }]);
    T.eq(missing.startLoc, '在途');
    T.eq(missing.endLoc, '在途');
  });

  T.test('deriveJourneyLabel：起点日无地点、终点日有 → 「在途」+终点地名（一端空）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '' },
      { happenedAt: '2026-09-03', location: '敦煌' }
    ]);
    T.eq(out.fromYmd, '2026-09-01');
    T.eq(out.toYmd, '2026-09-03');
    T.eq(out.startLoc, '在途');
    T.eq(out.endLoc, '敦煌');
  });

  T.test('deriveJourneyLabel：终点日无地点、起点日有 → 起点+「在途」（一端空）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '兰州' },
      { happenedAt: '2026-09-03', location: undefined }
    ]);
    T.eq(out.startLoc, '兰州');
    T.eq(out.endLoc, '在途');
  });

  T.test('deriveJourneyLabel：两端都无地点 → 双「在途」（多笔）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '' },
      { happenedAt: '2026-09-02', location: '' }
    ]);
    T.eq(out.startLoc, '在途');
    T.eq(out.endLoc, '在途');
  });

  T.test('deriveJourneyLabel：不往前/往后找——中间日有地点不外借给空端点', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '' },
      { happenedAt: '2026-09-02', location: '张掖' },
      { happenedAt: '2026-09-03', location: '' }
    ]);
    T.eq(out.startLoc, '在途');
    T.eq(out.endLoc, '在途');
  });

  T.test('deriveJourneyLabel：多日乱序输入 → from/to 取实际边界、首末日各取当天地点（人拍板②）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-03', location: '敦煌' },
      { happenedAt: '2026-09-01', location: '兰州' },
      { happenedAt: '2026-09-02', location: '张掖' }
    ]);
    T.eq(out.fromYmd, '2026-09-01');
    T.eq(out.toYmd, '2026-09-03');
    T.eq(out.startLoc, '兰州');
    T.eq(out.endLoc, '敦煌');
  });

  T.test('deriveJourneyLabel：同日多笔取 createdAt 降序首条非空（同账簿主行口径，人拍板①）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '兰州', createdAt: '2026-09-01T08:00:00.000Z' },
      { happenedAt: '2026-09-01', location: '河口西', createdAt: '2026-09-01T20:00:00.000Z' },
      { happenedAt: '2026-09-02', location: '张掖', createdAt: '2026-09-02T12:00:00.000Z' }
    ]);
    T.eq(out.startLoc, '河口西', '起点日当天最晚记账的非空地点');
    T.eq(out.endLoc, '张掖');
  });

  T.test('deriveJourneyLabel：同日多笔、最新一笔无地点 → 跳过取次新非空（降序首条「非空」）', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-09-01', location: '', createdAt: '2026-09-01T22:00:00.000Z' },
      { happenedAt: '2026-09-01', location: '兰州', createdAt: '2026-09-01T08:00:00.000Z' }
    ]);
    T.eq(out.startLoc, '兰州');
    T.eq(out.endLoc, '兰州');
  });

  T.test('deriveJourneyLabel：跨年边界字典序 = 日历序，2026-12-31 < 2027-01-02', function () {
    var out = U.deriveJourneyLabel([
      { happenedAt: '2026-12-31', location: '敦煌' },
      { happenedAt: '2027-01-02', location: '哈密' }
    ]);
    T.eq(out.fromYmd, '2026-12-31');
    T.eq(out.toYmd, '2027-01-02');
  });

  T.test('deriveJourneyLabel：混入非法 happenedAt 的脏记录被忽略；不修改传入数组', function () {
    var input = [
      { happenedAt: '2026-09-01', location: '兰州' },
      { happenedAt: '2026-13-99', location: '脏数据' },
      { happenedAt: '2026-09-02', location: '张掖' }
    ];
    var snapshot = JSON.stringify(input);
    var out = U.deriveJourneyLabel(input);
    T.eq(out.fromYmd, '2026-09-01');
    T.eq(out.toYmd, '2026-09-02');
    T.eq(out.startLoc, '兰州');
    T.eq(out.endLoc, '张掖');
    T.eq(JSON.stringify(input), snapshot, '纯函数不改传入数组');
  });

  /* ---- deriveYMDRange（S3-08 批 3 导出文件名边界，扫描逻辑与 deriveJourneyLabel 共用）：6 条 ---- */

  T.test('deriveYMDRange：空数组 → null（与 deriveJourneyLabel 判据逐字一致）', function () {
    T.eq(U.deriveYMDRange([]), null);
  });

  T.test('deriveYMDRange：null / undefined → null（纯函数防御，判据与 deriveJourneyLabel 一致）', function () {
    T.eq(U.deriveYMDRange(null), null);
  });

  T.test('deriveYMDRange：happenedAt 全非法 → null（与 deriveJourneyLabel 判据逐字一致）', function () {
    T.eq(U.deriveYMDRange([
      { happenedAt: '2026-02-30' },
      { happenedAt: '乱串' }
    ]), null);
  });

  T.test('deriveYMDRange：单笔 → from=to=该日', function () {
    var out = U.deriveYMDRange([{ happenedAt: '2026-09-05' }]);
    T.eq(out.fromYmd, '2026-09-05');
    T.eq(out.toYmd, '2026-09-05');
  });

  T.test('deriveYMDRange：乱序多日 + 混入脏日期 → 取合法记录实际边界；输出只含 fromYmd/toYmd', function () {
    var input = [
      { happenedAt: '2026-09-20' },
      { happenedAt: '2026-09-08' },
      { happenedAt: '2026-13-99' },
      { happenedAt: '2026-09-15' }
    ];
    var snapshot = JSON.stringify(input);
    var out = U.deriveYMDRange(input);
    T.eq(out.fromYmd, '2026-09-08');
    T.eq(out.toYmd, '2026-09-20');
    T.eq(Object.keys(out).length, 2, '只输出 fromYmd/toYmd（导出文件名只需边界）');
    T.eq(JSON.stringify(input), snapshot, '纯函数不改传入数组');
  });

  T.test('deriveYMDRange：跨年边界字典序 = 日历序', function () {
    var out = U.deriveYMDRange([
      { happenedAt: '2027-01-02' },
      { happenedAt: '2026-12-31' }
    ]);
    T.eq(out.fromYmd, '2026-12-31');
    T.eq(out.toYmd, '2027-01-02');
  });
})();
