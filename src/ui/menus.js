const StudioMenus = (() => {
    const cleanups = [];

    function register() {
        const ready = StudioDialogs.ready;
        const guard = StudioDialogs.guard;

        const addAction = (id, nameKey, icon, condition, click) => {
            const action = new Action(id, {name: Locale.t(nameKey), icon, condition, click: guard(click)});
            cleanups.push(() => action.delete());
            return action;
        };

        const actNewScene = addAction('animcue_new_scene', 'menu_new_scene', 'movie_creation', true, () => SceneProject.createBlankScene());
        const actImportFile = addAction('animcue_import_participant', 'menu_import_bbmodel', 'group_add', ready, () => StudioDialogs.importModelFile());
        const actImportPal = addAction('animcue_import_pal_player', 'menu_import_pal_player', 'accessibility_new', ready, () => StudioDialogs.importPalPlayer('player'));
        const actImportDc = addAction('animcue_import_pal_dragoncore', 'menu_import_pal_dragoncore', 'sports_martial_arts', ready, () => StudioDialogs.importPalPlayer('dragoncore'));
        const actImportVanilla = addAction('animcue_import_vanilla', 'menu_import_vanilla', 'person_add', ready, () => StudioDialogs.importVanilla());
        const actAddCamera = addAction('animcue_add_camera', 'menu_add_camera', 'videocam', ready, () => SceneCameraRig.add());
        const actLookCamera = addAction('animcue_look_camera', 'menu_look_camera', 'center_focus_strong', () => ready() && Boolean(SceneCameraRig.find()), () => SceneCameraRig.lookThrough());
        const actEditSlot = addAction('animcue_edit_participant', 'menu_edit_participant', 'edit', ready, () => StudioDialogs.editParticipant());
        const actPlaceViewport = addAction('animcue_place_in_viewport', 'menu_place_viewport', 'open_with', ready, () => Participants.placeInViewport());
        const actStartPos = addAction('animcue_start_position', 'menu_set_start_pos', 'place', ready, () => StudioDialogs.setStartPosition());
        const actImportActorAnim = addAction('animcue_import_actor_anim', 'menu_import_actor_anim', 'file_upload', ready, () => StudioDialogs.importActorAnimationFile());
        const actInsertEvent = addAction('animcue_insert_event', 'menu_add_event', 'flag', ready, () => StudioDialogs.insertEventDialog());
        const actShowTracks = addAction('animcue_show_tracks', 'menu_show_tracks', 'view_timeline', () => ready() && Boolean(Animation.selected), () => InteractionCodec.showActiveTracks());
        const actImportScene = addAction('animcue_import_scene', 'menu_import_scene', 'file_upload', ready, () => StudioDialogs.importSceneFile());
        const actExportDialog = addAction('animcue_export_dialog', 'menu_export_scene', 'movie', ready, () => StudioDialogs.exportDialog());
        const actExportSelected = addAction('animcue_export_selected', 'menu_export_selected', 'movie', ready, () => StudioDialogs.exportDialog('selected'));
        const actExportAll = addAction('animcue_export_all', 'menu_export_all', 'video_library', ready, () => StudioDialogs.exportDialog('all'));

        // File menu entries
        MenuBar.addAction(actNewScene, 'file.new');
        MenuBar.addAction(actImportScene, 'file.import');
        MenuBar.addAction(actExportDialog, 'file.export');

        // Grouped submenu under Tools (keeps Blockbench's Tools menu clean)
        const toolsSubmenu = {
            id: 'animcue_tools_menu',
            name: Locale.t('menu_root'),
            icon: 'movie_creation',
            condition: ready,
            children: [
                {
                    id: 'animcue_add_submenu',
                    name: Locale.t('menu_add_participant'),
                    icon: 'group_add',
                    children: [actImportFile, actImportPal, actImportDc, actImportVanilla]
                },
                actAddCamera,
                actLookCamera,
                '_',
                actPlaceViewport,
                actStartPos,
                actEditSlot,
                actImportActorAnim,
                '_',
                actInsertEvent,
                actShowTracks,
                '_',
                actImportScene,
                actExportSelected,
                actExportAll
            ]
        };
        MenuBar.addAction(toolsSubmenu, 'tools');
        cleanups.push(() => MenuBar.menus?.tools?.removeAction(toolsSubmenu));

        // Animation menu shortcut
        MenuBar.addAction(actShowTracks, 'animation');
        MenuBar.addAction(actInsertEvent, 'animation');

        // Outliner right-click context menu on participant root or descendant groups
        const outlinerSubmenu = {
            id: 'animcue_outliner_menu',
            name: Locale.t('menu_root'),
            icon: 'movie_creation',
            condition: () => ready() && Boolean(Participants.rootOf(Group.first_selected)),
            children: [
                {
                    name: Locale.t('menu_select_root'),
                    icon: 'account_tree',
                    click: guard(() => Participants.selectedRoot().select())
                },
                {
                    name: Locale.t('menu_place_viewport'),
                    icon: 'open_with',
                    click: guard(() => Participants.placeInViewport())
                },
                {
                    name: Locale.t('menu_set_start_pos'),
                    icon: 'place',
                    click: guard(() => StudioDialogs.setStartPosition())
                },
                {
                    name: Locale.t('menu_import_actor_anim'),
                    icon: 'file_upload',
                    click: guard(() => StudioDialogs.importActorAnimationFile())
                },
                {
                    name: Locale.t('menu_edit_participant'),
                    icon: 'edit',
                    click: guard(() => StudioDialogs.editParticipant())
                },
                '_',
                {
                    name: Locale.t('menu_duplicate_participant'),
                    icon: 'content_copy',
                    click: guard(() => Participants.duplicate(Participants.selectedRoot()))
                },
                {
                    name: Locale.t('menu_remove_participant'),
                    icon: 'delete_outline',
                    click: guard(() => StudioDialogs.confirmRemoveParticipant())
                }
            ]
        };
        if (Group?.prototype?.menu && typeof Group.prototype.menu.addAction === 'function') {
            Group.prototype.menu.addAction(outlinerSubmenu);
            cleanups.push(() => Group.prototype.menu.removeAction(outlinerSubmenu));
        }

        // Animation panel toolbar quick actions (matching pal_bend_player_tools ergonomics)
        const attachToolbar = () => {
            if (!globalThis.Toolbars?.animations || typeof Toolbars.animations.add !== 'function') return;
            const toolbar = Toolbars.animations;
            const has = id => Array.isArray(toolbar.children) && toolbar.children.some(item => item === id || item?.id === id);
            if (!has(actExportDialog.id)) {
                toolbar.add(actExportDialog);
                cleanups.push(() => toolbar.remove?.(actExportDialog));
            }
        };
        attachToolbar();
        const timer = setTimeout(attachToolbar, 250);
        cleanups.push(() => clearTimeout(timer));

        return {
            delete() {
                while (cleanups.length) {
                    try { cleanups.pop()(); } catch (_ignore) {}
                }
            }
        };
    }

    return {register};
})();
