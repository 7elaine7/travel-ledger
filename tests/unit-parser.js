/* unit-parser.js — Parser 纯逻辑用例（S1-01，25 条） */
(function () {
  'use strict';

  var amount = Parser.extractAmount;
  var cat = Parser.matchCategory;
  var parse = Parser.parse;

  /* ---- extractAmount：15 条 ---- */

  T.test('金额：整数"花了50" → 50', function () {
    T.eq(amount('花了50'), 50);
  });

  T.test('金额：小数"3.5" → 3.5（英文句点作小数点时不切句）', function () {
    T.eq(amount('咖啡3.5'), 3.5);
  });

  T.test('金额：小数 + 跨句求和"咖啡3.5、午饭20" → 23.5', function () {
    T.eq(amount('咖啡3.5、午饭20'), 23.5);
  });

  T.test('金额：按标点切句，每句取最后一个数字后求和', function () {
    T.eq(amount('早上花了10，中午花了20'), 30);
  });

  T.test('金额：无数字或空串 → null', function () {
    T.eq(amount('今天天气真好'), null);
    T.eq(amount(''), null);
  });

  T.test('金额：数字在句首"50吃了个面" → 50（该句唯一且最后一个数字）', function () {
    T.eq(amount('50吃了个面'), 50);
  });

  T.test('金额：无标点句中的日期不再误算——"2026年去了北京花了500" → 500（2026-09-11 AC4 新口径）', function () {
    T.eq(amount('2026年去了北京花了500'), 500);
  });

  /* ---- AC4 新口径专项（2026-09-11 人拍板） ---- */

  T.test('金额：无标点"买了2杯咖啡花了40" → 整句最后一个数字 40', function () {
    T.eq(amount('买了2杯咖啡花了40'), 40);
  });

  T.test('金额：日期数字剥离——"8月30日加油200，买菜50" → 200 + 50 = 250', function () {
    T.eq(amount('8月30日加油200，买菜50'), 250);
  });

  T.test('金额：无标点多数字"早上花了10中午花了20" → 整句最后一个数字 20', function () {
    T.eq(amount('早上花了10中午花了20'), 20);
  });

  T.test('金额：顿号切句"苹果10、香蕉20" → 10 + 20 = 30', function () {
    T.eq(amount('苹果10、香蕉20'), 30);
  });

  /* ---- 切句边界专项（2026-09-12 补测：小数切句核心语义此前零覆盖） ---- */

  T.test('金额：英文句点作句末标点切句"花了50.打车20" → 50 + 20 = 70', function () {
    T.eq(amount('花了50.打车20'), 70);
  });

  T.test('金额：多小数"咖啡3.5、蛋糕4.2" → 3.5 + 4.2 = 7.7', function () {
    T.eq(amount('咖啡3.5、蛋糕4.2'), 7.7);
  });

  T.test('金额：连续标点"咖啡。。20" → 20（空句不产生金额）', function () {
    T.eq(amount('咖啡。。20'), 20);
  });

  T.test('金额：换行切句"早餐10\\n午餐20" → 10 + 20 = 30', function () {
    T.eq(amount('早餐10\n午餐20'), 30);
  });

  /* ---- matchCategory：5 条 ---- */

  T.test('类别：六类主关键词各归各类', function () {
    T.eq(cat('吃了碗面'), 'food');
    T.eq(cat('坐地铁'), 'transport');
    T.eq(cat('高速费'), 'driving');
    T.eq(cat('加油'), 'driving');
    T.eq(cat('门票'), 'ticket');
    T.eq(cat('酒店两晚'), 'hotel');
    T.eq(cat('超市采购'), 'other');
  });

  T.test('类别：同义词抽查', function () {
    T.eq(cat('一杯咖啡'), 'food');
    T.eq(cat('打滴滴回家'), 'transport');
    T.eq(cat('过桥费'), 'driving');
    T.eq(cat('新能源车充电'), 'driving');
    T.eq(cat('去乐园玩'), 'ticket');
    T.eq(cat('住青旅'), 'hotel');
    T.eq(cat('便利店买水'), 'other');
  });

  T.test('类别：无法匹配 → other', function () {
    T.eq(cat('今天天气真好'), 'other');
  });

  T.test('类别：多类命中按映射表行序（food 在 transport 前）', function () {
    T.eq(cat('吃早饭然后坐地铁'), 'food');
  });

  T.test('类别：子串匹配"博物馆一日游" → ticket', function () {
    T.eq(cat('博物馆一日游'), 'ticket');
  });

  /* ---- parse 组合：5 条 ---- */

  T.test('parse：完整案例——"我今天吃肉夹馍花了50" → 原文 / 50 / food', function () {
    var r = parse('我今天吃肉夹馍花了50');
    T.eq(r.rawText, '我今天吃肉夹馍花了50');
    T.eq(r.amount, 50);
    T.eq(r.category, 'food');
    T.eq(r.categoryIcon, '🍜');
    T.eq(r.categoryLabel, '餐饮');
  });

  T.test('parse：rawText 完全原样（含首尾空格，不 trim）', function () {
    var r = parse('  去XX景区门票花费100  ');
    T.eq(r.rawText, '  去XX景区门票花费100  ');
    T.eq(r.amount, 100);
    T.eq(r.category, 'ticket');
  });

  T.test('parse：无数字但有类别"今天吃了顿好的" → amount=null，category=food', function () {
    var r = parse('今天吃了顿好的');
    T.eq(r.amount, null);
    T.eq(r.category, 'food');
  });

  T.test('parse：无数字无类别 → amount=null，category=other', function () {
    var r = parse('今天天气真好');
    T.eq(r.amount, null);
    T.eq(r.category, 'other');
  });

  T.test('parse："加油花了200" → 200 / driving', function () {
    var r = parse('加油花了200');
    T.eq(r.amount, 200);
    T.eq(r.category, 'driving');
    T.eq(r.categoryLabel, '自驾');
  });
})();
