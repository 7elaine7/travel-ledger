/*
 * export.js — JSON 导出纯逻辑（S2-03，E-05 / D6）
 * 三个纯函数，无 DOM、无 IndexedDB 依赖（与 profiles.js / parser.js 同模式，可直接单测）：
 *   buildExportData(profile, entries, exportedAt) — 组装导出 JSON 结构
 *   sanitizeFileName(name)                        — 文件名非法字符清洗
 *   buildExportFileName(accountName, fromYmd, toYmd) — travel-ledger-<名>-<起YYYYMMDD>-<止YYYYMMDD>.json
 * 口径（S3-08 批 3 修订）：导出内容由调用方决定（传什么数组导什么，本模块不查询、
 * 不限定范围）；不含其他账户（禁令 7）由调用方保证。
 */
(function (global) {
  'use strict';

  /* 导出条目白名单：entries 表的九个数据字段（BRIEF 第 7 节数据模型）。location/note
     为 S2-03 遗留补齐——db v3 已加字段，本白名单漏跟，S3-08 批 3 修复。
     组装时逐字段复制，条目上混入的任何其他属性一律不透传。 */
  var EXPORT_FIELDS = ['id', 'ownerId', 'rawText', 'amount', 'category', 'happenedAt', 'createdAt', 'location', 'note'];

  /*
   * 组装导出 JSON 结构：app 标识 + 版本 + exportedAt + profile(id/name) + 笔数 + 条目。
   * 纯函数：不修改传入数组与条目对象；entries 缺省/null 按 0 笔处理（空账户也可导出）。
   * exportedAt 由调用方生成后传入（app 侧 new Date().toISOString()），函数内不取系统时间，
   * 保证输出对入参完全确定、可单测。
   */
  function buildExportData(profile, entries, exportedAt) {
    var list = entries || [];
    var cleanEntries = [];
    for (var i = 0; i < list.length; i++) {
      var src = list[i];
      var copy = {};
      for (var j = 0; j < EXPORT_FIELDS.length; j++) {
        var key = EXPORT_FIELDS[j];
        copy[key] = src[key];
      }
      cleanEntries.push(copy);
    }
    return {
      app: 'travel-ledger',
      version: 1,
      exportedAt: exportedAt,
      profile: { id: profile.id, name: profile.name },
      count: cleanEntries.length,
      entries: cleanEntries
    };
  }

  /*
   * 文件名清洗（D6「非法字符清洗」）：跨平台（macOS/Windows）文件名禁用的
   * 9 个字符 / \ : * ? " < > | 全部替换为 -；连续空白收成一个、首尾裁掉。
   * 兜底判定（S2-03 验收修复）：先把非法字符与空白整体剥掉再看是否还有可用字符——
   * 若名字本身不含任何可用字符（'///'、'???'、' '、''、null）直接兜底「账户」。
   * 不能先替换成 '-' 再判空：'-' 非空，'///' 会得到 '---' 永远走不到兜底。
   * 点号是合法字符，保留。
   */
  function sanitizeFileName(name) {
    var raw = String(name == null ? '' : name);
    if (raw.replace(/[/\\:*?"<>|\s]/g, '') === '') {
      return '账户';
    }
    return raw
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /*
   * 导出文件名（S3-08 批 3 新命名，2026-09-20 人拍板）：
   * travel-ledger-<账户名>-<起YYYYMMDD>-<止YYYYMMDD>.json。
   * fromYmd/toYmd 为本地 YYYY-MM-DD（app 侧取寻踪结果实际边界 EntryUtils.deriveYMDRange，
   * 双边/单边筛选恒用结果实际边界、非筛选框原文——同批 2 存卷拍板②口径），压成 YYYYMMDD。
   */
  function buildExportFileName(accountName, fromYmd, toYmd) {
    var fromCompact = String(fromYmd == null ? '' : fromYmd).replace(/-/g, '');
    var toCompact = String(toYmd == null ? '' : toYmd).replace(/-/g, '');
    return 'travel-ledger-' + sanitizeFileName(accountName) + '-' + fromCompact + '-' + toCompact + '.json';
  }

  global.Exporter = {
    buildExportData: buildExportData,
    sanitizeFileName: sanitizeFileName,
    buildExportFileName: buildExportFileName
  };
})(window);
