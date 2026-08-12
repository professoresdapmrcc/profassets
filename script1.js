(() => {
    const storageKey = 'PROF_REQUERIMENTOS_THEME';
    let theme = 'dark';

    try {
        const savedTheme = localStorage.getItem(storageKey);
        theme = savedTheme === 'light' || savedTheme === 'dark'
            ? savedTheme
            : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    document.documentElement.dataset.theme = theme;
})();
(() => {
    const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const menuButton = document.getElementById('mobile-menu-button');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const themeStorageKey = 'PROF_REQUERIMENTOS_THEME';

    const updateThemeLabel = () => {
        if (!themeToggle) return;
        const nextTheme = root.dataset.theme === 'dark' ? 'claro' : 'escuro';
        themeToggle.setAttribute('aria-label', `Ativar tema ${nextTheme}`);
        themeToggle.setAttribute('title', `Ativar tema ${nextTheme}`);
    };

    const closeSidebar = () => {
        if (!sidebar || !menuButton) return;
        sidebar.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Abrir menu lateral');
    };

    themeToggle?.addEventListener('click', () => {
        const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = nextTheme;
        try { localStorage.setItem(themeStorageKey, nextTheme); } catch {}
        updateThemeLabel();
    });

    menuButton?.addEventListener('click', () => {
        if (!sidebar) return;
        const isOpen = sidebar.classList.toggle('is-open');
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu lateral' : 'Abrir menu lateral');
    });

    sidebarOverlay?.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeSidebar();
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) closeSidebar();
    });

    const getFieldLabel = (field) => {
        const optionLabel = field.tagName === 'SELECT'
            ? field.querySelector('option')?.textContent
            : '';
        const rawLabel = field.dataset.fieldLabel
            || field.getAttribute('placeholder')
            || field.getAttribute('aria-label')
            || optionLabel
            || field.getAttribute('name')
            || 'Campo';

        return rawLabel
            .split('—')[0]
            .replace(/_/g, ' ')
            .replace(/\s*\([^)]*\)\s*$/, '')
            .trim();
    };

    document.querySelectorAll('.form-container .input-field').forEach((field, index) => {
        if (field.type === 'hidden' || field.closest('.field-group')) return;

        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        const fieldId = field.id || `request-field-${index + 1}`;

        field.id = fieldId;
        wrapper.className = 'field-group';
        label.className = 'field-label';
        label.htmlFor = fieldId;
        label.textContent = getFieldLabel(field);

        field.parentNode.insertBefore(wrapper, field);
        wrapper.append(label, field);
    });

    const pageTitle = document.getElementById('request-page-title');
    const topbarTitle = document.getElementById('request-topbar-title');
    document.querySelectorAll('.dropdown > li').forEach((item) => {
        item.addEventListener('click', () => {
            const rawTitle = item.querySelector('a')?.textContent?.trim();
            if (!rawTitle) return;
            const formattedTitle = rawTitle
                .toLocaleLowerCase('pt-BR')
                .split(' ')
                .map((word) => word ? word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1) : word)
                .join(' ');

            if (pageTitle) pageTitle.textContent = formattedTitle;
            if (topbarTitle) topbarTitle.textContent = formattedTitle;
        });
    });

    const tagForm = document.getElementById('attlist_postagem');
    const tagValue = document.getElementById('attlist_tag');
    const tagCharacters = Array.from(document.querySelectorAll('.tag-character-input'));

    const syncTagValue = () => {
        if (!tagValue) return '';
        const value = tagCharacters.map((field) => field.value).join('');
        tagValue.value = value;
        tagValue.dispatchEvent(new Event('input', { bubbles: true }));
        tagValue.classList.toggle('invalid', Array.from(value).length > 0 && Array.from(value).length !== 3);
        return value;
    };

    const fillTagFrom = (startIndex, rawValue) => {
        const characters = Array.from(rawValue.replace(/\s/g, '')).slice(0, 3 - startIndex);
        characters.forEach((character, offset) => {
            tagCharacters[startIndex + offset].value = character;
        });
        syncTagValue();
        const nextIndex = Math.min(startIndex + characters.length, tagCharacters.length - 1);
        tagCharacters[nextIndex]?.focus();
        tagCharacters[nextIndex]?.select();
    };

    tagCharacters.forEach((field, index) => {
        field.addEventListener('input', () => {
            const value = field.value.replace(/\s/g, '');
            field.value = '';
            if (value) fillTagFrom(index, value);
            else syncTagValue();

            if (value && index < tagCharacters.length - 1) {
                tagCharacters[index + 1].focus();
                tagCharacters[index + 1].select();
            }
        });

        field.addEventListener('paste', (event) => {
            const pastedValue = event.clipboardData?.getData('text') || '';
            if (!pastedValue) return;
            event.preventDefault();
            fillTagFrom(index, pastedValue);
        });

        field.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' && !field.value && index > 0) {
                tagCharacters[index - 1].value = '';
                tagCharacters[index - 1].focus();
                syncTagValue();
            } else if (event.key === 'ArrowLeft' && index > 0) {
                event.preventDefault();
                tagCharacters[index - 1].focus();
            } else if (event.key === 'ArrowRight' && index < tagCharacters.length - 1) {
                event.preventDefault();
                tagCharacters[index + 1].focus();
            }
        });
    });

    tagForm?.addEventListener('submit', () => {
        const value = syncTagValue();
        const isComplete = Array.from(value).length === 3;
        tagValue?.classList.toggle('invalid', !isComplete);
        if (!isComplete) {
            (tagCharacters.find((field) => !field.value) || tagCharacters[0])?.focus();
        }
    }, true);

    const toastOverlay = document.getElementById('customModalOverlay');
    const toastContent = document.getElementById('customModal');
    const toastTitle = document.getElementById('modalTitle');
    const toastText = document.getElementById('modalText');
    const toastIcon = document.querySelector('.modal-icon i');
    const toastClose = document.getElementById('modalCloseBtn');
    let toastVisible = false;
    let toastExitTimer = null;
    let nativeAlertTimer = null;

    /* O overlay legado fica desativado; o toast independente é inicializado após o script principal. */
    if (false && toastOverlay && toastContent) {
        const toastObserver = new MutationObserver(() => {
            const isOpen = toastOverlay.classList.contains('show');

            if (isOpen) {
                clearTimeout(toastExitTimer);
                toastOverlay.classList.remove('is-exiting');
                toastVisible = true;

                if (/atualiza[cç][aã]o enviada/i.test(toastTitle?.textContent || '')) {
                    tagCharacters.forEach((field) => { field.value = ''; });
                    syncTagValue();
                }
                return;
            }

            if (!toastVisible || toastOverlay.classList.contains('is-exiting')) return;
            toastVisible = false;
            toastOverlay.classList.add('is-exiting');
            toastExitTimer = setTimeout(() => {
                toastOverlay.classList.remove('is-exiting');
            }, 660);
        });

        toastObserver.observe(toastOverlay, { attributes: true, attributeFilter: ['class'] });

        window.alert = (message) => {
            clearTimeout(nativeAlertTimer);
            if (toastTitle) toastTitle.textContent = 'Atenção';
            if (toastText) toastText.textContent = String(message ?? '');
            if (toastIcon) {
                toastIcon.className = 'fas fa-exclamation-triangle';
                toastIcon.style.color = 'var(--warning)';
            }
            if (toastClose) toastClose.style.display = 'none';
            toastOverlay.classList.add('show');
            nativeAlertTimer = setTimeout(() => toastOverlay.classList.remove('show'), 5200);
        };
    }

    updateThemeLabel();
})();
(() => {
    const REQUEST_VISUALS = {
        form1:  { title: 'ENTRADA DE MEMBROS', icon: 'ph-fill ph-user-plus' },
        form2:  { title: 'EXPULSÃO', icon: 'ph-fill ph-user-minus' },
        form3:  { title: 'LICENÇA', icon: 'ph-fill ph-calendar-x' },
        form4:  { title: 'PROMOÇÃO', icon: 'ph-fill ph-trend-up' },
        form5:  { title: 'REBAIXAMENTO', icon: 'ph-fill ph-trend-down' },
        form6:  { title: 'SAÍDA', icon: 'ph-fill ph-sign-out' },
        form7:  { title: 'PROLONGAMENTO DE LICENÇA', icon: 'ph-fill ph-calendar-plus' },
        form8:  { title: 'RETORNO DE LICENÇA', icon: 'ph-fill ph-arrow-u-up-left' },
        form9:  { title: 'MIGRAÇÃO DE CORPO', icon: 'ph-fill ph-arrows-left-right' },
        form10: { title: 'TRANSFERÊNCIA DE CONTA', icon: 'ph-fill ph-arrows-clockwise' },
        form11: { title: 'REINTEGRAÇÃO', icon: 'ph-fill ph-user-circle-plus' },
        form13: { title: 'MUDANÇA DE CONSELHO', icon: 'ph-fill ph-arrows-left-right' }
    };

    const FIELD_ICONS = {
        user: 'ph ph-user',
        role: 'ti ti-id-badge-2',
        reason: 'ph ph-chat-dots',
        date: 'ph ph-calendar-blank',
        permission: 'ph ph-key',
        duration: 'ph ph-clock-countdown',
        movement: 'ph ph-arrows-left-right',
        group: 'ph ph-buildings',
        accepted: 'ph ph-check-square'
    };

    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentForumDate = () => {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    };

    const forumDate = (value) => {
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
        if (isoMatch) return `${isoMatch[3]} ${MONTHS[Number(isoMatch[2]) - 1]} ${isoMatch[1]}`;
        const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
        if (brMatch) return `${brMatch[1]} ${MONTHS[Number(brMatch[2]) - 1]} ${brMatch[3]}`;
        return value || currentForumDate();
    };

    const roleWithGender = (role) => {
        if (!role || /\(a\)/i.test(role)) return role;
        const genderedRoles = ['Professor', 'Coordenador', 'Graduador', 'Estagiário', 'Conselheiro'];
        return genderedRoles.includes(role) ? `${role}(a)` : role;
    };

    const selectedText = (form, name) => {
        const select = form.querySelector(`[name="${name}"]`);
        return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value?.trim() || '';
    };

    const valueOf = (form, name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || '';
    const transition = (from, to, role = false) => {
        const left = role ? roleWithGender(from) : from;
        const right = role ? roleWithGender(to) : to;
        return `${left} [color=#8C6B94]›[/color] ${right}`;
    };

    const row = (icon, content, strong = false) => {
        const value = strong ? `[b][color=#FFFFFF]${content}[/color][/b]` : content;
        return `<i class="${icon}" style="color: #B896C4; font-size: 16px"></i> ${value}`;
    };

    const buildRequestCard = ({ title, badgeIcon, rows, accent = '#A22CA9' }) => {
        const body = rows.filter(Boolean).join('\n');
        return `[table style="width: max-content; min-width: 420px; max-width: 100%; margin: 10% auto 0 auto; border: none!important; position: relative; border-radius: 14px; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: visible"][table style="width: 100%; border: none!important; border-radius: 14px; overflow: hidden; position: relative; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: hidden"][table style="width: auto; height: auto; border: none!important; position: absolute; top: -20px; right: -65px; z-index: 1; overflow: visible; opacity: 0.22; display: inline-block;"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1; transform: rotate(-25deg)"]<img src="https://i.imgur.com/D1mUb7O.png" style="width: 230px; height: auto; display: block;">[/td][/tr][/table][table style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; background: transparent; box-sizing: border-box;"][tr style="border: none!important"][td style="border: none!important; padding: clamp(20px, 6vw, 28px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px); color: #E7DCEA; font-family: 'Nunito', Arial, sans-serif; font-size: clamp(12.5px, 3.2vw, 14px); line-height: 1.7em; text-align: justify; box-sizing: border-box; white-space: nowrap"]${body}[/td][/tr][/table][/td][/tr][/table][table style="width: auto; border: none!important; border-radius: 20px; overflow: hidden; position: absolute; top: -14px; left: 16px; z-index: 5;" bgcolor="${accent}"][tr style="border: none!important"][td style="border: none!important; padding: 6px 16px 6px 12px; white-space: nowrap; vertical-align: middle; font-family: 'Syne', sans-serif;"][size=14][color=#FFFFFF]<i class="${badgeIcon}"></i> [b]${title}[/b][/color][/size][/td][/tr][/table][/td][/tr][/table]`;
    };

    const reasonFor = (form, selectName, helperId) => {
        const select = form.querySelector(`[name="${selectName}"]`);
        if (select?.selectedOptions?.[0]?.dataset?.customReason === 'true') {
            return document.getElementById(helperId)?.value?.trim() || 'Outro';
        }
        return selectedText(form, selectName);
    };

    const rowsForForm = (formId, form) => {
        const automaticDate = row(FIELD_ICONS.date, currentForumDate());
        const accepted = row(FIELD_ICONS.accepted, 'Termo de ciência aceito');

        switch (formId) {
            case 'form1':
                return [row(FIELD_ICONS.user, valueOf(form, 'nick_ent'), true), automaticDate];
            case 'form2':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'TAG_ex'), true),
                    row(FIELD_ICONS.role, roleWithGender(selectedText(form, 'cargo_ex'))),
                    row(FIELD_ICONS.permission, selectedText(form, 'perm_ex')),
                    row(FIELD_ICONS.reason, reasonFor(form, 'motivo_ex', 'expulsion_custom_reason')),
                    automaticDate
                ];
            case 'form3':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_lic'), true),
                    row(FIELD_ICONS.duration, `${valueOf(form, 'dias_lic')} dias`),
                    row(FIELD_ICONS.permission, valueOf(form, 'perm_lic')),
                    automaticDate,
                    accepted
                ];
            case 'form4':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_pro'), true),
                    row(FIELD_ICONS.role, transition(selectedText(form, 'cargo_pro'), selectedText(form, 'cargo_pro2'), true)),
                    row(FIELD_ICONS.reason, valueOf(form, 'motivo_pro')),
                    row(FIELD_ICONS.date, forumDate(valueOf(form, 'data_pro')))
                ];
            case 'form5':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_reb'), true),
                    row(FIELD_ICONS.role, transition(selectedText(form, 'cargo_reb'), selectedText(form, 'cargo_reb2'), true)),
                    row(FIELD_ICONS.reason, valueOf(form, 'motivo_reb')),
                    row(FIELD_ICONS.date, forumDate(valueOf(form, 'data_reb')))
                ];
            case 'form6':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_sai'), true),
                    row(FIELD_ICONS.role, roleWithGender(selectedText(form, 'cargo_sai'))),
                    row(FIELD_ICONS.permission, valueOf(form, 'perm_sai')),
                    row(FIELD_ICONS.reason, valueOf(form, 'motivo_sai')),
                    automaticDate,
                    accepted
                ];
            case 'form7':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_licpro'), true),
                    row(FIELD_ICONS.duration, `${valueOf(form, 'dias_licpro')} dias`),
                    row(FIELD_ICONS.permission, valueOf(form, 'perm_licpro')),
                    automaticDate,
                    accepted
                ];
            case 'form8':
                return [row(FIELD_ICONS.user, valueOf(form, 'nick_retlic'), true), automaticDate];
            case 'form9':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_mig'), true),
                    row(FIELD_ICONS.group, selectedText(form, 'corpo_mig')),
                    automaticDate
                ];
            case 'form10':
                return [
                    row(FIELD_ICONS.user, transition(valueOf(form, 'nick_atual_transf'), valueOf(form, 'nick_novo_transf')), true),
                    row(FIELD_ICONS.role, roleWithGender(selectedText(form, 'cargo_transf'))),
                    automaticDate
                ];
            case 'form11':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_reint'), true),
                    row(FIELD_ICONS.permission, valueOf(form, 'perm_reint')),
                    automaticDate
                ];
            case 'form13':
                return [
                    row(FIELD_ICONS.user, valueOf(form, 'nick_conselho'), true),
                    row(FIELD_ICONS.movement, transition(selectedText(form, 'conselho_atual'), selectedText(form, 'conselho_novo'))),
                    automaticDate
                ];
            default:
                return [];
        }
    };

    const buildForForm = (formId, form, options = {}) => {
        const visual = REQUEST_VISUALS[formId];
        if (!visual) return '';
        return buildRequestCard({
            title: options.title || visual.title,
            badgeIcon: options.icon || visual.icon,
            rows: options.rows || rowsForForm(formId, form),
            accent: options.accent || '#A22CA9'
        });
    };

    gatherFormData = function () {
        if (!activeFormGlobal) return '';
        const form = activeFormGlobal.querySelector('form');
        if (!form || !validateForm($(form))) return null;
        return buildForForm(activeFormGlobal.id, form);
    };

    const subgroupRows = (formId, form, permission = '') => {
        const rows = rowsForForm(formId, form);
        if (!permission) return rows;
        return rows.map((item, index) => index === 2 ? row(FIELD_ICONS.permission, permission) : item);
    };

    const subgroupCard = (formId, form, group, permission = '') => {
        const visual = REQUEST_VISUALS[formId];
        const suffix = formId === 'form8' ? 'RETORNO DE LICENÇA/RESERVA'
            : formId === 'form7' ? 'PROLONGAMENTO DE LICENÇA/RESERVA'
            : 'LICENÇA/RESERVA';
        return buildRequestCard({
            title: suffix,
            badgeIcon: visual.icon,
            rows: subgroupRows(formId, form, permission),
            accent: CONFIG.subgroups[group].color
        });
    };

    const interceptSpecialRequest = (formId, handler) => {
        const form = document.querySelector(`#${formId} form`);
        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            handler(form);
        }, true);
    };

    interceptSpecialRequest('form3', (form) => {
        if (!validateForm($(form))) {
            showCustomModal('Atenção!', 'Por favor, preencha todos os campos obrigatórios.', { icon: 'warning' });
            return;
        }
        setSubmitButtonLoading(form);
        const nickname = valueOf(form, 'nick_lic');
        const days = valueOf(form, 'dias_lic');
        const permission = valueOf(form, 'perm_lic');
        const posts = [{ topic: CONFIG.mainTopicId, message: buildForForm('form3', form), name: 'Companhia dos Professores' }];
        if (form.querySelector('#post_subgrupos')?.checked) {
            [['spp', 'perm_spp'], ['cdc', 'perm_cdc'], ['da', 'perm_da']].forEach(([group, field]) => {
                const groupPermission = valueOf(form, field);
                if (groupPermission) posts.push({ topic: CONFIG.subgroups[group].topicId, message: subgroupCard('form3', form, group, groupPermission), name: group.toUpperCase() });
            });
        }
        queueAppsScriptSubmission(form, { forumPosts: posts });
        registrarLicencaFirebase(nickname, days, permission);
        postWithDelay(posts);
    });

    interceptSpecialRequest('form7', (form) => {
        if (!validateForm($(form))) {
            showCustomModal('Atenção!', 'Por favor, preencha todos os campos obrigatórios.', { icon: 'warning' });
            return;
        }
        setSubmitButtonLoading(form);
        const nickname = valueOf(form, 'nick_licpro');
        const days = valueOf(form, 'dias_licpro');
        const permission = valueOf(form, 'perm_licpro');
        const posts = [{ topic: CONFIG.mainTopicId, message: buildForForm('form7', form), name: 'Companhia dos Professores' }];
        if (form.querySelector('#prolong_post_subgrupos')?.checked) {
            [['spp', 'perm_spp_prolong'], ['cdc', 'perm_cdc_prolong'], ['da', 'perm_da_prolong']].forEach(([group, field]) => {
                const groupPermission = valueOf(form, field);
                if (groupPermission) posts.push({ topic: CONFIG.subgroups[group].topicId, message: subgroupCard('form7', form, group, groupPermission), name: group.toUpperCase() });
            });
        }
        queueAppsScriptSubmission(form, { forumPosts: posts });
        registrarLicencaFirebase(nickname, days, permission);
        postWithDelay(posts);
    });

    interceptSpecialRequest('form8', (form) => {
        if (!validateForm($(form))) {
            showCustomModal('Atenção!', 'Por favor, preencha o seu nickname.', { icon: 'warning' });
            return;
        }
        setSubmitButtonLoading(form);
        const nickname = valueOf(form, 'nick_retlic');
        const posts = [{ topic: CONFIG.mainTopicId, message: buildForForm('form8', form), name: 'Companhia dos Professores' }];
        if (form.querySelector('#retorno_post_subgrupos')?.checked) {
            [['spp', 'post_retorno_spp'], ['cdc', 'post_retorno_cdc'], ['da', 'post_retorno_da']].forEach(([group, field]) => {
                if (form.querySelector(`[name="${field}"]`)?.checked) {
                    posts.push({ topic: CONFIG.subgroups[group].topicId, message: subgroupCard('form8', form, group), name: group.toUpperCase() });
                }
            });
        }
        queueAppsScriptSubmission(form, { forumPosts: posts });
        registrarRetornoFirebase(nickname);
        postWithDelay(posts);
    });

    const buildUpdateStamp = (tag) => `[table style="width: 45%; max-width: 900px; margin: 0 auto; border: none!important; position: relative; border-radius: 14px;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: visible"][table style="width: 100%; border: none!important; border-radius: 14px; overflow: hidden; position: relative;" bgcolor="#24102A"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: hidden"][table style="width: auto; height: auto; border: none!important; position: absolute; top: -20px; right: -15px; z-index: 1; overflow: visible; opacity: 0.12; display: inline-block;"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1"]<img src="https://i.imgur.com/D1mUb7O.png" style="width: 170px; height: auto; display: block;">[/td][/tr][/table][table style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; background: transparent;"][tr style="border: none!important"][td style="border: none!important; padding: 16px 18px 16px 30px; vertical-align: middle; color: #FFFFFF; font-size: 13.5px; line-height: 1.5em; font-family: 'Bebas Neue', Arial, sans-serif; text-align: justify"][size=20]ATUALIZAÇÃO [color=#E0A6E8][${tag}][/color][/size]\n[color=#B7A6BC][font=Nunito][size=12]Em casos de dúvidas ou possíveis falhas, contate um estagiário+[/size][/font][/color][/td][/tr][/table][/td][/tr][/table][table style="border: none!important; width: 52px; height: 52px; border-radius: 20%; overflow: hidden; position: absolute; left: -29px; top: 42%; margin-top: -19px; z-index: 5" bgcolor="#821F88"][tr style="border: none!important"][td style="border: none!important; text-align: center; vertical-align: middle; color: #FFFFFF; font-size: 14px; height: 32px"]<img src="https://i.imgur.com/Mkcivh7.png">[/td][/tr][/table][/td][/tr][/table]`;

    document.getElementById('attlist_postagem')?.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const form = this;
        const button = form.querySelector('button[type="submit"]');
        const tagInput = document.getElementById('attlist_tag');
        const tag = tagInput?.value?.trim() || '';

        if (Array.from(tag).length !== 3) {
            tagInput?.classList.add('invalid');
            showCustomModal('Atenção!', tag ? 'A TAG deve conter exatamente 3 caracteres.' : 'Preencha o campo TAG!', { icon: 'warning' });
            button?.classList.remove('loading');
            if (button) button.disabled = false;
            return;
        }

        tagInput.classList.remove('invalid');
        setSubmitButtonLoading(form);
        const message = buildUpdateStamp(tag);
        const posts = [{ topic: CONFIG.mainTopicId, name: 'Companhia dos Professores', message }];
        queueAppsScriptSubmission(form, { forumPosts: posts });
        document.getElementById('fa-generated-message').value = message;
        showForumPostProgress(posts, 0, 'sending');
        postToForum({ t: CONFIG.mainTopicId, message, mode: 'reply', post: 1 })
            .done(() => {
                showForumPostProgress(posts, 0, 'sent');
                tagInput.value = '';
                showSubmissionDestinationModal(false, 'Atualização enviada!', posts);
            })
            .fail((xhr, status, error) => {
                console.error('❌ Erro ao postar atualização:', error);
                showCustomModal('Erro!', 'Erro ao postar atualização! Tente novamente.', { icon: 'error' });
                button?.classList.remove('loading');
                if (button) button.disabled = false;
            });
    }, true);
})();
(() => {
    const selectInstances = [];
    const calendarInstances = [];

    const closeSelects = (exception = null) => {
        selectInstances.forEach((instance) => {
            if (instance !== exception) instance.close(false);
        });
    };

    const closeCalendars = (exception = null) => {
        calendarInstances.forEach((instance) => {
            if (instance !== exception) instance.close(false);
        });
    };

    document.querySelectorAll('.form-container select.input-field').forEach((select, index) => {
        if (select.dataset.customSelect === 'true') return;
        select.dataset.customSelect = 'true';
        select.classList.add('native-select-control');

        const fieldGroup = select.closest('.field-group');
        const formContainer = fieldGroup?.closest('.form-container');
        const label = fieldGroup?.querySelector('.field-label');
        const container = document.createElement('div');
        const trigger = document.createElement('button');
        const valueLabel = document.createElement('span');
        const chevron = document.createElement('i');
        const menu = document.createElement('div');
        const menuId = `${select.id || `custom-select-${index + 1}`}-menu`;
        const triggerId = `${select.id || `custom-select-${index + 1}`}-trigger`;

        container.className = 'custom-select';
        trigger.type = 'button';
        trigger.id = triggerId;
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', menuId);
        trigger.setAttribute('aria-required', String(select.required));
        chevron.className = 'fas fa-chevron-down';
        chevron.setAttribute('aria-hidden', 'true');
        menu.id = menuId;
        menu.className = 'custom-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;

        select.parentNode.insertBefore(container, select);
        container.append(select, trigger, menu);
        trigger.append(valueLabel, chevron);
        if (label) label.htmlFor = triggerId;

        const optionButtons = [];
        Array.from(select.options).forEach((option) => {
            if (!option.value && option.disabled) return;

            const optionButton = document.createElement('button');
            const optionText = document.createElement('span');
            const check = document.createElement('i');

            optionButton.type = 'button';
            optionButton.className = 'custom-select-option';
            optionButton.setAttribute('role', 'option');
            optionButton.dataset.value = option.value;
            optionButton.disabled = option.disabled;
            optionText.textContent = option.textContent.trim();
            check.className = 'fas fa-check';
            check.setAttribute('aria-hidden', 'true');
            optionButton.append(optionText, check);
            menu.append(optionButton);
            optionButtons.push(optionButton);

            optionButton.addEventListener('click', () => {
                if (optionButton.disabled) return;
                select.value = option.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                update();
                close(true);
            });
        });

        const update = () => {
            const selectedOption = select.options[select.selectedIndex] || select.options[0];
            const hasValue = Boolean(select.value);
            valueLabel.textContent = selectedOption?.textContent?.trim() || 'Selecione uma opção';
            trigger.dataset.placeholder = String(!hasValue);
            trigger.disabled = select.disabled;
            trigger.classList.toggle('is-invalid', false);
            optionButtons.forEach((button) => {
                button.setAttribute('aria-selected', String(button.dataset.value === select.value));
            });
        };

        const open = () => {
            if (select.disabled) return;
            closeSelects(instance);
            closeCalendars();
            container.classList.add('is-open');
            container.classList.remove('opens-upward');
            fieldGroup?.classList.add('control-open');
            formContainer?.classList.add('control-layer-open');
            trigger.setAttribute('aria-expanded', 'true');
            menu.hidden = false;
            const selectedButton = optionButtons.find((button) => button.getAttribute('aria-selected') === 'true' && !button.disabled)
                || optionButtons.find((button) => !button.disabled);
            requestAnimationFrame(() => {
                const triggerRect = trigger.getBoundingClientRect();
                const naturalHeight = Math.min(menu.scrollHeight, 272);
                const spaceBelow = window.innerHeight - triggerRect.bottom - 12;
                const spaceAbove = triggerRect.top - 12;
                const openUpward = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
                const availableSpace = openUpward ? spaceAbove : spaceBelow;

                container.classList.toggle('opens-upward', openUpward);
                menu.style.maxHeight = `${Math.max(112, Math.min(272, availableSpace - 8))}px`;
                if (selectedButton) {
                    const optionTop = selectedButton.offsetTop;
                    const optionBottom = optionTop + selectedButton.offsetHeight;
                    if (optionTop < menu.scrollTop) menu.scrollTop = optionTop;
                    else if (optionBottom > menu.scrollTop + menu.clientHeight) {
                        menu.scrollTop = optionBottom - menu.clientHeight;
                    }
                    selectedButton.focus({ preventScroll: true });
                }
            });
        };

        const close = (restoreFocus = false) => {
            if (!container.classList.contains('is-open')) return;
            container.classList.remove('is-open');
            container.classList.remove('opens-upward');
            fieldGroup?.classList.remove('control-open');
            formContainer?.classList.remove('control-layer-open');
            trigger.setAttribute('aria-expanded', 'false');
            menu.hidden = true;
            menu.style.maxHeight = '';
            if (restoreFocus) trigger.focus();
        };

        const instance = { container, close };
        selectInstances.push(instance);

        trigger.addEventListener('click', () => {
            if (container.classList.contains('is-open')) close(false);
            else open();
        });

        trigger.addEventListener('keydown', (event) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                open();
            }
        });

        menu.addEventListener('keydown', (event) => {
            const enabledOptions = optionButtons.filter((button) => !button.disabled);
            const currentIndex = enabledOptions.indexOf(document.activeElement);
            let nextIndex = currentIndex;

            if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, enabledOptions.length - 1);
            else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0);
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = enabledOptions.length - 1;
            else if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
                return;
            } else if (event.key === 'Tab') {
                close(false);
                return;
            } else {
                return;
            }

            event.preventDefault();
            enabledOptions[nextIndex]?.focus();
        });

        select.addEventListener('change', update);
        select.addEventListener('invalid', (event) => {
            event.preventDefault();
            trigger.classList.add('is-invalid');
            trigger.focus();
        });
        select.form?.addEventListener('reset', () => setTimeout(update, 0));
        update();
    });

    const padDatePart = (value) => String(value).padStart(2, '0');
    const toISODate = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
    const parseISODate = (value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Number.isNaN(date.getTime()) ? null : date;
    };

    document.querySelectorAll('.form-container input[type="date"].input-field').forEach((input, index) => {
        if (input.dataset.customCalendar === 'true') return;
        input.dataset.customCalendar = 'true';
        input.classList.add('enhanced-date-input');

        const fieldGroup = input.closest('.field-group');
        const formContainer = fieldGroup?.closest('.form-container');
        const control = document.createElement('div');
        const toggle = document.createElement('button');
        const panel = document.createElement('div');
        const panelId = `${input.id || `custom-date-${index + 1}`}-calendar`;

        control.className = 'custom-date-control';
        toggle.type = 'button';
        toggle.className = 'custom-calendar-toggle';
        toggle.setAttribute('aria-label', 'Abrir calendário');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', panelId);
        toggle.innerHTML = '<i class="far fa-calendar-alt" aria-hidden="true"></i>';
        panel.id = panelId;
        panel.className = 'custom-calendar';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Escolher data');
        panel.hidden = true;
        panel.innerHTML = `
            <div class="custom-calendar-header">
                <button type="button" class="custom-calendar-nav" data-calendar-prev aria-label="Mês anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                <div class="custom-calendar-title" aria-live="polite"></div>
                <button type="button" class="custom-calendar-nav" data-calendar-next aria-label="Próximo mês"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
            </div>
            <div class="custom-calendar-weekdays" aria-hidden="true">
                <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
            </div>
            <div class="custom-calendar-days" role="grid"></div>
            <div class="custom-calendar-footer">
                <button type="button" class="custom-calendar-action" data-calendar-clear>Limpar</button>
                <button type="button" class="custom-calendar-action" data-calendar-today>Hoje</button>
            </div>`;

        input.parentNode.insertBefore(control, input);
        control.append(input, toggle, panel);

        const title = panel.querySelector('.custom-calendar-title');
        const daysGrid = panel.querySelector('.custom-calendar-days');
        const previousButton = panel.querySelector('[data-calendar-prev]');
        const nextButton = panel.querySelector('[data-calendar-next]');
        const clearButton = panel.querySelector('[data-calendar-clear]');
        const todayButton = panel.querySelector('[data-calendar-today]');
        const today = new Date();
        let viewDate = parseISODate(input.value) || new Date(today.getFullYear(), today.getMonth(), 1);

        const isDateDisabled = (isoDate) => Boolean((input.min && isoDate < input.min) || (input.max && isoDate > input.max));

        const render = () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const gridStart = new Date(year, month, 1 - firstDay.getDay());
            const selectedDate = input.value;
            const todayDate = toISODate(today);
            const monthText = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

            title.textContent = monthText.charAt(0).toLocaleUpperCase('pt-BR') + monthText.slice(1);
            daysGrid.replaceChildren();

            for (let dayIndex = 0; dayIndex < 42; dayIndex += 1) {
                const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayIndex);
                const isoDate = toISODate(date);
                const dayButton = document.createElement('button');

                dayButton.type = 'button';
                dayButton.className = 'custom-calendar-day';
                dayButton.textContent = String(date.getDate());
                dayButton.dataset.date = isoDate;
                dayButton.setAttribute('role', 'gridcell');
                dayButton.setAttribute('aria-label', date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
                dayButton.classList.toggle('is-outside', date.getMonth() !== month);
                dayButton.classList.toggle('is-today', isoDate === todayDate);
                dayButton.classList.toggle('is-selected', isoDate === selectedDate);
                dayButton.setAttribute('aria-selected', String(isoDate === selectedDate));
                dayButton.disabled = isDateDisabled(isoDate);
                dayButton.addEventListener('click', () => {
                    input.value = isoDate;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
                    render();
                    close(true);
                });
                daysGrid.append(dayButton);
            }
        };

        const open = () => {
            closeSelects();
            closeCalendars(instance);
            const selected = parseISODate(input.value);
            if (selected) viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
            render();
            control.classList.add('is-open');
            control.classList.remove('opens-upward');
            fieldGroup?.classList.add('control-open');
            formContainer?.classList.add('control-layer-open');
            toggle.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            requestAnimationFrame(() => {
                const inputRect = input.getBoundingClientRect();
                const panelHeight = panel.offsetHeight;
                const spaceBelow = window.innerHeight - inputRect.bottom - 12;
                const spaceAbove = inputRect.top - 12;
                control.classList.toggle('opens-upward', spaceBelow < panelHeight && spaceAbove > spaceBelow);

                const focusTarget = panel.querySelector('.custom-calendar-day.is-selected')
                    || panel.querySelector('.custom-calendar-day:not(:disabled)');
                focusTarget?.focus({ preventScroll: true });
            });
        };

        const close = (restoreFocus = false) => {
            if (!control.classList.contains('is-open')) return;
            control.classList.remove('is-open');
            control.classList.remove('opens-upward');
            fieldGroup?.classList.remove('control-open');
            formContainer?.classList.remove('control-layer-open');
            toggle.setAttribute('aria-expanded', 'false');
            panel.hidden = true;
            if (restoreFocus) input.focus();
        };

        const instance = { control, close };
        calendarInstances.push(instance);

        const toggleCalendar = () => {
            if (control.classList.contains('is-open')) close(false);
            else open();
        };

        input.addEventListener('click', (event) => {
            event.preventDefault();
            toggleCalendar();
        });
        input.addEventListener('keydown', (event) => {
            if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                open();
            }
        });
        input.addEventListener('change', () => {
            const selected = parseISODate(input.value);
            if (selected) viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
            render();
        });
        toggle.addEventListener('click', toggleCalendar);
        panel.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
            }
        });
        previousButton.addEventListener('click', () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
            render();
        });
        nextButton.addEventListener('click', () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
            render();
        });
        clearButton.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            close(true);
        });
        todayButton.addEventListener('click', () => {
            const todayValue = toISODate(today);
            if (isDateDisabled(todayValue)) return;
            input.value = todayValue;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
            render();
            close(true);
        });
        input.form?.addEventListener('reset', () => setTimeout(() => {
            viewDate = parseISODate(input.value) || new Date(today.getFullYear(), today.getMonth(), 1);
            render();
        }, 0));
        render();
    });

    document.addEventListener('pointerdown', (event) => {
        selectInstances.forEach((instance) => {
            if (!instance.container.contains(event.target)) instance.close(false);
        });
        calendarInstances.forEach((instance) => {
            if (!instance.control.contains(event.target)) instance.close(false);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeSelects();
        closeCalendars();
    });
})();
(() => {
    const toast = document.getElementById('profToast');
    const toastIcon = toast?.querySelector('.prof-toast-icon i');
    const toastTitle = document.getElementById('profToastTitle');
    const toastMessage = document.getElementById('profToastMessage');
    const toastClose = document.getElementById('profToastClose');
    const legacyOverlay = document.getElementById('customModalOverlay');
    let autoCloseTimer = null;
    let finishTimer = null;

    if (!toast || !toastIcon || !toastTitle || !toastMessage || !toastClose) return;

    const iconClasses = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const closeToast = () => {
        clearTimeout(autoCloseTimer);
        if (toast.hidden || toast.classList.contains('is-exiting')) return;
        toast.classList.remove('is-entering');
        toast.classList.add('is-exiting');
        finishTimer = setTimeout(() => {
            toast.hidden = true;
            toast.classList.remove('is-exiting');
        }, 640);
    };

    const showToast = (title, message, options = {}) => {
        clearTimeout(autoCloseTimer);
        clearTimeout(finishTimer);

        const type = ['success', 'error', 'warning', 'info'].includes(options.icon)
            ? options.icon
            : 'success';

        const originalTitle = title || '';
        toast.dataset.type = type;
        toastIcon.className = iconClasses[type];
        toastTitle.textContent = '';
        toastTitle.hidden = true;
        toastMessage.innerHTML = message || '';
        toastClose.hidden = false;
        toast.hidden = false;
        toast.classList.remove('is-entering', 'is-exiting');
        void toast.offsetWidth;
        toast.classList.add('is-entering');

        if (/atualiza[cç][aã]o enviada/i.test(originalTitle)) {
            document.querySelectorAll('.tag-character-input').forEach((field) => { field.value = ''; });
            const hiddenTag = document.getElementById('attlist_tag');
            if (hiddenTag) {
                hiddenTag.value = '';
                hiddenTag.classList.remove('invalid');
            }
        }

        const requestedDuration = Number(options.timer);
        if (Number.isFinite(requestedDuration) && requestedDuration > 0) {
            autoCloseTimer = setTimeout(closeToast, Math.max(requestedDuration, 2200));
        }
    };

    toastClose.addEventListener('click', closeToast);
    window.showCustomModal = showToast;
    window.hideCustomModal = closeToast;
    try {
        showCustomModal = showToast;
        hideCustomModal = closeToast;
    } catch {}
    window.alert = (message) => showToast(
        'Atenção',
        String(message ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[character]),
        { icon: 'warning', buttons: false, timer: 5200 }
    );

    if (legacyOverlay) {
        const legacyObserver = new MutationObserver(() => {
            if (!legacyOverlay.classList.contains('show')) return;
            legacyOverlay.classList.remove('show');
            const legacyTitle = document.getElementById('modalTitle')?.textContent || 'Notificação';
            const legacyMessage = document.getElementById('modalText')?.innerHTML || '';
            const legacyIcon = document.querySelector('.modal-icon i')?.className || '';
            const type = legacyIcon.includes('times') ? 'error'
                : legacyIcon.includes('triangle') ? 'warning'
                    : legacyIcon.includes('info') ? 'info'
                        : 'success';
            showToast(legacyTitle, legacyMessage, { icon: type });
        });
        legacyObserver.observe(legacyOverlay, { attributes: true, attributeFilter: ['class'] });
    }
})();
