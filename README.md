# AnimCue Studio

[简体中文](README_zh.md) · [English Wiki](https://github.com/kltyton/AnimCue-Studio/wiki) · [中文 Wiki](https://github.com/kltyton/AnimCue-Studio/wiki/Home-zh)

**AnimCue Studio** is a Blockbench plugin for authoring multi-actor Minecraft animations for the [AnimCue](https://github.com/kltyton/AnimCue) runtime. Animate a subject model, multiple actors (custom models, vanilla entities, or bendable players), timeline events, and a scene camera together on a single Blockbench timeline, then export everything to one `.animation.json`.

Works on both **Blockbench Desktop and Web (`5.0.0+`)**, with automatic **English / Simplified Chinese / Traditional Chinese** UI following Blockbench's language setting.

## Features

- **Multi-Actor Timeline (`animcue_scene`)**: Combine a primary model with up to 64 actors in one scene. Single-texture projects automatically open a multi-texture copy so every actor keeps its own texture.
- **Flexible Actor Sources**:
  - Local `.bbmodel` or Bedrock `.geo.json` (with optional `.png` skin/texture).
  - Built-in **PAL Bend Player** and **PAL DragonCore Player** rigs when paired with [PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools) (`0.4.2+`).
  - **Vanilla Entity** templates with vanilla textures loaded automatically.
- **PAL & MoreRotation Bend Support**: Detects standard PAL and DragonCore player rigs, converts `*_bend` helper bones into 3-axis AnimCue `bend` vectors, and lets you import existing PAL, Emotecraft (`.emote`), DragonCore, or Bedrock clips directly onto a specific actor. Basic `*_bend` export also works standalone without the PAL plugin installed.
- **Scene Camera & Event Markers**: Add a non-exported scene camera (`interactive_animation:interactions.<anim>.camera`), align the viewport to the camera at any frame (`Look Through Camera`), and insert `timeline` event markers in one click.
- **Full Round-Trip Import & Export**: Export selected or all animations to one AnimCue `.animation.json` (preserving `sound_effects` and `particle_effects`), and load existing AnimCue `.animation.json` files (including grouped sound and particle keyframes) back into the scene (via the panel, `File → Import`, or native Bedrock animation import).

## Installation

### From Blockbench Plugin Store
1. Open Blockbench (`5.0.0` or newer) and go to **File → Plugins...**
2. Search for **AnimCue Studio** under the **Available** tab and click **Install**.

### Manual Installation
1. Download [dist/animcue_studio.js](dist/animcue_studio.js) (and optionally [dist/icon.png](dist/icon.png) next to it).
2. In Blockbench, open **File → Plugins... → Load Plugin from File** and select `animcue_studio.js`.

### Recommended Companion Plugin
For player elbow/knee/torso bends and `.emote` import, also install **[PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools)** (`0.4.2+`). Both plugins detect each other and link automatically.

## Quick Start

1. Open your main model (`.bbmodel`), or create a blank scene via **File → New → AnimCue Scene**.
2. In the left **AnimCue** panel, click **+ Add Actor** to bring in a `.bbmodel` / `.geo.json`, a **PAL Bend / DragonCore Player**, or a **Vanilla Entity**.
3. Double-click an actor card (or click the move icon) to jump to **Frame 0** with its root selected and position it in the viewport.
   - Animate the actor root (`interactive_animation:root`) for whole-actor movement and turning.
   - Animate child bones (and `*_bend` helpers on PAL rigs) for body and limb motion.
   - Open the **⋮** menu (or right-click in the panel / Outliner) to set exact Frame 0 coordinates, import an animation onto that actor, edit role/resource ID, reorder, duplicate, or remove.
4. Click **Add Camera** to animate a scene camera and preview through it at any time, or click the flag icon to add an event marker to the timeline.
5. Click **Export** (or **File → Export → AnimCue Animation...**) to generate the `.animation.json`.

## Documentation (Wiki)

| English | 简体中文 |
| --- | --- |
| [Home](https://github.com/kltyton/AnimCue-Studio/wiki) | [首页](https://github.com/kltyton/AnimCue-Studio/wiki/Home-zh) |
| [Getting Started](https://github.com/kltyton/AnimCue-Studio/wiki/Getting-Started) | [快速上手](https://github.com/kltyton/AnimCue-Studio/wiki/Getting-Started-zh) |
| [Actors, Formats & Vanilla Entities](https://github.com/kltyton/AnimCue-Studio/wiki/Actors-and-Rigs) | [角色导入、多贴图场景与原版实体](https://github.com/kltyton/AnimCue-Studio/wiki/Actors-and-Rigs-zh) |
| [PAL & MoreRotation Integration](https://github.com/kltyton/AnimCue-Studio/wiki/PAL-and-MoreRotation) | [PAL 与 MoreRotation 弯曲联动](https://github.com/kltyton/AnimCue-Studio/wiki/PAL-and-MoreRotation-zh) |
| [Camera & Event Markers](https://github.com/kltyton/AnimCue-Studio/wiki/Camera-and-Events) | [镜头轨道与事件标记](https://github.com/kltyton/AnimCue-Studio/wiki/Camera-and-Events-zh) |
| [Export Format & Coordinate Rules](https://github.com/kltyton/AnimCue-Studio/wiki/Export-Format) | [导出格式与坐标约定](https://github.com/kltyton/AnimCue-Studio/wiki/Export-Format-zh) |
| [Troubleshooting](https://github.com/kltyton/AnimCue-Studio/wiki/Troubleshooting) | [常见问题排查](https://github.com/kltyton/AnimCue-Studio/wiki/Troubleshooting-zh) |

## Building from Source

Requires Node.js (`18+`), with zero external npm dependencies:

```bash
node build.cjs
```

This bundles `src/` into `dist/animcue_studio.js` and copies `icon.png` into `dist/icon.png`.

### Source Layout

```text
src/
  i18n/locale.js            # EN / ZH / ZH-TW translations
  compat/pal_bridge.js      # PalBendPlayerToolsAPI bridge & standalone *_bend fallback
  project/scene_format.js   # animcue_scene ModelFormat & safe mode-switch helpers
  project/camera.js         # Scene camera rig & Look Through Camera preview
  project/participants.js   # Actor import, Frame-0 placement, edit/duplicate/remove
  assets/vanilla.js         # Vanilla CEM entity templates & texture loader
  animation/codec.js        # AnimCue JSON export, import, actor clip import & native hook
  ui/dialogs.js             # Modal dialogs (add/edit actor, vanilla picker, export, events)
  ui/studio_panel.js        # AnimCue sidebar panel
  ui/menus.js               # File / Tools / Animation / Outliner menus
  entry.js                  # Plugin registration & lifecycle
```

## Related Projects

- [AnimCue](https://github.com/kltyton/AnimCue) — Minecraft multi-actor animation runtime mod
- [PAL Bend Player Tools](https://github.com/kltyton/Pal-bend-player-tools) — Blockbench plugin for PAL / Emotecraft / DragonCore / MoreRotation player animations

## License

Licensed under the [GNU Lesser General Public License v3.0 or later (LGPL-3.0-or-later)](../../LICENSE).
