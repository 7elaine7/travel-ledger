/*
 * profiles.js — 账户相关纯逻辑（无 DOM、无 IndexedDB 依赖，可直接单元测试）
 */
(function (global) {
  'use strict';

  var NAME_MAX = 20;

  /**
   * 校验账户名。
   * @param {string} raw 输入框原文
   * @returns {{valid:true,name:string}|{valid:false,reason:'empty'|'too_long'}}
   * 长度按 Unicode 码点计数（一个 emoji 算一个字）。
   */
  function validateProfileName(raw) {
    var name = String(raw == null ? '' : raw).trim();
    if (name.length === 0) {
      return { valid: false, reason: 'empty' };
    }
    if (Array.from(name).length > NAME_MAX) {
      return { valid: false, reason: 'too_long' };
    }
    return { valid: true, name: name };
  }

  /**
   * 菜单排序（纯函数，S0-02）：createdAt 升序，同刻按 id 兜底保证输出确定。
   * 返回新数组，不改原数组。
   */
  function timeValue(profile) {
    var t = profile && profile.createdAt ? new Date(profile.createdAt).getTime() : NaN;
    return isNaN(t) ? 0 : t;
  }

  function sortProfilesForMenu(profiles) {
    if (!Array.isArray(profiles)) {
      return [];
    }
    return profiles.slice().sort(function (a, b) {
      var ta = timeValue(a);
      var tb = timeValue(b);
      if (ta !== tb) {
        return ta - tb;
      }
      var ia = String(a && a.id || '');
      var ib = String(b && b.id || '');
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }

  /**
   * 恢复当前账户（纯函数，S0-02）：
   * savedId 命中 → 该账户；savedId 为空或已失效（账户被删/残留）→ 最早创建的账户（即菜单第一项）；
   * 空列表 → null（回到创建引导）。
   */
  function pickCurrentProfile(profiles, savedId) {
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return null;
    }
    if (savedId != null && savedId !== '') {
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i] && profiles[i].id === savedId) {
          return profiles[i];
        }
      }
    }
    return sortProfilesForMenu(profiles)[0];
  }

  global.Profiles = {
    NAME_MAX: NAME_MAX,
    validateProfileName: validateProfileName,
    sortProfilesForMenu: sortProfilesForMenu,
    pickCurrentProfile: pickCurrentProfile
  };
})(window);
