const PalBridge = (() => {
    const HELPER_SUFFIX = '_bend';
    const BEND_HELPERS = {
        torso: 'torso_bend',
        right_arm: 'right_arm_bend',
        left_arm: 'left_arm_bend',
        right_leg: 'right_leg_bend',
        left_leg: 'left_leg_bend'
    };
    const DRAGONCORE_MARKERS = new Set([
        'Body_Lower', 'Right_Arm_Lower', 'Left_Arm_Lower', 'Right_Leg_Lower', 'Left_Leg_Lower'
    ]);
    const listeners = new Set();
    let boundReady = null;
    let boundUnload = null;

    function api() {
        return globalThis.PalBendPlayerToolsAPI?.apiVersion >= 1 ? globalThis.PalBendPlayerToolsAPI : null;
    }

    function isAvailable() {
        return Boolean(api());
    }

    function version() {
        return api()?.version || '';
    }

    function notify() {
        for (const fn of listeners) {
            try { fn(isAvailable()); } catch (error) { console.warn('[AnimCue] PalBridge listener error', error); }
        }
    }

    function onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function register() {
        if (typeof Blockbench !== 'undefined' && typeof Blockbench.on === 'function') {
            boundReady = () => notify();
            boundUnload = () => notify();
            Blockbench.on('pal_bend_player_tools_ready', boundReady);
            Blockbench.on('pal_bend_player_tools_unloaded', boundUnload);
        }
        return {
            delete() {
                if (typeof Blockbench !== 'undefined' && typeof Blockbench.removeListener === 'function') {
                    if (boundReady) Blockbench.removeListener('pal_bend_player_tools_ready', boundReady);
                    if (boundUnload) Blockbench.removeListener('pal_bend_player_tools_unloaded', boundUnload);
                }
                boundReady = null;
                boundUnload = null;
                listeners.clear();
            }
        };
    }

    function collectSubtreeEntries(rootGroup) {
        const entries = [];
        function walk(group, parentOriginal) {
            for (const child of group.children ?? []) {
                if (!(child instanceof Group)) continue;
                const name = child[Participants.boneKey] || child.name;
                entries.push({
                    name,
                    parentName: parentOriginal || null,
                    origin: Array.isArray(child.origin) ? child.origin.slice(0, 3) : [0, 0, 0]
                });
                walk(child, name);
            }
        }
        walk(rootGroup, null);
        return entries;
    }

    function collectPrimaryEntries() {
        const entries = [];
        function walk(nodes, parentOriginal) {
            for (const node of nodes ?? []) {
                if (!(node instanceof Group)) continue;
                if (node[Participants.slotKey]?.role || node[SceneCameraRig.cameraKey]) continue;
                const name = node.name;
                entries.push({
                    name,
                    parentName: parentOriginal || null,
                    origin: Array.isArray(node.origin) ? node.origin.slice(0, 3) : [0, 0, 0]
                });
                walk(node.children, name);
            }
        }
        walk(Outliner.root, null);
        return entries;
    }

    function fallbackDetectEntries(entries) {
        const names = new Set(entries.map(item => String(item.name || '').trim()));
        const lower = new Set(Array.from(names, n => n.toLowerCase()));
        if (Array.from(names).some(n => DRAGONCORE_MARKERS.has(n))) {
            return {preset: 'dragoncore', rig: null, hasBendHelpers: true, source: 'builtin_fallback'};
        }
        const hasHelper = Object.values(BEND_HELPERS).some(h => lower.has(h));
        if (hasHelper) {
            return {preset: 'player', rig: null, hasBendHelpers: true, source: 'builtin_fallback'};
        }
        return null;
    }

    function detectEntries(entries) {
        const bridge = api();
        if (bridge) {
            const detected = bridge.detectRig(entries);
            if (detected) return {...detected, source: 'pal_plugin'};
        }
        return fallbackDetectEntries(entries);
    }

    function detectParticipantRig(rootGroup) {
        if (!rootGroup) return null;
        const slot = rootGroup[Participants.slotKey];
        if (slot?.rigMode === 'generic') return null;
        const detected = detectEntries(collectSubtreeEntries(rootGroup));
        if (slot?.rigMode === 'pal_player') {
            return detected || {preset: 'player', rig: api()?.getPresetRig('player') || null, hasBendHelpers: true, source: isAvailable() ? 'pal_plugin' : 'builtin_fallback'};
        }
        if (slot?.rigMode === 'pal_dragoncore') {
            return detected || {preset: 'dragoncore', rig: api()?.getPresetRig('dragoncore') || null, hasBendHelpers: true, source: isAvailable() ? 'pal_plugin' : 'builtin_fallback'};
        }
        return detected;
    }

    function detectPrimaryRig() {
        if (typeof Project === 'undefined' || !Project) return null;
        const marker = Project.pal_bend_player_tools_rig;
        const entries = collectPrimaryEntries();
        const detected = detectEntries(entries);
        if (marker === 'dragoncore' || marker === 'dragoncore_compatible') {
            return detected || {preset: 'dragoncore', rig: api()?.getPresetRig('dragoncore') || null, hasBendHelpers: true, source: isAvailable() ? 'pal_plugin' : 'builtin_fallback'};
        }
        if (marker === 'player') {
            return detected || {preset: 'player', rig: api()?.getPresetRig('player') || null, hasBendHelpers: true, source: isAvailable() ? 'pal_plugin' : 'builtin_fallback'};
        }
        return detected;
    }

    function getPresetGeometry(preset) {
        const bridge = api();
        if (!bridge) throw new Error(Locale.t('msg_pal_plugin_required'));
        return bridge.getPresetGeometry(preset);
    }

    function getDefaultTexture() {
        const bridge = api();
        return bridge ? bridge.getDefaultTexture() : null;
    }

    function mirrorVec3(vec, channel) {
        const out = [Number(vec[0]) || 0, Number(vec[1]) || 0, Number(vec[2]) || 0];
        if (channel === 'rotation' || channel === 'bend') {
            out[0] = cleanZero(-out[0]);
            out[1] = cleanZero(-out[1]);
        } else if (channel === 'position') {
            out[0] = cleanZero(-out[0]);
        }
        return out;
    }

    function cleanZero(n) {
        return Math.abs(n) < 1e-6 ? 0 : Math.round(n * 1e6) / 1e6;
    }

    function mapCurveVec3(curve, transform) {
        if (Array.isArray(curve)) return transform(curve);
        if (typeof curve === 'number') return transform([curve, 0, 0]);
        if (!curve || typeof curve !== 'object') return curve;
        if (Object.hasOwn(curve, 'pre') || Object.hasOwn(curve, 'post')) {
            const out = {};
            if (curve.pre !== undefined) out.pre = mapCurveVec3(curve.pre, transform);
            if (curve.post !== undefined) out.post = mapCurveVec3(curve.post, transform);
            if (curve.lerp_mode !== undefined) out.lerp_mode = curve.lerp_mode;
            return out;
        }
        const result = {};
        for (const [t, frame] of Object.entries(curve)) {
            result[t] = mapCurveVec3(frame, transform);
        }
        return result;
    }

    function fallbackExportBones(bones) {
        const out = {};
        let needsMoreRotation = false;
        const copy = structuredClone(bones || {});
        for (const [rawName, track] of Object.entries(copy)) {
            const name = rawName.toLowerCase();
            if (name.endsWith(HELPER_SUFFIX)) continue;
            const target = {};
            for (const ch of ['position', 'rotation', 'scale', 'bend']) {
                if (track[ch] !== undefined) target[ch] = mapCurveVec3(track[ch], v => mirrorVec3(v, ch));
            }
            if (Object.keys(target).length) out[name] = target;
        }
        for (const [rawName, track] of Object.entries(copy)) {
            const name = rawName.toLowerCase();
            if (!name.endsWith(HELPER_SUFFIX) || track.rotation === undefined) continue;
            const base = name.slice(0, -HELPER_SUFFIX.length);
            const bendCurve = mapCurveVec3(track.rotation, v => {
                const mirrored = mirrorVec3(v, 'bend');
                if (Math.abs(mirrored[1]) > 1e-6 || Math.abs(mirrored[2]) > 1e-6) needsMoreRotation = true;
                return mirrored;
            });
            out[base] = out[base] || {};
            out[base].bend = bendCurve;
        }
        return {bones: out, format: needsMoreRotation ? 'more_rotation' : 'pal_original', needsMoreRotation};
    }

    function exportTracks(animationName, bones, rigInfo, options = {}) {
        const bridge = api();
        if (bridge) {
            return bridge.exportBoneTracks(animationName, bones, {
                preset: rigInfo?.preset || 'player',
                rig: rigInfo?.rig || undefined,
                length: options.length ?? 0,
                loop: options.loop,
                animcueStrict: options.animcueStrict !== false,
                preserveBodyRoot: Boolean(options.preserveBodyRoot)
            });
        }
        return fallbackExportBones(bones);
    }

    function fallbackImportBones(inputData) {
        if (inputData?.emote) throw new Error(Locale.t('err_emote_needs_pal'));
        const animations = {};
        for (const [name, anim] of Object.entries(inputData?.animations ?? {})) {
            const bones = {};
            for (const [rawName, track] of Object.entries(anim?.bones ?? {})) {
                const boneName = rawName.toLowerCase();
                const out = {};
                for (const ch of ['position', 'rotation', 'scale']) {
                    if (track[ch] !== undefined) out[ch] = mapCurveVec3(track[ch], v => mirrorVec3(v, ch));
                }
                if (Object.keys(out).length) bones[boneName] = out;
                if (track.bend !== undefined) {
                    const helper = BEND_HELPERS[boneName] || (boneName + HELPER_SUFFIX);
                    const bendTrack = track.bend?.rotation !== undefined ? track.bend.rotation : track.bend;
                    bones[helper] = bones[helper] || {};
                    bones[helper].rotation = mapCurveVec3(bendTrack, v => mirrorVec3(v, 'bend'));
                }
            }
            animations[name] = {...anim, bones};
        }
        return {animations, profile: 'builtin_fallback', profileLabel: Locale.t('badge_pal_standalone')};
    }

    function importTracks(inputData, rigInfo, options = {}) {
        const bridge = api();
        if (bridge) {
            return bridge.importBoneTracks(inputData, {
                targetPreset: rigInfo?.preset || 'player',
                targetRig: rigInfo?.rig || undefined,
                fileName: options.fileName || 'animation'
            });
        }
        return fallbackImportBones(inputData);
    }

    return {
        register,
        onChange,
        isAvailable,
        version,
        detectParticipantRig,
        detectPrimaryRig,
        getPresetGeometry,
        getDefaultTexture,
        exportTracks,
        importTracks
    };
})();
