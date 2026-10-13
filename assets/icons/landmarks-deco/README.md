# 地标简笔 · 装饰级 v1 归档

生成时间：2026-09-17

## 笔触参数（与图标级同源）

- 线宽分档：主骨架 2.2-2.5，装饰短线 1.6-1.8
- 抖动：handShake（feTurbulence baseFrequency 0.9 / numOctaves 1 / seed 7 + feDisplacementMap scale 2.5）
- 长线断墨（飞白）：stroke-dasharray "40 3 12 4" 一族
- 线帽/转角 round，无填充，墨色 #3b362f（引用时按需替换）

## 与图标级的区别

- 笔数放开到 10-20：允许屋檐层次、瓦、栏杆、屋脊、垛口、云雾断线等细节暗示
- 规格：DESIGN_SPEC.md 2.10「装饰级」；效果记录 mock/trajectory-test.html

## 文件清单

| 文件 | 地标 | 笔数 |
|---|---|---|
| landmark-ta.svg | 塔 | 16 |
| landmark-qiao.svg | 拱桥 | 14 |
| landmark-chengmen.svg | 城门 | 14 |
| landmark-shan.svg | 山 | 11 |

每个文件自带内嵌 handShake 滤镜，可独立使用；内联时可删 <defs> 复用页面滤镜。
