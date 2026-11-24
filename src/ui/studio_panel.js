const StudioPanel = (() => {
    let panel = null;
    let cssHandle = null;
    let vm = null;
    const eventCleanups = [];

    const STYLES = `
        .animcue-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            font-size: 12px;
        }
        .animcue-bar {
            display: flex;
            align-items: center;
            height: 34px;
            padding: 0 6px;
            gap: 4px;
            border-bottom: 1px solid var(--color-border);
            flex-shrink: 0;
        }
        .animcue-bar .animcue-spacer {
            flex: 1;
        }
        .animcue-action-btn {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            height: 24px;
            padding: 0 8px;
            border-radius: 4px;
            border: 1px solid var(--color-border);
            background: var(--color-button);
            color: var(--color-text);
            font-size: 11.5px;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.12s ease, border-color 0.12s ease;
        }
        .animcue-action-btn:hover {
            background: var(--color-selected);
            color: var(--color-light);
        }
        .animcue-action-btn.primary {
            background: var(--color-accent);
            border-color: var(--color-accent);
            color: var(--color-accent_text);
            font-weight: 500;
        }
        .animcue-action-btn.primary:hover {
            filter: brightness(1.08);
        }
        .animcue-action-btn i {
            font-size: 15px;
        }
        .animcue-tool {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            cursor: pointer;
            color: var(--color-subtle_text);
            border-radius: 4px;
            transition: background 0.12s ease, color 0.12s ease;
        }
        .animcue-tool:hover {
            color: var(--color-light);
            background: var(--color-selected);
        }
        .animcue-tool i {
            font-size: 17px;
        }
        .animcue-body {
            flex: 1;
            overflow-y: auto;
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-height: 0;
        }
        .animcue-card {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 5px 8px;
            background: var(--color-back);
            border: 1px solid var(--color-border);
            border-radius: 5px;
            cursor: pointer;
            user-select: none;
            transition: border-color 0.12s ease, background 0.12s ease;
        }
        .animcue-card:hover {
            border-color: var(--color-subtle_text);
            background: var(--color-ui);
        }
        .animcue-card.selected {
            border-color: var(--color-accent);
            box-shadow: inset 3px 0 0 var(--color-accent);
            background: var(--color-ui);
        }
        .animcue-card.dimmed {
            opacity: 0.5;
        }
        .animcue-card.subject {
            cursor: default;
            background: var(--color-back);
        }
        .animcue-card.subject:hover {
            border-color: var(--color-border);
            background: var(--color-back);
        }
        .animcue-avatar {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 4px;
            background: var(--color-button);
            color: var(--color-subtle_text);
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .animcue-card.selected .animcue-avatar {
            background: var(--color-accent);
            color: var(--color-accent_text);
        }
        .animcue-avatar i {
            font-size: 15px;
        }
        .animcue-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .animcue-name-line {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
        }
        .animcue-name {
            font-size: 12.5px;
            font-weight: 500;
            color: var(--color-text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .animcue-sub {
            font-size: 10.5px;
            color: var(--color-subtle_text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .animcue-chip {
            display: inline-flex;
            align-items: center;
            height: 16px;
            padding: 0 5px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            background: var(--color-button);
            color: var(--color-subtle_text);
            flex-shrink: 0;
        }
        .animcue-chip.accent {
            background: rgba(62, 144, 255, 0.16);
            color: var(--color-accent);
            border: 1px solid rgba(62, 144, 255, 0.35);
        }
        .animcue-row-btns {
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }
        .animcue-row-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            color: var(--color-subtle_text);
            border-radius: 4px;
            transition: background 0.1s ease, color 0.1s ease;
        }
        .animcue-row-btn:hover {
            color: var(--color-light);
            background: var(--color-button);
        }
        .animcue-row-btn i {
            font-size: 15px;
        }
        .animcue-group-label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 2px 2px 0;
            font-size: 11px;
            color: var(--color-subtle_text);
        }
        .animcue-empty-box {
            padding: 14px 10px;
            text-align: center;
            color: var(--color-subtle_text);
            font-size: 11.5px;
            line-height: 1.5;
            background: var(--color-back);
            border: 1px dashed var(--color-border);
            border-radius: 5px;
        }
        .animcue-cam-add {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            height: 28px;
            border-radius: 5px;
            border: 1px dashed var(--color-border);
            color: var(--color-subtle_text);
            font-size: 11.5px;
            cursor: pointer;
            transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
        }
        .animcue-cam-add:hover {
            border-color: var(--color-accent);
            color: var(--color-text);
            background: var(--color-back);
        }
        .animcue-cam-add i {
            font-size: 15px;
        }
        .animcue-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 24px;
            padding: 0 8px;
            border-top: 1px solid var(--color-border);
            font-size: 11px;
            color: var(--color-subtle_text);
            flex-shrink: 0;
        }
        .animcue-dot {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-right: 5px;
            background: var(--color-subtle_text);
            vertical-align: middle;
        }
        .animcue-dot.on {
            background: #4ade80;
            box-shadow: 0 0 5px rgba(74, 222, 128, 0.5);
        }
    `;

    function snapshot() {
        const hasProject = StudioDialogs.ready();
        const palLinked = PalBridge.isAvailable();
        const palVersion = PalBridge.version();
        const primaryRig = hasProject ? PalBridge.detectPrimaryRig() : null;
        const selectedRoot = hasProject ? Participants.rootOf(Group.first_selected ?? Outliner.selected[0]) : null;
        const camera = hasProject ? SceneCameraRig.find() : null;

        const participants = hasProject ? Participants.roots().map((root, index) => {
            const slot = root[Participants.slotKey];
            const rig = PalBridge.detectParticipantRig(root);
            return {
                uuid: root.uuid,
                index: index + 1,
                role: slot.role,
                type: slot.type,
                id: slot.id,
                visible: root.visibility !== false,
                selected: root === selectedRoot,
                rigBadge: rig ? (rig.preset === 'dragoncore' ? Locale.t('badge_dragoncore') : Locale.t('badge_pal')) : ''
            };
        }) : [];

        return {
            hasProject,
            palLinked,
            palStatus: palLinked ? Locale.t('badge_pal_linked', {version: palVersion}) : Locale.t('badge_pal_standalone'),
            palTooltip: palLinked ? Locale.t('tip_pal_linked') : Locale.t('tip_pal_standalone'),
            subjectName: hasProject ? (Project.name || Locale.t('panel_subject_unnamed')) : '',
            subjectRigBadge: primaryRig
                ? (primaryRig.preset === 'dragoncore' ? Locale.t('badge_dragoncore') : Locale.t('badge_pal'))
                : '',
            participants,
            hasCamera: Boolean(camera),
            cameraSelected: Boolean(camera && Group.first_selected === camera)
        };
    }

    function refresh() {
        if (!vm) return;
        Object.assign(vm, snapshot());
    }

    function groupByUuid(uuid) {
        return Participants.roots().find(group => group.uuid === uuid) || null;
    }

    function openAddMenu(event) {
        const anchor = event?.currentTarget instanceof HTMLElement ? event.currentTarget : event;
        new Menu([
            {
                name: Locale.t('menu_import_bbmodel'),
                icon: 'group_add',
                click: StudioDialogs.guard(() => StudioDialogs.importModelFile())
            },
            '_',
            {
                name: Locale.t('menu_import_pal_player'),
                icon: 'accessibility_new',
                click: StudioDialogs.guard(() => StudioDialogs.importPalPlayer('player'))
            },
            {
                name: Locale.t('menu_import_pal_dragoncore'),
                icon: 'sports_martial_arts',
                click: StudioDialogs.guard(() => StudioDialogs.importPalPlayer('dragoncore'))
            },
            '_',
            {
                name: Locale.t('menu_import_vanilla'),
                icon: 'person_add',
                click: StudioDialogs.guard(() => StudioDialogs.importVanilla())
            }
        ]).open(anchor);
    }

    function openActorMenu(uuid, index, total, event) {
        const root = groupByUuid(uuid);
        if (!root) return;
        const anchor = event?.type === 'contextmenu'
            ? event
            : (event?.currentTarget instanceof HTMLElement ? event.currentTarget : event);
        const items = [
            {
                name: Locale.t('tip_place_zero'),
                icon: 'open_with',
                click: StudioDialogs.guard(() => Participants.placeInViewport(root))
            },
            {
                name: Locale.t('tip_start_pos'),
                icon: 'place',
                click: StudioDialogs.guard(() => StudioDialogs.setStartPosition(root))
            },
            {
                name: Locale.t('tip_import_anim'),
                icon: 'file_upload',
                click: StudioDialogs.guard(() => StudioDialogs.importActorAnimationFile(root))
            },
            {
                name: Locale.t('tip_edit'),
                icon: 'edit',
                click: StudioDialogs.guard(() => StudioDialogs.editParticipant(root))
            },
            '_'
        ];
        if (index > 0) {
            items.push({
                name: Locale.t('tip_move_up'),
                icon: 'arrow_upward',
                click: StudioDialogs.guard(() => Participants.moveOrder(root, -1))
            });
        }
        if (index < total - 1) {
            items.push({
                name: Locale.t('tip_move_down'),
                icon: 'arrow_downward',
                click: StudioDialogs.guard(() => Participants.moveOrder(root, 1))
            });
        }
        items.push(
            {
                name: Locale.t('tip_duplicate'),
                icon: 'content_copy',
                click: StudioDialogs.guard(() => Participants.duplicate(root))
            },
            {
                name: Locale.t('tip_remove'),
                icon: 'delete_outline',
                click: StudioDialogs.guard(() => StudioDialogs.confirmRemoveParticipant(root))
            }
        );
        new Menu(items).open(anchor);
    }

    function register() {
        if (typeof Blockbench !== 'undefined' && typeof Blockbench.addCSS === 'function') {
            cssHandle = Blockbench.addCSS(STYLES);
        }
        panel = new Panel('animcue_studio_panel', {
            id: 'animcue_studio_panel',
            name: Locale.t('panel_title'),
            icon: 'movie_creation',
            growable: true,
            resizable: true,
            default_position: {
                slot: 'left_bar',
                float_position: [0, 0],
                float_size: [280, 360],
                height: 310
            },
            insert_after: 'animations',
            component: {
                data() {
                    return snapshot();
                },
                mounted() {
                    vm = this;
                },
                beforeDestroy() {
                    if (vm === this) vm = null;
                },
                methods: {
                    t: (key, params) => Locale.t(key, params),
                    newScene: StudioDialogs.guard(() => SceneProject.createBlankScene()),
                    openAdd: (event) => openAddMenu(event),
                    openMenu: (uuid, idx, event) => openActorMenu(uuid, idx, Participants.roots().length, event),
                    selectActor(uuid) {
                        const root = groupByUuid(uuid);
                        if (root) {
                            root.select();
                            refresh();
                        }
                    },
                    toggleVis(uuid) {
                        const root = groupByUuid(uuid);
                        if (root) Participants.toggleVisibility(root);
                    },
                    placeZero(uuid) {
                        const root = groupByUuid(uuid);
                        if (root) Participants.placeInViewport(root);
                    },
                    moveActor(uuid, delta) {
                        const root = groupByUuid(uuid);
                        if (root) Participants.moveOrder(root, delta);
                    },
                    duplicateActor(uuid) {
                        const root = groupByUuid(uuid);
                        if (root) Participants.duplicate(root);
                    },
                    addCamera: StudioDialogs.guard(() => SceneCameraRig.add()),
                    selectCamera() {
                        const cam = SceneCameraRig.find();
                        if (cam) {
                            cam.select();
                            refresh();
                        }
                    },
                    placeCamera: StudioDialogs.guard(() => SceneCameraRig.focusForAnimate()),
                    lookCamera: StudioDialogs.guard(() => SceneCameraRig.lookThrough()),
                    removeCamera: StudioDialogs.guard(() => StudioDialogs.confirmRemoveCamera()),
                    insertEvent: StudioDialogs.guard(() => StudioDialogs.insertEventDialog()),
                    showTracks: StudioDialogs.guard(() => InteractionCodec.showActiveTracks()),
                    importScene: StudioDialogs.guard(() => StudioDialogs.importSceneFile()),
                    exportScene: StudioDialogs.guard(() => StudioDialogs.exportDialog())
                },
                template: `
                    <div class="animcue-panel">
                        <div class="animcue-bar" v-if="hasProject">
                            <div class="animcue-action-btn" :title="t('panel_btn_add')" @click="openAdd($event)">
                                <i class="material-icons">add</i><span>{{ t('panel_btn_add') }}</span>
                            </div>
                            <div class="animcue-tool" :title="t('panel_btn_event')" @click="insertEvent">
                                <i class="material-icons">flag</i>
                            </div>
                            <div class="animcue-tool" :title="t('panel_btn_tracks')" @click="showTracks">
                                <i class="material-icons">view_timeline</i>
                            </div>
                            <div class="animcue-spacer"></div>
                            <div class="animcue-tool" :title="t('toolbar_import')" @click="importScene">
                                <i class="material-icons">file_upload</i>
                            </div>
                            <div class="animcue-action-btn primary" :title="t('toolbar_export')" @click="exportScene">
                                <i class="material-icons">movie</i><span>{{ t('panel_btn_export') }}</span>
                            </div>
                        </div>

                        <div v-if="!hasProject" class="animcue-body">
                            <div class="animcue-empty-box">
                                <div>{{ t('panel_no_project') }}</div>
                                <div class="animcue-action-btn primary" style="margin-top:8px;" @click="newScene">
                                    <i class="material-icons">add</i><span>{{ t('panel_create_scene') }}</span>
                                </div>
                            </div>
                        </div>

                        <div v-else class="animcue-body">
                            <div class="animcue-card subject" :title="subjectName">
                                <div class="animcue-avatar"><i class="material-icons">deployed_code</i></div>
                                <div class="animcue-info">
                                    <div class="animcue-name-line">
                                        <span class="animcue-name">{{ subjectName }}</span>
                                    </div>
                                    <div class="animcue-sub">{{ t('badge_subject') }}</div>
                                </div>
                                <span v-if="subjectRigBadge" class="animcue-chip accent">{{ subjectRigBadge }}</span>
                            </div>

                            <div class="animcue-group-label">
                                <span>{{ t('panel_participants_heading') }}</span>
                                <span>{{ participants.length }}</span>
                            </div>

                            <div v-if="!participants.length" class="animcue-empty-box">
                                {{ t('panel_empty_participants') }}
                            </div>

                            <div v-for="(actor, idx) in participants" :key="actor.uuid"
                                 class="animcue-card"
                                 :class="{selected: actor.selected, dimmed: !actor.visible}"
                                 @click="selectActor(actor.uuid)"
                                 @dblclick="placeZero(actor.uuid)"
                                 @contextmenu.prevent="openMenu(actor.uuid, idx, $event)">
                                <div class="animcue-avatar">{{ actor.index }}</div>
                                <div class="animcue-info">
                                    <div class="animcue-name-line">
                                        <span class="animcue-name">{{ actor.role }}</span>
                                        <span v-if="actor.rigBadge" class="animcue-chip accent">{{ actor.rigBadge }}</span>
                                    </div>
                                    <div class="animcue-sub">{{ actor.id }}</div>
                                </div>
                                <div class="animcue-row-btns" @click.stop>
                                    <div class="animcue-row-btn" :title="t('tip_place_zero')" @click="placeZero(actor.uuid)">
                                        <i class="material-icons">open_with</i>
                                    </div>
                                    <div class="animcue-row-btn" :title="t('tip_toggle_vis')" @click="toggleVis(actor.uuid)">
                                        <i class="material-icons">{{ actor.visible ? 'visibility' : 'visibility_off' }}</i>
                                    </div>
                                    <div class="animcue-row-btn" :title="t('tip_more')" @click="openMenu(actor.uuid, idx, $event)">
                                        <i class="material-icons">more_vert</i>
                                    </div>
                                </div>
                            </div>

                            <div v-if="hasCamera" class="animcue-card" :class="{selected: cameraSelected}"
                                 @click="selectCamera" @dblclick="placeCamera">
                                <div class="animcue-avatar"><i class="material-icons">videocam</i></div>
                                <div class="animcue-info">
                                    <div class="animcue-name">{{ t('badge_camera') }}</div>
                                    <div class="animcue-sub">{{ t('panel_camera_ready') }}</div>
                                </div>
                                <div class="animcue-row-btns" @click.stop>
                                    <div class="animcue-row-btn" :title="t('tip_place_camera')" @click="placeCamera">
                                        <i class="material-icons">open_with</i>
                                    </div>
                                    <div class="animcue-row-btn" :title="t('tip_look_camera')" @click="lookCamera">
                                        <i class="material-icons">center_focus_strong</i>
                                    </div>
                                    <div class="animcue-row-btn" :title="t('tip_remove')" @click="removeCamera">
                                        <i class="material-icons">delete_outline</i>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="animcue-cam-add" @click="addCamera">
                                <i class="material-icons">videocam</i><span>{{ t('panel_btn_add_camera') }}</span>
                            </div>
                        </div>

                        <div class="animcue-footer" :title="palTooltip">
                            <span><span class="animcue-dot" :class="{on: palLinked}"></span>{{ palStatus }}</span>
                            <span v-if="hasProject">{{ participants.length === 1 ? t('panel_footer_actor_one') : t('panel_footer_actor_many', {count: participants.length}) }}</span>
                        </div>
                    </div>
                `
            }
        });

        const hook = event => {
            const handler = () => refresh();
            Blockbench.on(event, handler);
            eventCleanups.push(() => Blockbench.removeListener(event, handler));
        };
        ['select_project', 'close_project', 'update_selection', 'finished_edit', 'select_mode', 'load_project'].forEach(hook);
        eventCleanups.push(PalBridge.onChange(() => refresh()));

        return {
            delete() {
                while (eventCleanups.length) eventCleanups.pop()();
                if (panel) panel.delete();
                panel = null;
                vm = null;
                if (cssHandle) cssHandle.delete();
                cssHandle = null;
            }
        };
    }

    return {register, refresh};
})();
