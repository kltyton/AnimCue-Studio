const SceneCameraRig = (() => {
    const cameraKey = 'animcue_camera';

    function register() {
        return new Property(Group, 'boolean', cameraKey, {default: false});
    }

    function find() {
        return Group.all.find(group => Boolean(group[cameraKey])) || null;
    }

    function add() {
        const existing = find();
        if (existing) {
            existing.select();
            return existing;
        }
        const camera = SceneProject.withEditMode(() => {
            const undoGroups = [];
            const undoElements = [];
            Undo.initEdit({outliner: true, groups: undoGroups, elements: undoElements, selection: true});
            const cam = new Group({
                name: 'animcue_camera',
                origin: [0, 0, 0],
                rotation: [0, 0, 0],
                color: 5,
                export: false
            }).init();
            cam[cameraKey] = true;

            // Lightweight non-exported camera body & lens guide placed behind z=0 so lookThrough() at origin is never occluded.
            const body = new Cube({
                name: 'camera_body',
                from: [-2.5, -1.8, -6.5],
                to: [2.5, 1.8, -2],
                color: 5,
                export: false
            }).addTo(cam).init();
            const lens = new Cube({
                name: 'camera_lens',
                from: [-1.2, -1.2, -2],
                to: [1.2, 1.2, -0.3],
                color: 5,
                export: false
            }).addTo(cam).init();
            const top = new Cube({
                name: 'camera_top',
                from: [-0.9, 1.8, -5.5],
                to: [0.9, 2.8, -2.8],
                color: 5,
                export: false
            }).addTo(cam).init();
            for (const cube of [body, lens, top]) {
                for (const face of Object.values(cube.faces ?? {})) face.texture = false;
            }

            cam.isOpen = false;
            undoGroups.push(cam);
            undoElements.push(body, lens, top);
            cam.select();
            Undo.finishEdit('Add AnimCue scene camera');
            Canvas.updateAll();
            return cam;
        });

        if (Animation.selected) {
            const track = Animation.selected.getBoneAnimator(camera);
            if (!track.position.length) track.createKeyframe({x: 0, y: 26, z: -48}, 0, 'position', false);
            track.addToTimeline();
            if (Modes.animate) Animator.preview();
        }
        Blockbench.showQuickMessage(Locale.t('msg_camera_added'), 3000);
        StudioPanel.refresh();
        return camera;
    }

    function remove() {
        const camera = find();
        if (!camera) return;
        SceneProject.withEditMode(() => {
            const groups = [camera];
            const elements = camera.children.slice();
            const animations = (Animation.all ?? []).filter(clip => Boolean(clip.animators?.[camera.uuid]));
            Undo.initEdit({outliner: true, groups, elements, selection: true, animations});
            for (const clip of animations) {
                if (clip.animators?.[camera.uuid]) clip.removeAnimator(camera.uuid);
            }
            camera.remove(false);
            groups.length = 0;
            elements.length = 0;
            Undo.finishEdit('Remove AnimCue scene camera');
            Canvas.updateAllBones?.();
        });
        StudioPanel.refresh();
    }

    function focusForAnimate() {
        const camera = find() || add();
        const clip = Animation.selected || Participants.ensureDefaultAnimation();
        Modes.options.animate.select();
        clip.select();
        if (Timeline.playing) Timeline.pause();
        camera.select();
        const track = clip.getBoneAnimator(camera);
        track.addToTimeline();
        track.expanded = true;
        BarItems.move_tool?.select();
        Animator.preview();
    }

    function lookThrough() {
        const camera = find();
        if (!camera) throw new Error(Locale.t('err_no_camera'));
        const preview = Preview.selected;
        if (!preview?.camera || !preview?.controls) return;
        if (Modes.animate && Animation.selected) Animator.preview();
        camera.mesh.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        camera.mesh.getWorldPosition(worldPos);
        camera.mesh.getWorldQuaternion(worldQuat);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
        const target = worldPos.clone().addScaledVector(forward, 24);
        preview.camera.position.copy(worldPos);
        preview.controls.target.copy(target);
        preview.controls.update();
        const sec = Math.round((Timeline.time || 0) * 100) / 100;
        Blockbench.showQuickMessage(Locale.t('msg_camera_aligned', {time: sec}), 2200);
    }

    return {register, find, add, remove, focusForAnimate, lookThrough, cameraKey};
})();
