const SceneProject = (() => {
    const formatId = 'animcue_scene';

    function register() {
        const format = new ModelFormat(formatId, {
            ...Formats.free,
            id: formatId,
            name: Locale.t('format_name'),
            description: Locale.t('format_description'),
            icon: 'movie_creation',
            category: 'minecraft',
            show_on_start_screen: true,
            show_in_new_list: true,
            single_texture: false,
            single_texture_default: false,
            per_texture_uv_size: true,
            box_uv: false,
            optional_box_uv: true,
            bone_rig: true,
            centered_grid: true,
            rotate_cubes: true,
            animation_mode: true,
            animation_files: true,
            texture_meshes: true,
            bone_binding_expression: true,
            molang: true,
            codec: Codecs.project,
            animation_codec: AnimationCodec.codecs.bedrock
        });
        format.new = () => {
            createBlankScene();
            return true;
        };
        return format;
    }

    function createBlankScene() {
        newProject(Formats[formatId]);
        Project.name = 'animcue_scene';
        Project.saved = false;
        Blockbench.showQuickMessage(Locale.t('msg_scene_created'), 2600);
        StudioPanel.refresh();
    }

    function ensureMultiTextureScene() {
        if (!Format?.single_texture) return false;
        const original = Project;
        const activeTexture = Texture.getDefault()?.uuid;
        const preservedPalRig = original.pal_bend_player_tools_rig || '';
        const suffix = Locale.code().startsWith('zh') ? ' · 合拍' : ' · AnimCue';
        const baseName = original.name || Locale.t('panel_subject_unnamed');
        const label = baseName.endsWith(suffix) ? baseName : baseName + suffix;
        const snapshot = Codecs.project.compile({raw: true, bitmaps: true, absolute_paths: true});
        snapshot.meta.backup = true;
        for (const animation of snapshot.animations ?? []) delete animation.path;
        for (const controller of snapshot.animation_controllers ?? []) delete controller.path;
        Codecs.project.load(snapshot, {path: original.save_path || '', no_file: true});
        if (Project === original) throw new Error(Locale.t('err_scene_copy_failed'));
        Texture.all.find(texture => texture.uuid === activeTexture)?.select();
        Formats[formatId].convertTo();
        if (preservedPalRig) Project.pal_bend_player_tools_rig = preservedPalRig;
        Project.name = label;
        Project.saved = false;
        Blockbench.showQuickMessage(Locale.t('msg_scene_copied', {name: label}), 4200);
        return true;
    }

    function captureModeState() {
        return {
            modeId: Mode?.selected?.id || null,
            clipName: Animation?.selected?.name || null,
            time: typeof Timeline !== 'undefined' ? (Timeline.time || 0) : 0,
            wasPlaying: typeof Timeline !== 'undefined' && Boolean(Timeline.playing)
        };
    }

    function enterSafeEditMode(state) {
        if (state.wasPlaying && typeof Timeline !== 'undefined' && typeof Timeline.pause === 'function') {
            Timeline.pause();
        }
        if (typeof Modes !== 'undefined' && !Modes.edit && Modes.options?.edit && Format?.edit_mode !== false) {
            Modes.options.edit.select();
        }
    }

    function restoreModeState(state) {
        if (!state?.modeId || typeof Modes === 'undefined') return;
        const targetMode = Modes.options?.[state.modeId];
        if (!targetMode || Mode?.selected === targetMode) {
            if (Modes.animate && Animation?.selected && typeof Animator !== 'undefined') Animator.preview();
            return;
        }
        if (state.modeId === 'animate' && !Format?.animation_mode) return;
        if (typeof targetMode.condition === 'function' && !targetMode.condition()) return;
        targetMode.select();
        if (state.modeId === 'animate') {
            const clip = (state.clipName && Animation.all.find(a => a.name === state.clipName))
                || Animation.selected
                || Animation.all[0];
            if (clip) clip.select();
            if (typeof Timeline !== 'undefined' && typeof Timeline.setTime === 'function') {
                Timeline.setTime(state.time);
            }
            if (typeof Animator !== 'undefined') Animator.preview();
        }
    }

    function withEditMode(fn) {
        const state = captureModeState();
        enterSafeEditMode(state);
        try {
            return fn();
        } finally {
            restoreModeState(state);
        }
    }

    async function withEditModeAsync(fn) {
        const state = captureModeState();
        enterSafeEditMode(state);
        try {
            return await fn();
        } finally {
            restoreModeState(state);
        }
    }

    return {register, createBlankScene, ensureMultiTextureScene, withEditMode, withEditModeAsync, formatId};
})();
