const InteractionCodec = (() => {
    const ROOT = 'kltyton:root';
    const SECTION = 'kltyton:interactions';
    const CHANNELS = ['position', 'rotation', 'scale', 'bend'];
    let hookedCodec = null;
    let originalCodecLoad = null;

    function buildDocument(animations, roots, options = {}) {
        if (!animations.length) throw new Error(Locale.t('err_no_animation'));
        if (Group.all.some(group => group[Participants.slotKey]?.role && !roots.includes(group))) {
            throw new Error(Locale.t('err_root_not_top_level'));
        }
        if (roots.length > 64) throw new Error(Locale.t('err_max_participants'));

        const codec = AnimationCodec.codecs.bedrock;
        const primary = Object.create(null);
        const interactions = Object.create(null);
        const roles = new Set();
        const owned = new Map();
        const cameraGroup = options.includeCamera !== false ? SceneCameraRig.find() : null;
        const cameraName = cameraGroup ? cameraGroup.name : null;
        const primaryRig = options.convertPrimaryPal ? PalBridge.detectPrimaryRig() : null;
        const palConvertedRoles = new Set();
        const moreRotationRoles = new Set();

        const rigs = roots.map(root => {
            const slot = root[Participants.slotKey];
            if (roles.has(slot.role)) throw new Error(Locale.t('err_role_duplicate', {role: slot.role}));
            roles.add(slot.role);
            const bones = new Set();
            function bind(group, original) {
                if (bones.has(original)) throw new Error(Locale.t('err_duplicate_bone', {name: original}));
                if (owned.has(group.name)) throw new Error(Locale.t('err_duplicate_display_bone', {name: group.name}));
                bones.add(original);
                owned.set(group.name, {role: slot.role, bone: original});
                for (const child of group.children ?? []) {
                    if (!(child instanceof Group)) continue;
                    if (child[Participants.slotKey]?.role) throw new Error(Locale.t('err_nested_participant_root'));
                    bind(child, child[Participants.boneKey] || child.name);
                }
            }
            bind(root, ROOT);
            return {
                root,
                slot: {role: slot.role, type: slot.type, id: slot.id},
                palRig: PalBridge.detectParticipantRig(root)
            };
        });

        let activeCameraCount = 0;
        for (const clip of animations) {
            if (Object.hasOwn(primary, clip.name)) throw new Error(Locale.t('err_duplicate_anim_name', {name: clip.name}));
            const animation = codec.compileAnimation(clip);
            const rawCamera = cameraName && animation.bones?.[cameraName] ? animation.bones[cameraName] : null;
            if (cameraName && animation.bones) delete animation.bones[cameraName];

            const byRoleRaw = new Map(rigs.map(entry => [entry.slot.role, {rootTrack: null, childBones: Object.create(null)}]));
            for (const [name, track] of Object.entries(animation.bones ?? {})) {
                const owner = owned.get(name);
                if (!owner) continue;
                const bucket = byRoleRaw.get(owner.role);
                if (owner.bone === ROOT) bucket.rootTrack = track;
                else bucket.childBones[owner.bone] = track;
                delete animation.bones[name];
            }

            if (primaryRig && animation.bones && Object.keys(animation.bones).length) {
                const rawPrimaryBones = compileRawBonesForGroups(clip, primaryGroupList(), group => group.name);
                if (Object.keys(rawPrimaryBones).length) {
                    const convertedPrimary = PalBridge.exportTracks(clip.name, rawPrimaryBones, primaryRig, {
                        length: clip.length,
                        loop: clip.loop,
                        animcueStrict: false
                    });
                    animation.bones = convertedPrimary.bones;
                    palConvertedRoles.add('primary');
                    if (convertedPrimary.needsMoreRotation) moreRotationRoles.add('primary');
                }
            }
            animation.bones ??= {};

            const activeParticipants = [];
            let maxTime = maxPrimaryTime(animation);
            for (const entry of rigs) {
                const bucket = byRoleRaw.get(entry.slot.role);
                const outBones = Object.create(null);

                if (bucket.rootTrack) {
                    const rootValidated = numericTrack(bucket.rootTrack, {role: entry.slot.role, bone: ROOT});
                    if (Object.keys(rootValidated).length) {
                        outBones[ROOT] = rootValidated;
                        maxTime = Math.max(maxTime, maxTrackTime(rootValidated));
                    }
                }

                const hasChildren = Object.keys(bucket.childBones).length > 0;
                if (hasChildren) {
                    let processed = bucket.childBones;
                    if (entry.palRig) {
                        // Compile raw Blockbench keyframes so PAL export mirrors North/South exactly once.
                        const rawChildBones = compileRawBonesForGroups(
                            clip,
                            descendantGroups(entry.root),
                            group => group[Participants.boneKey] || group.name
                        );
                        const converted = PalBridge.exportTracks(clip.name, rawChildBones, entry.palRig, {
                            length: clip.length,
                            loop: clip.loop,
                            animcueStrict: true
                        });
                        processed = converted.bones;
                        palConvertedRoles.add(entry.slot.role);
                        if (converted.needsMoreRotation) moreRotationRoles.add(entry.slot.role);
                    }
                    for (const [boneName, rawTrack] of Object.entries(processed)) {
                        const validated = numericTrack(rawTrack, {role: entry.slot.role, bone: boneName});
                        if (Object.keys(validated).length) {
                            outBones[boneName] = validated;
                            maxTime = Math.max(maxTime, maxTrackTime(validated));
                        }
                    }
                }

                if (!Object.keys(outBones).length && options.includeStaticVisible && entry.root.visibility !== false) {
                    outBones[ROOT] = {position: {'0': [0, 0, 0]}};
                }

                if (Object.keys(outBones).length) {
                    activeParticipants.push({...entry.slot, bones: outBones});
                }
            }

            let cameraOut = null;
            if (rawCamera) {
                cameraOut = numericCameraTrack(rawCamera);
                if (cameraOut && Object.keys(cameraOut).length) {
                    activeCameraCount += 1;
                    maxTime = Math.max(maxTime, maxTrackTime(cameraOut));
                } else {
                    cameraOut = null;
                }
            }

            if (animation.animation_length !== undefined && maxTime > Number(animation.animation_length) + 1e-5) {
                animation.animation_length = roundNumber(maxTime);
            }
            if (activeParticipants.length) {
                formatMarkers(animation.timeline);
                const ext = {participants: activeParticipants};
                if (cameraOut) ext.camera = cameraOut;
                interactions[clip.name] = ext;
            }
            primary[clip.name] = animation;
        }

        const document = {format_version: '1.8.0', animations: primary};
        if (Object.keys(interactions).length) document[SECTION] = interactions;
        return {
            document,
            stats: {
                clipCount: animations.length,
                interactionClipCount: Object.keys(interactions).length,
                participantCount: rigs.length,
                hasCamera: activeCameraCount > 0,
                palConvertedRoles: Array.from(palConvertedRoles),
                moreRotationRoles: Array.from(moreRotationRoles)
            }
        };
    }

    function formatMarkers(timeline) {
        const label = line => typeof line === 'string' && /^[\p{L}\p{N}_:.\/-]+;$/u.test(line)
            ? line.slice(0, -1) : line;
        for (const [time, instruction] of Object.entries(timeline ?? {})) {
            timeline[time] = Array.isArray(instruction) ? instruction.map(label) : label(instruction);
        }
    }

    function numericCameraTrack(track) {
        const output = {};
        for (const channel of ['position', 'rotation']) {
            if (track[channel] === undefined) continue;
            try {
                output[channel] = numericCurve(track[channel], channel);
            } catch (error) {
                throw new Error(Locale.t('err_camera_invalid_channel', {channel, message: error.message}));
            }
        }
        return output;
    }

    function numericTrack(track, owner) {
        if (track.relative_to) {
            throw new Error(Locale.t('err_global_rotation', {role: owner.role, bone: owner.bone}));
        }
        const output = {};
        for (const [channel, curve] of Object.entries(track)) {
            if (!CHANNELS.includes(channel)) continue;
            try {
                output[channel] = numericCurve(curve, channel);
            } catch (error) {
                throw new Error(`${owner.role} / ${owner.bone} / ${channel} · ${error.message}`);
            }
        }
        return output;
    }

    function numericCurve(value, channel) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return vector3(value, channel);
        if (Object.hasOwn(value, 'pre') || Object.hasOwn(value, 'post') || Object.hasOwn(value, 'vector')) {
            return numericFrame(value, channel);
        }
        const result = Object.create(null);
        for (const [time, frame] of Object.entries(value)) {
            if (!/^\d+(?:\.\d+)?$/.test(time)) throw new Error(Locale.t('err_invalid_time', {time}));
            result[time] = frame && typeof frame === 'object' && !Array.isArray(frame)
                ? numericFrame(frame, channel) : vector3(frame, channel);
        }
        return result;
    }

    function numericFrame(frame, channel) {
        const key = {};
        if (frame.pre !== undefined) key.pre = vector3(frame.pre, channel);
        if (frame.post !== undefined) key.post = vector3(frame.post, channel);
        else if (frame.vector !== undefined) key.post = vector3(frame.vector, channel);
        if (key.pre === undefined && key.post === undefined) throw new Error(Locale.t('err_empty_keyframe'));
        if (frame.lerp_mode !== undefined) {
            if (!['linear', 'catmullrom'].includes(frame.lerp_mode)) {
                throw new Error(Locale.t('err_unsupported_lerp', {mode: frame.lerp_mode}));
            }
            key.lerp_mode = frame.lerp_mode;
        }
        return key;
    }

    function vector3(values, channel) {
        if (!Array.isArray(values)) {
            const n = numericComponent(values);
            // AnimCue AnimationCurve expands scalar to (n,n,n), so bend must ALWAYS be [n, 0, 0] to avoid Y/Z pollution.
            return channel === 'bend' ? [n, 0, 0] : [n, n, n];
        }
        if (values.length !== 3) throw new Error(Locale.t('err_vector_length'));
        return values.map(numericComponent);
    }

    function numericComponent(value) {
        if ((typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value))) {
            return Number(value);
        }
        throw new Error(Locale.t('err_numeric_required'));
    }

    function maxPrimaryTime(animation) {
        let max = 0;
        for (const bone of Object.values(animation.bones ?? {})) {
            max = Math.max(max, maxTrackTime(bone));
        }
        for (const t of Object.keys(animation.timeline ?? {})) {
            const n = Number(t);
            if (Number.isFinite(n) && n >= 0) max = Math.max(max, n);
        }
        return max;
    }

    function maxTrackTime(track) {
        let max = 0;
        for (const curve of Object.values(track ?? {})) {
            if (!curve || typeof curve !== 'object' || Array.isArray(curve)) continue;
            if (Object.hasOwn(curve, 'pre') || Object.hasOwn(curve, 'post')) continue;
            for (const key of Object.keys(curve)) {
                const n = Number(key);
                if (Number.isFinite(n) && n >= 0) max = Math.max(max, n);
            }
        }
        return max;
    }

    function roundNumber(value) {
        return Math.round(Number(value) * 1e6) / 1e6;
    }

    function uniqueClipName(base) {
        const clean = String(base || 'animation').trim() || 'animation';
        const used = new Set((Animation.all ?? []).map(a => a.name));
        if (!used.has(clean)) return clean;
        let idx = 2;
        while (used.has(`${clean}_${idx}`)) idx += 1;
        return `${clean}_${idx}`;
    }

    function loopModeFromJson(value) {
        const raw = String(value ?? '').toLowerCase();
        if (value === true || raw === 'true' || raw === 'loop') return 'loop';
        if (raw === 'hold' || raw === 'hold_on_last_frame') return 'hold';
        return 'once';
    }

    function descendantGroups(root) {
        const list = [];
        const walk = node => {
            for (const child of node.children ?? []) {
                if (!(child instanceof Group)) continue;
                list.push(child);
                walk(child);
            }
        };
        walk(root);
        return list;
    }

    function primaryGroupList() {
        const participantSet = new Set(Participants.roots());
        const cameraGroup = SceneCameraRig.find();
        const list = [];
        const walk = nodes => {
            for (const node of nodes ?? []) {
                if (!(node instanceof Group)) continue;
                if (participantSet.has(node) || node === cameraGroup) continue;
                list.push(node);
                walk(node.children);
            }
        };
        walk(Outliner.root);
        return list;
    }

    function compileRawBonesForGroups(clip, groups, nameOf) {
        const bones = {};
        for (const group of groups) {
            const animator = clip.animators?.[group.uuid];
            if (!animator) continue;
            const boneOut = {};
            for (const channel of ['position', 'rotation', 'scale']) {
                const keyframes = Array.isArray(animator[channel]) ? animator[channel] : [];
                if (!keyframes.length) continue;
                const track = {};
                keyframes.slice().sort((a, b) => a.time - b.time).forEach(kf => {
                    const timeKey = formatSecondsKey(kf.time);
                    const points = Array.isArray(kf.data_points) && kf.data_points.length
                        ? kf.data_points
                        : [{x: kf.get?.('x') ?? 0, y: kf.get?.('y') ?? 0, z: kf.get?.('z') ?? 0}];
                    const toVec = pt => {
                        const fb = channel === 'scale' ? 1 : 0;
                        return [
                            rawAxisNum(pt?.x, fb),
                            rawAxisNum(pt?.y, fb),
                            rawAxisNum(pt?.z, fb)
                        ];
                    };
                    const post = toVec(points[points.length - 1]);
                    const hasPre = points.length > 1;
                    const hasLerp = Boolean(kf.interpolation && kf.interpolation !== 'linear');
                    const hasEasing = Boolean(kf.easing && String(kf.easing).toLowerCase() !== 'linear');
                    const palMeta = kf.pal_bend_easing && typeof kf.pal_bend_easing === 'object' ? kf.pal_bend_easing : null;
                    if (!hasPre && !hasLerp && !hasEasing && !palMeta) {
                        track[timeKey] = post;
                    } else {
                        const obj = {post};
                        if (hasPre) obj.pre = toVec(points[0]);
                        if (hasLerp) obj.lerp_mode = kf.interpolation;
                        if (hasEasing) obj.easing = kf.easing;
                        if (palMeta) Object.assign(obj, structuredClone(palMeta));
                        track[timeKey] = obj;
                    }
                });
                if (Object.keys(track).length) boneOut[channel] = track;
            }
            if (Object.keys(boneOut).length) bones[nameOf(group)] = boneOut;
        }
        return bones;
    }

    function rawAxisNum(value, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
    }

    function formatSecondsKey(seconds) {
        const n = Math.round((Number(seconds) || 0) * 1e6) / 1e6;
        return Number.isInteger(n) ? String(n) : String(n);
    }

    function applyCurveToAnimator(animator, channel, curve, options = {}) {
        if (!animator || curve === undefined || curve === null) return;
        const entries = extractCurveEntries(curve, channel, Boolean(options.fromBedrock));
        for (const entry of entries) {
            const opts = {
                time: entry.time,
                channel,
                data_points: entry.points,
                interpolation: entry.interpolation
            };
            const kf = animator.addKeyframe(opts);
            if (kf && entry.interpolation && entry.interpolation !== 'linear') {
                kf.interpolation = entry.interpolation;
            }
        }
    }

    function extractCurveEntries(curve, channel, fromBedrock = false) {
        const out = [];
        const fallback = channel === 'scale' ? 1 : 0;
        const flip = (x, y, z) => {
            if (!fromBedrock) return {x, y, z};
            if (channel === 'position') return {x: cleanSign(-x), y, z};
            if (channel === 'rotation') return {x: cleanSign(-x), y: cleanSign(-y), z};
            return {x, y, z};
        };
        const toPoint = raw => {
            if (Array.isArray(raw)) {
                return flip(Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0);
            }
            const n = Number(raw);
            const v = Number.isFinite(n) ? n : fallback;
            return channel === 'bend' ? {x: v, y: 0, z: 0} : flip(v, v, v);
        };
        const parseFrame = (time, frame) => {
            if (frame && typeof frame === 'object' && !Array.isArray(frame)) {
                const points = [];
                if (frame.pre !== undefined) points.push(toPoint(frame.pre));
                if (frame.post !== undefined) points.push(toPoint(frame.post));
                else if (frame.vector !== undefined) points.push(toPoint(frame.vector));
                else if (!points.length) points.push(toPoint(0));
                const lerp = frame.lerp_mode === 'catmullrom' ? 'catmullrom' : 'linear';
                out.push({time, points, interpolation: lerp});
            } else {
                out.push({time, points: [toPoint(frame)], interpolation: 'linear'});
            }
        };
        if (Array.isArray(curve) || typeof curve === 'number' || typeof curve === 'string'
            || (typeof curve === 'object' && (curve.pre !== undefined || curve.post !== undefined || curve.vector !== undefined))) {
            parseFrame(0, curve);
        } else if (typeof curve === 'object') {
            Object.entries(curve)
                .map(([k, v]) => [Number(k), v])
                .filter(([t]) => Number.isFinite(t) && t >= 0)
                .sort((a, b) => a[0] - b[0])
                .forEach(([t, v]) => parseFrame(t, v));
        }
        return out;
    }

    function cleanSign(n) {
        return Math.abs(n) < 1e-9 ? 0 : n;
    }

    function applyBoneTracksToMap(clip, bones, groupLookup, options = {}) {
        let applied = 0;
        for (const [boneName, track] of Object.entries(bones ?? {})) {
            if (!track || typeof track !== 'object') continue;
            const group = groupLookup(boneName);
            if (!group) continue;
            const animator = clip.getBoneAnimator(group);
            for (const channel of ['position', 'rotation', 'scale']) {
                if (track[channel] !== undefined) applyCurveToAnimator(animator, channel, track[channel], options);
            }
            applied += 1;
        }
        return applied;
    }

    function primaryGroupMap() {
        const participantSet = new Set(Participants.roots());
        const cameraGroup = SceneCameraRig.find();
        const map = new Map();
        const walk = nodes => {
            for (const node of nodes ?? []) {
                if (!(node instanceof Group)) continue;
                if (participantSet.has(node) || node === cameraGroup) continue;
                map.set(node.name, node);
                map.set(node.name.toLowerCase(), node);
                walk(node.children);
            }
        };
        walk(Outliner.root);
        return map;
    }

    function insertEventMarker(clip, time, name) {
        const clean = String(name || '').trim();
        if (!clean) throw new Error(Locale.t('err_event_empty'));
        const seconds = Math.max(0, Number(time) || 0);
        if (!clip.animators.effects && typeof EffectAnimator !== 'undefined') {
            clip.animators.effects = new EffectAnimator(clip);
        }
        const effects = clip.animators.effects;
        if (!effects) return null;
        effects.addToTimeline?.();
        const kf = effects.addKeyframe({
            time: seconds,
            channel: 'timeline',
            data_points: [{script: clean}]
        });
        if (seconds > clip.length) clip.length = seconds;
        return kf;
    }

    function importSceneDocument(data, options = {}) {
        if (!data || typeof data !== 'object' || !data.animations || typeof data.animations !== 'object') {
            throw new Error(Locale.t('err_not_animcue_file'));
        }
        const interactions = data[SECTION] || {};
        const primaryRig = PalBridge.detectPrimaryRig();
        const primaryLookupMap = primaryGroupMap();
        const primaryLookup = name => primaryLookupMap.get(name) || primaryLookupMap.get(String(name).toLowerCase()) || null;

        let clipsCreated = 0;
        let matchedParticipantTracks = 0;
        let cameraTracksLoaded = 0;
        const unmatchedRoles = new Set();
        let firstClip = null;

        for (const [animName, rawAnim] of Object.entries(data.animations)) {
            if (!rawAnim || typeof rawAnim !== 'object') continue;
            const clip = new Animation({
                name: uniqueClipName(animName),
                length: Number(rawAnim.animation_length) || 0,
                snapping: 20,
                loop: loopModeFromJson(rawAnim.loop)
            }).add();
            if (!firstClip) firstClip = clip;

            // 1. Primary subject tracks
            let primaryBones = rawAnim.bones || {};
            const primaryFromPal = Boolean(primaryRig && Object.keys(primaryBones).length);
            if (primaryFromPal) {
                const imported = PalBridge.importTracks({animations: {[animName]: rawAnim}}, primaryRig, {fileName: options.fileName});
                primaryBones = imported.animations[animName]?.bones || primaryBones;
            }
            applyBoneTracksToMap(clip, primaryBones, primaryLookup, {fromBedrock: !primaryFromPal});

            // 2. Timeline event markers
            for (const [timeKey, payload] of Object.entries(rawAnim.timeline ?? {})) {
                const sec = Number(timeKey);
                if (!Number.isFinite(sec) || sec < 0) continue;
                const lines = Array.isArray(payload) ? payload : [payload];
                for (const line of lines) {
                    if (typeof line === 'string' && line.trim()) insertEventMarker(clip, sec, line.trim());
                }
            }

            // 3. AnimCue interaction participants & camera
            const ext = interactions[animName];
            if (ext && typeof ext === 'object') {
                for (const participant of ext.participants ?? []) {
                    const root = Participants.findByRole(participant.role);
                    if (!root) {
                        unmatchedRoles.add(participant.role);
                        continue;
                    }
                    const rawBones = participant.bones || {};
                    const rootCurve = rawBones[ROOT];
                    if (rootCurve) {
                        const rootAnimator = clip.getBoneAnimator(root);
                        for (const ch of ['position', 'rotation', 'scale']) {
                            if (rootCurve[ch] !== undefined) applyCurveToAnimator(rootAnimator, ch, rootCurve[ch], {fromBedrock: true});
                        }
                    }
                    const childBones = {};
                    for (const [bName, bTrack] of Object.entries(rawBones)) {
                        if (bName !== ROOT) childBones[bName] = bTrack;
                    }
                    let readyBones = childBones;
                    const rigInfo = PalBridge.detectParticipantRig(root);
                    const childFromPal = Boolean(rigInfo && Object.keys(childBones).length);
                    if (childFromPal) {
                        const imported = PalBridge.importTracks({
                            animations: {[animName]: {animation_length: clip.length, bones: childBones}}
                        }, rigInfo, {fileName: options.fileName});
                        readyBones = imported.animations[animName]?.bones || childBones;
                    }
                    const boneMap = Participants.boneGroupMap(root);
                    applyBoneTracksToMap(
                        clip,
                        readyBones,
                        name => boneMap.get(name) || boneMap.get(String(name).toLowerCase()) || null,
                        {fromBedrock: !childFromPal}
                    );
                    matchedParticipantTracks += 1;
                }

                if (ext.camera && typeof ext.camera === 'object') {
                    const cam = SceneCameraRig.find() || SceneCameraRig.add();
                    const camAnim = clip.getBoneAnimator(cam);
                    for (const ch of ['position', 'rotation']) {
                        if (ext.camera[ch] !== undefined) applyCurveToAnimator(camAnim, ch, ext.camera[ch], {fromBedrock: true});
                    }
                    cameraTracksLoaded += 1;
                }
            }

            if (typeof clip.calculateSnappingFromKeyframes === 'function') {
                clip.calculateSnappingFromKeyframes();
            }
            clipsCreated += 1;
        }

        if (firstClip) {
            Modes.options.animate.select();
            firstClip.select();
            showActiveTracks(firstClip);
            Animator.preview();
        }
        StudioPanel.refresh();

        const extra = cameraTracksLoaded ? ` · ${Locale.t('badge_camera')}` : '';
        Blockbench.showQuickMessage(Locale.t('msg_imported_scene', {
            clips: clipsCreated,
            matched: matchedParticipantTracks,
            extra
        }), 4200);
        if (unmatchedRoles.size) {
            Blockbench.showMessageBox({
                title: Locale.t('dialog_import_missing_title'),
                message: Locale.t('dialog_import_missing_msg', {
                    clips: clipsCreated,
                    roles: Array.from(unmatchedRoles).join(', ')
                }),
                icon: 'warning'
            });
        }
        return {clipsCreated, matchedParticipantTracks, cameraTracksLoaded, unmatchedRoles: Array.from(unmatchedRoles)};
    }

    function importActorAnimation(root, data, options = {}) {
        const slot = root[Participants.slotKey];
        const rigInfo = PalBridge.detectParticipantRig(root);
        let animationsMap;
        let profileLabel = Locale.t('rig_generic');
        const usedPalImport = Boolean(data?.emote || rigInfo);
        if (usedPalImport) {
            const converted = PalBridge.importTracks(data, rigInfo || {preset: 'player'}, {fileName: options.fileName});
            animationsMap = converted.animations;
            profileLabel = converted.profileLabel || converted.profile;
        } else if (data?.animations && typeof data.animations === 'object') {
            animationsMap = data.animations;
        } else {
            throw new Error(Locale.t('err_not_animcue_file'));
        }

        const entries = Object.entries(animationsMap);
        if (!entries.length) throw new Error(Locale.t('err_no_animation'));

        const boneMap = Participants.boneGroupMap(root);
        const lookup = name => boneMap.get(name) || boneMap.get(String(name).toLowerCase()) || null;
        const mergeCurrent = Boolean(options.mergeIntoSelected && Animation.selected && entries.length === 1);
        let firstClip = null;
        let count = 0;

        for (const [animName, animObj] of entries) {
            const clip = mergeCurrent
                ? Animation.selected
                : new Animation({
                    name: uniqueClipName(animName),
                    length: Number(animObj.animation_length) || 0,
                    snapping: 20,
                    loop: loopModeFromJson(animObj.loop)
                }).add();
            if (!firstClip) firstClip = clip;
            const len = Number(animObj.animation_length) || 0;
            if (len > clip.length) clip.length = len;
            applyBoneTracksToMap(clip, animObj.bones || {}, lookup, {fromBedrock: !usedPalImport});
            count += 1;
        }

        if (firstClip) {
            Modes.options.animate.select();
            firstClip.select();
            showActiveTracks(firstClip);
            Animator.preview();
        }
        StudioPanel.refresh();
        Blockbench.showQuickMessage(Locale.t('msg_imported_actor', {
            clips: count,
            role: slot.role,
            profile: profileLabel
        }), 3800);
        return {count, profileLabel};
    }

    function showActiveTracks(clip = Animation.selected) {
        if (!clip) return;
        for (const root of Participants.roots()) {
            const track = clip.getBoneAnimator(root);
            track.addToTimeline();
            track.expanded = true;
        }
        const cam = SceneCameraRig.find();
        if (cam) {
            const camTrack = clip.getBoneAnimator(cam);
            camTrack.addToTimeline();
        }
        for (const track of Object.values(clip.animators ?? {})) {
            if (track?.keyframes?.length) track.addToTimeline();
        }
    }

    function hookNativeImport() {
        const codec = AnimationCodec?.codecs?.bedrock;
        const methodName = codec && (typeof codec.importFile === 'function'
            ? 'importFile'
            : (typeof codec.loadFile === 'function' ? 'loadFile' : (typeof codec.load === 'function' ? 'load' : null)));
        if (!codec || !methodName || codec.animcue_studio_hook) return {delete() {}};
        hookedCodec = codec;
        originalCodecLoad = {methodName, fn: codec[methodName]};
        codec.animcue_studio_hook = function(...args) {
            const first = args[0];
            const list = Array.isArray(first) ? first : (first ? [first] : []);
            const parsed = [];
            let hasInteractions = false;
            for (const file of list) {
                const raw = file?.content !== undefined ? file.content : file;
                if (typeof raw === 'string') {
                    try {
                        const json = autoParseJSON(raw, false);
                        if (json && json[SECTION]) {
                            hasInteractions = true;
                            parsed.push({json, name: file?.name || file?.path || 'animation.json'});
                        }
                    } catch (_ignore) {}
                } else if (raw && typeof raw === 'object' && raw[SECTION]) {
                    hasInteractions = true;
                    parsed.push({json: raw, name: file?.name || file?.path || 'animation.json'});
                }
            }
            if (hasInteractions && parsed.length === list.length) {
                for (const item of parsed) {
                    try {
                        importSceneDocument(item.json, {fileName: item.name});
                    } catch (error) {
                        Blockbench.showMessageBox({title: Locale.t('plugin_title'), message: error.message, icon: 'error'});
                    }
                }
                return true;
            }
            return originalCodecLoad.fn.apply(this, args);
        };
        codec[methodName] = codec.animcue_studio_hook;
        return {
            delete() {
                if (hookedCodec && originalCodecLoad && hookedCodec[originalCodecLoad.methodName] === hookedCodec.animcue_studio_hook) {
                    hookedCodec[originalCodecLoad.methodName] = originalCodecLoad.fn;
                }
                if (hookedCodec) delete hookedCodec.animcue_studio_hook;
                hookedCodec = null;
                originalCodecLoad = null;
            }
        };
    }

    return {
        ROOT,
        SECTION,
        buildDocument,
        importSceneDocument,
        importActorAnimation,
        insertEventMarker,
        showActiveTracks,
        hookNativeImport
    };
})();
