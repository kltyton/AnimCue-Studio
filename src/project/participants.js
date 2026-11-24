const Participants = (() => {
    const slotKey = 'animcue_participant';
    const boneKey = 'animcue_bone_name';
    const resourceId = /^[a-z0-9_.-]+:[a-z0-9/._-]+$/;

    function register() {
        return [
            new Property(Group, 'object', slotKey),
            new Property(Group, 'string', boneKey)
        ];
    }

    function roots() {
        return Outliner.root.filter(node => node instanceof Group && Boolean(node[slotKey]?.role));
    }

    function findByRole(role) {
        return roots().find(group => group[slotKey]?.role === role) || null;
    }

    function rootOf(node) {
        let current = node;
        while (current && current !== 'root') {
            if (current instanceof Group && current.parent === 'root' && current[slotKey]?.role) return current;
            current = current.parent;
        }
        return null;
    }

    function selectedRoot() {
        const found = rootOf(Group.first_selected ?? Outliner.selected[0]);
        if (!found) throw new Error(Locale.t('err_select_participant'));
        return found;
    }

    function uniqueRole(base) {
        const clean = String(base || 'actor')
            .toLowerCase()
            .replace(/[^a-z0-9_.-]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'actor';
        const stem = clean === 'primary' ? 'actor' : clean;
        const existing = new Set(roots().map(group => group[slotKey]?.role));
        if (!existing.has(stem)) return stem;
        let idx = 2;
        while (existing.has(`${stem}_${idx}`)) idx += 1;
        return `${stem}_${idx}`;
    }

    function guessDefaults(fileName, data) {
        const stem = String(fileName || 'actor')
            .split(/[\\/]/)
            .pop()
            .replace(/(\.geo\.json|\.bbmodel|\.json)$/i, '');
        const groupNames = collectRawGroupNames(data);
        const lower = new Set(groupNames.map(n => n.toLowerCase()));
        const isDragoncore = groupNames.some(n => n === 'Body_Lower' || n === 'Right_Arm_Lower');
        const isPalPlayer = isDragoncore || (lower.has('torso_bend') && lower.has('right_arm_bend'));
        const isVanillaPlayer = lower.has('head') && lower.has('left_arm') && lower.has('right_arm') && lower.has('left_leg');
        if (isPalPlayer || isVanillaPlayer) {
            return {
                role: uniqueRole(isPalPlayer ? 'player' : stem),
                type: 'entity',
                id: 'minecraft:player',
                rigMode: isDragoncore ? 'pal_dragoncore' : (isPalPlayer ? 'pal_player' : 'auto')
            };
        }
        const safePath = stem.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'actor';
        return {
            role: uniqueRole(safePath),
            type: 'model',
            id: `minecraft:${safePath}`,
            rigMode: 'auto'
        };
    }

    function collectRawGroupNames(data) {
        const names = [];
        if (Array.isArray(data?.groups)) {
            for (const g of data.groups) if (g?.name) names.push(g.name);
        } else if (Array.isArray(data?.outliner)) {
            const walk = list => {
                for (const item of list ?? []) {
                    if (item && typeof item === 'object') {
                        if (item.name) names.push(item.name);
                        walk(item.children);
                    }
                }
            };
            walk(data.outliner);
        } else if (Array.isArray(data?.['minecraft:geometry'])) {
            for (const bone of data['minecraft:geometry'][0]?.bones ?? []) {
                if (bone?.name) names.push(bone.name);
            }
        }
        return names;
    }

    function describe(input, editing) {
        const role = String(input.role ?? '').trim();
        const id = String(input.id ?? '').trim();
        const type = input.type || 'model';
        const rigMode = ['auto', 'generic', 'pal_player', 'pal_dragoncore'].includes(input.rigMode)
            ? input.rigMode : 'auto';
        if (!role || role === 'primary') throw new Error(Locale.t('err_role_invalid'));
        if (!['model', 'entity', 'block', 'item'].includes(type)) throw new Error(Locale.t('err_type_invalid'));
        if (!resourceId.test(id)) throw new Error(Locale.t('err_id_invalid'));
        if (roots().some(group => group !== editing && group[slotKey].role === role)) {
            throw new Error(Locale.t('err_role_duplicate', {role}));
        }
        if (!editing && roots().length >= 64) throw new Error(Locale.t('err_max_participants'));
        return {role, type, id, rigMode};
    }

    function importProject(data, path, input, options = {}) {
        const slot = describe(input);
        if (!data?.meta || !Array.isArray(data.outliner) || !Array.isArray(data.elements ?? data.cubes)) {
            throw new Error(Locale.t('err_invalid_bbmodel'));
        }
        if (!data.outliner.length) throw new Error(Locale.t('err_empty_model'));

        const source = structuredClone(data);
        const sourceFormat = Formats[source.meta.model_format]
            ?? (source.meta.bone_rig ? Formats.bedrock_old : Formats.java_block);
        const model = {
            meta: source.meta,
            resolution: source.resolution ?? {width: 16, height: 16},
            elements: source.elements ?? source.cubes,
            textures: source.textures ?? [],
            texture_groups: source.texture_groups,
            outliner: source.outliner,
            groups: source.groups
        };

        const group = SceneProject.withEditMode(() => {
            SceneProject.ensureMultiTextureScene();

            const uuid = guid();
            const used = new Set(Group.all.map(g => g.name));
            const displayName = uniqueName(slot.role, used);
            const anchor = {
                name: displayName,
                uuid,
                origin: [0, 0, 0],
                rotation: [0, 0, 0],
                [slotKey]: slot
            };
            const sourceNames = new Set();

            function tag(g) {
                const original = g[boneKey] || g.name;
                if (!original || original === 'kltyton:root' || sourceNames.has(original)) {
                    throw new Error(Locale.t('err_duplicate_bone', {name: original}));
                }
                if (g[slotKey]?.role) throw new Error(Locale.t('err_nested_scene'));
                sourceNames.add(original);
                g[boneKey] = original;
                g.name = uniqueName(displayName + '_' + original, used);
            }

            if (Array.isArray(model.groups)) {
                model.groups.forEach(tag);
                model.groups.push(anchor);
                model.outliner = [{uuid, children: model.outliner}];
            } else {
                const walk = nodes => {
                    for (const node of nodes ?? []) {
                        if (typeof node !== 'object' || !node) continue;
                        tag(node);
                        walk(node.children);
                    }
                };
                walk(model.outliner);
                model.outliner = [{...anchor, children: model.outliner}];
            }

            preserveTextures(model, sourceFormat);
            for (const element of model.elements) {
                if (element.type && !OutlinerElement.isTypePermitted(element.type)) {
                    throw new Error(Locale.t('err_unsupported_element', {type: element.type}));
                }
            }
            Codecs.project.merge(model, path || '');
            const merged = Group.all.find(bone => bone.uuid === uuid);
            if (!merged || merged[slotKey]?.role !== slot.role) {
                throw new Error(Locale.t('err_create_participant_failed', {role: slot.role}));
            }
            return merged;
        });

        const offset = parseOffsetVector(options.initialOffset);
        if (offset && (offset[0] !== 0 || offset[1] !== 0 || offset[2] !== 0)) {
            const clip = Animation.selected || ensureDefaultAnimation();
            const track = clip.getBoneAnimator(group);
            track.createKeyframe({x: offset[0], y: offset[1], z: offset[2]}, 0, 'position', false);
            if (Modes.animate) Animator.preview();
        }

        Blockbench.showQuickMessage(Locale.t('msg_participant_added', {role: slot.role}), 2800);
        StudioPanel.refresh();
        return group;
    }

    async function compileBedrockGeometry(geoJson, textureInfo, targetProject) {
        if (Project !== targetProject) throw new Error(Locale.t('err_switch_back_project'));
        if (!Formats.bedrock || !Codecs.bedrock) throw new Error(Locale.t('err_invalid_bbmodel'));
        return SceneProject.withEditModeAsync(async () => {
            const existingProjects = new Set(ModelProject.all);
            try {
                newProject(Formats.bedrock);
                if (typeof Codecs.bedrock.parseGeometry === 'function' && Array.isArray(geoJson?.['minecraft:geometry'])) {
                    Codecs.bedrock.parseGeometry({object: structuredClone(geoJson['minecraft:geometry'][0])}, {
                        switch_to_existing_tab: false
                    });
                } else {
                    Codecs.bedrock.parse(structuredClone(geoJson), '');
                }
                if (textureInfo?.dataURL) {
                    const tex = new Texture({
                        name: textureInfo.name || 'texture.png',
                        keep_size: true,
                        uv_width: textureInfo.width || Project.texture_width || 64,
                        uv_height: textureInfo.height || Project.texture_height || 64
                    });
                    await new Promise(resolve => {
                        let done = false;
                        const finish = () => {
                            if (done) return;
                            done = true;
                            resolve();
                        };
                        tex.load_callback = finish;
                        tex.fromDataURL(textureInfo.dataURL).add(false);
                        if (tex.img?.complete && tex.img.naturalWidth > 0) finish();
                        setTimeout(finish, 1500);
                    });
                    for (const cube of Cube.all) cube.applyTexture(tex, true);
                    Canvas.updateAllFaces?.();
                }
                return Codecs.project.compile({raw: true, bitmaps: true});
            } finally {
                const leaked = ModelProject.all.filter(proj => !existingProjects.has(proj) && proj !== targetProject);
                for (const proj of leaked) {
                    try { await proj.close(true); } catch (error) { console.warn('[AnimCue] Failed to close scratch project', error); }
                }
                if (targetProject && ModelProject.all.includes(targetProject) && Project !== targetProject) {
                    targetProject.select();
                }
            }
        });
    }

    async function importBedrockGeometry(geoJson, fileName, textureInfo, input, options = {}) {
        const target = Project;
        const compiled = await compileBedrockGeometry(geoJson, textureInfo, target);
        if (Project !== target) throw new Error(Locale.t('err_switch_back_project'));
        return importProject(compiled, '', input, options);
    }

    async function importPalPlayer(preset, input, options = {}) {
        const geometry = PalBridge.getPresetGeometry(preset);
        const texture = PalBridge.getDefaultTexture();
        const rigMode = preset === 'dragoncore' ? 'pal_dragoncore' : 'pal_player';
        return importBedrockGeometry(geometry, `pal_${preset}.geo.json`, texture, {...input, rigMode}, options);
    }

    function preserveTextures(model, sourceFormat) {
        if (!sourceFormat?.per_texture_uv_size) {
            for (const texture of model.textures) {
                texture.uv_width = model.resolution.width;
                texture.uv_height = model.resolution.height;
            }
        }
        if (!sourceFormat?.single_texture) return;
        if (model.textures.length) return;
        model.meta.model_format = SceneProject.formatId;
        for (const element of model.elements) {
            for (const face of Object.values(element.faces ?? {})) {
                if (face.texture !== null) face.texture = false;
            }
        }
    }

    function uniqueName(input, used) {
        const name = String(input || '').replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'participant';
        let choice = name;
        let suffix = 2;
        while (used.has(choice)) choice = name + '_' + suffix++;
        used.add(choice);
        return choice;
    }

    function parseOffsetVector(value) {
        if (!value) return null;
        if (Array.isArray(value) && value.length === 3 && value.every(v => Number.isFinite(Number(v)))) {
            return value.map(Number);
        }
        return null;
    }

    function ensureDefaultAnimation() {
        if (Animation.selected) return Animation.selected;
        if (Animation.all.length) {
            Animation.all[0].select();
            return Animation.all[0];
        }
        const clip = new Animation({
            name: 'animation.scene.interaction',
            loop: 'once',
            length: 2,
            snapping: 20
        }).add();
        clip.select();
        return clip;
    }

    function openStartingFrame(root, animation, toolId = 'move_tool') {
        const clip = animation || ensureDefaultAnimation();
        Modes.options.animate.select();
        clip.select();
        if (Timeline.playing) Timeline.pause();
        Timeline.setTime(0);
        root.select();
        const track = clip.getBoneAnimator(root);
        track.addToTimeline();
        track.expanded = true;
        BarItems[toolId]?.select();
        return {track, clip};
    }

    function startingKey(track) {
        return track.position.find(key => Math.abs(key.time) < 0.00001) || null;
    }

    function placeInViewport(root) {
        const targetRoot = root || selectedRoot();
        const {track} = openStartingFrame(targetRoot, Animation.selected, 'move_tool');
        const key = startingKey(track) ?? track.createKeyframe(null, 0, 'position', true);
        key.select();
        Animator.preview();
        StudioPanel.refresh();
    }

    function edit(group, input) {
        const slot = describe(input, group);
        Undo.initEdit({groups: [group], outliner: true});
        group[slotKey] = slot;
        Undo.finishEdit('Edit AnimCue participant');
        StudioPanel.refresh();
    }

    function collectSubtree(root) {
        const groups = [];
        const elements = [];
        const walk = node => {
            if (node instanceof Group) {
                groups.push(node);
                for (const child of node.children ?? []) walk(child);
            } else if (node) {
                elements.push(node);
            }
        };
        walk(root);
        return {groups, elements};
    }

    function moveOrder(group, delta) {
        const list = roots();
        const index = list.indexOf(group);
        const nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return;
        const swapWith = list[nextIndex];
        const a = Outliner.root.indexOf(group);
        const b = Outliner.root.indexOf(swapWith);
        if (a < 0 || b < 0) return;
        SceneProject.withEditMode(() => {
            Undo.initEdit({outliner: true});
            Outliner.root.splice(a, 1);
            Outliner.root.splice(b, 0, group);
            Undo.finishEdit('Reorder AnimCue participants');
        });
        StudioPanel.refresh();
    }

    function toggleVisibility(group) {
        if (!group) return;
        Undo.initEdit({groups: [group], outliner: true});
        group.visibility = !group.visibility;
        Undo.finishEdit('Toggle AnimCue participant visibility');
        Canvas.updateVisibility?.();
        StudioPanel.refresh();
    }

    function duplicate(group) {
        const slot = group?.[slotKey];
        if (!slot?.role) return null;
        const role = uniqueRole(slot.role);
        const cloned = SceneProject.withEditMode(() => {
            const used = new Set(Group.all.map(g => g.name));
            const newRootName = uniqueName(role, used);
            const undoGroups = [];
            const undoElements = [];
            Undo.initEdit({outliner: true, groups: undoGroups, elements: undoElements, selection: true});
            const copy = group.duplicate();
            if (copy.parent !== 'root') copy.addTo('root');
            copy.name = newRootName;
            copy[slotKey] = {...slot, role};
            const renameChildren = parent => {
                for (const child of parent.children ?? []) {
                    if (!(child instanceof Group)) continue;
                    const orig = child[boneKey] || child.name;
                    child[boneKey] = orig;
                    child.name = uniqueName(newRootName + '_' + orig, used);
                    renameChildren(child);
                }
            };
            renameChildren(copy);
            const subtree = collectSubtree(copy);
            undoGroups.push(...subtree.groups);
            undoElements.push(...subtree.elements);
            copy.select();
            Undo.finishEdit('Duplicate AnimCue participant');
            Canvas.updateAll();
            return copy;
        });
        Blockbench.showQuickMessage(Locale.t('msg_participant_added', {role}), 2400);
        StudioPanel.refresh();
        return cloned;
    }

    function remove(group) {
        const role = group?.[slotKey]?.role;
        if (!role) return;
        SceneProject.withEditMode(() => {
            const {groups, elements} = collectSubtree(group);
            const groupUuids = new Set(groups.map(g => g.uuid));
            const animations = (Animation.all ?? []).filter(clip =>
                clip.animators && Object.keys(clip.animators).some(uuid => groupUuids.has(uuid))
            );
            Undo.initEdit({outliner: true, groups, elements, selection: true, animations});
            for (const clip of animations) {
                for (const uuid of groupUuids) {
                    if (clip.animators?.[uuid]) clip.removeAnimator(uuid);
                }
            }
            group.remove(false);
            groups.length = 0;
            elements.length = 0;
            Undo.finishEdit('Remove AnimCue participant');
            Canvas.updateAllBones?.();
        });
        Blockbench.showQuickMessage(Locale.t('msg_participant_removed', {role}), 2400);
        StudioPanel.refresh();
    }

    function boneGroupMap(root) {
        const map = new Map();
        const walk = node => {
            for (const child of node.children ?? []) {
                if (!(child instanceof Group)) continue;
                const orig = child[boneKey] || child.name;
                map.set(orig, child);
                map.set(orig.toLowerCase(), child);
                walk(child);
            }
        };
        walk(root);
        return map;
    }

    return {
        register,
        roots,
        findByRole,
        rootOf,
        selectedRoot,
        uniqueRole,
        guessDefaults,
        describe,
        importProject,
        importBedrockGeometry,
        importPalPlayer,
        ensureDefaultAnimation,
        openStartingFrame,
        startingKey,
        placeInViewport,
        edit,
        moveOrder,
        toggleVisibility,
        duplicate,
        remove,
        boneGroupMap,
        slotKey,
        boneKey
    };
})();
