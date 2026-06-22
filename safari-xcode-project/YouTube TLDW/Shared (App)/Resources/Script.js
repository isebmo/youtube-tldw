// ----- i18n ----------------------------------------------------------------
const I18N_DICT = {
    en: {
        "home.title": "Summarize a YouTube video",
        "home.sub": "Paste a link or share a video from the YouTube app.",
        "home.summarize": "Summarize",
        "loading.transcript": "Fetching transcript…",
        "loading.summarizing": "Generating summary with {service}…",
        "history.title": "History",
        "history.clearAll": "Clear all",
        "history.empty": "No summaries yet.",
        "history.confirmClear": "Clear all history?",
        "history.open": "Open",
        "history.copy": "Copy",
        "history.delete": "Delete",
        "history.defaultTitle": "Video",
        "settings.title": "Settings",
        "settings.language": "Language",
        "settings.languageAuto": "Automatic (system)",
        "settings.aiService": "AI service",
        "settings.serviceApple": "Apple Intelligence (on device)",
        "settings.appleHint": "Runs on your device — no API key needed.",
        "settings.appleUnavailable": "not available on this device",
        "settings.apiKey": "API key",
        "settings.openrouterModel": "OpenRouter model",
        "settings.openrouterHint": "Leave empty to use the default. See openrouter.ai/models for available IDs.",
        "settings.customInstructions": "Custom instructions (optional)",
        "settings.customInstructionsPlaceholder": "E.g. Reply in English, add a “key points” section…",
        "settings.save": "Save",
        "settings.saved": "Saved.",
        "settings.upgradeBtn": "Upgrade to Premium",
        "settings.restoreBtn": "Restore purchase",
        "settings.apiKeyMissing": "Set your API key in Settings.",
        "trial.premium": "Premium · unlimited access",
        "trial.active": "Free trial · {days} day{plural} left",
        "trial.expired": "Trial expired · Premium required",
        "trial.upgradePriced": "Upgrade to Premium · {price}",
        "paywall.expiredTitle": "Free trial ended",
        "paywall.expiredSub": "To keep summarizing videos, unlock YouTube TLDW; Premium.",
        "paywall.upgradeTitle": "Upgrade to Premium",
        "paywall.upgradeSub": "Unlimited summaries, one-time purchase.",
        "paywall.buy": "Buy Premium",
        "paywall.buyPriced": "Buy Premium · {price}",
        "paywall.restore": "Restore purchases",
        "paywall.purchasing": "Purchasing…",
        "toast.premiumActivated": "Premium activated. Thank you!",
        "toast.purchaseCanceled": "Purchase canceled.",
        "toast.purchaseRestored": "Purchase restored.",
        "toast.noPurchase": "No purchase found.",
        "toast.summaryCopied": "Summary copied.",
        "result.copy": "Copy",
        "result.viewYT": "View on YouTube",
        "about.versionPrefix": "YouTube TLDW; — version",
        "about.sharedKey": "The Safari extension uses the same API key.",
        "tab.home": "Home",
        "tab.history": "History",
        "tab.settings": "Settings",
        "error.prefix": "Error: {msg}",
        "error.apiKeyMissing": "API key missing. Go to Settings.",
        "error.unsupportedService": "Unsupported AI service: {service}",
        "error.noSummary": "{service} returned no summary.",
        "error.invalidYTLink": "Invalid YouTube link.",
        "error.cantLoadYT": "Could not load the YouTube page.",
        "error.cantFindKey": "Could not find the InnerTube key.",
        "error.innertubeStatus": "InnerTube API returned {status}",
        "error.noCaptions": "This video has no captions.",
        "error.videoUnavailable": "Video unavailable."
    },
    fr: {
        "home.title": "Résumer une vidéo YouTube",
        "home.sub": "Colle un lien ou partage une vidéo depuis l'app YouTube.",
        "home.summarize": "Résumer",
        "loading.transcript": "Récupération du transcript…",
        "loading.summarizing": "Génération du résumé avec {service}…",
        "history.title": "Historique",
        "history.clearAll": "Tout effacer",
        "history.empty": "Aucun résumé pour l'instant.",
        "history.confirmClear": "Effacer tout l'historique ?",
        "history.open": "Ouvrir",
        "history.copy": "Copier",
        "history.delete": "Supprimer",
        "history.defaultTitle": "Vidéo",
        "settings.title": "Réglages",
        "settings.language": "Langue",
        "settings.languageAuto": "Automatique (système)",
        "settings.aiService": "Service d'IA",
        "settings.serviceApple": "Apple Intelligence (sur l'appareil)",
        "settings.appleHint": "Fonctionne sur votre appareil — aucune clé API requise.",
        "settings.appleUnavailable": "indisponible sur cet appareil",
        "settings.apiKey": "Clé API",
        "settings.openrouterModel": "Modèle OpenRouter",
        "settings.openrouterHint": "Laisse vide pour utiliser le modèle par défaut. Voir openrouter.ai/models pour les identifiants disponibles.",
        "settings.customInstructions": "Instructions personnalisées (optionnel)",
        "settings.customInstructionsPlaceholder": "Ex. Réponds en français, ajoute une section « points clés »…",
        "settings.save": "Enregistrer",
        "settings.saved": "Enregistré.",
        "settings.upgradeBtn": "Passer à Premium",
        "settings.restoreBtn": "Restaurer l'achat",
        "settings.apiKeyMissing": "Configure ta clé API dans Réglages.",
        "trial.premium": "Premium · accès illimité",
        "trial.active": "Essai gratuit · {days} jour{plural} restant{plural}",
        "trial.expired": "Essai expiré · Premium requis",
        "trial.upgradePriced": "Passer à Premium · {price}",
        "paywall.expiredTitle": "Essai gratuit terminé",
        "paywall.expiredSub": "Pour continuer à résumer des vidéos, débloque YouTube TLDW; Premium.",
        "paywall.upgradeTitle": "Passer à Premium",
        "paywall.upgradeSub": "Résumés illimités, achat unique.",
        "paywall.buy": "Acheter Premium",
        "paywall.buyPriced": "Acheter Premium · {price}",
        "paywall.restore": "Restaurer les achats",
        "paywall.purchasing": "Achat en cours…",
        "toast.premiumActivated": "Premium activé. Merci !",
        "toast.purchaseCanceled": "Achat annulé.",
        "toast.purchaseRestored": "Achat restauré.",
        "toast.noPurchase": "Aucun achat trouvé.",
        "toast.summaryCopied": "Résumé copié.",
        "result.copy": "Copier",
        "result.viewYT": "Voir sur YouTube",
        "about.versionPrefix": "YouTube TLDW; — version",
        "about.sharedKey": "L'extension Safari utilise la même clé API.",
        "tab.home": "Accueil",
        "tab.history": "Historique",
        "tab.settings": "Réglages",
        "error.prefix": "Erreur : {msg}",
        "error.apiKeyMissing": "Clé API manquante. Va dans Réglages.",
        "error.unsupportedService": "Service d'IA non pris en charge : {service}",
        "error.noSummary": "Aucun résumé renvoyé par {service}.",
        "error.invalidYTLink": "Lien YouTube invalide.",
        "error.cantLoadYT": "Impossible de charger la page YouTube.",
        "error.cantFindKey": "Impossible de trouver la clé InnerTube.",
        "error.innertubeStatus": "L'API InnerTube a renvoyé {status}",
        "error.noCaptions": "Cette vidéo n'a pas de sous-titres.",
        "error.videoUnavailable": "Vidéo indisponible."
    }
};

const I18N = {
    locale: 'en',
    resolveLocale(stored) {
        if (stored && stored !== 'auto' && I18N_DICT[stored]) return stored;
        const sys = (navigator.language || 'en').slice(0, 2).toLowerCase();
        return I18N_DICT[sys] ? sys : 'en';
    },
    setLocale(stored) {
        this.locale = this.resolveLocale(stored);
        document.documentElement.lang = this.locale;
    },
    t(key, vars) {
        const dict = I18N_DICT[this.locale] || I18N_DICT.en;
        let str = dict[key] || I18N_DICT.en[key] || key;
        if (vars) {
            for (const k in vars) {
                // Function replacement: keeps '$&'-style patterns in values literal.
                str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), () => vars[k]);
            }
        }
        return str;
    },
    hydrate(root) {
        (root || document).querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = this.t(el.dataset.i18n);
        });
        (root || document).querySelectorAll('[data-i18n-attr-placeholder]').forEach(el => {
            el.placeholder = this.t(el.dataset.i18nAttrPlaceholder);
        });
    }
};

const t = (key, vars) => I18N.t(key, vars);

// ----- IAP / Trial bridges -------------------------------------------------
const Entitlement = {
    cache: null,
    async refresh() {
        try {
            this.cache = await window.webkit.messageHandlers.refreshEntitlement.postMessage({});
        } catch (e) {
            this.cache = { premium: true, trialDaysRemaining: 0, trialActive: false };
        }
        return this.cache;
    },
    async get() { return this.cache || await this.refresh(); },
    canSummarize(ent) { return !!(ent && (ent.premium || ent.trialActive)); }
};

async function purchasePremium() {
    try { return await window.webkit.messageHandlers.purchasePremium.postMessage({}); }
    catch (e) { return { success: false }; }
}
async function restorePurchases() {
    try { return await window.webkit.messageHandlers.restorePurchases.postMessage({}); }
    catch (e) { return { success: false }; }
}

async function nativeFetch(url, options = {}) {
    const reply = await window.webkit.messageHandlers.nativeFetch.postMessage({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null
    });
    return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        text: () => Promise.resolve(reply.body),
        json: () => {
            try { return Promise.resolve(JSON.parse(reply.body)); }
            catch (e) { return Promise.reject(new Error('Invalid JSON: ' + reply.body.slice(0, 200))); }
        },
        headers: reply.headers
    };
}

function openExternal(url) {
    try { window.webkit.messageHandlers.openExternal.postMessage(url); }
    catch (e) { window.open(url, '_blank'); }
}

const Settings = {
    KEY: 'tldw.settings',
    defaults: { aiService: 'gemini', apiKey: '', userPrompt: '', openrouterModel: '', locale: 'auto' },
    cache: null,
    load() {
        if (this.cache) return this.cache;
        const native = (typeof window !== 'undefined') ? window.__INITIAL_SETTINGS__ : null;
        if (native && Object.keys(native).length > 0) {
            this.cache = Object.assign({}, this.defaults, native);
            return this.cache;
        }
        try { this.cache = Object.assign({}, this.defaults, JSON.parse(localStorage.getItem(this.KEY) || '{}')); }
        catch (e) { this.cache = { ...this.defaults }; }
        return this.cache;
    },
    save(values) {
        const merged = Object.assign({}, this.load(), values);
        this.cache = merged;
        localStorage.setItem(this.KEY, JSON.stringify(merged));
        try { window.webkit.messageHandlers.saveSettings.postMessage(merged); } catch (e) {}
        return merged;
    }
};

const History = {
    KEY: 'tldw.history',
    list() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
        catch (e) { return []; }
    },
    add(entry) {
        const all = this.list();
        const idx = all.findIndex(e => e.videoId === entry.videoId);
        if (idx >= 0) all.splice(idx, 1);
        all.unshift(entry);
        localStorage.setItem(this.KEY, JSON.stringify(all.slice(0, 200)));
    },
    remove(id) {
        const all = this.list().filter(e => e.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    },
    clear() { localStorage.removeItem(this.KEY); },
    get(id) { return this.list().find(e => e.id === id); }
};

class TranscriptFetcher {
    static INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player';
    static INNERTUBE_CONTEXT = { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } };

    static extractVideoId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
            const v = u.searchParams.get('v');
            if (v) return v;
            const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/);
            if (m) return m[2];
        } catch (e) {}
        throw new Error(t('error.invalidYTLink'));
    }

    static async _fetchInnertubeApiKey(html) {
        const m = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
        if (m && m[1]) return m[1];
        throw new Error(t('error.cantFindKey'));
    }

    static async _fetchInnertubeData(videoId, apiKey) {
        const res = await nativeFetch(`${this.INNERTUBE_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: this.INNERTUBE_CONTEXT, videoId })
        });
        if (!res.ok) throw new Error(t('error.innertubeStatus', { status: res.status }));
        return res.json();
    }

    static decodeHtmlEntities(text) {
        const ta = document.createElement('textarea');
        ta.innerHTML = text;
        return ta.value;
    }

    static formatTimestamp(seconds) {
        const t = Math.floor(parseFloat(seconds));
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    static toPlainText(segments) { return segments.map(s => s.text).join(' '); }

    static async getTranscript(videoUrl) {
        const videoId = this.extractVideoId(videoUrl);

        const pageRes = await nativeFetch(`https://www.youtube.com/watch?v=${videoId}`);
        if (!pageRes.ok) throw new Error(t('error.cantLoadYT'));
        const pageHtml = await pageRes.text();
        const apiKey = await this._fetchInnertubeApiKey(pageHtml);
        const data = await this._fetchInnertubeData(videoId, apiKey);

        const status = data.playabilityStatus?.status;
        if (status && status !== 'OK') {
            throw new Error(data.playabilityStatus?.reason || t('error.videoUnavailable'));
        }

        const captions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captions || captions.length === 0) throw new Error(t('error.noCaptions'));

        const track = captions.find(t => t.languageCode === 'fr')
            || captions.find(t => t.languageCode === 'en')
            || captions[0];
        const transcriptUrl = track.baseUrl.replace('&fmt=srv3', '');
        const xmlRes = await nativeFetch(transcriptUrl);
        const xmlText = await xmlRes.text();

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'text/xml');
        const nodes = xml.getElementsByTagName('text');
        const segments = [];
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const start = parseFloat(n.getAttribute('start') || '0');
            segments.push({
                text: this.decodeHtmlEntities(n.textContent),
                start,
                timestamp: this.formatTimestamp(start)
            });
        }

        const title = (data.videoDetails?.title) || `Video ${videoId}`;
        const author = data.videoDetails?.author || '';
        return { videoId, title, author, segments };
    }
}

const FIXED_PROMPT = `Please summarize the transcription of the YouTube video. Be precise and structured; the summary should allow the reader to avoid watching the video while still understanding all the points and details discussed. Give me the summary without any other sentence, the summary must be formatted in markdown.

Transcript:
{{transcript}}`;

// On-device Apple Intelligence: summarization runs natively, no API key.
async function summarizeApple(transcript, settings) {
    const reply = await window.webkit.messageHandlers.aiSummarize.postMessage({
        transcript,
        userPrompt: settings.userPrompt || '',
        lang: settings.locale || ''
    });
    if (!reply || !reply.summary) throw new Error(t('error.noSummary', { service: 'Apple Intelligence' }));
    return { summary: reply.summary, model: reply.model || 'Apple Intelligence' };
}

async function summarize(transcript, settings) {
    if (settings.aiService === 'apple') return summarizeApple(transcript, settings);
    if (!settings.apiKey) throw new Error(t('error.apiKeyMissing'));
    let prompt = FIXED_PROMPT.replace('{{transcript}}', transcript);
    if (settings.userPrompt) prompt += "\n\nAdditional instructions:\n" + settings.userPrompt;

    if (settings.aiService === 'gemini') return summarizeGemini(settings.apiKey, prompt);
    if (settings.aiService === 'openai' || settings.aiService === 'openrouter') {
        return summarizeOpenAICompatible(settings.aiService, settings.apiKey, prompt, settings.openrouterModel);
    }
    throw new Error(t('error.unsupportedService', { service: settings.aiService }));
}

async function summarizeGemini(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    const res = await nativeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) {
        let msg = `Gemini ${res.status}`;
        try { const j = await res.json(); msg = j.error?.message || msg; } catch (e) {}
        throw new Error(msg);
    }
    const data = await res.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) throw new Error(t('error.noSummary', { service: 'Gemini' }));
    return { summary, model: 'gemini-3.1-flash-lite' };
}

async function summarizeOpenAICompatible(service, apiKey, prompt, openrouterModel) {
    let url, model;
    if (service === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-5-mini';
    } else {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        model = (openrouterModel || '').trim() || 'google/gemini-2.5-flash';
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    if (service === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/sebastienmouret/firefox-ext-yt';
        headers['X-Title'] = 'YouTube TLDW';
    }
    const res = await nativeFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) {
        let msg = `${service} ${res.status}`;
        try { const j = await res.json(); msg = j.error?.message || msg; } catch (e) {}
        throw new Error(msg);
    }
    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content;
    if (!summary) throw new Error(t('error.noSummary', { service }));
    return { summary, model };
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^[ \t]+[\-\*] (.+)$/gm, '<uli2>$1</uli2>');
    html = html.replace(/^[\-\*] (.+)$/gm, '<uli>$1</uli>');
    html = html.replace(/^[ \t]+\d+\. (.+)$/gm, '<oli2>$1</oli2>');
    html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/((?:<uli2>[\s\S]*?<\/uli2>\n?)+)/g, '<ul>$1</ul>');
    html = html.replace(/((?:<oli2>[\s\S]*?<\/oli2>\n?)+)/g, '<ol>$1</ol>');
    html = html.replace(/((?:<uli>[\s\S]*?<\/uli>\n?)+)/g, '<ul>$1</ul>');
    html = html.replace(/((?:<oli>[\s\S]*?<\/oli>\n?)+)/g, '<ol>$1</ol>');
    html = html.replace(/<(\/?)[uo]li2?>/g, '<$1li>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*(<(?:h[2-5]|ul|ol|hr)[^>]*>)/g, '$1');
    html = html.replace(/(<\/(?:h[2-5]|ul|ol|hr)>)\s*<\/p>/g, '$1');
    html = html.replace(/\n/g, '');
    return html;
}

const App = {
    el(id) { return document.getElementById(id); },

    init() {
        I18N.setLocale(Settings.load().locale);
        I18N.hydrate();
        this.bindNav();
        this.bindHome();
        this.bindSettings();
        this.bindHistory();
        this.bindUpgrade();
        this.loadSettingsForm();
        this.refreshHistoryList();

        window.handleDeepLink = (urlString) => this.handleDeepLink(urlString);

        // Hydrate entitlement and refresh the trial badge in Settings.
        Entitlement.refresh().then((ent) => this.renderTrialBadge(ent));
    },

    bindUpgrade() {
        const upgradeBtn = this.el('upgrade-btn');
        const restoreBtn = this.el('restore-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', async () => {
                upgradeBtn.disabled = true;
                upgradeBtn.textContent = t('paywall.purchasing');
                const res = await purchasePremium();
                Entitlement.cache = res;
                this.renderTrialBadge(res || {});
                upgradeBtn.disabled = false;
                if (res && res.premium) {
                    this.showToast(t('toast.premiumActivated'));
                } else if (res && res.success === false) {
                    this.showToast(t('toast.purchaseCanceled'));
                }
            });
        }
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async () => {
                const res = await restorePurchases();
                Entitlement.cache = res;
                this.renderTrialBadge(res || {});
                this.showToast(res && res.premium ? t('toast.purchaseRestored') : t('toast.noPurchase'));
            });
        }
    },

    renderTrialBadge(ent) {
        const status = this.el('trial-status');
        const upgradeRow = this.el('upgrade-row');
        const upgradeBtn = this.el('upgrade-btn');
        if (!status) return;
        if (ent.premium) {
            status.textContent = t('trial.premium');
            status.className = "trial-status trial-premium";
            if (upgradeRow) upgradeRow.hidden = true;
        } else if (ent.trialActive) {
            const days = ent.trialDaysRemaining;
            status.textContent = t('trial.active', { days, plural: days > 1 ? 's' : '' });
            status.className = "trial-status trial-active";
            if (upgradeRow) upgradeRow.hidden = false;
        } else {
            status.textContent = t('trial.expired');
            status.className = "trial-status trial-expired";
            if (upgradeRow) upgradeRow.hidden = false;
        }
        if (upgradeBtn) {
            upgradeBtn.textContent = ent.price ? t('trial.upgradePriced', { price: ent.price }) : t('settings.upgradeBtn');
        }
    },

    showPaywall(ent) {
        const expired = ent && !ent.premium && !ent.trialActive;
        const price = (ent && ent.price) || "";
        const buyLabel = price ? t('paywall.buyPriced', { price }) : t('paywall.buy');
        const html = `
            <div class="paywall">
                <div class="paywall-badge">${expired ? "⏱" : "✨"}</div>
                <h2 class="paywall-title">${expired ? t('paywall.expiredTitle') : t('paywall.upgradeTitle')}</h2>
                <p class="paywall-sub">${expired ? t('paywall.expiredSub') : t('paywall.upgradeSub')}</p>
                <button id="paywall-buy" class="primary-btn">${buyLabel}</button>
                <button id="paywall-restore" class="ghost-btn">${t('paywall.restore')}</button>
            </div>
        `;
        this.el('result-area').hidden = false;
        this.el('result-meta').innerHTML = '';
        this.el('result-actions').innerHTML = '';
        this.el('result-body').innerHTML = html;
        this.el('paywall-buy').addEventListener('click', async () => {
            const btn = this.el('paywall-buy');
            btn.disabled = true;
            btn.textContent = t('paywall.purchasing');
            const res = await purchasePremium();
            this.renderTrialBadge(res || {});
            if (res && res.premium) {
                this.showToast(t('toast.premiumActivated'));
                this.el('result-area').hidden = true;
            } else if (res && res.success === false) {
                btn.disabled = false;
                btn.textContent = buyLabel;
            }
        });
        this.el('paywall-restore').addEventListener('click', async () => {
            const res = await restorePurchases();
            this.renderTrialBadge(res || {});
            if (res && res.premium) {
                this.showToast(t('toast.purchaseRestored'));
                this.el('result-area').hidden = true;
            } else {
                this.showToast(t('toast.noPurchase'));
            }
        });
    },

    showToast(msg) {
        const t = this.el('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    },

    showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        if (name === 'history') this.refreshHistoryList();
    },

    bindNav() {
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => this.showView(btn.dataset.tab));
        });
    },

    bindHome() {
        this.el('url-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const url = this.el('url-input').value.trim();
            if (!url) return;
            this.summarizeFromUrl(url);
        });
    },

    async handleDeepLink(urlString) {
        let target = urlString;
        try {
            const u = new URL(urlString);
            const isUniversalLink = u.protocol === 'https:' && u.hostname === 'tldw.mouret.pro';
            if (u.protocol === 'tldw:' || isUniversalLink) {
                const inner = u.searchParams.get('url');
                if (inner) target = decodeURIComponent(inner);
            }
        } catch (e) {}
        this.el('url-input').value = target;
        this.showView('home');
        await this.summarizeFromUrl(target);
    },

    async summarizeFromUrl(url) {
        const ent = await Entitlement.get();
        if (!Entitlement.canSummarize(ent)) {
            this.showPaywall(ent);
            return;
        }
        const settings = Settings.load();
        if (settings.aiService !== 'apple' && !settings.apiKey) {
            this.showToast(t('settings.apiKeyMissing'));
            this.showView('settings');
            return;
        }

        this.hideError();
        this.el('result-area').hidden = true;
        const loadingEl = this.el('loading-area');
        const loadingText = this.el('loading-text');
        loadingEl.hidden = false;
        loadingText.textContent = t('loading.transcript');

        let entry = { id: 't_' + Date.now(), createdAt: Date.now(), url };

        try {
            const tr = await TranscriptFetcher.getTranscript(url);
            entry.videoId = tr.videoId;
            entry.title = tr.title;
            entry.author = tr.author;
            entry.transcript = TranscriptFetcher.toPlainText(tr.segments);

            const serviceLabel = settings.aiService === 'openai' ? 'OpenAI'
                : settings.aiService === 'openrouter' ? 'OpenRouter'
                : settings.aiService === 'apple' ? 'Apple Intelligence'
                : 'Gemini';
            loadingText.textContent = t('loading.summarizing', { service: serviceLabel });
            const r = await summarize(entry.transcript, settings);
            entry.summary = r.summary;
            entry.model = r.model;

            History.add(entry);
            loadingEl.hidden = true;
            this.renderResult(entry);
        } catch (err) {
            loadingEl.hidden = true;
            this.showError(err.message || String(err));
        }
    },

    renderResult(entry) {
        this.el('result-area').hidden = false;

        this.el('result-meta').innerHTML = `
            <div class="video-title" title="${escapeAttr(entry.title)}">${escapeText(entry.title)}</div>
            ${entry.model ? `<span class="badge">${escapeText(entry.model)}</span>` : ''}
        `;

        this.el('result-actions').innerHTML = `
            <button class="icon-btn" id="copy-summary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>${t('result.copy')}</button>
            <button class="icon-btn" id="open-yt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5"/></svg>${t('result.viewYT')}</button>
        `;
        this.el('copy-summary').addEventListener('click', () => {
            navigator.clipboard.writeText(entry.summary).then(() => this.showToast(t('toast.summaryCopied')));
        });
        this.el('open-yt').addEventListener('click', () => openExternal(entry.url));

        this.el('result-body').innerHTML = renderMarkdown(entry.summary);
        this.el('result-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    showError(msg) {
        const e = this.el('error-area');
        e.textContent = t('error.prefix', { msg });
        e.hidden = false;
    },
    hideError() { this.el('error-area').hidden = true; },

    bindSettings() {
        const form = this.el('settings-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            const newLocale = data.get('locale') || 'auto';
            Settings.save({
                locale: newLocale,
                aiService: data.get('aiService'),
                apiKey: (data.get('apiKey') || '').trim(),
                userPrompt: (data.get('userPrompt') || '').trim(),
                openrouterModel: (data.get('openrouterModel') || '').trim()
            });
            I18N.setLocale(newLocale);
            I18N.hydrate();
            const status = this.el('settings-status');
            status.textContent = t('settings.saved');
            setTimeout(() => { status.textContent = ''; }, 1800);
            Entitlement.get().then((ent) => this.renderTrialBadge(ent || {}));
            this.refreshHistoryList();
        });
        form.aiService.addEventListener('change', (e) => {
            this.toggleServiceFields(e.target.value);
        });
    },

    toggleServiceFields(service) {
        const orField = this.el('openrouter-model-field');
        if (orField) orField.hidden = service !== 'openrouter';
        // Apple Intelligence runs on-device — no API key field.
        const keyField = this.el('apiKey-field');
        if (keyField) keyField.hidden = service === 'apple';
    },

    loadSettingsForm() {
        const s = Settings.load();
        const form = this.el('settings-form');
        if (form.locale) form.locale.value = s.locale || 'auto';
        form.aiService.value = s.aiService;
        form.apiKey.value = s.apiKey;
        form.userPrompt.value = s.userPrompt;
        if (form.openrouterModel) form.openrouterModel.value = s.openrouterModel || '';
        this.toggleServiceFields(s.aiService);
        this.probeAppleIntelligence(form, s);
    },

    async probeAppleIntelligence(form, s) {
        let available = false;
        try {
            const r = await window.webkit.messageHandlers.aiAvailability.postMessage({});
            available = !!(r && r.available);
        } catch (e) { /* handler missing on older OS */ }

        const appleOpt = form.aiService.querySelector('option[value="apple"]');
        if (!available) {
            if (appleOpt) {
                appleOpt.disabled = true;
                appleOpt.textContent = t('settings.serviceApple') + ' — ' + t('settings.appleUnavailable');
            }
            if (form.aiService.value === 'apple') {
                form.aiService.value = 'gemini';
                Settings.save({ aiService: 'gemini' });
            }
        } else if (s.aiService === 'gemini' && !s.apiKey) {
            // New / unconfigured user on a capable device → default to on-device.
            form.aiService.value = 'apple';
            Settings.save({ aiService: 'apple' });
        }
        this.toggleServiceFields(form.aiService.value);
    },

    bindHistory() {
        this.el('clear-history-btn').addEventListener('click', () => {
            if (confirm(t('history.confirmClear'))) {
                History.clear();
                this.refreshHistoryList();
            }
        });

        this.el('history-list').addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-action]');
            if (!btn) return;
            const id = btn.dataset.id;
            const entry = History.get(id);
            if (!entry) return;
            if (btn.dataset.action === 'open') {
                this.renderResult(entry);
                this.showView('home');
            } else if (btn.dataset.action === 'copy') {
                navigator.clipboard.writeText(entry.summary).then(() => this.showToast(t('toast.summaryCopied')));
            } else if (btn.dataset.action === 'delete') {
                History.remove(id);
                this.refreshHistoryList();
            }
        });
    },

    refreshHistoryList() {
        const list = this.el('history-list');
        const empty = this.el('history-empty');
        const items = History.list();
        list.innerHTML = '';
        if (items.length === 0) {
            empty.classList.add('visible');
            return;
        }
        empty.classList.remove('visible');
        const dateLocale = I18N.locale === 'fr' ? 'fr-FR' : 'en-US';
        items.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'history-item';
            const date = new Date(entry.createdAt).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
            const preview = (entry.summary || '').slice(0, 200).replace(/[#*`>\-\n]+/g, ' ').trim();
            li.innerHTML = `
                <div class="title">${escapeText(entry.title || t('history.defaultTitle'))}</div>
                <div class="meta">
                    <span>${date}</span>
                    ${entry.author ? `<span>· ${escapeText(entry.author)}</span>` : ''}
                </div>
                <div class="preview">${escapeText(preview)}</div>
                <div class="history-actions">
                    <button class="icon-btn" data-action="open" data-id="${entry.id}">${t('history.open')}</button>
                    <button class="icon-btn" data-action="copy" data-id="${entry.id}">${t('history.copy')}</button>
                    <button class="icon-btn" data-action="delete" data-id="${entry.id}">${t('history.delete')}</button>
                </div>
            `;
            list.appendChild(li);
        });
    }
};

function escapeText(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) { return escapeText(s).replace(/"/g, '&quot;'); }

window.addEventListener('DOMContentLoaded', () => App.init());
