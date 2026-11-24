# AnimCue Studio（合拍创作插件）

[English](README.md) · [中文 Wiki](https://github.com/kltyton/AnimCue-Studio/wiki/Home-zh) · [English Wiki](https://github.com/kltyton/AnimCue-Studio/wiki)

**AnimCue Studio** 是为 [AnimCue](https://github.com/kltyton/AnimCue) 运行端制作多角色互动动画的 Blockbench 插件。你可以把主体模型、多个参与角色（自定义模型、原版实体或可弯曲玩家）、时间轴事件以及镜头放在同一条 Blockbench 时间轴上协同 K 帧，并一键导出为单个 `.animation.json`。

同时支持 **Blockbench 桌面版与网页版（`5.0.0+`）**，界面语言跟随 Blockbench 设置自动切换 **简体中文 / 繁体中文 / English**。

## 核心功能

- **多角色同轴编辑（`animcue_scene`）**：在同一场景内组合主体与最多 64 个参与角色。若主体原本是单贴图格式，首次添加角色会自动创建多贴图副本，避免贴图互相覆盖。
- **多种角色导入方式**：
  - 本地 `.bbmodel` 或基岩版 `.geo.json`（支持顺手指定 `.png` 贴图）。
  - 安装 [PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools)（`0.4.2+`）后，可直接添加内置 **PAL 弯曲玩家** 与 **PAL 龙核玩家**。
  - **原版实体模板**：内置检索与双击确认，自动拉取原版实体贴图。
- **PAL / MoreRotation 弯曲联动**：自动识别标准 PAL 与龙核玩家骨骼，将 `*_bend` 辅助骨骼转换为 AnimCue 运行端使用的三轴 `bend` 向量，并支持将现成的 PAL、Emotecraft（`.emote`）、龙核或基岩动画直接导入到指定角色身上。未安装 PAL 插件时，仍提供基础 `*_bend` 导出回退。
- **场景镜头与事件标记**：一键添加不导出几何体的镜头组（导出为 `kltyton:interactions.<anim>.camera`），随时在任意时间点通过「预览镜头视角」对齐视口，也可一键向主动画 `timeline` 插入事件标记。
- **完整双向导入导出**：支持导出当前或全部动画为单个合拍 `.animation.json`，也支持从面板、文件菜单或直接用原生动画导入加载已有合拍文件继续修改。

## 安装方式

### 从 Blockbench 插件商店安装
1. 打开 Blockbench（`5.0.0` 及以上），进入 **文件 → 插件...**
2. 切换到 **可用** 标签页，搜索 **AnimCue Studio** 并点击 **安装**。

### 手动安装
1. 下载 [dist/animcue_studio.js](dist/animcue_studio.js)（可选将 [dist/icon.png](dist/icon.png) 放在同目录）。
2. 在 Blockbench 中打开 **文件 → 插件... → 从文件加载插件**，选择 `animcue_studio.js`。

### 推荐搭配插件
如果需要制作玩家手肘、膝盖、躯干弯曲或导入 `.emote` 动作，建议同时安装 **[PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools)**（`0.4.2+`）。两个插件会自动发现并联动。

## 快速上手

1. 打开你的主体模型（`.bbmodel`），或从 **文件 → 新建 → 合拍场景 (AnimCue)** 新建空白场景。
2. 在左侧 **合拍场景** 面板点击 **+ 添加角色**，导入 `.bbmodel` / `.geo.json`、内置 **PAL 弯曲玩家 / 龙核玩家** 或 **原版实体模板**。
3. 双击角色卡片（或点摆位图标）可直接跳转到**动画模式第 0 帧**并选中该角色根组，在视口中拖拽站位：
   - 角色根组控制整体移动与转身（导出为 `kltyton:root`）。
   - 子骨骼与 PAL 的 `*_bend` 辅助骨骼控制肢体动作和三轴弯曲。
   - 点击角色卡片右侧 **⋮**（或在面板卡片 / 大纲上右键）可设置精确的第 0 帧坐标、向该角色导入动作、修改角色名/资源 ID、调整绑定顺序、复制或移除。
4. 点击 **添加镜头** 制作镜头运动并随时预览当前帧视角；点击工具栏旗标图标在当前时间插入事件标记。
5. 点击面板右上角 **导出**（或 **文件 → 导出 → 合拍动画**）输出 `.animation.json`。

## 完整文档（Wiki）

| 简体中文 | English |
| --- | --- |
| [首页](https://github.com/kltyton/AnimCue-Studio/wiki/Home-zh) | [Home](https://github.com/kltyton/AnimCue-Studio/wiki) |
| [快速上手](https://github.com/kltyton/AnimCue-Studio/wiki/Getting-Started-zh) | [Getting Started](https://github.com/kltyton/AnimCue-Studio/wiki/Getting-Started) |
| [角色导入、多贴图场景与原版实体](https://github.com/kltyton/AnimCue-Studio/wiki/Actors-and-Rigs-zh) | [Actors, Formats & Vanilla Entities](https://github.com/kltyton/AnimCue-Studio/wiki/Actors-and-Rigs) |
| [PAL 与 MoreRotation 弯曲联动](https://github.com/kltyton/AnimCue-Studio/wiki/PAL-and-MoreRotation-zh) | [PAL & MoreRotation Integration](https://github.com/kltyton/AnimCue-Studio/wiki/PAL-and-MoreRotation) |
| [镜头轨道与事件标记](https://github.com/kltyton/AnimCue-Studio/wiki/Camera-and-Events-zh) | [Camera & Event Markers](https://github.com/kltyton/AnimCue-Studio/wiki/Camera-and-Events) |
| [导出格式与坐标约定](https://github.com/kltyton/AnimCue-Studio/wiki/Export-Format-zh) | [Export Format & Coordinate Rules](https://github.com/kltyton/AnimCue-Studio/wiki/Export-Format) |
| [常见问题排查](https://github.com/kltyton/AnimCue-Studio/wiki/Troubleshooting-zh) | [Troubleshooting](https://github.com/kltyton/AnimCue-Studio/wiki/Troubleshooting) |

## 从源码构建

仅需 Node.js（`18+`），零第三方 npm 依赖：

```bash
node build.cjs
```

脚本会将 `src/` 合并输出到 `dist/animcue_studio.js`，并同步复制 `icon.png` 到 `dist/icon.png`。

### 源码结构

```text
src/
  i18n/locale.js            # 中英文 / 繁中多语言字典
  compat/pal_bridge.js      # PalBendPlayerToolsAPI 联动桥与无插件 *_bend 回退
  project/scene_format.js   # animcue_scene 格式与编辑/动画模式安全切换
  project/camera.js         # 场景镜头组与视角预览
  project/participants.js   # 角色导入、第 0 帧摆位、编辑/复制/删除
  assets/vanilla.js         # 原版实体 CEM 模板与贴图加载
  animation/codec.js        # 合拍动画导出、双向导入、单角色导入与原生导入钩子
  ui/dialogs.js             # 对话框（添加/编辑角色、原版模板检索、导出、事件）
  ui/studio_panel.js        # 侧边栏「合拍场景」面板
  ui/menus.js               # 文件 / 工具 / 动画 / 大纲菜单注册
  entry.js                  # 插件注册与生命周期
```

## 相关项目

- [AnimCue](https://github.com/kltyton/AnimCue) — Minecraft 多角色互动动画运行端模组
- [PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools) — PAL / Emotecraft / 龙核 / MoreRotation 玩家动画 Blockbench 插件

## 开源许可

本项目基于 [GNU Lesser General Public License v3.0 or later (LGPL-3.0-or-later)](LICENSE) 开源。
