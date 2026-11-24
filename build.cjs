const fs = require('node:fs');
const path = require('node:path');

const sources = [
    'src/i18n/locale.js',
    'src/compat/pal_bridge.js',
    'src/project/scene_format.js',
    'src/project/camera.js',
    'src/project/participants.js',
    'src/assets/vanilla.js',
    'src/animation/codec.js',
    'src/ui/dialogs.js',
    'src/ui/studio_panel.js',
    'src/ui/menus.js',
    'src/entry.js'
];
const body = sources.map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
const output = path.join(__dirname, 'dist');
fs.mkdirSync(output, {recursive: true});
fs.writeFileSync(
    path.join(output, 'animcue_studio.js'),
    '/* SPDX-License-Identifier: LGPL-3.0-or-later */\n(() => {\n"use strict";\n' + body + '\n})();\n'
);
const iconSource = path.join(__dirname, 'icon.png');
if (fs.existsSync(iconSource)) {
    fs.copyFileSync(iconSource, path.join(output, 'icon.png'));
}
