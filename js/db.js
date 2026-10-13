/*
 * db.js — IndexedDB Promise 封装（零第三方依赖）
 * 数据模型见 PROJECT_BRIEF 第 7 节：
 *   profiles: id(主键) / name / createdAt
 *   entries : id(主键) / ownerId(索引) / rawText / amount / category / happenedAt / createdAt
 *             / location / note（v3 新增业务字段，不建索引）
 *   journeys: id(主键) / ownerId(索引) / fromYmd / toYmd / startLoc / endLoc / createdAt
 *             （v5 新增，S3-08 批 2：旅程自动快照，视图不是副本，DESIGN_SPEC 3.10）
 */
(function (global) {
  'use strict';

  var DB_NAME = 'travel-ledger';
  var TEST_DB_NAME = 'travel-ledger-test';
  /* v2（S2-01）：entries 新增 ownerId_happenedAt 复合索引（时间段区间查询用）。
     v1 → v2 由 onupgradeneeded 幂等补建，老数据自动编入新索引。
     v3（载录五字段，2026-09-19 人拍板）：entries 记录新增 location / note 两个业务字段。
     IndexedDB 记录是 schema-free 的，新字段随写入落库即可，objectStore / 索引零变化、
     不建索引——未来真需要"按地点查账单"时再升 v4。旧记录不回填：读出 location / note
     为 undefined，由应用层兜底（unit-db 有 v2 → v3 迁移用例锁死该口径）。
     v5（S3-08 批 2，2026-09-20 人拍板）：新增 journeys 表——旅程自动快照，不命名，
     只存 { fromYmd, toYmd, startLoc, endLoc } 四业务字段。纯结构级迁移：只建新
     store + ownerId 索引，无数据改写，v4 及更老版本直升由幂等建库块覆盖。 */
  var DB_VERSION = 5;
  var STORE_PROFILES = 'profiles';
  var STORE_ENTRIES = 'entries';
  var STORE_JOURNEYS = 'journeys';

  function openDB(name, version) {
    var dbName = name || DB_NAME;
    var dbVersion = version || DB_VERSION;
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(dbName, dbVersion);
      var settled = false;
      var blockedTimer = null;

      /* 单一出口：保证 resolve/reject 只触发一次，并清掉 onblocked 的宽限计时器 */
      function finish(fn) {
        if (settled) { return; }
        settled = true;
        if (blockedTimer) {
          clearTimeout(blockedTimer);
          blockedTimer = null;
        }
        fn();
      }

      req.onupgradeneeded = function (e) {
        var db = req.result;
        var oldVersion = e.oldVersion; /* v4 数据迁移的执行闸：只在低版本库升级时跑 */
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
        }
        // 升级迁移加固：store 已存在时取出来补建缺失索引（幂等），保证后续版本能给已有库加新索引
        var entriesStore;
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          entriesStore = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
        } else {
          entriesStore = req.transaction.objectStore(STORE_ENTRIES);
        }
        if (!entriesStore.indexNames.contains('ownerId')) {
          entriesStore.createIndex('ownerId', 'ownerId', { unique: false });
        }
        /* v2（S2-01）：ownerId + happenedAt 复合索引，时间段区间查询用。
           键序 [ownerId, happenedAt]：第 0 位锁定账户隔离（禁令 6），第 1 位是
           YYYY-MM-DD 字符串字典序 = 日历序。幂等：老库 v1→v2 / 新库直建 v2 都走这里，
           既有记录由 IndexedDB 自动编入新索引。 */
        if (!entriesStore.indexNames.contains('ownerId_happenedAt')) {
          entriesStore.createIndex('ownerId_happenedAt', ['ownerId', 'happenedAt'], { unique: false });
        }
        /* v3（载录五字段）：location / note 只进记录、不进 schema——objectStore 与索引
           结构相对 v2 零变化，本分支刻意无结构动作；上方幂等建库逻辑原样覆盖
           v1 → v3 直升。老记录不在此回填（保持字段缺失），应用层读到 undefined 兜底。 */
        /* v4（S3-02）：category 归一化迁移——toll/fuel → driving，attraction → ticket，
           shopping → other。首个动数据的迁移分支（v1~v3 均为结构级）：store/索引零变化，
           只用 cursor 改写已知旧键，6 键之外的值原样保留（防御式，不猜未知键）。
           升级事务会等 openCursor 游标链走完才提交，无需手动等待；空表时游标即 null，无操作。 */
        if (oldVersion < 4) {
          var migrateMap = { toll: 'driving', fuel: 'driving', attraction: 'ticket', shopping: 'other' };
          var store = req.transaction.objectStore(STORE_ENTRIES);
          store.openCursor().onsuccess = function (ev) {
            var cursor = ev.target.result;
            if (!cursor) {
              return;
            }
            var entry = cursor.value;
            var mapped = migrateMap[entry.category];
            if (mapped) {
              entry.category = mapped;
              cursor.update(entry);
            }
            cursor.continue();
          };
        }
        /* v5（S3-08 批 2）：journeys 表。纯结构级迁移（新表、无旧数据、无 cursor 改写），
           与 profiles/entries 同款幂等块：升级 / 直升 / 新库直建 v5 都走这里，
           不需要 oldVersion 闸（对已是 v5 的库重复执行是 no-op）。 */
        var journeysStore;
        if (!db.objectStoreNames.contains(STORE_JOURNEYS)) {
          journeysStore = db.createObjectStore(STORE_JOURNEYS, { keyPath: 'id' });
        } else {
          journeysStore = req.transaction.objectStore(STORE_JOURNEYS);
        }
        if (!journeysStore.indexNames.contains('ownerId')) {
          journeysStore.createIndex('ownerId', 'ownerId', { unique: false });
        }
      };

      req.onblocked = function () {
        // 升级可能被同一页面上刚 close() 但版本锁尚未释放的连接短暂占用。
        // 给 1.5s 宽限：期间 onsuccess 到达（占用解除）即正常 resolve，超时才 reject。
        blockedTimer = setTimeout(function () {
          finish(function () {
            // 超时 reject 后 onsuccess 仍可能迟到并真正打开连接：换上清理逻辑，
            // 迟到的连接一打开立即关闭，避免无人持有、无 onversionchange 的孤儿连接永久阻塞本页后续升级。
            req.onsuccess = function () {
              req.result.close();
            };
            reject(new Error('数据库被其他标签页占用，请关闭本应用的其他标签页后刷新'));
          });
        }, 1500);
      };

      req.onsuccess = function () {
        finish(function () {
          var db = req.result;
          // 其他标签页请求升级版本时主动让路，避免互相 block
          db.onversionchange = function () {
            db.close();
          };
          resolve(db);
        });
      };

      req.onerror = function () {
        finish(function () {
          // openDB 的失败会直接渲染到错误视图（app.js boot），统一成可读的中文说明，保留底层原因
          var cause = req.error && req.error.message ? req.error.message : String(req.error);
          reject(new Error('数据库打开失败：' + cause));
        });
      };
    });
  }

  function store(db, storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function genId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* profiles */

  function addProfile(db, name) {
    var profile = {
      id: genId(),
      name: name,
      createdAt: new Date().toISOString()
    };
    return new Promise(function (resolve, reject) {
      var req = store(db, STORE_PROFILES, 'readwrite').add(profile);
      req.onsuccess = function () { resolve(profile); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllProfiles(db) {
    return new Promise(function (resolve, reject) {
      var req = store(db, STORE_PROFILES, 'readonly').getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* entries（B-03 硬保证）：对 entries 的任何读写必须带 ownerId，缺失即在开事务前失败，
   * 绝不静默写入/读出。本模块不提供任何无 ownerId 的全表读接口（禁令 6 的结构性收口，
   * unit-db 有模块表面守卫用例锁死）。 */

  function validOwnerId(ownerId) {
    return typeof ownerId === 'string' && ownerId !== '';
  }

  /* 金额规范化（addEntry / updateEntry 共用，B-33 抽出，避免规则双写）：
     有限数字一律 round 到分（0.01）——"金额最小单位是分"是数据契约。
     null / 非数字原样返回：是否 >0、能否保存归弹窗校验，本层不拦截。 */
  function normalizeAmount(amount) {
    if (typeof amount === 'number' && isFinite(amount)) {
      return Math.round(amount * 100) / 100;
    }
    return amount;
  }

  /* 文本字段规范化（v3：addEntry / updateEntry 的 location / note 共用）：
     非字符串一律归空串，字符串 trim 后落库。数据契约：库内 location / note 恒为
     字符串（可为空串），应用层读到即用、无需判型。 */
  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /*
   * 写入一条账单。ownerId 必须由调用方取自当前登录态（Session.getCurrentProfileId()），
   * 不得由输入内容决定（BRIEF 5.2-B）。守卫在任何 IndexedDB 事务创建之前执行：
   * 非法调用直接 reject，不存在"写进去了再补救"的路径。
   * entryData 仅承载业务六字段（rawText / amount / category / happenedAt /
   * location / note，后两字段 v3 新增）；id 由本层生成，createdAt 恒为写入时刻（S1-02 AC10）。
   * 金额规范化（不是字段级校验，S1-04 review 人拍板）：amount 为有限数字时一律
   * round 到分（0.01）后落库——"金额最小单位是分"是数据契约，保证单条金额与
   * ledger 求和同精度，杜绝 1.234×2 时"单条 1.23、小计 2.47"的自相矛盾。
   * 是否 >0、能否保存仍归 S1-02 弹窗校验，本层不做拦截。
   */
  function addEntry(db, ownerId, entryData) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('写入被拦截：当前没有有效账户（ownerId 缺失）'));
    }
    return new Promise(function (resolve, reject) {
      var entry = {
        id: genId(),
        ownerId: ownerId,
        rawText: entryData.rawText,
        amount: normalizeAmount(entryData.amount),
        category: entryData.category,
        happenedAt: entryData.happenedAt,
        location: normalizeText(entryData.location),
        note: normalizeText(entryData.note),
        createdAt: new Date().toISOString()
      };
      var req = store(db, STORE_ENTRIES, 'readwrite').add(entry);
      req.onsuccess = function () { resolve(entry); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /*
   * 更新一条账单（B-33：编辑功能的数据层能力；编辑 UI 入口在 S2-02）。
   * 与 addEntry 对称的硬保证：
   *   - ownerId / entryId 缺失：在任何事务创建之前 reject；
   *   - 记录不存在：reject，绝不静默 put 成一条新记录（否则"编辑变新增"）；
   *   - 记录属于其他账户：reject 且不写回（应用层永远不该持有他人 entryId，db 层兜底）。
   * 不可变字段：id / ownerId / createdAt 恒取库中原值，patch 中即使混入也被忽略
   *   （createdAt 是首次记录时刻，S1-02 AC10 在编辑路径继续成立）。
   * patch 只承载业务六字段（rawText / amount / category / happenedAt / location / note），
   *   与 addEntry 的 entryData 契约对齐；金额同样经 normalizeAmount 规范化到分。
   *   location / note 未随 patch 传入时归空串（与 addEntry 缺省契约一致）——旧四字段
   *   调用方的编辑会把这两字段清掉，迁移期已知行为，由 UI 层接线消除（unit-db 已锁口径）。
   * 整个 get→校验→put 在同一个 readwrite 事务内完成。
   */
  function updateEntry(db, ownerId, entryId, patch) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('更新被拦截：当前没有有效账户（ownerId 缺失）'));
    }
    if (typeof entryId !== 'string' || entryId === '') {
      return Promise.reject(new Error('更新被拦截：记录 id 缺失'));
    }
    if (!patch || typeof patch !== 'object') {
      return Promise.reject(new Error('更新被拦截：缺少账单内容'));
    }
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_ENTRIES, 'readwrite');
      var objStore = tx.objectStore(STORE_ENTRIES);
      var getReq = objStore.get(entryId);
      getReq.onsuccess = function () {
        var existing = getReq.result;
        if (!existing) {
          /* 不发起 put，事务无写入提交：不存在的 id 不会被静默新建 */
          reject(new Error('记录不存在或已被删除'));
          return;
        }
        if (existing.ownerId !== ownerId) {
          /* 同样不写回：跨账户 id 只可能是脏调用，拒绝且原记录完好 */
          reject(new Error('无权修改其他账户的记录'));
          return;
        }
        var updated = {
          id: existing.id,
          ownerId: existing.ownerId,
          createdAt: existing.createdAt,
          rawText: patch.rawText,
          amount: normalizeAmount(patch.amount),
          category: patch.category,
          happenedAt: patch.happenedAt,
          location: normalizeText(patch.location),
          note: normalizeText(patch.note)
        };
        var putReq = objStore.put(updated);
        putReq.onsuccess = function () { resolve(updated); };
        putReq.onerror = function () { reject(putReq.error); };
      };
      getReq.onerror = function () { reject(getReq.error); };
    });
  }

  /*
   * S2-02（E-04 写侧）：物理删除一条记录（禁令 9：无软删、无回收站）。
   * 与 updateEntry 对称的越权拦截：开事务前校验 ownerId/entryId；
   * get 到记录后核对归属，跨账户拒绝且不删；不存在拒绝。
   * 只删单条（禁止批量），用主键 store.delete，不需要升 DB_VERSION。
   */
  function deleteEntry(db, ownerId, entryId) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('删除被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    if (typeof entryId !== 'string' || entryId === '') {
      return Promise.reject(new Error('删除被拦截：记录 id 缺失'));
    }
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_ENTRIES, 'readwrite');
      var store = tx.objectStore(STORE_ENTRIES);
      var getReq = store.get(entryId);
      getReq.onsuccess = function () {
        var existing = getReq.result;
        if (!existing) {
          reject(new Error('记录不存在或已被删除'));
          return;
        }
        if (existing.ownerId !== ownerId) {
          reject(new Error('无权删除其他账户的记录'));
          return;
        }
        var delReq = store.delete(entryId);
        delReq.onsuccess = function () { resolve(); };
        delReq.onerror = function () { reject(delReq.error); };
      };
      getReq.onerror = function () { reject(getReq.error); };
    });
  }

  /*
   * S2-03（E-05 / B-43①）：按 ownerId 单事务清空当前账户全部账单，返回删除条数。
   * ⚠️ 禁止改成循环 deleteEntry：N 条记录 = N 个独立事务 = N 次独立提交，
   *    中途任何一条失败即"部分永久删除"且无回滚；单事务内游标删除，任一条失败
   *    整个事务 abort 自动回滚，不存在部分提交。
   * 范围硬保证：游标走 ownerId 单字段索引 + openCursor(ownerId)，只遍历本账户键，
   *    其他账户记录与 profiles 表物理上不在游标范围内（禁令 6 / 禁令 8）。
   * 禁令 9 延伸：物理删除，无软删副本。不升 DB_VERSION（v2 索引已够用）。
   * ownerId 缺失在开事务前 reject，与 addEntry/updateEntry/deleteEntry/查询四面对称（禁令 6）。
   */
  function clearEntriesByOwner(db, ownerId) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('清空被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    return new Promise(function (resolve, reject) {
      var removed = 0;
      var settled = false; /* 单出口守卫：resolve/reject 只触发一次 */
      function finish(fn, val) {
        if (settled) { return; }
        settled = true;
        fn(val);
      }
      var tx = db.transaction(STORE_ENTRIES, 'readwrite');
      var cursorReq = tx.objectStore(STORE_ENTRIES).index('ownerId').openCursor(ownerId);
      cursorReq.onsuccess = function () {
        var cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          removed += 1;
          cursor.continue();
        }
        /* 游标走完：不做任何事，提交与否交给 tx.oncomplete 统一裁决 */
      };
      tx.oncomplete = function () { finish(resolve, removed); };
      tx.onerror = function () { finish(reject, tx.error); };
      tx.onabort = function () { finish(reject, tx.error || new Error('清空账单失败：事务中止')); };
    });
  }

  /*
   * 按 ownerId 索引查询账单：index.getAll(ownerId)，纯索引检索，
   * 绝不 getAll 全表后在内存过滤。返回顺序不做保证，展示排序由调用层决定（S1-04 落口径）。
   * 字段透传（v3）：v3 起新写入的记录恒带 location / note（normalizeText 兜底为空串）；
   * v2 及更早的老记录可能缺这两字段（读出 undefined），本层不回填，展示层兜底。
   * ownerId 缺失同样在开事务前 reject（禁令 6：读写对称强制）。
   */
  function getEntriesByOwner(db, ownerId) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('查询被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    return new Promise(function (resolve, reject) {
      var req = store(db, STORE_ENTRIES, 'readonly').index('ownerId').getAll(ownerId);
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /*
   * S2-01（E-04 读侧）：按 happenedAt 闭区间 [fromYmd, toYmd] 查询当前账户账单。
   * 走 v2 复合索引 ownerId_happenedAt + IDBKeyRange.bound，在数据库层完成过滤，
   * 绝不 getAll 全表后内存过滤（禁令 6 延伸 + S2-01 AC10）。
   * 复合键数组序 [ownerId, happenedAt]：第 0 位锁定账户，结果不含其他账户任何条目；
   * 第 1 位 YYYY-MM-DD 字典序与日历序一致，bound 默认含两端 = 闭区间（AC3）。
   * ⚠️ 禁止"简化"成 bound(from, to) 裸字符串或单字段索引：前者一条都查不到，
   * 后者会跨账户串数据。
   * fromYmd / toYmd 格式校验归调用层（同弹窗 isValidYMD 口径），本层只挡缺失。
   * happenedAt 缺失的脏数据不编入复合索引，区间查询自然排除（全量列表/汇总口径不变，B-27 遗留）。
   */
  function getEntriesByOwnerInRange(db, ownerId, fromYmd, toYmd) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('查询被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    if (typeof fromYmd !== 'string' || fromYmd === ''
      || typeof toYmd !== 'string' || toYmd === '') {
      return Promise.reject(new Error('查询被拦截：必须提供有效的起止日期'));
    }
    return new Promise(function (resolve, reject) {
      var req = store(db, STORE_ENTRIES, 'readonly')
        .index('ownerId_happenedAt')
        .getAll(IDBKeyRange.bound([ownerId, fromYmd], [ownerId, toYmd]));
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /*
   * v5（S3-08 批 2）：journeys——旅程自动快照（视图不是副本，DESIGN_SPEC 3.10）。
   * ownerId 硬保证与 entries 四面对称：任何读写必带 ownerId，缺失在开事务前 reject。
   * journeyData 契约：{ fromYmd, toYmd, startLoc, endLoc }（deriveJourneyLabel 的返回值
   * 直传）；fromYmd / toYmd 由调用方取筛选结果的实际边界（非筛选框原文，2026-09-20
   * 人拍板②），非空字符串校验在本层（格式归调用层，同 getEntriesByOwnerInRange 口径）；
   * startLoc / endLoc 空 → "在途"由调用方 deriveJourneyLabel 落定，本层 normalizeText
   * 兜底恒字符串（与 entries 的 location / note 同契约）。id / createdAt 本层生成。
   */
  function addJourney(db, ownerId, journeyData) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('写入被拦截：当前没有有效账户（ownerId 缺失）'));
    }
    if (!journeyData || typeof journeyData !== 'object'
      || typeof journeyData.fromYmd !== 'string' || journeyData.fromYmd === ''
      || typeof journeyData.toYmd !== 'string' || journeyData.toYmd === '') {
      return Promise.reject(new Error('写入被拦截：必须提供有效的旅程起止日期'));
    }
    return new Promise(function (resolve, reject) {
      var journey = {
        id: genId(),
        ownerId: ownerId,
        fromYmd: journeyData.fromYmd,
        toYmd: journeyData.toYmd,
        startLoc: normalizeText(journeyData.startLoc),
        endLoc: normalizeText(journeyData.endLoc),
        createdAt: new Date().toISOString()
      };
      var req = store(db, STORE_JOURNEYS, 'readwrite').add(journey);
      req.onsuccess = function () { resolve(journey); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /*
   * 按 ownerId 索引查询旅程：index.getAll(ownerId)，纯索引检索（禁令 6）。
   * 返回顺序不做保证，展示排序由调用层决定。空表返回 []。
   */
  function getJourneysByOwner(db, ownerId) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('查询被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    return new Promise(function (resolve, reject) {
      var req = store(db, STORE_JOURNEYS, 'readonly').index('ownerId').getAll(ownerId);
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /*
   * 物理删除一条旅程（禁令 9：无软删）。与 deleteEntry 全对称的越权拦截：
   * 开事务前校验 ownerId/journeyId；get 到记录后核对归属，跨账户拒绝且不删；
   * 不存在拒绝。只删 journeys 表记录，绝不动 entries（旅程是视图不是副本，
   * 删旅程不改账目，DESIGN_SPEC 3.10）。
   */
  function deleteJourney(db, ownerId, journeyId) {
    if (!validOwnerId(ownerId)) {
      return Promise.reject(new Error('删除被拦截：必须提供有效账户（ownerId 缺失）'));
    }
    if (typeof journeyId !== 'string' || journeyId === '') {
      return Promise.reject(new Error('删除被拦截：旅程 id 缺失'));
    }
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_JOURNEYS, 'readwrite');
      var objStore = tx.objectStore(STORE_JOURNEYS);
      var getReq = objStore.get(journeyId);
      getReq.onsuccess = function () {
        var existing = getReq.result;
        if (!existing) {
          reject(new Error('旅程不存在或已被删除'));
          return;
        }
        if (existing.ownerId !== ownerId) {
          reject(new Error('无权删除其他账户的旅程'));
          return;
        }
        var delReq = objStore.delete(journeyId);
        delReq.onsuccess = function () { resolve(); };
        delReq.onerror = function () { reject(delReq.error); };
      };
      getReq.onerror = function () { reject(getReq.error); };
    });
  }

  global.DB = {
    DB_NAME: DB_NAME,
    TEST_DB_NAME: TEST_DB_NAME,
    DB_VERSION: DB_VERSION,
    STORE_PROFILES: STORE_PROFILES,
    STORE_ENTRIES: STORE_ENTRIES,
    STORE_JOURNEYS: STORE_JOURNEYS,
    openDB: openDB,
    addProfile: addProfile,
    getAllProfiles: getAllProfiles,
    addEntry: addEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    clearEntriesByOwner: clearEntriesByOwner,
    getEntriesByOwner: getEntriesByOwner,
    getEntriesByOwnerInRange: getEntriesByOwnerInRange,
    addJourney: addJourney,
    getJourneysByOwner: getJourneysByOwner,
    deleteJourney: deleteJourney
  };
})(window);
