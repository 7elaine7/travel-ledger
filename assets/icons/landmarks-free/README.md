# 地标简笔 · 自由笔数版归档

生成时间：2026-09-17

## 说明

- 源：mock/landmarks-free-test.html（实验 4，不限笔数、对齐 refs/A-基调与元素/轨迹图-参考.jpg 意境）
- 效果记录以该测试页为准；本目录为提取归档

## 笔触参数

- 线宽分档：主骨架 2.2-2.5，装饰短线 1.6-1.8
- 抖动：handShake（feTurbulence baseFrequency 0.9 / numOctaves 1 / seed 7 + feDisplacementMap scale 2.5）
- 长线断墨（飞白）：stroke-dasharray "40 3 12 4" 一族
- 线帽/转角 round，无填充，墨色 #3b362f（引用时按需替换）

## 文件清单

| 文件 | 地标 | 笔数 |
|---|---|---|
| landmark-ta.svg | 塔（5 层檐 + 瓦 8 + 相轮 + 云 + 水线） | 22 |
| landmark-qiao.svg | 拱桥（栏杆 10 + 内拱 + 桥墩 + 水波 4） | 19 |
| landmark-chengmen.svg | 城门（重檐 + 垛口暗示 + 两侧山影） | 15 |
| landmark-shan.svg | 山（三峰 + 轮廓断线 3 + 云雾 4） | 13 |
| landmark-shui.svg | 水（三大波 + 小涟漪 5） | 8 |
| landmark-chuan.svg | 船（乌篷 + 篷骨 3 + 篙 + 鸥鸟 2） | 13 |

每个文件自带内嵌 handShake 滤镜，可独立使用；内联时可删 <defs> 复用页面滤镜。

## 相关目录

- landmarks-icon/：毛笔风图标级（4-8 笔）
- landmarks-deco/：毛笔风装饰级 v1（10-20 笔）
- landmarks-pen/：钢笔风（匀速线 + penShake 1.5，无飞白 dasharray）
