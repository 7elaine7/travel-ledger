/*
 * parser.js — 文本录入智能解析（S1-01，纯逻辑，无 DOM、无写库）
 *
 * 口径（2026-09-11 人拍板，见 PROJECT_BRIEF 10.3 S1-01 AC4 变更块 / 第 9 节）：
 * 1. 金额：按标点（，。；！？、,.;!? 与换行）切句，每句取最后一个数字后求和；
 *    整句无标点时即只有一句，取整句最后一个数字；全句无数字 → null。
 *    已知局限（量词误算 / 无标点长句 / 整句单条记录）见 BRIEF B-15，不在此处理。
 * 2. 类别：6 键（2026-09-16 拍板）：food/transport/driving/hotel/ticket/other，
 *    按词典行序自上而下做子串匹配，首次命中即定类；
 *    全部不命中 → other。单字词误报（如"见面"误归餐饮）MVP 接受，B-15 已登记。
 * 3. rawText 原样保留，不 trim、不改写。
 */
(function (global) {
  'use strict';

  /* 类别元信息（图标 + 显示名），顺序 = 6 键行序 */
  var CATEGORY_META = {
    food:      { icon: '🍜', label: '餐饮' },
    transport: { icon: '🚇', label: '交通' },
    driving:   { icon: '🚗', label: '自驾' },
    hotel:     { icon: '🏨', label: '住宿' },
    ticket:    { icon: '🎟️', label: '门票' },
    other:     { icon: '📦', label: '其他' }
  };

  /*
   * 关键词词典：数组顺序 = 6 键行序（food 最优先）。
   * 每行内部长词在前（如"过桥费"先于"过路"类词），仅为可读性，
   * 跨行命中时一律按行序，不做打分。
   */
  var KEYWORD_ROWS = [
    { category: 'food',      keywords: ['肉夹馍', '咖啡', '早餐', '午餐', '晚餐', '吃', '饭', '餐', '面'] },
    { category: 'transport', keywords: ['出租车', '滴滴', '打车', '地铁', '公交'] },
    { category: 'driving',   keywords: ['过桥费', '路桥', '过路', '高速', '加油', '充电'] },
    { category: 'ticket',    keywords: ['博物馆', '乐园', '景点', '景区', '门票'] },
    { category: 'hotel',     keywords: ['酒店', '民宿', '住宿', '青旅'] },
    { category: 'other',     keywords: ['纪念品', '便利店', '超市', '购物', '买'] }
  ];

  var AMOUNT_RE_GLOBAL = /\d+(?:\.\d+)?/g;
  var DECIMAL_DOT_RE = /(\d)\.(\d)/g;

  /*
   * 切句标点（BRIEF 10.3 AC4 变更 + 2026-09-11 小数/Safari 修复）：
   * 中文标点（，。；！？、）/ 英文逗号句号分号叹号问号 / 换行。
   * 英文句点默认切句，但"数字.数字"中的点是小数点，不切。
   * 做法（不用 lookbehind/lookahead，Safari 15 兼容，见 BRIEF 第 8 节技术约束）：
   * 切句前把小数点替换成私用区占位符，切完再还原；还原只认"数字-占位符-数字"形态。
   * 用户文本自带的 U+E000（私用区，图标字体/部分输入法会用）在保护前先中和为空格，
   * 否则它与真小数点保护出的占位符在字符串层面不可区分，会被误还原成小数点
   * （如"花了12\E0005元"会误算成 12.5，正确口径应取最后一个数字 5）（2026-09-12 加固）。
   */
  var SENTENCE_SPLIT_RE = /[，。；！？、,.;!?\n\r]+/;
  var DOT_PLACEHOLDER = String.fromCharCode(0xE000); /* 私用区 U+E000，正常记账文本不会出现；用 fromCharCode 避免源码里出现不可见字符 */
  var RESTORE_DECIMAL_RE = new RegExp('(\\d)' + DOT_PLACEHOLDER + '(\\d)', 'g'); /* 还原：仅"数字-占位符-数字"算小数点 */

  /** 把"数字.数字"里的小数点保护为占位符（循环处理重叠的极端串） */
  function protectDecimalDots(s) {
    var prev;
    do {
      prev = s;
      s = s.replace(DECIMAL_DOT_RE, '$1' + DOT_PLACEHOLDER + '$2');
    } while (s !== prev);
    return s;
  }

  /**
   * 提取金额（2026-09-11 新口径；2026-09-12 占位符还原收紧）：
   * 中和用户自带的 U+E000 → 保护小数点 → 按标点切成若干小句
   * → 按"数字-占位符-数字"还原小数点 → 每句取最后一个数字 → 各句求和；
   * 没有任何一句含数字 → null。
   * 无标点文本天然只有一句，即"整句取最后一个数字"。
   * 求和结果四舍五入到分，规避浮点尾差。
   */
  function extractAmount(text) {
    if (text == null) {
      return null;
    }
    var cleanText = String(text).split(DOT_PLACEHOLDER).join(' '); /* 先中和用户自带的 U+E000 */
    var protectedText = protectDecimalDots(cleanText);
    var segments = protectedText.split(SENTENCE_SPLIT_RE);
    var sum = 0;
    var found = false;
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i].replace(RESTORE_DECIMAL_RE, '$1.$2');
      var nums = segment.match(AMOUNT_RE_GLOBAL);
      if (nums && nums.length > 0) {
        found = true;
        sum += parseFloat(nums[nums.length - 1]);
      }
    }
    if (!found) {
      return null;
    }
    return Math.round(sum * 100) / 100;
  }

  /**
   * 类别匹配：映射表行序优先的子串匹配，首个命中类即结果；都不命中 → other。
   */
  function matchCategory(text) {
    var s = text == null ? '' : String(text);
    for (var i = 0; i < KEYWORD_ROWS.length; i++) {
      var row = KEYWORD_ROWS[i];
      for (var j = 0; j < row.keywords.length; j++) {
        if (s.indexOf(row.keywords[j]) !== -1) {
          return row.category;
        }
      }
    }
    return 'other';
  }

  /**
   * 组合入口：rawText 原样回传，附解析金额、类别与展示元信息。
   * 返回 { rawText, amount, category, categoryIcon, categoryLabel }。
   */
  function parse(rawText) {
    var text = rawText == null ? '' : String(rawText);
    var category = matchCategory(text);
    var meta = CATEGORY_META[category] || CATEGORY_META.other;
    return {
      rawText: rawText,
      amount: extractAmount(text),
      category: category,
      categoryIcon: meta.icon,
      categoryLabel: meta.label
    };
  }

  global.Parser = {
    CATEGORY_META: CATEGORY_META,
    extractAmount: extractAmount,
    matchCategory: matchCategory,
    parse: parse
  };
})(window);
