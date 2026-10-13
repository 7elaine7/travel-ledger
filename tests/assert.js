/*
 * assert.js — 项目自有极简测试助手（不是第三方框架，BRIEF 6.5）
 * 用法：
 *   T.test('用例名', function () { T.eq(a, b); });          // 同步
 *   T.test('用例名', async function () { ... });            // 异步
 *   全部注册完后由 tests.html 调用 await T.run() 渲染结果。
 */
(function (global) {
  'use strict';

  var results = [];
  var queue = Promise.resolve();

  function test(name, fn) {
    queue = queue.then(function () {
      try {
        return Promise.resolve(fn()).then(
          function () { results.push({ name: name, ok: true }); },
          function (err) { results.push({ name: name, ok: false, error: String(err && err.message || err) }); }
        );
      } catch (err) {
        results.push({ name: name, ok: false, error: String(err && err.message || err) });
      }
    });
  }

  function eq(actual, expected, message) {
    if (!Object.is(actual, expected)) {
      throw new Error(message || ('期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual)));
    }
  }

  function ok(value, message) {
    if (!value) {
      throw new Error(message || ('期望真值，实际 ' + JSON.stringify(value)));
    }
  }

  function notOk(value, message) {
    if (value) {
      throw new Error(message || ('期望假值，实际 ' + JSON.stringify(value)));
    }
  }

  function throws(fn, message) {
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) {
      throw new Error(message || '期望抛异常，但没有');
    }
  }

  function run() {
    return queue.then(function () { render(); });
  }

  function render() {
    var passed = results.filter(function (r) { return r.ok; }).length;
    var failed = results.length - passed;
    var root = document.getElementById('results');
    var html = '';
    html += '<p class="summary ' + (failed === 0 ? 'pass' : 'fail') + '">'
      + (failed === 0 ? '✅' : '❌') + ' ' + passed + '/' + results.length + ' 通过'
      + (failed > 0 ? '，失败 ' + failed : '') + '</p>';
    html += '<ul class="case-list">';
    results.forEach(function (r) {
      html += '<li class="' + (r.ok ? 'case pass' : 'case fail') + '">'
        + (r.ok ? '✅' : '❌') + ' ' + r.name
        + (r.ok ? '' : '<div class="error">' + escapeHtml(r.error) + '</div>')
        + '</li>';
    });
    html += '</ul>';
    root.innerHTML = html;
    document.title = (failed === 0 ? '✅ ' : '❌ ') + passed + '/' + results.length + ' 单元测试';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.T = {
    test: test,
    eq: eq,
    ok: ok,
    notOk: notOk,
    throws: throws,
    run: run,
    results: results
  };
})(window);
