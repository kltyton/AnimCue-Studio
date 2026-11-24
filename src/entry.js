const cleanup = [];

Plugin.register('animcue_studio', {
    title: 'AnimCue Studio',
    author: 'kltyton',
    description: 'Animate multiple models and a scene camera on one Blockbench timeline, with PAL / MoreRotation bend support.',
    icon: 'icon.png',
    tags: ['Minecraft: Java Edition', 'Animation', 'Tools'],
    version: '0.3.0',
    min_version: '5.0.0',
    variant: 'both',
    await_loading: true,
    creation_date: '2026/11/24',
    website: 'https://github.com/kltyton/AnimCue-Studio/wiki',
    repository: 'https://github.com/kltyton/AnimCue-Studio',
    bug_tracker: 'https://github.com/kltyton/AnimCue-Studio/issues',
    onload() {
        Locale.register();
        cleanup.push(...Participants.register());
        cleanup.push(SceneCameraRig.register());
        cleanup.push(PalBridge.register());
        cleanup.push(SceneProject.register());
        cleanup.push(InteractionCodec.hookNativeImport());
        cleanup.push(StudioPanel.register());
        cleanup.push(StudioMenus.register());
        StudioPanel.refresh();
    },
    onunload() {
        for (const entry of cleanup.splice(0).reverse()) {
            try { entry.delete(); } catch (_ignore) {}
        }
    }
});
