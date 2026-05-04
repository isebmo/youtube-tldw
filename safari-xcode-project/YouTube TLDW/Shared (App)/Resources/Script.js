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
    defaults: { aiService: 'gemini', apiKey: '', userPrompt: '' },
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
        throw new Error("Lien YouTube invalide.");
    }

    static async _fetchInnertubeApiKey(html) {
        const m = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
        if (m && m[1]) return m[1];
        throw new Error("Impossible de trouver la clé InnerTube.");
    }

    static async _fetchInnertubeData(videoId, apiKey) {
        const res = await nativeFetch(`${this.INNERTUBE_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: this.INNERTUBE_CONTEXT, videoId })
        });
        if (!res.ok) throw new Error(`InnerTube API a retourné ${res.status}`);
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
        if (!pageRes.ok) throw new Error("Impossible de charger la page YouTube.");
        const pageHtml = await pageRes.text();
        const apiKey = await this._fetchInnertubeApiKey(pageHtml);
        const data = await this._fetchInnertubeData(videoId, apiKey);

        const status = data.playabilityStatus?.status;
        if (status && status !== 'OK') {
            throw new Error(data.playabilityStatus?.reason || "Vidéo indisponible.");
        }

        const captions = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captions || captions.length === 0) throw new Error("Cette vidéo n'a pas de sous-titres.");

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

        const title = (data.videoDetails?.title) || `Vidéo ${videoId}`;
        const author = data.videoDetails?.author || '';
        return { videoId, title, author, segments };
    }
}

const FIXED_PROMPT = `Please summarize the transcription of the YouTube video. Be precise and structured; the summary should allow the reader to avoid watching the video while still understanding all the points and details discussed. Give me the summary without any other sentence, the summary must be formatted in markdown.

Transcript:
{{transcript}}`;

async function summarize(transcript, settings) {
    if (!settings.apiKey) throw new Error("Clé API manquante. Va dans Réglages.");
    let prompt = FIXED_PROMPT.replace('{{transcript}}', transcript);
    if (settings.userPrompt) prompt += "\n\nAdditional instructions:\n" + settings.userPrompt;

    if (settings.aiService === 'gemini') return summarizeGemini(settings.apiKey, prompt);
    throw new Error("Service AI non supporté: " + settings.aiService);
}

async function summarizeGemini(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
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
    if (!summary) throw new Error("Gemini n'a renvoyé aucun résumé.");
    return { summary, model: 'gemini-3.1-flash-lite-preview' };
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
        this.bindNav();
        this.bindHome();
        this.bindSettings();
        this.bindHistory();
        this.loadSettingsForm();
        this.refreshHistoryList();

        window.handleDeepLink = (urlString) => this.handleDeepLink(urlString);
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
        const settings = Settings.load();
        if (!settings.apiKey) {
            this.showToast("Configure ta clé API dans Réglages.");
            this.showView('settings');
            return;
        }

        this.hideError();
        this.el('result-area').hidden = true;
        const loadingEl = this.el('loading-area');
        const loadingText = this.el('loading-text');
        loadingEl.hidden = false;
        loadingText.textContent = "Récupération du transcript…";

        let entry = { id: 't_' + Date.now(), createdAt: Date.now(), url };

        try {
            const t = await TranscriptFetcher.getTranscript(url);
            entry.videoId = t.videoId;
            entry.title = t.title;
            entry.author = t.author;
            entry.transcript = TranscriptFetcher.toPlainText(t.segments);

            loadingText.textContent = "Génération du résumé avec Gemini…";
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
            <button class="icon-btn" id="copy-summary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>Copier</button>
            <button class="icon-btn" id="open-yt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5"/></svg>Voir sur YouTube</button>
        `;
        this.el('copy-summary').addEventListener('click', () => {
            navigator.clipboard.writeText(entry.summary).then(() => this.showToast("Résumé copié."));
        });
        this.el('open-yt').addEventListener('click', () => openExternal(entry.url));

        this.el('result-body').innerHTML = renderMarkdown(entry.summary);
        this.el('result-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    showError(msg) {
        const e = this.el('error-area');
        e.textContent = "Erreur : " + msg;
        e.hidden = false;
    },
    hideError() { this.el('error-area').hidden = true; },

    bindSettings() {
        this.el('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            Settings.save({
                aiService: data.get('aiService'),
                apiKey: (data.get('apiKey') || '').trim(),
                userPrompt: (data.get('userPrompt') || '').trim()
            });
            const status = this.el('settings-status');
            status.textContent = "Enregistré.";
            setTimeout(() => { status.textContent = ''; }, 1800);
        });
    },

    loadSettingsForm() {
        const s = Settings.load();
        const form = this.el('settings-form');
        form.aiService.value = s.aiService;
        form.apiKey.value = s.apiKey;
        form.userPrompt.value = s.userPrompt;
    },

    bindHistory() {
        this.el('clear-history-btn').addEventListener('click', () => {
            if (confirm("Effacer tout l'historique ?")) {
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
                navigator.clipboard.writeText(entry.summary).then(() => this.showToast("Résumé copié."));
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
        items.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'history-item';
            const date = new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const preview = (entry.summary || '').slice(0, 200).replace(/[#*`>\-\n]+/g, ' ').trim();
            li.innerHTML = `
                <div class="title">${escapeText(entry.title || 'Vidéo')}</div>
                <div class="meta">
                    <span>${date}</span>
                    ${entry.author ? `<span>· ${escapeText(entry.author)}</span>` : ''}
                </div>
                <div class="preview">${escapeText(preview)}</div>
                <div class="history-actions">
                    <button class="icon-btn" data-action="open" data-id="${entry.id}">Ouvrir</button>
                    <button class="icon-btn" data-action="copy" data-id="${entry.id}">Copier</button>
                    <button class="icon-btn" data-action="delete" data-id="${entry.id}">Supprimer</button>
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
