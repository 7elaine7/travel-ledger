/* unit-validation.js — Profiles 模块纯逻辑用例（S0-01 名字校验 + S0-02 菜单排序/恢复决策） */
(function () {
  'use strict';

  var v = Profiles.validateProfileName;

  T.test('名字去除首尾空格后合法：" 小明 " -> "小明"', function () {
    var r = v(' 小明 ');
    T.eq(r.valid, true);
    T.eq(r.name, '小明');
  });

  T.test('空字符串：invalid / empty', function () {
    var r = v('');
    T.eq(r.valid, false);
    T.eq(r.reason, 'empty');
  });

  T.test('纯空格：invalid / empty', function () {
    var r = v('   ');
    T.eq(r.valid, false);
    T.eq(r.reason, 'empty');
  });

  T.test('长度边界：恰好 20 字通过，21 字 too_long', function () {
    var r20 = v('字'.repeat(20));
    T.eq(r20.valid, true);
    T.eq(Array.from(r20.name).length, 20);
    var r21 = v('字'.repeat(21));
    T.eq(r21.valid, false);
    T.eq(r21.reason, 'too_long');
  });

  T.test('含 emoji / 英文的名字通过，emoji 按一个字计', function () {
    var r = v('Mom😊');
    T.eq(r.valid, true);
    T.eq(r.name, 'Mom😊');
  });

  /* ---- S0-02：pickCurrentProfile（恢复当前账户决策） ---- */

  function p(id, createdAt) {
    return { id: id, name: 'N-' + id, createdAt: createdAt };
  }

  T.test('pickCurrentProfile：savedId 命中 → 返回该账户', function () {
    var a = p('a', '2026-01-01T08:00:00Z');
    var b = p('b', '2026-01-02T08:00:00Z');
    T.eq(Profiles.pickCurrentProfile([a, b], 'b'), b);
  });

  T.test('pickCurrentProfile：savedId 为 null → 返回最早创建的账户', function () {
    var a = p('a', '2026-01-02T08:00:00Z');
    var b = p('b', '2026-01-01T08:00:00Z'); /* b 更早创建 */
    T.eq(Profiles.pickCurrentProfile([a, b], null), b);
  });

  T.test('pickCurrentProfile：savedId 已失效（账户被删）→ 回退最早创建，不抛错', function () {
    var a = p('a', '2026-01-02T08:00:00Z');
    var b = p('b', '2026-01-01T08:00:00Z');
    T.eq(Profiles.pickCurrentProfile([a, b], 'ghost'), b);
  });

  T.test('pickCurrentProfile：空列表 → null（回创建引导）', function () {
    T.eq(Profiles.pickCurrentProfile([], 'a'), null);
    T.eq(Profiles.pickCurrentProfile([], null), null);
  });

  T.test('pickCurrentProfile：createdAt 相同 → 按 id 兜底，输出确定', function () {
    var a = p('a', '2026-01-01T08:00:00Z');
    var b = p('b', '2026-01-01T08:00:00Z');
    T.eq(Profiles.pickCurrentProfile([b, a], null), a); /* 'a' < 'b'，与传入顺序无关 */
  });

  T.test('sortProfilesForMenu：createdAt 升序、不改原数组（纯度）', function () {
    var a = p('a', '2026-01-03T08:00:00Z');
    var b = p('b', '2026-01-01T08:00:00Z');
    var c = p('c', '2026-01-02T08:00:00Z');
    var arr = [a, b, c];
    var sorted = Profiles.sortProfilesForMenu(arr);
    T.eq(sorted.map(function (x) { return x.id; }).join(','), 'b,c,a');
    T.eq(arr.map(function (x) { return x.id; }).join(','), 'a,b,c'); /* 原数组顺序未动 */
  });
})();
