const StudioDialogs = (() => {
    const ready = () => Boolean(Project && Format?.bone_rig && Format.animation_mode);

    function guard(action) {
        return async (...args) => {
            try {
                return await action(...args);
            } catch (error) {
                console.error('[AnimCue Studio]', error);
                Blockbench.showMessageBox({
                    title: Locale.t('plugin_title'),
                    message: error?.message || String(error),
                    icon: 'error'
                });
            }
        };
    }

    function ensureProject(target) {
        if (Project !== target || !ready()) throw new Error(Locale.t('err_switch_back_project'));
    }

    function kindOptions() {
        return {
            model: Locale.t('kind_model'),
            entity: Locale.t('kind_entity'),
            block: Locale.t('kind_block'),
            item: Locale.t('kind_item')
        };
    }

    function rigModeOptions() {
        return {
            auto: Locale.t('rig_auto'),
            generic: Locale.t('rig_generic'),
            pal_player: Locale.t('rig_pal_player'),
            pal_dragoncore: Locale.t('rig_pal_dragoncore')
        };
    }

    function openParticipantDialog(title, defaults, options, onConfirm) {
        const showOffset = Boolean(options?.showOffset);
        const form = {
            role: {
                label: Locale.t('field_role'),
                description: Locale.t('field_role_desc'),
                type: 'text',
                value: defaults.role ?? ''
            },
            type: {
                label: Locale.t('field_type'),
                type: 'select',
                options: kindOptions(),
                value: defaults.type ?? 'model'
            },
            id: {
                label: Locale.t('field_id'),
                description: Locale.t('field_id_desc'),
                type: 'text',
                value: defaults.id ?? ''
            },
            rigMode: {
                label: Locale.t('field_rig_mode'),
                type: 'select',
                options: rigModeOptions(),
                value: defaults.rigMode ?? 'auto'
            }
        };
        if (showOffset) {
            form.offset = {
                label: Locale.t('field_initial_offset'),
                description: Locale.t('field_initial_offset_desc'),
                type: 'vector',
                value: defaults.offset ?? [0, 0, 0]
            };
        }
        new Dialog({
            id: 'animcue_participant',
            title,
            form,
            onConfirm: guard(onConfirm)
        }).show();
    }

    function importModelFile() {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        const target = Project;
        Blockbench.import({
            extensions: ['bbmodel', 'json'],
            type: 'Blockbench / Bedrock Geometry',
            readtype: 'text',
            multiple: false
        }, guard(files => {
            if (!files?.length) return;
            const file = files[0];
            let data;
            try {
                data = autoParseJSON(file.content, false);
            } catch (error) {
                throw new Error(Locale.t('err_invalid_json', {message: error.message}));
            }
            const defaults = Participants.guessDefaults(file.name || file.path, data);
            const isGeo = Array.isArray(data?.['minecraft:geometry']);
            if (isGeo) {
                openParticipantDialog(Locale.t('dialog_participant_add_file'), defaults, {showOffset: true}, async form => {
                    ensureProject(target);
                    askOptionalTexture(async textureInfo => {
                        ensureProject(target);
                        const group = await Participants.importBedrockGeometry(data, file.name, textureInfo, form, {
                            initialOffset: form.offset
                        });
                        group.select();
                    });
                });
                return;
            }
            openParticipantDialog(Locale.t('dialog_participant_add_file'), defaults, {showOffset: true}, form => {
                ensureProject(target);
                const group = Participants.importProject(data, file.path, form, {initialOffset: form.offset});
                group.select();
            });
        }));
    }

    function askOptionalTexture(callback) {
        new Dialog({
            id: 'animcue_geo_texture',
            title: Locale.t('dialog_geo_texture_title'),
            lines: [`<p>${Locale.t('dialog_geo_texture_msg')}</p>`],
            buttons: [Locale.t('btn_choose_texture'), Locale.t('btn_skip_texture')],
            confirmIndex: 0,
            cancelIndex: 1,
            onConfirm: guard(() => {
                Blockbench.import({
                    extensions: ['png'],
                    type: 'PNG Texture',
                    readtype: 'image',
                    multiple: false
                }, guard(async files => {
                    const texFile = files?.[0];
                    const textureInfo = texFile ? {name: texFile.name || 'texture.png', dataURL: texFile.content} : null;
                    await callback(textureInfo);
                }));
            }),
            onCancel: guard(async () => {
                await callback(null);
            })
        }).show();
    }

    function importPalPlayer(preset) {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        if (!PalBridge.isAvailable()) {
            Blockbench.showMessageBox({
                title: Locale.t('plugin_title'),
                message: Locale.t('msg_pal_plugin_required'),
                icon: 'info'
            });
            return;
        }
        const target = Project;
        const defaults = {
            role: Participants.uniqueRole('player'),
            type: 'entity',
            id: 'minecraft:player',
            rigMode: preset === 'dragoncore' ? 'pal_dragoncore' : 'pal_player',
            offset: [Participants.roots().length ? 24 : 0, 0, 0]
        };
        const title = preset === 'dragoncore'
            ? Locale.t('dialog_participant_add_dc')
            : Locale.t('dialog_participant_add_pal');
        openParticipantDialog(title, defaults, {showOffset: true}, async form => {
            ensureProject(target);
            const group = await Participants.importPalPlayer(preset, form, {initialOffset: form.offset});
            group.select();
        });
    }

    async function importVanilla() {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        const target = Project;
        if (typeof MinecraftEULA !== 'undefined' && !await MinecraftEULA.promptUser('animcue_studio')) return;
        const data = await VanillaTemplates.catalog();
        ensureProject(target);
        const entries = data.entities.filter(entry => data.models[entry.model ?? entry.id]?.model);
        const items = entries.map(entry => ({
            id: entry.id,
            label: String(entry.display ?? entry.name ?? entry.id),
            entry
        }));
        let chosen = items.find(i => i.id === 'player')?.id || items[0]?.id || '';

        const dialog = new Dialog({
            id: 'animcue_vanilla',
            title: Locale.t('dialog_vanilla_title'),
            component: {
                data() {
                    return {
                        query: '',
                        selected: chosen,
                        items
                    };
                },
                computed: {
                    filtered() {
                        const q = this.query.trim().toLowerCase();
                        if (!q) return this.items;
                        return this.items.filter(item =>
                            item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
                    }
                },
                watch: {
                    selected(val) {
                        chosen = val;
                    },
                    filtered(list) {
                        if (list.length && !list.some(item => item.id === this.selected)) {
                            this.selected = list[0].id;
                        }
                    }
                },
                methods: {
                    t: (key, params) => Locale.t(key, params),
                    pick(id) {
                        this.selected = id;
                    },
                    confirmPick(id) {
                        this.selected = id;
                        chosen = id;
                        dialog.confirm();
                    }
                },
                template: `
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <input class="dark_bordered" type="text" v-model="query" :placeholder="t('field_vanilla_search')" style="width:100%;padding:5px 8px;" />
                        <div style="max-height:260px;overflow-y:auto;border:1px solid var(--color-border);border-radius:3px;background:var(--color-back);">
                            <div v-for="item in filtered" :key="item.id"
                                 @click="pick(item.id)"
                                 @dblclick="confirmPick(item.id)"
                                 style="padding:5px 8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"
                                 :style="{background: item.id === selected ? 'var(--color-accent)' : 'transparent', color: item.id === selected ? 'var(--color-accent_text)' : 'var(--color-text)'}">
                                <span>{{ item.label }}</span>
                                <span style="opacity:0.7;font-size:11px;">{{ item.id }}</span>
                            </div>
                        </div>
                    </div>
                `
            },
            onConfirm: guard(async (formResult) => {
                const pickId = formResult?.entry || chosen;
                const entity = entries.find(candidate => candidate.id === pickId);
                if (!entity) throw new Error(Locale.t('err_vanilla_select'));
                const template = await VanillaTemplates.resolve(entity);
                ensureProject(target);
                const resource = 'minecraft:' + (entity.baseId ?? entity.id);
                openParticipantDialog(Locale.t('dialog_participant_add_vanilla'), {
                    role: Participants.uniqueRole(entity.id),
                    type: 'entity',
                    id: resource,
                    rigMode: 'generic'
                }, {showOffset: true}, async form => {
                    const model = await VanillaTemplates.compile(template, target);
                    ensureProject(target);
                    const group = Participants.importProject(model, '', form, {initialOffset: form.offset});
                    group.select();
                });
            })
        });
        dialog.show();
    }

    function editParticipant(root) {
        const targetRoot = root || Participants.selectedRoot();
        const target = Project;
        openParticipantDialog(Locale.t('dialog_participant_edit'), targetRoot[Participants.slotKey], {showOffset: false}, form => {
            ensureProject(target);
            Participants.edit(targetRoot, form);
        });
    }

    function setStartPosition(root) {
        const targetRoot = root || Participants.selectedRoot();
        const animation = Animation.selected || Participants.ensureDefaultAnimation();
        const target = Project;
        const track = animation.getBoneAnimator(targetRoot);
        const previous = Participants.startingKey(track);
        const position = previous ? previous.data_points[0] : {};
        new Dialog({
            id: 'animcue_start_position',
            title: Locale.t('dialog_start_pos_title'),
            form: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, {
                label: axis.toUpperCase(),
                type: 'number',
                value: Number(position[axis]) || 0,
                step: 0.25
            }])),
            onConfirm: guard(({x, y, z}) => {
                ensureProject(target);
                if (animation !== Animation.selected) throw new Error(Locale.t('err_switch_back_anim'));
                if (![x, y, z].every(Number.isFinite)) throw new Error(Locale.t('err_invalid_coords'));
                const {track} = Participants.openStartingFrame(targetRoot, animation);
                const existing = Participants.startingKey(track);
                if (existing) {
                    Undo.initEdit({keyframes: [existing]});
                    existing.data_points[0].extend({x, y, z});
                    Undo.finishEdit('Set AnimCue start position');
                    existing.select();
                } else {
                    const created = track.createKeyframe({x, y, z}, 0, 'position', true);
                    created?.select();
                }
                Animator.preview();
            })
        }).show();
    }

    function insertEventDialog() {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        const clip = Animation.selected || Participants.ensureDefaultAnimation();
        const target = Project;
        new Dialog({
            id: 'animcue_event_marker',
            title: Locale.t('dialog_event_title'),
            form: {
                name: {
                    label: Locale.t('field_event_name'),
                    description: Locale.t('field_event_desc'),
                    type: 'text',
                    value: ''
                },
                time: {
                    label: Locale.t('field_event_time'),
                    type: 'number',
                    value: Math.round((Timeline.time || 0) * 1000) / 1000,
                    min: 0,
                    step: 0.05
                }
            },
            onConfirm: guard(({name, time}) => {
                ensureProject(target);
                Modes.options.animate.select();
                clip.select();
                InteractionCodec.insertEventMarker(clip, time, name);
                Blockbench.showQuickMessage(Locale.t('msg_event_inserted', {name: name.trim(), time}), 2400);
            })
        }).show();
    }

    function importSceneFile() {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        const target = Project;
        Blockbench.import({
            extensions: ['json'],
            type: Locale.t('export_file_type'),
            readtype: 'text',
            multiple: false
        }, guard(files => {
            if (!files?.length) return;
            ensureProject(target);
            let data;
            try {
                data = autoParseJSON(files[0].content, false);
            } catch (error) {
                throw new Error(Locale.t('err_invalid_json', {message: error.message}));
            }
            InteractionCodec.importSceneDocument(data, {fileName: files[0].name || files[0].path});
        }));
    }

    function importActorAnimationFile(root) {
        const targetRoot = root || Participants.selectedRoot();
        const target = Project;
        Blockbench.import({
            extensions: ['json', 'emote'],
            type: 'PAL / Emotecraft / Bedrock Animation',
            readtype: 'text',
            multiple: false
        }, guard(files => {
            if (!files?.length) return;
            ensureProject(target);
            let data;
            try {
                data = autoParseJSON(files[0].content, false);
            } catch (error) {
                throw new Error(Locale.t('err_invalid_json', {message: error.message}));
            }
            const clipCount = data?.emote ? 1 : Object.keys(data?.animations || {}).length;
            const mergeIntoSelected = Boolean(Animation.selected && clipCount === 1);
            InteractionCodec.importActorAnimation(targetRoot, data, {
                fileName: files[0].name || files[0].path,
                mergeIntoSelected
            });
        }));
    }

    function exportDialog(defaultScope) {
        if (!ready()) throw new Error(Locale.t('err_no_project'));
        if (!Animation.all.length) throw new Error(Locale.t('err_no_animation'));
        const roots = Participants.roots();
        const hasCamera = Boolean(SceneCameraRig.find());
        const primaryPal = Boolean(PalBridge.detectPrimaryRig());
        const palRoles = roots.filter(r => Boolean(PalBridge.detectParticipantRig(r))).length + (primaryPal ? 1 : 0);
        const selectedName = Animation.selected?.name || Animation.all[0].name;
        const scopeDefault = defaultScope || (Animation.selected ? 'selected' : 'all');

        const scopeOptions = {
            selected: Locale.t('scope_selected', {name: selectedName}),
            all: Locale.t('scope_all', {count: Animation.all.length})
        };

        const form = {
            scope: {
                label: Locale.t('field_export_scope'),
                type: 'select',
                options: scopeOptions,
                value: scopeDefault
            },
            includeStaticVisible: {
                label: Locale.t('field_export_static'),
                type: 'checkbox',
                value: false
            },
            includeCamera: {
                label: Locale.t('field_export_camera'),
                type: 'checkbox',
                value: hasCamera,
                condition: () => hasCamera
            },
            convertPrimaryPal: {
                label: Locale.t('field_export_primary_pal'),
                type: 'checkbox',
                value: primaryPal,
                condition: () => primaryPal
            },
            summary: {
                label: Locale.t('field_export_summary'),
                type: 'info',
                text: Locale.t('export_summary_text', {
                    clips: scopeDefault === 'all' ? Animation.all.length : 1,
                    participants: roots.length,
                    camera: hasCamera ? Locale.t('export_yes') : Locale.t('export_no'),
                    pal: palRoles > 0 ? Locale.t('export_yes') : Locale.t('export_no')
                })
            }
        };

        new Dialog({
            id: 'animcue_export',
            title: Locale.t('dialog_export_title'),
            form,
            onConfirm: guard(result => {
                const clips = result.scope === 'all' ? Animation.all.slice() : [Animation.selected || Animation.all[0]].filter(Boolean);
                runExport(clips, {
                    includeStaticVisible: Boolean(result.includeStaticVisible),
                    includeCamera: hasCamera && result.includeCamera !== false,
                    convertPrimaryPal: primaryPal && Boolean(result.convertPrimaryPal)
                });
            })
        }).show();
    }

    function runExport(clips, options = {}) {
        const roots = Participants.roots();
        const {document, stats} = InteractionCodec.buildDocument(clips, roots, options);
        const fileName = (Project.name || 'interaction').replace(/[<>:"/\\|?*]+/g, '_') + '.animation';
        Blockbench.export({
            type: Locale.t('export_file_type'),
            extensions: ['json'],
            name: fileName,
            savetype: 'text',
            content: JSON.stringify(document, null, 2) + '\n'
        });
        Blockbench.showQuickMessage(Locale.t('msg_exported', {
            clips: stats.clipCount,
            name: fileName + '.json'
        }), 3000);
        return {document, stats};
    }

    function confirmRemoveParticipant(root) {
        const targetRoot = root || Participants.selectedRoot();
        const role = targetRoot[Participants.slotKey]?.role;
        new Dialog({
            id: 'animcue_confirm_remove',
            title: Locale.t('dialog_confirm_remove_title'),
            lines: [`<p>${Locale.t('dialog_confirm_remove_msg', {role})}</p>`],
            onConfirm: guard(() => Participants.remove(targetRoot))
        }).show();
    }

    function confirmRemoveCamera() {
        if (!SceneCameraRig.find()) return;
        new Dialog({
            id: 'animcue_confirm_remove_camera',
            title: Locale.t('panel_camera_heading'),
            lines: [`<p>${Locale.t('dialog_confirm_remove_camera')}</p>`],
            onConfirm: guard(() => SceneCameraRig.remove())
        }).show();
    }

    return {
        ready,
        guard,
        importModelFile,
        importPalPlayer,
        importVanilla,
        editParticipant,
        setStartPosition,
        insertEventDialog,
        importSceneFile,
        importActorAnimationFile,
        exportDialog,
        runExport,
        confirmRemoveParticipant,
        confirmRemoveCamera
    };
})();
