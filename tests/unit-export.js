/* unit-export.js — Exporter（S2-03 JSON 导出；S3-08 批 3 九字段白名单 + 双日期段命名）用例：三个纯函数，无 DOM / 无 IndexedDB */
(function () {
  'use strict';

  function makeEntry(id) {
    return {
      id: id,
      ownerId: 'owner-a',
      rawText: '测试账单 ' + id,
      amount: 12.5,
      category: 'food',
      happenedAt: '2026-09-12',
      createdAt: '2026-09-12T08:00:00.000Z',
      location: '敦煌',
      note: '莫高窟门票'
    };
  }

  /* ---- buildExportData ---- */

  T.test('S2-03 buildExportData：结构齐全（app/version/exportedAt/profile/count/entries），profile 只含 id/name', function () {
    var data = Exporter.buildExportData({ id: 'p1', name: '小明' }, [makeEntry('e1')], '2026-09-13T00:00:00.000Z');
    T.eq(data.app, 'travel-ledger');
    T.eq(data.version, 1);
    T.eq(data.exportedAt, '2026-09-13T00:00:00.000Z');
    T.eq(data.profile.id, 'p1');
    T.eq(data.profile.name, '小明');
    T.eq(data.count, 1);
    T.ok(Array.isArray(data.entries));
    T.eq(data.entries.length, 1);
    T.eq(Object.keys(data.profile).length, 2, 'profile 只应含 id/name 两个字段');
  });

  T.test('S2-03 buildExportData：entries 按九字段白名单复制（S3-08 批 3 补 location/note），混入的多余字段不透传', function () {
    var e = makeEntry('e1');
    e.hacked = '混入的脏字段';
    var out = Exporter.buildExportData({ id: 'p1', name: '小明' }, [e], 'x').entries[0];
    T.eq(out.id, 'e1');
    T.eq(out.ownerId, 'owner-a');
    T.eq(out.rawText, '测试账单 e1');
    T.eq(out.amount, 12.5);
    T.eq(out.category, 'food');
    T.eq(out.happenedAt, '2026-09-12');
    T.eq(out.createdAt, '2026-09-12T08:00:00.000Z');
    T.eq(out.location, '敦煌');
    T.eq(out.note, '莫高窟门票');
    T.eq(Object.keys(out).length, 9, '导出条目只应含九个数据字段');
    T.eq(out.hacked, undefined, '白名单外的字段不得透传');
  });

  T.test('S2-03 buildExportData：纯函数——不修改传入数组与条目对象', function () {
    var e = makeEntry('e1');
    var list = [e];
    Exporter.buildExportData({ id: 'p1', name: '小明' }, list, 'x');
    T.eq(list.length, 1);
    T.ok(list[0] === e, '数组元素引用不变');
    T.eq(list[0].rawText, '测试账单 e1');
    T.eq(list[0].amount, 12.5);
  });

  T.test('S2-03 buildExportData：entries 缺省 / null → count 0、entries []（空账户也可导出）', function () {
    var a = Exporter.buildExportData({ id: 'p1', name: '小明' });
    T.eq(a.count, 0);
    T.ok(Array.isArray(a.entries) && a.entries.length === 0);
    var b = Exporter.buildExportData({ id: 'p1', name: '小明' }, null, 'x');
    T.eq(b.count, 0);
    T.eq(b.entries.length, 0);
  });

  T.test('S2-03 buildExportData：exportedAt 原样透传（函数内不取系统时间，输出对入参确定）', function () {
    var iso = '2020-01-02T03:04:05.006Z';
    var data = Exporter.buildExportData({ id: 'p1', name: '小明' }, [], iso);
    T.eq(data.exportedAt, iso);
  });

  /* ---- sanitizeFileName ---- */

  T.test('S2-03 sanitizeFileName：九个跨平台非法字符 / \\ : * ? " < > | 全部替换为 -', function () {
    T.eq(Exporter.sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), 'a-b-c-d-e-f-g-h-i-j');
  });

  T.test('S2-03 sanitizeFileName：清洗后为空 → 兜底「账户」；首尾空白裁掉、连续空白收成一个', function () {
    T.eq(Exporter.sanitizeFileName('///'), '账户');
    T.eq(Exporter.sanitizeFileName(''), '账户');
    T.eq(Exporter.sanitizeFileName(null), '账户');
    T.eq(Exporter.sanitizeFileName('  小明  '), '小明');
    T.eq(Exporter.sanitizeFileName('小  明'), '小 明');
  });

  T.test('S2-03 sanitizeFileName：正常中英文名与点号原样保留（点号是合法文件名字符）', function () {
    T.eq(Exporter.sanitizeFileName('小明'), '小明');
    T.eq(Exporter.sanitizeFileName('Tom 2026'), 'Tom 2026');
    T.eq(Exporter.sanitizeFileName('A.B'), 'A.B');
  });

  /* ---- buildExportFileName ---- */

  T.test('S3-08批3 buildExportFileName：travel-ledger-<名>-<起YYYYMMDD>-<止YYYYMMDD>.json，双日期段横杠去除', function () {
    T.eq(Exporter.buildExportFileName('小明', '2026-09-13', '2026-09-20'), 'travel-ledger-小明-20260913-20260920.json');
  });

  T.test('S3-08批3 buildExportFileName：账户名含非法字符被清洗 / 为空走兜底，整体仍是安全文件名', function () {
    T.eq(Exporter.buildExportFileName('a/b', '2026-09-13', '2026-09-20'), 'travel-ledger-a-b-20260913-20260920.json');
    T.eq(Exporter.buildExportFileName('', '2026-09-13', '2026-09-20'), 'travel-ledger-账户-20260913-20260920.json');
  });
})();
