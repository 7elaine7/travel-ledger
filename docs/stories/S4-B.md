# S4-B 缮录归帙保存链

> 本文件是 S4-B 的方案（intent + spec + plan + 测试重点）。AC 全文在 SPRINTS.md Sprint 4 章节。
> Gitee 工作项：挂在 E-02 下。

---

## Intent（业务意图）

**为什么做**：S4-A 让载录页可输入，但还不能保存。要让记账主路径闭环，必须接通「表单 → 校验 → 写库 → 去向」的完整链路。

**解决什么问题**：现状「缮录归帙」按钮点击后只 switchTab('home')，不会保存。用户填了表单却存不进去。

**边界**：
- 不弹 sheet——载录页表单本身即确认页（修订 BRIEF 禁令 4）
- 不做地点/日期解析
- 不做 ← 返回确认框（B-60）
- 不动 journeys / 存卷
- 不做多笔拆条（B-17）

---

## Spec（需求规格）

**AC 全文见 SPRINTS.md Sprint 4 章节 S4-B**（AC1 ~ AC11）。

**关键行为**：
- 五项有效 → 跳账簿页，当日分组出现该笔
- 四字段任一为空 → 不写库，页内提示
- 空格算已填（2026-09-20 拍板口径）
- 金额非法或 ≤0 → 不写库
- 日期选明天 → 不写库
- 成功后清首页输入框、跳账簿页、toast
- 写库失败 → 表单保留、可重试
- 全程不出现确认 sheet

**数据结构**：写入 entries，含 location/note，rawText = 首页原文。

**BRIEF 禁令 4 修订**：随本 Story 先改文件再动代码（BRIEF 加 v1.13）。
- 原：禁止点击"保存"后直接写入 IndexedDB
- 新：禁止绕过确认环节直接写库——每个写库入口必须有确认环节；首页→载录→缮录归帙链路以载录页表单本身为确认页，不另弹 sheet

**DESIGN_SPEC 209 修订**："rawText 只做预填用途，保存后废弃" → "rawText 不再单独展示，落库保留原文一字不改"

---

## Plan（实施计划）

**改哪里**：

| 文件 | 改动 |
|---|---|
| `js/app.js` | btn-record-save 从 `switchTab('home')` 改接 `saveRecord()`（读表单 → 校验 → addEntry → 清输入框 → switchTab('ledger')）；新增载录页错误提示位；保存防重入 |
| `js/record-form.js` | 增 `validateRecordForm(values)` 函数 |
| `index.html` | 错误提示位 |
| `db.js` | **零改动**——v3 的 addEntry/updateEntry 已支持 location/note |
| `PROJECT_BRIEF.md` | 禁令 4 修订（加版本行 v1.13） |
| `DESIGN_SPEC.md` | 209 条修订 |

**步骤**：
1. 改 BRIEF 禁令 4 + DESIGN_SPEC 209（先改文件）
2. 加 `validateRecordForm` + 单测
3. 改 `app.js` saveRecord
4. 改 `index.html` 错误提示位
5. 人手动验收 AC1~AC11

**依赖**：S4-A（控件存在才能读值）

**风险**：
- addEntry 的 location/note 字段若未在 db 层正确规范化，写入可能失败（已核实 v3 支持）
- 载录页错误提示与 toast 的交互需明确（本 Story 用页内提示，不用 toast）

---

## 测试重点

**单元测试**（validateRecordForm，约 5-6 条）：
- 四字段空 / 空格 / 金额非法 / 未来日期 / 合法路径

**手动验收**（AC1 ~ AC11）：
- 每条 AC 对应一条「前置条件 → 操作 → 预期结果」
- 重点验：写库内容正确性（导出 JSON 或 DevTools 查看）、失败保留表单、不出现 sheet

**不做**：UI 渲染测试（不符合 BRIEF 6.5-A）