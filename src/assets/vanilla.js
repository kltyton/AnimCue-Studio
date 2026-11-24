const VanillaTemplates = (() => {
    let library;
    const providers = [
        'https://wynem.com/assets',
        'https://raw.githubusercontent.com/ewanhowell5195/wynem/main/src/assets',
        'https://cdn.jsdelivr.net/gh/ewanhowell5195/wynem/src/assets'
    ];

    async function catalog() {
        if (!library) {
            library = (async () => {
                for (const root of providers) {
                    try {
                        const response = await fetch(root + '/json/cem_template_models.json', {signal: AbortSignal.timeout(12000)});
                        if (!response.ok) continue;
                        const data = await response.json();
                        if (!data.categories || !data.models) continue;
                        const entities = data.categories.flatMap(category => category.entities ?? [])
                            .filter(entry => entry.id && !entry.type)
                            .flatMap(entry => [entry, ...(entry.variants ?? []).map(variant => ({
                                ...variant,
                                model: variant.model ?? entry.model ?? entry.id,
                                baseId: entry.id
                            }))]);
                        return {root, entities, models: data.models};
                    } catch (error) {
                        console.warn('AnimCue could not read vanilla templates from ' + root, error);
                    }
                }
                throw new Error(Locale.t('err_vanilla_offline'));
            })().catch(error => {
                library = undefined;
                throw error;
            });
        }
        return library;
    }

    async function fetchTextureDataURL(relativePath, preferredRoot) {
        const roots = [preferredRoot, ...providers.filter(r => r !== preferredRoot)].filter(Boolean);
        for (const root of roots) {
            try {
                const response = await fetch(`${root}/${relativePath}`, {signal: AbortSignal.timeout(10000)});
                if (!response.ok) continue;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.startsWith('text/html')) continue;
                const blob = await response.blob();
                if (!blob || blob.size < 32) continue;
                return await blobToDataURL(blob);
            } catch (_ignore) {}
        }
        return null;
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => reject(reader.error || new Error('Failed to read texture blob'));
            reader.readAsDataURL(blob);
        });
    }

    async function resolve(entry) {
        const source = await catalog();
        const modelKey = entry.model ?? entry.id;
        const model = source.models[modelKey];
        if (!model?.model) throw new Error(Locale.t('err_vanilla_missing', {id: entry.id}));

        const textures = [];
        if (!entry.textureless) {
            const vanillaNames = Array.isArray(entry.vanilla_textures)
                ? entry.vanilla_textures
                : [entry.vanilla_textures ?? entry.id];
            for (const [index, name] of vanillaNames.entries()) {
                const suffix = index ? `_${index}` : '';
                let dataURL = await fetchTextureDataURL(`images/minecraft/entities/${entry.id}${suffix}.png`, source.root);
                if (!dataURL && entry.baseId && entry.baseId !== entry.id) {
                    dataURL = await fetchTextureDataURL(`images/minecraft/entities/${entry.baseId}${suffix}.png`, source.root);
                }
                if (dataURL) {
                    const cleanName = String(name || entry.id);
                    textures.push({
                        name: cleanName.endsWith('.png') ? cleanName : cleanName + '.png',
                        dataURL
                    });
                }
            }
            if (!textures.length && model.texture_data) {
                const rawList = Array.isArray(model.texture_data) ? model.texture_data : [model.texture_data];
                const rawNames = Array.isArray(entry.texture) ? entry.texture : [entry.texture ?? entry.id];
                rawList.forEach((bitmap, idx) => {
                    if (typeof bitmap !== 'string' || !bitmap) return;
                    const nm = String(rawNames[idx] || `${entry.id}_${idx + 1}`);
                    textures.push({
                        name: nm.endsWith('.png') ? nm : nm + '.png',
                        dataURL: bitmap.startsWith('data:') ? bitmap : 'data:image/png;base64,' + bitmap
                    });
                });
            }
            if (!textures.length && (entry.id === 'player' || entry.baseId === 'player')) {
                const fallbackSkin = PalBridge.getDefaultTexture();
                if (fallbackSkin?.dataURL) {
                    textures.push({name: fallbackSkin.name || 'player.png', dataURL: fallbackSkin.dataURL});
                }
            }
        }
        return {geometry: JSON.parse(model.model), textures, entityId: entry.baseId ?? entry.id};
    }

    function loadTextureAndWait(info) {
        return new Promise(resolve => {
            const tex = new Texture({
                name: info.name || 'texture.png',
                keep_size: true,
                uv_width: Project.texture_width || 64,
                uv_height: Project.texture_height || 64
            });
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve(tex);
            };
            tex.load_callback = finish;
            tex.fromDataURL(info.dataURL).add(false);
            if (tex.img?.complete && tex.img.naturalWidth > 0) finish();
            setTimeout(finish, 2000);
        });
    }

    function sanitizeGroupNames() {
        const used = new Set();
        for (const group of Group.all) {
            let base = String(group.name || '').trim();
            if (!base || base === 'kltyton:root') base = 'submodel';
            let candidate = base;
            let suffix = 2;
            while (used.has(candidate)) candidate = `${base}_${suffix++}`;
            used.add(candidate);
            if (group.name !== candidate) group.name = candidate;
        }
    }

    async function closeScratchProjects(existingProjects, target) {
        const leaked = ModelProject.all.filter(proj => !existingProjects.has(proj) && proj !== target);
        for (const proj of leaked) {
            try {
                await proj.close(true);
            } catch (error) {
                console.warn('[AnimCue] Failed to close scratch project', error);
            }
        }
        if (target && ModelProject.all.includes(target) && Project !== target) {
            target.select();
        }
    }

    async function compile(template, target) {
        if (Project !== target) throw new Error(Locale.t('err_switch_back_project'));
        if (!Formats.optifine_entity) throw new Error(Locale.t('err_vanilla_no_format'));
        return SceneProject.withEditModeAsync(async () => {
            const existingProjects = new Set(ModelProject.all);
            try {
                newProject(Formats.optifine_entity);
                Formats.optifine_entity.codec.parse(template.geometry, '');
                if (template.entityId === 'player') attachPlayerLayers();
                sanitizeGroupNames();

                const loadedTextures = [];
                for (const info of template.textures ?? []) {
                    if (!info?.dataURL) continue;
                    loadedTextures.push(await loadTextureAndWait(info));
                }
                if (loadedTextures.length) {
                    const primary = loadedTextures[0];
                    if (loadedTextures.length === 1) primary.use_as_default = true;
                    for (const cube of Cube.all) {
                        const hasTex = Object.values(cube.faces ?? {}).some(face => Boolean(face.texture));
                        if (!hasTex) cube.applyTexture(primary, true);
                    }
                    Canvas.updateAllFaces?.();
                }
                return Codecs.project.compile({raw: true, bitmaps: true});
            } finally {
                await closeScratchProjects(existingProjects, target);
            }
        });
    }

    function attachPlayerLayers() {
        const pairs = {
            headwear: 'head',
            jacket: 'body',
            left_sleeve: 'left_arm',
            right_sleeve: 'right_arm',
            left_pants: 'left_leg',
            right_pants: 'right_leg'
        };
        const groups = new Map(Group.all.map(group => [group.name, group]));
        for (const [layer, bodyPart] of Object.entries(pairs)) {
            const parent = groups.get(bodyPart);
            if (parent) groups.get(layer)?.addTo(parent);
        }
    }

    return {catalog, resolve, compile};
})();
