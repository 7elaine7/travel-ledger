/*
 * app.js — 单账户启动路由（S3-04：首开自动建「我的账本」，不再进 onboarding）
 *          + 底部 tab 路由（账=账簿 / 记=首页 / 户=游笺；载录为模态页无 tab）
 *          + 首页视觉迁移（S3-05：absolute 坐标模式，同 mock/home-preview.html；
 *            汇总/筛选/区间/列表/数据管理五链随旧首页删除，S3-07 搬账簿页与查页，
 *            git 5b62ae2 可取）+ 写入前确认弹窗（S1-02 链保留，入口待 S3-06 载录页）
 *          + 账簿页（S3-07：日聚合列表一行=一天，唯一出口 refreshLedger 沿 B-05/B-25 收口经验；
 *            清空链自 git 5b62ae2 复活，sheet 结构照旧待 B-60 换皮；查按钮/⋯/≡ 留 S3-08/09）
 *          + 阅踪页（S3-08 批 1：统一明细页筛选+渲染，[寻踪] 显式触发；批 2 接 [存卷]，[归档] 留批 3）
 * 视图显隐只用 hidden 属性（showView 按 data-view 通用分发），无路由、无框架。
 */
(function () {
  'use strict';

  var els = {};
  var db = null;
  /* S3-07：账户名来源（清空确认文案用）。enterHome 存入；单账户模式下即「我的账本」 */
  var currentProfile = null;

  function $(id) {
    return document.getElementById(id);
  }

  /* S3-04：按 data-view 通用分发（还 B-11「枚举式硬编码」债）。
     error / record / trace 态藏 tab 栏：boot 失败是全屏错误页；载录与阅踪是模态页
     无 tab（DESIGN_SPEC 3.3 / 3.5，S3-08 加 trace）。 */
  function showView(name) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute('data-view') !== name;
    }
    els.tabBar.hidden = name === 'error' || name === 'record' || name === 'trace';
  }

  /* ---------- S3-04 底部 tab 路由（账=ledger / 记=home / 户=youjian） ---------- */

  /* 纯高亮：is-active class + aria-current */
  function setActiveTab(name) {
    var tabs = [els.tabLedger, els.tabHome, els.tabYoujian];
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].getAttribute('data-tab') === name;
      tabs[i].classList.toggle('is-active', isActive);
      if (isActive) {
        tabs[i].setAttribute('aria-current', 'page');
      } else {
        tabs[i].removeAttribute('aria-current');
      }
    }
  }

  /* tab 切换 = showView + 高亮。S3-07：进账簿即全量刷新（每次进入都查，覆盖跨午夜常规路径；
     bfcache/后台恢复由 pageshow/visibilitychange 监听兜底）。首页仍是静态视觉页。 */
  function switchTab(name) {
    showView(name);
    setActiveTab(name);
    if (name === 'ledger') {
      refreshLedger();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function enterHome(profile) {
    /* S3-07：profile 首次有消费者——存模块级 currentProfile，清空确认 sheet 文案取账户名 */
    currentProfile = profile;
    showView('home');
    setActiveTab('home'); /* AC4：首页 = 记 tab 默认页 */
  }

  /* ---------- S1-02 写入前确认弹窗（.sheet，文本/语音共用） ----------
     S3-05：链保留（人拍板），「记一笔」入口已随旧首页删除；
     S3-06 载录页接管触发口径（含 BRIEF 禁令 4 在新 IA 下如何满足）。 */

  var selectedCategory = 'other'; /* 弹窗内当前选中的类别 */
  var saving = false;             /* 确认保存防重入 */
  /* B-33：弹窗模式位。null = 新建模式（走 addEntry）；非空 = 编辑模式（走 updateEntry，
     值为正在编辑的 entry id）。当前没有任何 UI 入口能把它置为非空（编辑入口在 S2-02），
     所以本 Sprint 它恒为 null，下列分叉与守卫均惰性、对用户零可见变化。 */
  var editingEntryId = null;

  /* 渲染 6 个类别胶囊（顺序 = 6 键行序，other 放最后） */
  function renderCategoryChips(defaultCategory) {
    var meta = Parser.CATEGORY_META;
    var keys = ['food', 'transport', 'driving', 'hotel', 'ticket', 'other'];
    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var m = meta[key];
      var isSel = key === defaultCategory;
      html += '<button type="button" class="chip' + (isSel ? ' is-selected' : '')
        + '" data-category="' + key + '">' + m.icon + ' ' + m.label + '</button>';
    }
    els.sheetCategories.innerHTML = html;
    selectedCategory = defaultCategory;
  }

  function selectCategory(category) {
    selectedCategory = category;
    var chips = els.sheetCategories.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-selected', chips[i].getAttribute('data-category') === category);
    }
  }

  function showSheetError(message) {
    els.sheetError.textContent = message;
  }

  function clearSheetError() {
    els.sheetError.textContent = '';
  }

  /*
   * 打开确认弹窗（共用组件接口，10.1.1）：接收 rawText / amount / category / happenedAt 即展示。
   * 文本入口原为首页 onRecord（S3-05 随旧首页删除），S3-06 载录页接管；将来语音接入直接复用。
   * B-33 review 修复：模式必须经第二参 editingId 显式传入——
   *   不传 / 传空 = 新建模式；传 entry id = 编辑模式（S2-02 接线）。
   * 禁止"先调用 openConfirmSheet 再在外面置 editingEntryId"的写法：首行会把它清掉，
   * 自然写法会被静默退化成新增（编辑变新增的重复账目陷阱）。
   */
  function openConfirmSheet(data, editingId) {
    editingEntryId = editingId || null; /* 模式唯一入口：显式入参，缺省即新建 */
    /* S2-02：编辑态文案区分（标题 / 确认按钮）；新建态恢复默认文案 */
    var isEdit = editingEntryId !== null;
    els.sheetTitle.textContent = isEdit ? '编辑这笔账' : '确认这笔账';
    els.sheetConfirm.textContent = isEdit ? '保存修改' : '确认保存';
    els.sheetRawtext.value = data.rawText || '';
    /* amount 为 null 时金额框留空（不默认 0，避免污染账目），用户必须填 > 0 才能保存 */
    els.sheetAmount.value = data.amount == null ? '' : String(data.amount);
    renderCategoryChips(data.category || 'other');
    els.sheetDate.value = data.happenedAt || EntryUtils.todayYMD();
    els.sheetDate.max = EntryUtils.todayYMD(); /* AC8：原生 date 禁止未来 */
    clearSheetError();
    els.sheetConfirm.disabled = false;
    els.sheetMask.hidden = false;
    updateScrollLock(); /* S2-02 验收修复③：锁背景滚动 */
  }

  function closeConfirmSheet() {
    els.sheetMask.hidden = true;
    editingEntryId = null; /* B-33：弹窗关闭的唯一出口统一复位，防模式位残留 */
    updateScrollLock(); /* S2-02 验收修复③：若其他 sheet 也关着则解背景滚动锁 */
  }

  /* S2-02 验收修复③：sheet 打开期间锁定背景滚动。
     用 position:fixed + top:-scrollY 而非仅 overflow:hidden——后者在 iOS Safari
     挡不住手势回弹滚动（页面仍会在遮罩下"跟手"）；fixed 方案把视口钉在当前滚动位置，
     解锁时滚回原位。任一 sheet 打开即锁，全部关闭才解（多 sheet 短暂叠放时不会误解锁）。 */
  var lockedScrollY = 0;
  function setBodyScrollLocked(lock) {
    if (lock) {
      if (document.body.classList.contains('sheet-open')) {
        return;
      }
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = '-' + lockedScrollY + 'px';
      document.body.classList.add('sheet-open');
    } else {
      if (!document.body.classList.contains('sheet-open')) {
        return;
      }
      document.body.classList.remove('sheet-open');
      document.body.style.top = '';
      window.scrollTo(0, lockedScrollY);
    }
  }

  function anySheetOpen() {
    /* S3-07：清空两步确认两 mask 回归（B-43③ 单点收口——滚动锁等依赖方自动覆盖） */
    return !els.sheetMask.hidden || !els.clearWarnMask.hidden || !els.clearConfirmMask.hidden;
  }

  function updateScrollLock() {
    setBodyScrollLocked(anySheetOpen());
  }

  /*
   * 确认保存：校验 → 按模式位分叉写库（B-33：null=addEntry 新建 / 非空=updateEntry 编辑）
   * → 成功关弹窗+toast；仅新建模式清录入框；失败弹窗保留（模式位保留）可重试。
   * 编辑模式位恒 null（编辑入口「⋯」随列表 S3-05 删除，S3-07 账簿页回归时接回）。
   */
  function saveEntry() {
    if (saving) {
      return; /* 防重入：写库期间连点只执行一次 */
    }
    clearSheetError();

    var rawText = els.sheetRawtext.value;
    var amount = EntryUtils.parseAmount(els.sheetAmount.value);
    if (amount == null) {
      showSheetError('请输入大于 0 的金额');
      return;
    }
    var happenedAt = els.sheetDate.value;
    if (!EntryUtils.isValidYMD(happenedAt)) {
      showSheetError('请选择有效日期');
      return;
    }
    if (EntryUtils.isFutureYMD(happenedAt)) {
      showSheetError('未来日期不可选');
      return;
    }

    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      /* ownerId 缺失：db 层 addEntry 也会硬拦截，这里提前给可读提示 */
      showSheetError('当前没有有效账户，请刷新后重试');
      return;
    }

    saving = true;
    els.sheetConfirm.disabled = true;
    /* B-33：payload 两模式同构（业务四字段）；写库 API 按 editingEntryId 分叉。
       isEdit 在 closeConfirmSheet 复位状态位之前取局部值缓存。 */
    var payload = {
      rawText: rawText,
      amount: amount,
      category: selectedCategory,
      happenedAt: happenedAt
    };
    var isEdit = editingEntryId !== null;
    var writeRequest = isEdit
      ? DB.updateEntry(db, ownerId, editingEntryId, payload)
      : DB.addEntry(db, ownerId, payload);
    writeRequest
      .then(function () {
        /* AC9：入库以弹窗编辑后的值为准；AC10：createdAt 由 db 层生成/保留 */
        closeConfirmSheet(); /* 内部复位 editingEntryId */
        if (!isEdit) {
          // S3-06 载录页重建保存流程时重新审视（S3-05 时入口已断）
          els.entryInput.value = ''; /* B-18①：仅新建成功后才清输入框；编辑模式不动录入框 */
        }
        /* S2-02：toast 区分新建 / 编辑。B-37 的「不在当前筛选区间」提示随筛选链
           S3-05 删除（activeFilter 已不存在），S3-07 查/账簿页回归时一并恢复 */
        showToast(isEdit ? '✅ 已保存修改' : '✅ 保存成功');
      })
      .catch(function (err) {
        console.error((isEdit ? 'updateEntry' : 'addEntry') + ' failed:', err);
        showSheetError('保存失败，请重试');
        els.sheetConfirm.disabled = false; /* 失败恢复按钮，允许重试；模式位保留=仍在原模式 */
      })
      .then(function () {
        saving = false;
      });
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove('is-fading');
    els.toast.hidden = false;
    /* S2-03 验收：顶部横幅从顶沿外滑入（120ms）。双 rAF 后才加 is-shown——
       hidden 刚撤掉的同一帧里初始 transform 与目标 transform 一起提交，
       Safari 会吞掉过渡（不动画甚至闪一帧）；等两帧确保 display:block 已完成一次样式重算。 */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        els.toast.classList.add('is-shown');
      });
    });
    /* 1.4s 后原路滑出（BRIEF 13.6 toast 配方），动效结束（120ms）再 hidden。
       S2-03 review：内层隐藏 timer 挂 _hideTimer——重入时一并 clearTimeout，
       否则上一条的内层 timer 会把新 toast 提前藏掉（外层 _timer 清不掉它）。 */
    clearTimeout(showToast._timer);
    clearTimeout(showToast._hideTimer);
    showToast._timer = setTimeout(function () {
      els.toast.classList.remove('is-shown');
      els.toast.classList.add('is-fading');
      showToast._hideTimer = setTimeout(function () {
        els.toast.hidden = true;
      }, 120);
    }, 1400);
  }

  /* ---------- S3-07 账簿页（日聚合列表一行 = 一天；唯一出口 refreshLedger，B-05/B-25 收口经验） ---------- */

  var ledgerRenderSeq = 0;   /* 渲染序号防竞态：迟到的旧查询结果直接丢弃（5.2-C 第 6 条） */
  var pendingClearCount = 0; /* 清空两步确认共享的目标笔数快照（warn → confirm 两层传递） */
  var clearing = false;      /* 清空落库防重入：一次确认只允许发起一次物理清空 */
  var prechecking = false;   /* 清空笔数预查防重入：异步窗口内连点不叠开确认 sheet */

  /* 金额显示（2026-09-19 人拍板③）：整数省小数（"¥ 666" 同 mock），非整数保留 2 位 */
  function formatMoney(n) {
    var s = n.toFixed(2);
    return s.slice(-3) === '.00' ? s.slice(0, -3) : s;
  }

  /* 读取失败/无账户的收起口径：列表、空态、合计条全部隐藏（不撒谎——不显示 0 也不显示空态文案） */
  function collapseLedger() {
    els.ledgerListArea.hidden = true;
    els.ledgerEmpty.hidden = true;
    els.ledgerTotal.hidden = true;
  }

  /*
   * refreshLedger：账簿页数据的唯一渲染出口（旧 refreshHome 骨架的账簿裁剪版：
   * 无筛选/区间查询——S3-08 查页回归再加；无汇总卡——合计条直接吃 totalSpend）。
   * 渲染序号防竞态：resetHomeView 式的多入口（切 tab / 清空 / bfcache）都汇到本函数，
   * 迟到的旧账户查询结果直接丢弃。catch 最小恢复照旧：重开一次 DB 重试一轮，仍失败才收起。
   */
  function refreshLedger() {
    if (!db) {
      return; /* boot 未完成（如 pageshow 先于 DB 打开）：不发起任何查询 */
    }
    ledgerRenderSeq += 1;
    var seq = ledgerRenderSeq;
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      collapseLedger();
      return;
    }
    DB.getEntriesByOwner(db, ownerId)
      .then(function (entries) {
        if (seq !== ledgerRenderSeq) {
          return; /* 过期结果：视图已被切换/再次刷新，丢弃 */
        }
        renderLedgerList(Ledger.groupByDate(entries));
        els.ledgerTotalNum.textContent = '¥ ' + formatMoney(Ledger.totalSpend(entries));
      })
      .catch(function (err) {
        console.error('refreshLedger failed:', err);
        if (seq !== ledgerRenderSeq) {
          return; /* 已有更新的渲染在途，不恢复，交给它 */
        }
        DB.openDB()
          .then(function (reopened) {
            if (seq !== ledgerRenderSeq) {
              return;
            }
            db = reopened;
            refreshLedger(); /* 内部重新取序号并查询 */
          })
          .catch(function (recoverErr) {
            console.error('refreshLedger recovery failed:', recoverErr);
            collapseLedger();
          });
      });
  }

  /*
   * 列表/空态切换：一行 = 一天，逐组 append renderDayGroup（第一组 = 最新一天）。
   * 空态原地切换不跳页（人拍板）：列表区 + 合计条隐、空态显；查/清按钮常驻原位，
   * 仅加 is-muted 类做视觉置灰（决策 3：仍可点，Q3 toast 拦截在 onClearClick）。
   */
  function renderLedgerList(groups) {
    els.ledgerList.innerHTML = '';
    for (var i = 0; i < groups.length; i++) {
      els.ledgerList.appendChild(renderDayGroup(groups[i], i === 0));
    }
    var isEmpty = groups.length === 0;
    els.ledgerListArea.hidden = isEmpty;
    els.ledgerTotal.hidden = isEmpty;
    els.ledgerEmpty.hidden = !isEmpty;
    els.ledgerBtnCha.classList.toggle('is-muted', isEmpty);
    els.ledgerBtnQing.classList.toggle('is-muted', isEmpty);
  }

  /*
   * 渲染一天 = 一行（2026-09-19 人拍板）：
   *   日期 = formatDayMD（S3-08 决策 2 起带年份 YYYY年M月D日，DESIGN_SPEC 9.2，阅踪页组头共用）。
   *   主行 = 组内第一条非空 location（组内 createdAt 降序，即最新一笔的）；全组无 → 「共 N 笔」。
   *   副行 = categorySummary 前 3 类（已按合计降序）拼「分类 ¥x」；label 只从 CATEGORY_META 取
   *         （防 B-19 式映射漂移），无 icon 无 emoji（PENDING #5 清 emoji 口径）。
   *   圆点 = 首行空心（最新一天）、其余实心朱砂；⋯/≡ 本轮不渲染（S3-08/S3-09 加回）。
   * 脏 amount 不炸渲染：subtotal/categorySummary 已按 isValidAmount 口径聚合（B-26）。
   * 日期脏数据：formatDayMD 对非法 happenedAt 返回 ''，日期格留空不猜。
   * 数据只来自 group（B-25：渲染函数绝不自行查询）；插值全部 escapeHtml。
   */
  function renderDayGroup(group, isFirst) {
    var row = document.createElement('div');
    row.className = 'v2-ledger-row';

    var mainText = '';
    for (var i = 0; i < group.entries.length; i++) {
      var loc = group.entries[i].location;
      if (typeof loc === 'string' && loc !== '') {
        mainText = loc;
        break;
      }
    }
    if (mainText === '') {
      mainText = '共 ' + group.entries.length + ' 笔';
    }

    var subParts = [];
    var cats = group.categorySummary.slice(0, 3);
    for (var j = 0; j < cats.length; j++) {
      var meta = Parser.CATEGORY_META[cats[j].category] || { label: cats[j].category };
      subParts.push(meta.label + ' ¥' + formatMoney(cats[j].total));
    }

    row.innerHTML = '<span class="v2-ledger-row__dot' + (isFirst ? ' is-first' : '')
      + '" aria-hidden="true"></span>'
      + '<span class="v2-ledger-row__date">' + escapeHtml(EntryUtils.formatDayMD(group.date)) + '</span>'
      + '<span class="v2-ledger-row__main">' + escapeHtml(mainText) + '</span>'
      + '<span class="v2-ledger-row__sub">' + escapeHtml(subParts.join(' · ')) + '</span>'
      + '<span class="v2-ledger-row__amount">¥ ' + formatMoney(group.subtotal) + '</span>';
    return row;
  }

  /* ---------- S3-08 阅踪页（统一明细页：筛选 + 渲染；批 2 接 [存卷]，批 3 接 [归档]） ---------- */

  var traceRenderSeq = 0;         /* 渲染序号防竞态（同 refreshLedger 模式，5.2-C 第 6 条） */
  var traceReturnView = 'ledger'; /* ← 返回去向：openTrace 记录来源视图，唯一写入口 */
  var lastTraceFilter = null;     /* 最近一次寻踪条件；null = 尚未寻踪（保持引导空态，bfcache 不重查） */
  /* S3-08 批 2 存卷状态：结果空否 + 结果集引用（存卷数据来源；B-25 不冲突——存的是
     查询结果，渲染函数仍不自行查询）。未寻踪/引导空态视同空结果（存卷置灰②）。 */
  var lastTraceResultEmpty = true;
  var lastTraceEntries = [];
  var savingJourney = false;      /* 存卷落库防重入：一次点击只允许发起一次写入 */
  var exportingTrace = false;     /* 批 3 [归档] 导出防重入：一次点击只允许发起一次下载 */
  var traceInputDirty = false;    /* 批 2 防呆：筛选输入被改动且未重新[寻踪]（置灰③） */

  /* 阅踪可见判定（visibilitychange/pageshow 共用，同 ledgerViewVisible 口径） */
  function traceViewVisible() {
    var view = document.querySelector('[data-view="trace"]');
    return view !== null && !view.hidden;
  }

  /*
   * S3-08 批 2：存卷按钮置灰（DESIGN_SPEC 3.5 修订，2026-09-20）：
   * ① 带地点筛选 ② 结果为空 ③ 筛选输入被改动但未重新点[寻踪]（防"改了条件
   * 却存旧结果"）；未寻踪视同无结果可存 → 置灰。
   * is-muted 挂容器（同账簿按钮容器模式，.v2-trace-btn.is-muted CSS 已预留）。
   * 沿用决策 3：置灰仍可点，点击由 onSaveJourney 的同款守卫拦截。
   */
  function updateTraceSaveState() {
    var muted = lastTraceFilter === null
      || (lastTraceFilter.location !== '')
      || lastTraceResultEmpty
      || traceInputDirty;
    els.traceBtnSaveWrap.classList.toggle('is-muted', muted);
  }

  /*
   * 阅踪页唯一入口（四入口将共用：账簿[查] 本轮接，游笺[详]/驿站[详]/账簿点某天随各自 Story 接）。
   * preset = { location } 预填；起止日期恒不预填（2026-09-20 人拍板，见函数内注释）。
   * 进页不自动查询（2026-09-20 人拍板：空筛选用户自填），列表区落引导空态——
   * 与查询无结果共用同一空态（此间无踪 / 择定时日，再寻踪迹）。
   * 地点建议（datalist）：进页后台取当前账户 distinct location 只填建议、不渲染列表
   * （「不自动查询」指不代跑筛选）；拉取失败不拦进页。
   */
  function openTrace(preset) {
    var current = document.querySelector('.view:not([hidden])');
    var currentView = current ? current.getAttribute('data-view') : 'ledger';
    traceReturnView = currentView && currentView !== 'trace' ? currentView : 'ledger';
    /* 修复③（2026-09-20 人拍板）：起止日期进页恒空、不预填——Safari date 曾致
       「视觉有值（placeholder 灰字）、.value 为空」的误判；preset 仅保留地点
       （text 输入无提交怪癖）。3.9 游笺/驿站的日期预填入口将来接线时重新拍板。
       修复②：max=今天（每次进页取鲜值，跨午夜不陈旧），用户选不到未来日期 */
    els.traceFrom.value = '';
    els.traceTo.value = '';
    /* 修复②配套：清值同时清 .has-value，placeholder 藏匿态复位 */
    els.traceFrom.classList.remove('has-value');
    els.traceTo.classList.remove('has-value');
    els.traceFrom.max = EntryUtils.todayYMD();
    els.traceTo.max = EntryUtils.todayYMD();
    els.traceLocation.value = (preset && preset.location) || '';
    lastTraceFilter = null;
    /* 批 2：进页未寻踪 = 无结果可存，存卷状态复位并置灰；表单被程序化清空
       （非用户改动，不触发 input 事件），防呆脏标记一并复位 */
    lastTraceEntries = [];
    lastTraceResultEmpty = true;
    traceInputDirty = false;
    updateTraceSaveState();
    els.traceListArea.hidden = true;
    els.traceTotal.hidden = true;
    els.traceEmpty.hidden = false;
    switchTab('trace');
    var ownerId = Session.getCurrentProfileId();
    if (db && ownerId) {
      DB.getEntriesByOwner(db, ownerId)
        .then(function (entries) {
          var seen = {};
          var options = '';
          for (var i = 0; i < entries.length; i++) {
            var loc = entries[i].location;
            if (typeof loc === 'string' && loc !== '' && !seen[loc]) {
              seen[loc] = true;
              options += '<option value="' + escapeHtml(loc) + '"></option>';
            }
          }
          els.traceLocList.innerHTML = options;
        })
        .catch(function (err) {
          console.error('trace loc suggestions failed:', err);
        });
    }
  }

  /*
   * [寻踪] 处理器（阅踪唯一查询出口）：读表单 → validateRangeYMD 校验（非法 toast）→
   * 单边日期哨兵补齐（db 层 getEntriesByOwnerInRange 要求两端非空；2026-09-20 人拍板
   * app 层补 '0000-01-01'/'9999-12-31'，db 层不动）→ 区间查询（复合索引 ownerId_happenedAt，
   * 禁令 6）→ 地点内存精确过滤（location 不建索引，BRIEF 7.1）→ 渲染 + 合计。
   * 序号防竞态 + catch 重开 DB 重试一轮（照抄 refreshLedger 骨架）。
   * lastTraceFilter 供 bfcache/跨午夜重查（refreshTrace）。
   */
  function applyTraceFilter() {
    /* 修复④（2026-09-20 人拍板）：读值前强制失焦，防 Safari date
       「填完立刻点[寻踪]」时 .value 未提交 */
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    if (!db) {
      return; /* boot 未完成：不发起任何查询 */
    }
    var from = els.traceFrom.value;
    var to = els.traceTo.value;
    var location = els.traceLocation.value;
    /* 修复⑩（2026-09-20 人拍板）：三输入全空 → 保持引导空态，不发起查询 */
    if (from === '' && to === '' && location === '') {
      lastTraceFilter = null;
      /* 批 2：引导空态 = 无结果可存；[寻踪] 已处理本次输入，脏标记清除 */
      lastTraceEntries = [];
      lastTraceResultEmpty = true;
      traceInputDirty = false;
      updateTraceSaveState();
      els.traceListArea.hidden = true;
      els.traceTotal.hidden = true;
      els.traceEmpty.hidden = false;
      return;
    }
    var rangeError = EntryUtils.validateRangeYMD(from, to);
    if (rangeError) {
      showToast(rangeError);
      return;
    }
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      collapseTrace();
      return;
    }
    traceRenderSeq += 1;
    var seq = traceRenderSeq;
    lastTraceFilter = { from: from, to: to, location: location };
    DB.getEntriesByOwnerInRange(db, ownerId, from || '0000-01-01', to || '9999-12-31')
      .then(function (entries) {
        if (seq !== traceRenderSeq) {
          return; /* 过期结果：已再次寻踪/切视图，丢弃 */
        }
        /* 批 2：结果集与空否先落存卷状态，再进渲染（渲染函数不持数据状态）；
           寻踪成功 = 结果重新与输入同步，脏标记清除（置灰③解除） */
        lastTraceEntries = EntryUtils.matchLocation(entries, location);
        lastTraceResultEmpty = lastTraceEntries.length === 0;
        traceInputDirty = false;
        renderTraceList(lastTraceEntries);
        updateTraceSaveState();
      })
      .catch(function (err) {
        console.error('applyTraceFilter failed:', err);
        if (seq !== traceRenderSeq) {
          return; /* 已有更新的渲染在途，不恢复，交给它 */
        }
        DB.openDB()
          .then(function (reopened) {
            if (seq !== traceRenderSeq) {
              return;
            }
            db = reopened;
            applyTraceFilter();
          })
          .catch(function (recoverErr) {
            console.error('applyTraceFilter recovery failed:', recoverErr);
            collapseTrace();
          });
      });
  }

  /* bfcache/跨午夜重查：阅踪可见且寻踪过至少一次时重跑（模态页 DOM 不销毁，
     表单值即最后一次寻踪条件，直接复用 applyTraceFilter 的读表单路径） */
  function refreshTrace() {
    if (!db || !lastTraceFilter) {
      return;
    }
    applyTraceFilter();
  }

  /*
   * 渲染唯一出口（B-25：渲染函数绝不自行查询）：groupByDate 分组（同账簿口径：日期降序、
   * 组内 createdAt 降序）→ 逐组 append；空 → 空态（与引导空态共用一处，人拍板）；
   * 合计 = 当前筛选结果求和（Ledger.totalSpend）。插值全部 escapeHtml。
   */
  function renderTraceList(entries) {
    els.traceList.innerHTML = '';
    var groups = Ledger.groupByDate(entries);
    for (var i = 0; i < groups.length; i++) {
      els.traceList.appendChild(renderTraceGroup(groups[i], i === 0));
    }
    var isEmpty = groups.length === 0;
    els.traceListArea.hidden = isEmpty;
    els.traceTotal.hidden = isEmpty;
    els.traceEmpty.hidden = !isEmpty;
    if (!isEmpty) {
      els.traceTotalNum.textContent = '¥ ' + formatMoney(Ledger.totalSpend(entries));
    }
  }

  /*
   * 渲染一组 = 组头（圆点 + 日期大字，YYYY年M月D日 = formatDayMD 决策 2 格式）+ 组内每笔。
   * 首组圆点空心（最新一天，同账簿口径）。非法日期 formatDayMD 返回 ''，组头留空不猜。
   */
  function renderTraceGroup(group, isFirst) {
    var div = document.createElement('div');
    div.className = 'v2-trace-group';
    var html = '<div class="v2-trace-date"><span class="v2-trace-date__dot'
      + (isFirst ? ' is-first' : '') + '" aria-hidden="true"></span>'
      + '<span class="v2-trace-date__text">' + escapeHtml(EntryUtils.formatDayMD(group.date)) + '</span></div>';
    for (var i = 0; i < group.entries.length; i++) {
      html += renderTraceEntry(group.entries[i]);
    }
    div.innerHTML = html;
    return div;
  }

  /*
   * 渲染一笔 = 两行 + 金额（DESIGN_SPEC 3.5）：
   *   主行 = note。不兜底（2026-09-20 人拍板：载录保存将强制四字段非空，S3-09 实装；
   *   老数据由人手动清空测试数据、不回填）——note 缺失/空串就留空。
   *   副行 = 地点 · 分类。地点空串（老数据）只显示分类、连接符一并省去（不造数据）；
   *   分类 label 只从 CATEGORY_META 取（防 B-19 式映射漂移）。
   *   金额 = 单笔，右对齐垂直居中；脏金额显示 ¥--（B-27 口径，isValidAmount 唯一判定）。
   */
  function renderTraceEntry(entry) {
    var main = typeof entry.note === 'string' ? entry.note : '';
    var subParts = [];
    if (typeof entry.location === 'string' && entry.location !== '') {
      subParts.push(entry.location);
    }
    var meta = Parser.CATEGORY_META[entry.category] || { label: entry.category };
    subParts.push(meta.label);
    var amount = Ledger.isValidAmount(entry.amount) ? '¥ ' + formatMoney(entry.amount) : '¥--';
    return '<div class="v2-trace-entry">'
      + '<span class="v2-trace-entry__main">' + escapeHtml(main) + '</span>'
      + '<span class="v2-trace-entry__sub">' + escapeHtml(subParts.join(' · ')) + '</span>'
      + '<span class="v2-trace-entry__amount">' + amount + '</span>'
      + '</div>';
  }

  /* 读取失败/无账户收口（同 collapseLedger 口径）：列表、空态、合计全隐——不撒谎。
     批 2：结果不可用 = 无结果可存，存卷置灰（lastTraceFilter 保留，恢复重查后解禁） */
  function collapseTrace() {
    els.traceListArea.hidden = true;
    els.traceEmpty.hidden = true;
    els.traceTotal.hidden = true;
    lastTraceResultEmpty = true;
    updateTraceSaveState();
  }

  /*
   * [存卷]（S3-08 批 2，DESIGN_SPEC 3.5 / 3.10）：把当前寻踪结果落一条旅程快照。
   * 数据来源：lastTraceEntries（最近一次寻踪结果）→ deriveJourneyLabel 推导四字段
   * （from/to = 结果实际边界，2026-09-20 人拍板②；start/end = 首/末日当天 location，
   * 空 → "在途"）→ DB.addJourney。
   * 置灰三条件的运行时守卫（沿用决策 3"置灰仍可点"）：条件不满足 toast 拦截、绝不落库
   * ——带地点筛选不可存（视图语义：旅程按日期重查，地点筛选结果不是旅程）；
   * 空结果/未寻踪不可存（无快照可落）；输入已改动未重新寻踪不可存（置灰③配套，
   * 防"改了条件却存旧结果"，2026-09-20 人拍板）。
   * 成功：toast 逐字「归藏游笺」（DESIGN_SPEC 5，人拍板④：不加 ✅）；留在阅踪页
   * （人拍板⑦）：不切视图、不清列表，结果未变故按钮态不动。
   * 重复存卷不去重（人拍板⑤）：同筛选可存多条，删除入口在游笺页（后续 Story）。
   */
  function onSaveJourney() {
    if (savingJourney) {
      return; /* 防重入：写库期间连点只执行一次 */
    }
    if (!db) {
      return; /* boot 未完成：不发起任何写库 */
    }
    if (lastTraceFilter !== null && lastTraceFilter.location !== '') {
      showToast('带地点筛选的结果不可存卷');
      return;
    }
    if (traceInputDirty) {
      showToast('筛选条件已改，请先点「寻踪」');
      return;
    }
    if (lastTraceFilter === null || lastTraceResultEmpty) {
      showToast('没有可存卷的寻踪结果');
      return;
    }
    var derived = EntryUtils.deriveJourneyLabel(lastTraceEntries);
    if (!derived) {
      /* 双保险路径：置灰守卫已挡空结果，这里挡"有记录但日期全非法"的脏结果 */
      showToast('没有可存卷的寻踪结果');
      return;
    }
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      showToast('当前没有有效账户，请刷新后重试');
      return;
    }
    savingJourney = true;
    DB.addJourney(db, ownerId, derived)
      .then(function () {
        showToast('归藏游笺');
      })
      .catch(function (err) {
        console.error('addJourney failed:', err);
        showToast('存卷失败，请重试');
      })
      .then(function () {
        savingJourney = false;
      });
  }

  /*
   * [归档]（S3-08 批 3，DESIGN_SPEC 3.5）：把当前寻踪结果导出为 JSON 备份下载。
   * 数据来源：lastTraceEntries（最近一次寻踪结果，批 2 同款）→ Exporter.buildExportData
   * 九字段白名单组装（含 location/note，version 保持 1）；导出范围由调用方决定，
   * 这里只传当前账户结果（禁令 7）。
   * 守卫链（点击直接下载、无二次确认，2026-09-20 人拍板⑤）：防重入 → !db → 无账户
   * → 输入已改未重寻（traceInputDirty 与存卷同款拦截：防"改了条件却导旧结果"；
   * 归档不做视觉置灰，只点击拦截）→ 空结果/未寻踪/全脏日期（无内容可归档、文件名
   * 也无边界可写，人拍板：toast 拦截不产出空文件）。
   * 文件名：travel-ledger-<账户名>-<起YYYYMMDD>-<止YYYYMMDD>.json；起止 = 结果实际
   * 边界 deriveYMDRange（双边/单边恒用实际边界、非筛选框原文，2026-09-20 人拍板，
   * 同批 2 存卷拍板②口径）。账户名从 currentProfile.name 取，兜底「账户」（人拍板⑥）。
   * 下载链（git 5b62ae2 旧导出骨架复活）：Blob + a[download] 一次性插入点击后移除；
   * revoke 延时 5s（人定 3-5s 取上限：Safari 偶发 revoke 过早截断下载，旧值 1s 偏短）。
   * 数据全在内存、无异步查询，用 try/catch/finally；导出只读，失败不动任何数据。
   * 成功：toast 逐字「归藏成卷」（DESIGN_SPEC 5，人拍板④：不加 ✅，与「归藏游笺」
   * 同风格）；留在阅踪页、不清列表，结果未变故存卷按钮态不动。
   */
  function onTraceExport() {
    if (exportingTrace) {
      return; /* 防重入：下载期间连点只执行一次 */
    }
    if (!db) {
      return; /* boot 未完成：不发起任何操作 */
    }
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      showToast('当前没有有效账户，请刷新后重试');
      return;
    }
    if (traceInputDirty) {
      showToast('筛选条件已改，请先点「寻踪」');
      return;
    }
    var bounds = EntryUtils.deriveYMDRange(lastTraceEntries);
    if (!bounds) {
      /* 空结果/未寻踪/全脏日期共用此拦截：无内容可归档，文件名也无边界可写 */
      showToast('没有可归档的寻踪结果');
      return;
    }
    exportingTrace = true;
    try {
      var name = currentProfile ? currentProfile.name : '账户';
      var data = Exporter.buildExportData(
        { id: ownerId, name: name },
        lastTraceEntries,
        new Date().toISOString()
      );
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = Exporter.buildExportFileName(name, bounds.fromYmd, bounds.toYmd);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      showToast('归藏成卷');
    } catch (err) {
      console.error('trace export failed:', err);
      showToast('导出失败，请重试');
    } finally {
      exportingTrace = false;
    }
  }

  /* ---------- S3-07 清空链（S2-03 骨架自 git 5b62ae2 复活：sheet 结构/文案照旧，B-60 统一换皮） ---------- */

  /* 清空两步确认的统一出口：关两个 sheet + 状态复位（旧 closeClearSheets 逐字照搬）。
     取消（按钮/遮罩）、清空落库，全部只经此一个出口。 */
  function closeClearSheets() {
    els.clearWarnMask.hidden = true;
    els.clearConfirmMask.hidden = true;
    pendingClearCount = 0;
    clearing = false; /* 复位防重入，供下次清空确认重新开始 */
    els.btnClearConfirm.disabled = false;
    updateScrollLock(); /* 若所有 sheet 已关，解背景滚动锁 */
  }

  /* 第一步警告 sheet（Q1）：展示账户名与笔数，纯展示、不发起任何写操作。
     账户名从 currentProfile 取（旧 els.homeName 随旧首页删除） */
  function openClearWarn(count) {
    var name = currentProfile && currentProfile.name ? currentProfile.name : '当前账户';
    els.clearWarnText.textContent = '「' + name + '」共有 ' + count + ' 笔账单，清空后本账户回到空白';
    els.clearWarnMask.hidden = false;
    updateScrollLock();
  }

  /* 第二步最终确认 sheet：与旧版同构——先隐藏第一层（仅 hidden 切换、不清快照），
     再显示第二层，避免两层叠压像 bug（S2-02 验收修复①同款） */
  function openClearConfirm() {
    var name = currentProfile && currentProfile.name ? currentProfile.name : '当前账户';
    els.clearConfirmText.textContent = '「' + name + '」的 ' + pendingClearCount + ' 笔账单将被永久删除，无法找回';
    els.clearWarnMask.hidden = true;
    els.clearConfirmMask.hidden = false;
    updateScrollLock();
  }

  /* 点「清」：Q3 拦截保留（决策 3：空态按钮置灰仍可点）——空账户直接 toast，不进确认流程。
     笔数预查用 getEntriesByOwner（当前账户全量，禁令 6：必带 ownerId）。防重入两重
     （prechecking / anySheetOpen）照旧版口径。 */
  function onClearClick() {
    if (prechecking) {
      return; /* 防重入：预查在途时连点忽略——异步窗口内再点会叠开第二个确认 sheet */
    }
    if (anySheetOpen()) {
      return; /* 防御：任一 sheet 开着时不叠开 */
    }
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      showToast('当前没有有效账户，请刷新后重试');
      return;
    }
    prechecking = true;
    DB.getEntriesByOwner(db, ownerId)
      .then(function (entries) {
        if (entries.length === 0) {
          showToast('当前账户没有账单，无需清空');
          return;
        }
        pendingClearCount = entries.length;
        openClearWarn(entries.length);
      })
      .catch(function (err) {
        console.error('clear precheck failed:', err);
        showToast('读取账单失败，请重试');
      })
      .then(function () {
        prechecking = false; /* 成功/失败都复位；sheet 已开时由 anySheetOpen 守卫接管 */
      });
  }

  /* 最终确认：单事务清空（B-43①：DB.clearEntriesByOwner，禁循环 deleteEntry）
     → 关全部 sheet → refreshLedger 唯一渲染链（吃空数组自然落空态，B-43②，原地切换不跳页）
     → toast。D7：profile 保留，只清 entries。旧版的 activeFilter/clearFilterForm 两行
     随筛选链死亡（S3-08 查页回归再议）。 */
  function confirmClearEntries() {
    if (clearing) {
      return; /* 防重入：连点只清一次 */
    }
    var ownerId = Session.getCurrentProfileId();
    if (!ownerId) {
      showToast('当前没有有效账户，请刷新后重试');
      closeClearSheets();
      return;
    }
    clearing = true;
    els.btnClearConfirm.disabled = true;
    DB.clearEntriesByOwner(db, ownerId)
      .then(function (removed) {
        closeClearSheets(); /* 内部复位 clearing 与按钮态 */
        refreshLedger();
        showToast('✅ 已清空 ' + removed + ' 笔账单');
      })
      .catch(function (err) {
        console.error('clearEntriesByOwner failed:', err);
        closeClearSheets();
        showToast('清空失败，请重试');
      });
  }

  /* ---------- 启动路由（S3-04 单账户：空库自动建「我的账本」，不再进 onboarding） ---------- */

  function bootRoute(profiles) {
    if (profiles.length === 0) {
      /* AC1：首开自动创建固定名账本（B-58 单账户模式；固定名绕过交互校验）。
         整条链 return 给 boot 的 catch——建账本失败沿既有路径进错误视图，不静默白屏。 */
      return DB.addProfile(db, '我的账本')
        .then(function (profile) {
          Session.setCurrentProfileId(profile.id); /* 写库成功即锁定，此后失败不回退（原 onCreate 口径） */
          enterHome(profile);
        });
    }
    var current = Profiles.pickCurrentProfile(profiles, Session.getCurrentProfileId());
    Session.setCurrentProfileId(current.id); /* AC6/AC7：命中或回退后都修正存储 */
    enterHome(current);
  }

  function boot() {
    els = {
      /* S3-04 tab 路由 */
      tabBar: $('tabbar'),
      tabLedger: $('tab-ledger'),
      tabHome: $('tab-home'),
      tabYoujian: $('tab-youjian'),
      errorMessage: $('error-message'),
      btnReload: $('btn-reload'),
      /* S3-05 首页 */
      entryInput: $('entry-input'),
      btnRecord: $('btn-record'),
      btnRecordBack: $('btn-record-back'),
      btnRecordSave: $('btn-record-save'),
      /* S3-07 账簿页（btn-cha/btn-qing 是按钮容器：空态置灰 is-muted 挂容器才能覆盖 rect） */
      ledgerBtnCha: $('ledger-btn-cha'),
      ledgerBtnQing: $('ledger-btn-qing'),
      btnLedgerSearch: $('btn-ledger-search'),
      btnLedgerClear: $('btn-ledger-clear'),
      ledgerListArea: $('ledger-list-area'),
      ledgerList: $('ledger-list'),
      ledgerEmpty: $('ledger-empty'),
      ledgerTotal: $('ledger-total'),
      ledgerTotalNum: $('ledger-total-num'),
      btnLedgerRestart: $('btn-ledger-restart'),
      /* S3-08 阅踪页（批 2 接 [存卷]；批 3 接 [归档]）。
         存卷置灰 is-muted 挂容器 trace-btn-cunjuan（同账簿按钮容器模式） */
      traceFrom: $('trace-from'),
      traceTo: $('trace-to'),
      traceLocation: $('trace-location'),
      traceLocList: $('trace-loc-list'),
      traceBtnSaveWrap: $('trace-btn-cunjuan'),
      btnTraceBack: $('btn-trace-back'),
      btnTraceSearch: $('btn-trace-search'),
      btnTraceSave: $('btn-trace-save'),
      btnTraceExport: $('btn-trace-export'),
      traceListArea: $('trace-list-area'),
      traceList: $('trace-list'),
      traceEmpty: $('trace-empty'),
      traceTotal: $('trace-total'),
      traceTotalNum: $('trace-total-num'),
      /* S1-02 确认弹窗 */
      sheetMask: $('sheet-mask'),
      sheetTitle: $('sheet-title'),
      sheetRawtext: $('sheet-rawtext'),
      sheetAmount: $('sheet-amount'),
      sheetCategories: $('sheet-categories'),
      sheetDate: $('sheet-date'),
      sheetError: $('sheet-error'),
      sheetCancel: $('sheet-cancel'),
      sheetConfirm: $('sheet-confirm'),
      /* S3-07 清空两步确认 sheet（结构复活自 git 5b62ae2） */
      clearWarnMask: $('clear-warn-mask'),
      clearWarnText: $('clear-warn-text'),
      btnClearWarnCancel: $('btn-clear-warn-cancel'),
      btnClearNext: $('btn-clear-next'),
      clearConfirmMask: $('clear-confirm-mask'),
      clearConfirmText: $('clear-confirm-text'),
      btnClearCancel: $('btn-clear-cancel'),
      btnClearConfirm: $('btn-clear-confirm'),
      toast: $('toast')
    };

    els.btnReload.addEventListener('click', function () {
      location.reload();
    });

    /* S3-04 tab 路由（AC3/AC4/AC5）：事件委托一处收口 */
    els.tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tabbar__btn');
      if (btn) {
        switchTab(btn.getAttribute('data-tab'));
      }
    });

    /* S3-05 首页：谨存此笔 → 载录占位（S3-06 迁移表单后接管）；
       输入框不接 Enter（原回车行为随 onRecord 删除，口径 S3-06 载录页定） */
    els.btnRecord.addEventListener('click', function () {
      switchTab('record');
    });
    els.btnRecordBack.addEventListener('click', function () {
      switchTab('home'); /* ← 返回入口（S3-06 实装）；带内容弹确认框留弹窗系统（B-60） */
    });
    /* S3-06 缮录归帙：无保存行为（保存逻辑 PENDING #16），暂直接回首页。
       去向改账簿原定 S3-07 落实，2026-09-19 人改：本轮不动继续回首页，PENDING #15 改 S3-09 落实 */
    els.btnRecordSave.addEventListener('click', function () {
      switchTab('home');
    });

    /* S3-07 账簿页：清按钮 + 空态重启。查按钮 S3-08 接线 → 阅踪页（空筛选）；
       重启 = 跳回首页（DESIGN_SPEC 3.4） */
    els.btnLedgerClear.addEventListener('click', onClearClick);
    els.btnLedgerRestart.addEventListener('click', function () {
      switchTab('home');
    });

    /* S3-08 阅踪页：账簿[查] → 空筛选进页；← 返回 openTrace 记录的来源视图；
       [寻踪] 显式触发；[存卷] → 旅程快照落库（守卫在 onSaveJourney，人拍板③置灰仍可点）；
       [归档] → 寻踪结果导出下载（守卫在 onTraceExport，无置灰只点击拦截） */
    els.btnLedgerSearch.addEventListener('click', function () {
      openTrace({});
    });
    els.btnTraceBack.addEventListener('click', function () {
      switchTab(traceReturnView);
    });
    els.btnTraceSearch.addEventListener('click', applyTraceFilter);
    els.btnTraceSave.addEventListener('click', onSaveJourney);
    els.btnTraceExport.addEventListener('click', onTraceExport);
    /* 修复②：date 有值 → 加 .has-value（配合 CSS 只在未聚焦+无值时藏 placeholder），
       清空 → 移除；openTrace 清值处同步移除 */
    function syncDateHasValue(input) {
      input.classList.toggle('has-value', input.value !== '');
    }
    els.traceFrom.addEventListener('input', function () { syncDateHasValue(els.traceFrom); });
    els.traceTo.addEventListener('input', function () { syncDateHasValue(els.traceTo); });
    /* 批 2 防呆（DESIGN_SPEC 3.5 ③）：任一筛选输入被改动 → 存卷立即置灰，直到重新
       [寻踪]（applyTraceFilter 成功后清 traceInputDirty）。程序化改值（openTrace 清空/
       预填）不触发 input 事件，不会误置灰 */
    function onTraceInputDirty() {
      traceInputDirty = true;
      updateTraceSaveState();
    }
    els.traceFrom.addEventListener('input', onTraceInputDirty);
    els.traceTo.addEventListener('input', onTraceInputDirty);
    els.traceLocation.addEventListener('input', onTraceInputDirty);

    /* S3-07 清空两步确认（绑定照旧版 git 5b62ae2 1080-1094 行）：取消 / 下一步 /
       最终确认 / 点遮罩即关（e.target === mask 才算，点 sheet 本身不关） */
    els.btnClearWarnCancel.addEventListener('click', closeClearSheets);
    els.btnClearNext.addEventListener('click', openClearConfirm);
    els.btnClearCancel.addEventListener('click', closeClearSheets);
    els.btnClearConfirm.addEventListener('click', confirmClearEntries);
    els.clearWarnMask.addEventListener('click', function (e) {
      if (e.target === els.clearWarnMask) {
        closeClearSheets();
      }
    });
    els.clearConfirmMask.addEventListener('click', function (e) {
      if (e.target === els.clearConfirmMask) {
        closeClearSheets();
      }
    });

    /* S3-07 跨午夜 / bfcache：账簿可见时刷新（旧 refreshHome 监听的账簿语境重建）。
       不做定时器（费电且无必要）；refreshLedger 内部挡 db 未就绪（pageshow 早于 boot 完成） */
    function ledgerViewVisible() {
      var view = document.querySelector('[data-view="ledger"]');
      return view !== null && !view.hidden;
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (ledgerViewVisible()) {
        refreshLedger();
      }
      /* S3-08：阅踪同口径——可见且寻踪过时重查（refreshTrace 内部挡未寻踪态） */
      if (traceViewVisible()) {
        refreshTrace();
      }
    });
    window.addEventListener('pageshow', function () {
      if (ledgerViewVisible()) {
        refreshLedger();
      }
      if (traceViewVisible()) {
        refreshTrace();
      }
    });

    /* S1-02 确认弹窗：取消 / 确认保存 / 类别切换 / 日期快捷 / 字段编辑清错 */
    els.sheetCancel.addEventListener('click', function () {
      /* AC4：取消 → 关弹窗、数据丢弃，输入框原文保留（onRecord 未清空） */
      closeConfirmSheet();
    });
    els.sheetConfirm.addEventListener('click', saveEntry);
    /* S1-04 review P2（方案 a）：确认/取消按钮 mousedown 时阻止焦点转移。
       否则点按钮先触发原文框 blur 重解析——无数字会清空用户手填金额导致保存被拒，
       有新值会在用户未见过的值上直接保存。preventDefault 后 blur 不触发、click 照常；
       改原文=重算金额与类别的语义不变（点别处失焦仍重解析），日期仍不参与重解析。 */
    function preventBlurOnPress(e) {
      e.preventDefault();
    }
    els.sheetConfirm.addEventListener('mousedown', preventBlurOnPress);
    els.sheetCancel.addEventListener('mousedown', preventBlurOnPress);
    els.sheetCategories.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip) {
        selectCategory(chip.getAttribute('data-category'));
      }
    });
    els.sheetMask.querySelectorAll('.date-shortcut').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var offset = parseInt(btn.getAttribute('data-offset'), 10);
        els.sheetDate.value = EntryUtils.shiftDateYMD(offset);
        clearSheetError();
      });
    });
    els.sheetAmount.addEventListener('input', clearSheetError);
    els.sheetDate.addEventListener('change', function () {
      /* 方案 A（S1-02 验收）：选到未来日期立即提示，不等点确认保存；
         提交时的校验保留（双保险），max 属性继续生效 */
      if (EntryUtils.isFutureYMD(els.sheetDate.value)) {
        showSheetError('未来日期不可选');
      } else {
        clearSheetError();
      }
    });
    els.sheetRawtext.addEventListener('input', clearSheetError);
    els.sheetRawtext.addEventListener('blur', function () {
      /* B-33：编辑模式不重解析——编辑弹窗里的金额/类别/日期是该条记录的现值，
         失焦重解析会冲掉用户正在编辑的值（BACKLOG B-33 第三颗雷）。
         S2-02 起编辑入口已接通（条目「⋯」→ 编辑），此守卫首次有 UI 可达路径，
         须在 Safari 手动验收（AC4）：编辑态改原文后失焦，金额/类别不变。 */
      if (editingEntryId !== null) {
        return;
      }
      /* S1-04 验收（2026-09-12 人拍板）：原文失焦后自动重解析金额与类别。
         刻意覆盖语义——改了原文就证明原来的不要了，即使用户此前手动改过金额/类别也一律覆盖
         （"觉得不好就取消"）。日期一律不动：解析器不认日期（B-22 未做），重算会把手选日期
         重置成今天，属于倒退。重算后旧错误提示已失效，一并清掉。 */
      var reparsed = Parser.parse(els.sheetRawtext.value);
      els.sheetAmount.value = reparsed.amount == null ? '' : String(reparsed.amount);
      /* 用 selectCategory 只切选中态、不重建胶囊 DOM：blur 发生在 mousedown 与 click 之间，
         重建会让用户正在点的那颗胶囊节点消失、click 落空；不重建则"blur 先选解析类别、
         用户随后点的胶囊 click 再显式覆盖"，显式选择优先 */
      selectCategory(reparsed.category || 'other');
      clearSheetError();
    });
    /* S1-05 跨午夜刷新监听随 refreshHome 删除（S3-05）：首页无动态数据可刷；
       S3-07 账簿页重建跨午夜刷新时在账簿语境重写 */
    DB.openDB()
      .then(function (opened) {
        db = opened;
        return DB.getAllProfiles(db);
      })
      .then(bootRoute)
      .catch(function (err) {
        console.error('boot failed:', err);
        els.errorMessage.textContent = (err && err.message) ? err.message : String(err);
        showView('error');
      });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
