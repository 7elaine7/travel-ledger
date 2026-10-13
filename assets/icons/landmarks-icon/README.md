# 地标简笔 · 图标级归档

生成时间：2026-09-17

## 笔触参数

- 线宽分档：主骨架 2.2-2.5，装饰短线 1.6-1.8（sw 1.6-2.5 分档）
- 抖动：handShake 滤镜（feTurbulence baseFrequency 0.9 / numOctaves 1 / seed 7 + feDisplacementMap scale 2.5）
- 长线断墨（飞白）：stroke-dasharray "40 3 12 4" 一族
- 线帽/转角：round；填充：无
- 墨色 #3b362f（引用时按需替换）

## 用途

分类图标、按钮图形、标签。规格见 DESIGN_SPEC.md 2.10「图标级」。

## 文件清单

| 文件 | 地标 | 笔数 |
|---|---|---|
| landmark-ta.svg | 塔 | 9 |
| landmark-qiao.svg | 拱桥 | 8 |
| landmark-chengmen.svg | 城门 | 7 |
| landmark-shan.svg | 山 | 4 |
| landmark-shui.svg | 水 | 3 |
| landmark-chuan.svg | 船 | 4 |

每个文件自带内嵌 handShake 滤镜定义，可独立以 <img> 或内联使用；
内联到页面时若页面已有同名滤镜，可删掉文件内 <defs> 复用页面版。
