/*
 * session.js — 当前账户态（审查修复 #2）
 * Sprint 1 的 entries.ownerId 一律从 Session.getCurrentProfileId() 取。
 * 内存为主，localStorage 持久化；S0-02 的"记住上次账户"复用同一 key。
 */
(function (global) {
  'use strict';

  var KEY = 'lastProfileId';
  var currentProfileId = null;

  function readStored() {
    try {
      return global.localStorage.getItem(KEY);
    } catch (e) {
      return null; /* localStorage 不可用时退化为纯内存态 */
    }
  }

  /*
   * 契约（B-03，2026-09-12）：返回「当前有效账户 id」或 null（当前没有有效账户）。
   * null 只出现在 boot 早期或 profiles 为空；localStorage 不可用时退化为纯内存态，绝不伪造 id。
   * 写入类调用方必须先判空：DB.addEntry 对缺失 ownerId 有硬守卫（开事务前 reject），
   * 本函数返回 null 不可能落成 ownerId=null 的孤儿数据。
   */
  function getCurrentProfileId() {
    return currentProfileId || readStored();
  }

  function setCurrentProfileId(id) {
    currentProfileId = id || null;
    try {
      if (currentProfileId) {
        global.localStorage.setItem(KEY, currentProfileId);
      } else {
        global.localStorage.removeItem(KEY);
      }
    } catch (e) {
      /* 同上，静默降级 */
    }
  }

  global.Session = {
    KEY: KEY,
    getCurrentProfileId: getCurrentProfileId,
    setCurrentProfileId: setCurrentProfileId
  };
})(window);
