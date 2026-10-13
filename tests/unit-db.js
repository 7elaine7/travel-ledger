/* unit-db.js — db.js 用例
 * 只连测试库 travel-ledger-test，与正式库 travel-ledger 物理隔离（BRIEF 6.5-A）。
 */
(function () {
  'use strict';

  var db = null;

  function clearStore(name) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(name, 'readwrite');
      t.objectStore(name).clear();
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error); };
    });
  }

  function reset() {
    return Promise.all([
      clearStore(DB.STORE_PROFILES),
      clearStore(DB.STORE_ENTRIES),
      clearStore(DB.STORE_JOURNEYS)
    ]);
  }

  function nextTick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  /* S2-01 review：测试库版本守卫。
     末尾"升级迁移"用例会把库开到 DB_VERSION+1 再删库；若上轮运行中途失败没走到删除，
     高版本残留会让本套件开头的 openDB(当前版本) 直接触发 VersionError 整屏红。
     套件首个用例前先无版本号打开（只探测、不升级）：版本高于当前 DB_VERSION 就删库，
     等版本锁释放后交给首个用例按当前版本干净重建。
     105/108 修复（C1+C2）：原三处逐字重复的内联删库（本函数、#22、#37）收敛于此。
     核心是 settled 守卫——WebKit 下 db.close() 同步断开、版本锁异步释放，刚 close 的
     连接会触发 onblocked 并安排 +100ms 重试；若原始请求随后成功而重试不作废，重试会在
     +100ms 落地成"幽灵删库"，杀掉正在使用的测试连接与数据库（冷启动 105/108 的根因）。
     守卫保证：原始请求已出结果（成功/失败都算）后，任何已排定与后续的重试一律不再发出。 */
  function deleteTestDatabase() {
    return new Promise(function (resolve) {
      var settled = false; /* 删库请求链是否已出结果 */
      function issueDelete() {
        var r = indexedDB.deleteDatabase(DB.TEST_DB_NAME);
        r.onsuccess = function () { settled = true; resolve(); };
        r.onerror = function () { settled = true; resolve(); };
        r.onblocked = function () {
          if (settled) { return; } /* 原始请求已出结果：作废一切后续重试 */
          setTimeout(function () {
            if (settled) { return; } /* 排定期间已出结果：作废本次补发 */
            issueDelete(); /* 尚未出结果：补发，新请求继承同一 settled 守卫 */
          }, 100);
        };
      }
      issueDelete();
    });
  }

  async function ensureTestDBAtCurrentVersion() {
    var version = await new Promise(function (resolve, reject) {
      var probe = indexedDB.open(DB.TEST_DB_NAME);
      /* 库不存在时无版本打开会建出空库（无 store），不处理；后续 openDB(当前版本) 升级会建 schema */
      probe.onupgradeneeded = function () { /* 探测不建 schema */ };
      probe.onsuccess = function () {
        var v = probe.result.version;
        probe.result.close();
        resolve(v);
      };
      probe.onerror = function () { reject(probe.error); };
    });
    if (version > DB.DB_VERSION) {
      await nextTick(); /* close 后等版本锁释放，避免 deleteDatabase 被 block */
      await deleteTestDatabase();
    }
  }

  T.test('库结构：含 profiles / entries / journeys，entries 与 journeys 上有 ownerId 索引', async function () {
    await ensureTestDBAtCurrentVersion();
    db = await DB.openDB(DB.TEST_DB_NAME);
    T.ok(db.objectStoreNames.contains(DB.STORE_PROFILES));
    T.ok(db.objectStoreNames.contains(DB.STORE_ENTRIES));
    T.ok(db.objectStoreNames.contains(DB.STORE_JOURNEYS), 'v5 应有 journeys 表');
    var entriesStore = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES);
    T.ok(entriesStore.indexNames.contains('ownerId'));
    var journeysStore = db.transaction(DB.STORE_JOURNEYS).objectStore(DB.STORE_JOURNEYS);
    T.ok(journeysStore.indexNames.contains('ownerId'), 'journeys 应有 ownerId 索引');
    await reset();
  });

  T.test('空库 getAllProfiles() 返回 []，不 reject', async function () {
    await reset();
    var profiles = await DB.getAllProfiles(db);
    T.ok(Array.isArray(profiles));
    T.eq(profiles.length, 0);
  });

  T.test('addProfile 后能读回，且含 id / name / createdAt', async function () {
    await reset();
    var created = await DB.addProfile(db, '小明');
    T.ok(typeof created.id === 'string' && created.id.length > 0);
    T.eq(created.name, '小明');
    T.ok(typeof created.createdAt === 'string' && created.createdAt.length > 0);
    var profiles = await DB.getAllProfiles(db);
    T.eq(profiles.length, 1);
    T.eq(profiles[0].id, created.id);
    T.eq(profiles[0].name, '小明');
  });

  T.test('createdAt 是可被 Date 解析的 ISO 字符串', async function () {
    await reset();
    var created = await DB.addProfile(db, '小红');
    T.ok(!isNaN(Date.parse(created.createdAt)));
  });

  T.test('连续创建两条，id 互不相同', async function () {
    await reset();
    var a = await DB.addProfile(db, '甲');
    var b = await DB.addProfile(db, '乙');
    T.ok(a.id !== b.id);
    T.eq((await DB.getAllProfiles(db)).length, 2);
  });

  /* ---- B-03：entries 读写强制 ownerId（硬保证） ---- */

  function makeEntryData(text) {
    return {
      rawText: text || '测试花费描述',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-12'
    };
  }

  T.test('B-03 addEntry：ownerId 缺失（null / \'\' / undefined）→ reject，错误信息可读', async function () {
    var bad = [null, '', undefined];
    for (var i = 0; i < bad.length; i++) {
      var err = null;
      try {
        await DB.addEntry(db, bad[i], makeEntryData());
      } catch (e) {
        err = e;
      }
      T.ok(err, 'ownerId=' + JSON.stringify(bad[i]) + ' 应被拒绝');
      T.ok(err.message.indexOf('ownerId') !== -1, '错误信息应可读（提及 ownerId）');
    }
  });

  T.test('B-03 addEntry：拦截发生在开事务之前，拒绝后整表零残留', async function () {
    /* 测试自检允许直接开事务数整表；禁令 6 约束的是业务代码路径 */
    function countAllEntries() {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES).count();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }
    try { await DB.addEntry(db, null, makeEntryData()); } catch (e) { /* 预期拒绝 */ }
    try { await DB.addEntry(db, '', makeEntryData()); } catch (e) { /* 预期拒绝 */ }
    T.eq(await countAllEntries(), 0);
  });

  T.test('B-03 addEntry：正常写入并读回，7 字段齐全且 ownerId 与传入一致', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '我今天吃肉夹馍花了50',
      amount: 50,
      category: 'food',
      happenedAt: '2026-09-12'
    });
    T.ok(typeof saved.id === 'string' && saved.id.length > 0);
    T.eq(saved.ownerId, 'owner-a');
    T.eq(saved.rawText, '我今天吃肉夹馍花了50');
    T.eq(saved.amount, 50);
    T.eq(saved.category, 'food');
    T.eq(saved.happenedAt, '2026-09-12');
    T.ok(!isNaN(Date.parse(saved.createdAt)));
    var list = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(list.length, 1);
    T.eq(list[0].id, saved.id);
  });

  T.test('B-03 getEntriesByOwner：两账户各写 2 条，各自只读回自己的，互不串', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('甲的早餐'));
    await DB.addEntry(db, 'owner-a', makeEntryData('甲的午餐'));
    await DB.addEntry(db, 'owner-b', makeEntryData('乙的晚餐'));
    await DB.addEntry(db, 'owner-b', makeEntryData('乙的夜宵'));
    var a = await DB.getEntriesByOwner(db, 'owner-a');
    var b = await DB.getEntriesByOwner(db, 'owner-b');
    T.eq(a.length, 2);
    T.eq(b.length, 2);
    T.ok(a.every(function (e) { return e.ownerId === 'owner-a'; }));
    T.ok(b.every(function (e) { return e.ownerId === 'owner-b'; }));
  });

  T.test('B-03 getEntriesByOwner：不存在的 ownerId 返回空数组，不报错', async function () {
    var list = await DB.getEntriesByOwner(db, 'nobody');
    T.ok(Array.isArray(list));
    T.eq(list.length, 0);
  });

  T.test('B-03 getEntriesByOwner：ownerId 缺失（null / \'\'）→ reject（读路径同样硬拦截）', async function () {
    var threwNull = false;
    try { await DB.getEntriesByOwner(db, null); } catch (e) { threwNull = true; }
    var threwEmpty = false;
    try { await DB.getEntriesByOwner(db, ''); } catch (e) { threwEmpty = true; }
    T.ok(threwNull);
    T.ok(threwEmpty);
  });

  T.test('B-03 模块表面：不暴露任何无 ownerId 的全表读接口（禁令 6 结构性收口）', function () {
    T.eq(typeof DB.getEntriesByOwner, 'function');
    T.eq(typeof DB.getAllEntries, 'undefined');
  });

  T.test('addEntry：超长小数写入时金额规范化到分（1.234 → 1.23），读回一致', async function () {
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '金额规范化',
      amount: 1.234,
      category: 'food',
      happenedAt: '2026-09-12'
    });
    T.eq(saved.amount, 1.23);
    var list = await DB.getEntriesByOwner(db, 'owner-a');
    var readBack = null;
    for (var k = 0; k < list.length; k++) {
      if (list[k].id === saved.id) { readBack = list[k]; }
    }
    T.ok(readBack, '写入的条目应能按 id 读回');
    T.eq(readBack.amount, 1.23);
  });

  /* ---- B-33：updateEntry（编辑能力数据层；编辑 UI 在 S2-02，此处无 UI 可手动验） ---- */

  function countAllEntriesB33() {
    /* 测试自检允许直接开事务数整表；禁令 6 约束的是业务代码路径 */
    return new Promise(function (resolve, reject) {
      var req = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES).count();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function findEntry(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  }

  T.test('B-33 updateEntry：ownerId 缺失（null / \'\' / undefined）→ reject，拦截在开事务前、整表零写入', async function () {
    await reset();
    var before = await countAllEntriesB33();
    var bad = [null, '', undefined];
    for (var i = 0; i < bad.length; i++) {
      var err = null;
      try {
        await DB.updateEntry(db, bad[i], 'some-id', makeEntryData());
      } catch (e) {
        err = e;
      }
      T.ok(err, 'ownerId=' + JSON.stringify(bad[i]) + ' 应被拒绝');
      T.ok(err.message.indexOf('ownerId') !== -1, '错误信息应提及 ownerId');
    }
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('B-33 updateEntry：patch 为 null / 非对象（undefined / 字符串 / 数字）→ reject，整表零写入', async function () {
    await reset();
    var before = await countAllEntriesB33();
    var bad = [null, undefined, 'not-an-object', 42];
    for (var i = 0; i < bad.length; i++) {
      var err = null;
      try {
        await DB.updateEntry(db, 'owner-a', 'some-id', bad[i]);
      } catch (e) {
        err = e;
      }
      T.ok(err, 'patch=' + JSON.stringify(bad[i]) + ' 应被拒绝');
    }
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('B-33 updateEntry：entryId 缺失（null / \'\'）→ reject，拦截在开事务前、整表零改动', async function () {
    await reset();
    var before = await countAllEntriesB33();
    var errNullId = null;
    var errEmptyId = null;
    try { await DB.updateEntry(db, 'owner-a', null, makeEntryData()); } catch (e) { errNullId = e; }
    try { await DB.updateEntry(db, 'owner-a', '', makeEntryData()); } catch (e) { errEmptyId = e; }
    T.ok(errNullId);
    T.ok(errEmptyId);
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('B-33 updateEntry：不存在的 id → reject，不静默新建；随后按该 owner 读回仍为空', async function () {
    await reset();
    var err = null;
    try {
      await DB.updateEntry(db, 'owner-a', 'not-a-real-id', makeEntryData());
    } catch (e) {
      err = e;
    }
    T.ok(err);
    T.ok(err.message.indexOf('不存在') !== -1, '错误信息应说明记录不存在');
    var list = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(list.length, 0);
  });

  T.test('B-33 updateEntry：四字段全部更新并读回；id / ownerId / createdAt 恒等不变', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '原文',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-01'
    });
    var updated = await DB.updateEntry(db, 'owner-a', saved.id, {
      rawText: '改后的原文',
      amount: 25.5,
      category: 'transport',
      happenedAt: '2026-09-10'
    });
    T.eq(updated.id, saved.id);
    T.eq(updated.ownerId, 'owner-a');
    T.eq(updated.createdAt, saved.createdAt);
    T.eq(updated.rawText, '改后的原文');
    T.eq(updated.amount, 25.5);
    T.eq(updated.category, 'transport');
    T.eq(updated.happenedAt, '2026-09-10');
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.ok(readBack, '更新的条目应能按 id 读回');
    T.eq(readBack.id, saved.id);
    T.eq(readBack.ownerId, 'owner-a');
    T.eq(readBack.createdAt, saved.createdAt);
    T.eq(readBack.rawText, '改后的原文');
    T.eq(readBack.amount, 25.5);
    T.eq(readBack.category, 'transport');
    T.eq(readBack.happenedAt, '2026-09-10');
  });

  T.test('B-33 updateEntry：金额与 addEntry 同规则规范化到分（1.236 → 1.24）', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '金额更新规范化',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-12'
    });
    var updated = await DB.updateEntry(db, 'owner-a', saved.id, {
      rawText: '金额更新规范化',
      amount: 1.236,
      category: 'food',
      happenedAt: '2026-09-12'
    });
    T.eq(updated.amount, 1.24);
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.eq(readBack.amount, 1.24);
  });

  T.test('B-33 updateEntry：持他人 entryId 更新 → reject 且不写回；真主人读回原值完好', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '甲的原文',
      amount: 50,
      category: 'food',
      happenedAt: '2026-09-01'
    });
    var err = null;
    try {
      await DB.updateEntry(db, 'owner-b', saved.id, {
        rawText: '被串改的原文',
        amount: 999,
        category: 'other',
        happenedAt: '2026-09-11'
      });
    } catch (e) {
      err = e;
    }
    T.ok(err);
    T.ok(err.message.indexOf('其他账户') !== -1, '错误信息应说明无权操作其他账户');
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.eq(readBack.rawText, '甲的原文');
    T.eq(readBack.amount, 50);
    T.eq(readBack.category, 'food');
    T.eq(readBack.happenedAt, '2026-09-01');
  });

  T.test('B-33 updateEntry：patch 混入 id / ownerId / createdAt 伪造值一律忽略（白名单组装）', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '原文',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-01'
    });
    var updated = await DB.updateEntry(db, 'owner-a', saved.id, {
      id: 'hacked-id',
      ownerId: 'owner-b',
      createdAt: '2000-01-01T00:00:00.000Z',
      rawText: '正常修改',
      amount: 12,
      category: 'toll',
      happenedAt: '2026-09-02'
    });
    T.eq(updated.id, saved.id);
    T.eq(updated.ownerId, 'owner-a');
    T.eq(updated.createdAt, saved.createdAt);
    T.eq(updated.rawText, '正常修改');
    T.eq(updated.amount, 12);
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.eq(readBack.id, saved.id);
    T.eq(readBack.ownerId, 'owner-a');
    T.eq(readBack.createdAt, saved.createdAt);
  });

  /* ---- S2-01：时间段区间查询（复合索引 ownerId_happenedAt，v2 引入） ---- */

  T.test('S2-01 升级迁移：手工搭真 v1 库（含旧数据）升到 v2 后复合索引存在，旧数据可区间查询读回', async function () {
    /* 前序用例可能已把测试库开到 v2：先关连接、删库，从真正的 v1 重建。
       删库不再依赖"等一帧"（C3）：刚 close 的连接若未及释放锁，deleteDatabase
       会走 onblocked 重试等待，settled 守卫保证重试不会在请求成功后落地成幽灵删库 */
    if (db) {
      db.close();
      db = null;
    }
    await deleteTestDatabase();
    /* 手工搭 v1 schema（只有 ownerId 索引，没有复合索引），绕开 DB.openDB 的 v2 幂等块 */
    db = await new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB.TEST_DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore(DB.STORE_PROFILES, { keyPath: 'id' });
        var es = d.createObjectStore(DB.STORE_ENTRIES, { keyPath: 'id' });
        es.createIndex('ownerId', 'ownerId', { unique: false });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    var savedV1 = await DB.addEntry(db, 'owner-a', makeEntryData('v1 时代的老账单'));
    db.close();
    await nextTick();
    /* 再按当前版本（v2）打开：触发 v1 → v2 幂等迁移，老数据自动编入复合索引 */
    db = await DB.openDB(DB.TEST_DB_NAME);
    var entriesStore = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES);
    T.ok(entriesStore.indexNames.contains('ownerId_happenedAt'), '复合索引应已创建');
    T.ok(entriesStore.indexNames.contains('ownerId'), '原 ownerId 索引应保留');
    var inRange = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-12', '2026-09-12');
    T.eq(inRange.length, 1);
    T.eq(inRange[0].id, savedV1.id);
    T.eq(inRange[0].rawText, 'v1 时代的老账单');
  });

  T.test('S2-01 模块表面：getEntriesByOwnerInRange 暴露为函数；仍无任何无 ownerId 全表读接口', function () {
    T.eq(typeof DB.getEntriesByOwnerInRange, 'function');
    T.eq(typeof DB.getAllEntries, 'undefined');
    T.eq(typeof DB.getEntriesInRange, 'undefined');
  });

  T.test('S2-01 getEntriesByOwnerInRange：ownerId 缺失（null / \'\'）→ reject，开事务前拦截', async function () {
    var threwNull = false;
    try { await DB.getEntriesByOwnerInRange(db, null, '2026-09-01', '2026-09-12'); } catch (e) { threwNull = true; }
    var threwEmpty = false;
    try { await DB.getEntriesByOwnerInRange(db, '', '2026-09-01', '2026-09-12'); } catch (e) { threwEmpty = true; }
    T.ok(threwNull);
    T.ok(threwEmpty);
  });

  T.test('S2-01 getEntriesByOwnerInRange：from / to 缺失（null / \'\'）→ reject，整表零写入', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('正常数据'));
    var before = await countAllEntriesB33();
    var bad = [[null, '2026-09-12'], ['2026-09-01', null], ['', '2026-09-12'], ['2026-09-01', '']];
    for (var i = 0; i < bad.length; i++) {
      var err = null;
      try {
        await DB.getEntriesByOwnerInRange(db, 'owner-a', bad[i][0], bad[i][1]);
      } catch (e) {
        err = e;
      }
      T.ok(err, 'from=' + JSON.stringify(bad[i][0]) + ' to=' + JSON.stringify(bad[i][1]) + ' 应被拒绝');
    }
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('S2-01 区间查询：闭区间含两端（起/止当天都算），区间外条目不混入，结果按日期升序', async function () {
    await reset();
    var outsideEarly = await DB.addEntry(db, 'owner-a', { rawText: '区间外-早', amount: 1, category: 'food', happenedAt: '2026-08-31' });
    var atFrom = await DB.addEntry(db, 'owner-a', { rawText: '区间起点当天', amount: 2, category: 'food', happenedAt: '2026-09-01' });
    var mid1 = await DB.addEntry(db, 'owner-a', { rawText: '区间中间一', amount: 3, category: 'food', happenedAt: '2026-09-05' });
    var mid2 = await DB.addEntry(db, 'owner-a', { rawText: '区间中间二', amount: 4, category: 'food', happenedAt: '2026-09-07' });
    var atTo = await DB.addEntry(db, 'owner-a', { rawText: '区间截止当天', amount: 5, category: 'food', happenedAt: '2026-09-10' });
    var outsideLate = await DB.addEntry(db, 'owner-a', { rawText: '区间外-晚', amount: 6, category: 'food', happenedAt: '2026-09-11' });
    var rows = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-01', '2026-09-10');
    T.eq(rows.length, 4);
    var ids = rows.map(function (e) { return e.id; });
    T.ok(ids.indexOf(atFrom.id) !== -1, '起始日当天应包含（闭区间左端）');
    T.ok(ids.indexOf(mid1.id) !== -1);
    T.ok(ids.indexOf(mid2.id) !== -1);
    T.ok(ids.indexOf(atTo.id) !== -1, '截止日当天应包含（闭区间右端）');
    T.ok(ids.indexOf(outsideEarly.id) === -1, '区间外-早不应混入');
    T.ok(ids.indexOf(outsideLate.id) === -1, '区间外-晚不应混入');
    T.ok(rows[0].happenedAt <= rows[1].happenedAt
      && rows[1].happenedAt <= rows[2].happenedAt
      && rows[2].happenedAt <= rows[3].happenedAt, '复合索引迭代应按日期升序');
  });

  T.test('S2-01 区间查询：同一日历区间内其他账户的条目绝不混入（复合键第 0 位锁账户）', async function () {
    await reset();
    var mine = await DB.addEntry(db, 'owner-a', { rawText: '甲的账单', amount: 10, category: 'food', happenedAt: '2026-09-05' });
    await DB.addEntry(db, 'owner-b', { rawText: '乙的账单', amount: 99, category: 'food', happenedAt: '2026-09-05' });
    await DB.addEntry(db, 'owner-b', { rawText: '乙的另一笔', amount: 98, category: 'food', happenedAt: '2026-09-06' });
    var rows = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-01', '2026-09-10');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, mine.id);
    T.ok(rows.every(function (e) { return e.ownerId === 'owner-a'; }));
  });

  T.test('S2-01 区间查询：区间内无命中返回空数组，不报错', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', { rawText: '九月账单', amount: 10, category: 'food', happenedAt: '2026-09-05' });
    var rows = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-07-01', '2026-07-31');
    T.ok(Array.isArray(rows));
    T.eq(rows.length, 0);
  });

  T.test('S2-01 getEntriesByOwnerInRange：from > to → reject（db 层锁，IDBKeyRange.bound DataError）', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', { rawText: '正常账单', amount: 10, category: 'food', happenedAt: '2026-09-05' });
    var err = null;
    try {
      await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-10', '2026-09-01');
    } catch (e) {
      err = e;
    }
    T.ok(err, '下限大于上限应被拒绝（app 层已先挡，db 层也要有锁）');
    /* 拒绝不影响数据完好：正常区间仍能读回 */
    var rows = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-01', '2026-09-10');
    T.eq(rows.length, 1);
  });

  T.test('S2-01 区间查询：happenedAt 缺失（属性不存在）的记录不编入复合索引、不出现在区间结果', async function () {
    await reset();
    var dated = await DB.addEntry(db, 'owner-a', { rawText: '有日期的账', amount: 10, category: 'food', happenedAt: '2026-09-05' });
    /* 故意不传 happenedAt：复合键 [ownerId, undefined] 非法键，该记录不入 ownerId_happenedAt 索引 */
    await DB.addEntry(db, 'owner-a', { rawText: '无日期的脏数据', amount: 20, category: 'food' });
    var rows = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-01-01', '2026-12-31');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, dated.id);
    /* 对照：全量 ownerId 单字段索引仍含该脏记录（排除只发生在复合索引路径，全量口径不动） */
    var full = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(full.length, 2);
  });

  /* ---- S2-02：物理删除 DB.deleteEntry（禁令 9：无软删；主键 delete，不升 DB_VERSION） ---- */

  T.test('S2-02 deleteEntry：ownerId 缺失（null / \'\'）→ reject，开事务前拦截、整表零改动', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('正常数据'));
    var before = await countAllEntriesB33();
    var threwNull = false;
    try { await DB.deleteEntry(db, null, 'some-id'); } catch (e) { threwNull = true; }
    var threwEmpty = false;
    try { await DB.deleteEntry(db, '', 'some-id'); } catch (e) { threwEmpty = true; }
    T.ok(threwNull);
    T.ok(threwEmpty);
    T.eq(await countAllEntriesB33(), before); /* 对齐 entryId 用例：拦截不得误删任何记录 */
  });

  T.test('S2-02 deleteEntry：entryId 缺失 / 空串 → reject，开事务前拦截、整表零改动', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('正常数据'));
    var before = await countAllEntriesB33();
    var cases = [null, '', 0, 123];
    for (var i = 0; i < cases.length; i++) {
      var err = null;
      try { await DB.deleteEntry(db, 'owner-a', cases[i]); } catch (e) { err = e; }
      T.ok(err, 'entryId=' + JSON.stringify(cases[i]) + ' 应被拒绝');
    }
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('S2-02 deleteEntry：不存在的 id → reject（\'记录不存在或已被删除\'），不静默成功', async function () {
    await reset();
    var err = null;
    try {
      await DB.deleteEntry(db, 'owner-a', 'nonexistent-id-' + Date.now());
    } catch (e) {
      err = e;
    }
    T.ok(err);
  });

  T.test('S2-02 deleteEntry：跨账户拦截——owner-b 持 owner-a 的 entryId → reject，且 owner-a 记录完好', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', makeEntryData('甲的账单'));
    var err = null;
    try {
      await DB.deleteEntry(db, 'owner-b', saved.id);
    } catch (e) {
      err = e;
    }
    T.ok(err, '跨账户删除应被拒绝');
    /* owner-a 读回该记录完好（未被删除） */
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, saved.id);
  });

  T.test('S2-02 deleteEntry：正常删除后读不到、全量查询不含该条、其余条目完好', async function () {
    await reset();
    var toDelete = await DB.addEntry(db, 'owner-a', { rawText: '要删的账', amount: 10, category: 'food', happenedAt: '2026-09-12' });
    var keep = await DB.addEntry(db, 'owner-a', { rawText: '保留的账', amount: 20, category: 'food', happenedAt: '2026-09-12' });
    await DB.deleteEntry(db, 'owner-a', toDelete.id);
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, keep.id);
    /* 区间查询同样不含已删除记录 */
    var inRange = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-12', '2026-09-12');
    T.eq(inRange.length, 1);
    T.eq(inRange[0].id, keep.id);
  });

  /* ---- S2-03：单事务清空 DB.clearEntriesByOwner（E-05 / B-43①：禁循环 deleteEntry） ---- */

  T.test('S2-03 clearEntriesByOwner：ownerId 缺失（null / \'\'）→ reject，开事务前拦截、整表零改动', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('正常数据'));
    var before = await countAllEntriesB33();
    var threwNull = false;
    try { await DB.clearEntriesByOwner(db, null); } catch (e) { threwNull = true; }
    var threwEmpty = false;
    try { await DB.clearEntriesByOwner(db, ''); } catch (e) { threwEmpty = true; }
    T.ok(threwNull);
    T.ok(threwEmpty);
    T.eq(await countAllEntriesB33(), before);
  });

  T.test('S2-03 clearEntriesByOwner：只清本账户——返回删除条数，其他账户记录完好（禁令 6）', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', makeEntryData('甲一'));
    await DB.addEntry(db, 'owner-a', makeEntryData('甲二'));
    var keepB1 = await DB.addEntry(db, 'owner-b', makeEntryData('乙一'));
    var keepB2 = await DB.addEntry(db, 'owner-b', makeEntryData('乙二'));
    var removed = await DB.clearEntriesByOwner(db, 'owner-a');
    T.eq(removed, 2, '返回值 = 实际删除条数');
    var a = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(a.length, 0);
    var b = await DB.getEntriesByOwner(db, 'owner-b');
    T.eq(b.length, 2, '其他账户两条都应完好');
    T.ok(findEntry(b, keepB1.id) !== null && findEntry(b, keepB2.id) !== null);
  });

  T.test('S2-03 clearEntriesByOwner：空账户 → resolve 0 不报错，他人数据不受影响', async function () {
    await reset();
    var keepA = await DB.addEntry(db, 'owner-a', makeEntryData('甲的账单'));
    var removed = await DB.clearEntriesByOwner(db, 'owner-nobody');
    T.eq(removed, 0);
    var a = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(a.length, 1);
    T.eq(a[0].id, keepA.id);
  });

  T.test('S2-03 clearEntriesByOwner：清空后全量与区间查询均为空，连接仍可继续写入', async function () {
    await reset();
    await DB.addEntry(db, 'owner-a', { rawText: '旧账一', amount: 10, category: 'food', happenedAt: '2026-09-01' });
    await DB.addEntry(db, 'owner-a', { rawText: '旧账二', amount: 20, category: 'food', happenedAt: '2026-09-05' });
    await DB.clearEntriesByOwner(db, 'owner-a');
    T.eq((await DB.getEntriesByOwner(db, 'owner-a')).length, 0);
    T.eq((await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-01-01', '2026-12-31')).length, 0);
    var again = await DB.addEntry(db, 'owner-a', { rawText: '新账', amount: 5, category: 'food', happenedAt: '2026-09-12' });
    T.ok(typeof again.id === 'string' && again.id.length > 0, '清空后同一连接应能正常写入');
  });

  /* ---- v3：载录五字段 location / note（不建索引；旧记录不回填，读出 undefined 应用层兜底） ---- */

  T.test('v3 addEntry：location / note 写入并读回，存库前 trim', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '鸣沙山门票',
      amount: 110,
      category: 'attraction',
      happenedAt: '2026-09-15',
      location: '  敦煌·鸣沙山  ',
      note: '  人很多，赶在日落前到月牙泉  '
    });
    T.eq(saved.location, '敦煌·鸣沙山');
    T.eq(saved.note, '人很多，赶在日落前到月牙泉');
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.ok(readBack, '写入的条目应能按 id 读回');
    T.eq(readBack.location, '敦煌·鸣沙山');
    T.eq(readBack.note, '人很多，赶在日落前到月牙泉');
  });

  T.test('v3 addEntry：location / note 缺省 → 存空串而非 undefined；null / 纯空白同样归空串', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', makeEntryData('不带地点备注'));
    T.eq(saved.location, '');
    T.eq(saved.note, '');
    var explicit = await DB.addEntry(db, 'owner-a', {
      rawText: '显式 null 与纯空白',
      amount: 5,
      category: 'food',
      happenedAt: '2026-09-15',
      location: null,
      note: '   '
    });
    T.eq(explicit.location, '');
    T.eq(explicit.note, '');
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 2);
    for (var i = 0; i < rows.length; i++) {
      T.eq(rows[i].location, '');
      T.eq(rows[i].note, '');
    }
  });

  T.test('v3 updateEntry：location / note 更新并读回；patch 未带时按契约归空串', async function () {
    await reset();
    var saved = await DB.addEntry(db, 'owner-a', {
      rawText: '带地点备注的账',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-01',
      location: '兰州',
      note: '牛肉面'
    });
    var updated = await DB.updateEntry(db, 'owner-a', saved.id, {
      rawText: '带地点备注的账',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-01',
      location: ' 张掖·七彩丹霞 ',
      note: '  误车两小时  '
    });
    T.eq(updated.location, '张掖·七彩丹霞');
    T.eq(updated.note, '误车两小时');
    var readBack = findEntry(await DB.getEntriesByOwner(db, 'owner-a'), saved.id);
    T.eq(readBack.location, '张掖·七彩丹霞');
    T.eq(readBack.note, '误车两小时');
    /* 缺省契约与 addEntry 对齐：旧四字段调用方的 patch 会把 location/note 清成空串
       （迁移期已知行为，UI 层接线后消除） */
    var cleared = await DB.updateEntry(db, 'owner-a', saved.id, {
      rawText: '四字段 patch',
      amount: 11,
      category: 'food',
      happenedAt: '2026-09-02'
    });
    T.eq(cleared.location, '');
    T.eq(cleared.note, '');
  });

  T.test('v3 旧记录兼容：绕开 addEntry 直写一条 v2 形态老记录（无 location/note），读出 undefined 不崩、其余字段完好', async function () {
    await reset();
    var legacy = {
      id: 'legacy-v2-record',
      ownerId: 'owner-a',
      rawText: 'v2 时代的老账单',
      amount: 66,
      category: 'food',
      happenedAt: '2026-09-01',
      createdAt: '2026-09-01T08:00:00.000Z'
    };
    /* 直写 v2 形态记录（v3 的 addEntry 会补默认值，绕开它才能模拟老数据） */
    await new Promise(function (resolve, reject) {
      var req = db.transaction(DB.STORE_ENTRIES, 'readwrite')
        .objectStore(DB.STORE_ENTRIES).put(legacy);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, legacy.id);
    T.eq(rows[0].rawText, 'v2 时代的老账单');
    T.eq(rows[0].amount, 66);
    T.eq(rows[0].happenedAt, '2026-09-01');
    T.eq(rows[0].location, undefined, '老记录 location 应为 undefined（不回填）');
    T.eq(rows[0].note, undefined, '老记录 note 应为 undefined（不回填）');
  });

  T.test('v3 升级迁移：手工搭真 v2 库（含老数据）升到当前版本后，老数据可读（location/note 为 undefined）、双索引保留、新写入带新字段', async function () {
    /* 同 S2-01 v1→v2 迁移用例的手法：关连接、删库、手工搭 v2 schema（双索引），
       绕开 DB.openDB 的当前版本幂等块，再按当前版本打开触发 v2 → v3 迁移 */
    if (db) {
      db.close();
      db = null;
    }
    await deleteTestDatabase();
    db = await new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB.TEST_DB_NAME, 2);
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore(DB.STORE_PROFILES, { keyPath: 'id' });
        var es = d.createObjectStore(DB.STORE_ENTRIES, { keyPath: 'id' });
        es.createIndex('ownerId', 'ownerId', { unique: false });
        es.createIndex('ownerId_happenedAt', ['ownerId', 'happenedAt'], { unique: false });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    /* 老记录用裸 put 直写（v3 的 addEntry 会把 location/note 补成空串，绕开它
       才能模拟真正的 v2 形态老数据——同上方"v3 旧记录兼容"用例的手法） */
    var legacy = {
      id: 'legacy-v2-migration',
      ownerId: 'owner-a',
      rawText: 'v2 时代的老账单',
      amount: 10,
      category: 'food',
      happenedAt: '2026-09-12',
      createdAt: '2026-09-01T08:00:00.000Z'
    };
    await new Promise(function (resolve, reject) {
      var req = db.transaction(DB.STORE_ENTRIES, 'readwrite')
        .objectStore(DB.STORE_ENTRIES).put(legacy);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
    db.close();
    await nextTick();
    db = await DB.openDB(DB.TEST_DB_NAME);
    T.eq(db.version, DB.DB_VERSION, '库应已升到当前版本');
    var entriesStore = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES);
    T.ok(entriesStore.indexNames.contains('ownerId'), 'ownerId 索引应保留');
    T.ok(entriesStore.indexNames.contains('ownerId_happenedAt'), '复合索引应保留');
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, legacy.id);
    T.eq(rows[0].location, undefined, '迁移不回填：location 保持缺失');
    T.eq(rows[0].note, undefined, '迁移不回填：note 保持缺失');
    var inRange = await DB.getEntriesByOwnerInRange(db, 'owner-a', '2026-09-12', '2026-09-12');
    T.eq(inRange.length, 1, 'v3 下复合索引区间查询对老数据照常工作');
    var fresh = await DB.addEntry(db, 'owner-a', {
      rawText: 'v3 新账单',
      amount: 8,
      category: 'food',
      happenedAt: '2026-09-13',
      location: '嘉峪关',
      note: '城楼日落'
    });
    T.eq(fresh.location, '嘉峪关');
    T.eq(fresh.note, '城楼日落');
  });

  T.test('v4 升级迁移：手工搭 v3 库（含 toll/fuel/attraction/shopping 老数据）升到 v4 后，category 被归一化，其他字段不变', async function () {
    /* 同 v3 迁移用例的手法：关连接、删库、手工搭 v3 schema（双索引，v3 相对 v2 无结构变化），
       绕开 DB.openDB 的当前版本幂等块，再按当前版本打开触发 v3 → v4 数据迁移 */
    if (db) {
      db.close();
      db = null;
    }
    await deleteTestDatabase();
    db = await new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB.TEST_DB_NAME, 3);
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore(DB.STORE_PROFILES, { keyPath: 'id' });
        var es = d.createObjectStore(DB.STORE_ENTRIES, { keyPath: 'id' });
        es.createIndex('ownerId', 'ownerId', { unique: false });
        es.createIndex('ownerId_happenedAt', ['ownerId', 'happenedAt'], { unique: false });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    /* 老记录裸 put 直写（绕开 addEntry 的字段补全）：4 条已知旧键 + 1 条 6 键防御样本 */
    var legacyRows = [
      { id: 'legacy-toll',       category: 'toll',       rawText: '高速费', amount: 30, happenedAt: '2026-09-01' },
      { id: 'legacy-fuel',       category: 'fuel',       rawText: '加油',   amount: 40, happenedAt: '2026-09-02' },
      { id: 'legacy-attraction', category: 'attraction', rawText: '门票',   amount: 50, happenedAt: '2026-09-03' },
      { id: 'legacy-shopping',   category: 'shopping',   rawText: '纪念品', amount: 60, happenedAt: '2026-09-04' },
      { id: 'legacy-food',       category: 'food',       rawText: '肉夹馍', amount: 70, happenedAt: '2026-09-05' }
    ];
    await new Promise(function (resolve, reject) {
      var tx = db.transaction(DB.STORE_ENTRIES, 'readwrite');
      var os = tx.objectStore(DB.STORE_ENTRIES);
      legacyRows.forEach(function (row) {
        os.put({
          id: row.id,
          ownerId: 'owner-a',
          rawText: row.rawText,
          amount: row.amount,
          category: row.category,
          happenedAt: row.happenedAt,
          createdAt: '2026-09-01T08:00:00.000Z'
        });
      });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
    db.close();
    await nextTick();
    db = await DB.openDB(DB.TEST_DB_NAME);
    T.eq(db.version, DB.DB_VERSION, '库应已升到当前版本');
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 5);
    var byId = {};
    rows.forEach(function (row) { byId[row.id] = row; });
    /* 已知旧键全部归一化 */
    T.eq(byId['legacy-toll'].category, 'driving');
    T.eq(byId['legacy-fuel'].category, 'driving');
    T.eq(byId['legacy-attraction'].category, 'ticket');
    T.eq(byId['legacy-shopping'].category, 'other');
    /* 防御式迁移：6 键之内的值不改写 */
    T.eq(byId['legacy-food'].category, 'food', '6 键之内的值不改写');
    /* 迁移只动 category，其余字段原样 */
    T.eq(byId['legacy-toll'].rawText, '高速费');
    T.eq(byId['legacy-toll'].amount, 30);
    T.eq(byId['legacy-toll'].happenedAt, '2026-09-01');
    T.eq(byId['legacy-attraction'].amount, 50);
    T.eq(byId['legacy-shopping'].rawText, '纪念品');
  });

  /* ---- v5（S3-08 批 2）：journeys 表——旅程自动快照 CRUD（ownerId 硬保证与 entries 四面对称） ---- */

  T.test('v5 addJourney：写入并读回，含 id / ownerId / fromYmd / toYmd / startLoc / endLoc / createdAt', async function () {
    await reset();
    var saved = await DB.addJourney(db, 'owner-a', {
      fromYmd: '2026-09-01',
      toYmd: '2026-09-05',
      startLoc: '兰州',
      endLoc: '敦煌'
    });
    T.ok(typeof saved.id === 'string' && saved.id.length > 0);
    T.eq(saved.ownerId, 'owner-a');
    T.eq(saved.fromYmd, '2026-09-01');
    T.eq(saved.toYmd, '2026-09-05');
    T.eq(saved.startLoc, '兰州');
    T.eq(saved.endLoc, '敦煌');
    T.ok(typeof saved.createdAt === 'string' && saved.createdAt.length > 0, 'createdAt 应为写入时刻');
    var rows = await DB.getJourneysByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, saved.id);
  });

  T.test('v5 addJourney：startLoc / endLoc trim 落库；非字符串归空串（normalizeText 契约）', async function () {
    await reset();
    var saved = await DB.addJourney(db, 'owner-a', {
      fromYmd: '2026-09-01',
      toYmd: '2026-09-02',
      startLoc: '  在途  ',
      endLoc: null
    });
    T.eq(saved.startLoc, '在途');
    T.eq(saved.endLoc, '');
  });

  T.test('v5 addJourney：journeyData 缺失 / fromYmd / toYmd 缺失或空串 → reject，开事务前拦截、零写入', async function () {
    await reset();
    var cases = [null, {}, { fromYmd: '2026-09-01' }, { toYmd: '2026-09-05' },
      { fromYmd: '', toYmd: '2026-09-05' }, { fromYmd: '2026-09-01', toYmd: '' }];
    for (var i = 0; i < cases.length; i++) {
      var err = null;
      try { await DB.addJourney(db, 'owner-a', cases[i]); } catch (e) { err = e; }
      T.ok(err, 'journeyData=' + JSON.stringify(cases[i]) + ' 应被拒绝');
    }
    T.eq((await DB.getJourneysByOwner(db, 'owner-a')).length, 0);
  });

  T.test('v5 addJourney：ownerId 缺失（null / \'\'）→ reject，journeys 表零写入', async function () {
    await reset();
    var data = { fromYmd: '2026-09-01', toYmd: '2026-09-02', startLoc: 'A', endLoc: 'B' };
    var threwNull = false;
    try { await DB.addJourney(db, null, data); } catch (e) { threwNull = true; }
    var threwEmpty = false;
    try { await DB.addJourney(db, '', data); } catch (e) { threwEmpty = true; }
    T.ok(threwNull);
    T.ok(threwEmpty);
    T.eq((await DB.getJourneysByOwner(db, 'owner-a')).length, 0);
  });

  T.test('v5 getJourneysByOwner：双账户隔离——各自只读回自己的旅程（禁令 6）', async function () {
    await reset();
    var a = await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-01', toYmd: '2026-09-02', startLoc: '甲起点', endLoc: '甲终点' });
    var b = await DB.addJourney(db, 'owner-b', { fromYmd: '2026-09-03', toYmd: '2026-09-04', startLoc: '乙起点', endLoc: '乙终点' });
    var rowsA = await DB.getJourneysByOwner(db, 'owner-a');
    var rowsB = await DB.getJourneysByOwner(db, 'owner-b');
    T.eq(rowsA.length, 1);
    T.eq(rowsA[0].id, a.id);
    T.eq(rowsB.length, 1);
    T.eq(rowsB[0].id, b.id);
  });

  T.test('v5 getJourneysByOwner：空表返回 []，不 reject；ownerId 缺失 → reject', async function () {
    await reset();
    var rows = await DB.getJourneysByOwner(db, 'owner-a');
    T.ok(Array.isArray(rows));
    T.eq(rows.length, 0);
    var err = null;
    try { await DB.getJourneysByOwner(db, ''); } catch (e) { err = e; }
    T.ok(err);
  });

  T.test('v5 deleteJourney：正常删除后读不到，其他旅程完好', async function () {
    await reset();
    var toDelete = await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-01', toYmd: '2026-09-02', startLoc: 'A', endLoc: 'B' });
    var keep = await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-03', toYmd: '2026-09-04', startLoc: 'C', endLoc: 'D' });
    await DB.deleteJourney(db, 'owner-a', toDelete.id);
    var rows = await DB.getJourneysByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, keep.id);
  });

  T.test('v5 deleteJourney：跨账户拦截——owner-b 持 owner-a 的 journeyId → reject，且原记录完好', async function () {
    await reset();
    var saved = await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-01', toYmd: '2026-09-02', startLoc: 'A', endLoc: 'B' });
    var err = null;
    try { await DB.deleteJourney(db, 'owner-b', saved.id); } catch (e) { err = e; }
    T.ok(err, '跨账户删除应被拒绝');
    var rows = await DB.getJourneysByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, saved.id);
  });

  T.test('v5 deleteJourney：不存在的 id / id 缺失 / ownerId 缺失 → reject', async function () {
    await reset();
    await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-01', toYmd: '2026-09-02', startLoc: 'A', endLoc: 'B' });
    var errNone = null;
    try { await DB.deleteJourney(db, 'owner-a', 'nonexistent-journey'); } catch (e) { errNone = e; }
    T.ok(errNone, '不存在的 id 应被拒绝');
    var errId = null;
    try { await DB.deleteJourney(db, 'owner-a', ''); } catch (e) { errId = e; }
    T.ok(errId, 'id 缺失应被拒绝');
    var errOwner = null;
    try { await DB.deleteJourney(db, null, 'whatever'); } catch (e) { errOwner = e; }
    T.ok(errOwner, 'ownerId 缺失应被拒绝');
  });

  T.test('v5 升级迁移：手工搭 v4 库（无 journeys、含 entries 老数据）升到 v5 后，journeys 表出现、entries 原样、新表立即可写', async function () {
    /* 同 v3/v4 迁移用例的手法：关连接、删库、手工搭 v4 schema（双索引、无 journeys），
       绕开 DB.openDB 的当前版本幂等块，再按当前版本打开触发 v4 → v5 结构迁移 */
    if (db) {
      db.close();
      db = null;
    }
    await deleteTestDatabase();
    db = await new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB.TEST_DB_NAME, 4);
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore(DB.STORE_PROFILES, { keyPath: 'id' });
        var es = d.createObjectStore(DB.STORE_ENTRIES, { keyPath: 'id' });
        es.createIndex('ownerId', 'ownerId', { unique: false });
        es.createIndex('ownerId_happenedAt', ['ownerId', 'happenedAt'], { unique: false });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    var legacy = {
      id: 'legacy-v4-record',
      ownerId: 'owner-a',
      rawText: 'v4 时代的老账单',
      amount: 88,
      category: 'food',
      happenedAt: '2026-09-10',
      location: '兰州',
      note: '',
      createdAt: '2026-09-10T08:00:00.000Z'
    };
    await new Promise(function (resolve, reject) {
      var req = db.transaction(DB.STORE_ENTRIES, 'readwrite')
        .objectStore(DB.STORE_ENTRIES).put(legacy);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
    db.close();
    await nextTick();
    db = await DB.openDB(DB.TEST_DB_NAME);
    T.eq(db.version, DB.DB_VERSION, '库应已升到当前版本 v5');
    T.ok(db.objectStoreNames.contains(DB.STORE_JOURNEYS), 'journeys 表应已创建');
    var journeysStore = db.transaction(DB.STORE_JOURNEYS).objectStore(DB.STORE_JOURNEYS);
    T.ok(journeysStore.indexNames.contains('ownerId'), 'journeys.ownerId 索引应已创建');
    /* 结构级迁移不动 entries：v4 老数据原样 */
    var rows = await DB.getEntriesByOwner(db, 'owner-a');
    T.eq(rows.length, 1);
    T.eq(rows[0].id, legacy.id);
    T.eq(rows[0].category, 'food');
    T.eq(rows[0].location, '兰州');
    /* 新表立即可写可读 */
    var saved = await DB.addJourney(db, 'owner-a', { fromYmd: '2026-09-10', toYmd: '2026-09-12', startLoc: '在途', endLoc: '敦煌' });
    var journeys = await DB.getJourneysByOwner(db, 'owner-a');
    T.eq(journeys.length, 1);
    T.eq(journeys[0].id, saved.id);
    T.eq(journeys[0].startLoc, '在途');
  });

  T.test('允许重名：同名两条都创建成功（AC6 数据层）', async function () {
    await reset();
    var a = await DB.addProfile(db, '同名');
    var b = await DB.addProfile(db, '同名');
    T.ok(a.id !== b.id);
    var profiles = await DB.getAllProfiles(db);
    T.eq(profiles.length, 2);
    T.eq(profiles[0].name, '同名');
    T.eq(profiles[1].name, '同名');
    db.close();
  });

  T.test('升级迁移：已有库升版本后 profiles/entries/ownerId 索引仍在（幂等迁移）', async function () {
    // 前序用例已 db.close()，但版本锁释放是异步的，等一帧确保旧连接完全释放再升版本
    await nextTick();
    db = await DB.openDB(DB.TEST_DB_NAME, DB.DB_VERSION + 1);
    T.ok(db.objectStoreNames.contains(DB.STORE_PROFILES));
    T.ok(db.objectStoreNames.contains(DB.STORE_ENTRIES));
    T.ok(db.objectStoreNames.contains(DB.STORE_JOURNEYS));
    var entriesStore = db.transaction(DB.STORE_ENTRIES).objectStore(DB.STORE_ENTRIES);
    T.ok(entriesStore.indexNames.contains('ownerId'));
    db.close();
    // 删库不再依赖"等一帧"（C3）：刚 close 的连接若未及释放锁，deleteDatabase
    // 会走 onblocked 重试等待，settled 守卫保证重试不会在请求成功后落地成幽灵删库，
    // 测试库仍会被真正清掉，下轮从干净状态建库
    await deleteTestDatabase();
  });
})();
