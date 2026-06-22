class TranscriptFetcher {
    // InnerTube API settings (from youtube-transcript-api Python library)
    static INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player";
    static INNERTUBE_CONTEXT = {
        client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38"
        }
    };

    static _extractVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (!videoId) {
            throw new Error("Could not extract video ID from URL.");
        }
        return videoId;
    }

    static async _fetchInnertubeApiKey(html) {
        const match = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
        if (match && match[1]) {
            return match[1];
        }
        throw new Error("Could not find InnerTube API key.");
    }

    static async _fetchInnertubeData(videoId, apiKey) {
        const response = await fetch(`${this.INNERTUBE_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                context: this.INNERTUBE_CONTEXT,
                videoId: videoId
            })
        });

        if (!response.ok) {
            throw new Error(`InnerTube API request failed: ${response.status}`);
        }

        return response.json();
    }

    static _decodeHtmlEntities(text) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        return doc.body.textContent || '';
    }

    static _formatTimestamp(seconds) {
        const total = Math.floor(parseFloat(seconds));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    static toPlainText(segments) {
        return segments.map(s => s.text).join(' ');
    }

    static async getTranscript() {
        try {
            const videoId = this._extractVideoId();

            // Fetch the page HTML to get the InnerTube API key
            const videoPageHtml = await fetch(window.location.href).then(res => res.text());
            const apiKey = await this._fetchInnertubeApiKey(videoPageHtml);

            // Fetch player data from InnerTube API
            const innertubeData = await this._fetchInnertubeData(videoId, apiKey);

            // Check playability
            const playabilityStatus = innertubeData.playabilityStatus?.status;
            if (playabilityStatus && playabilityStatus !== "OK") {
                const reason = innertubeData.playabilityStatus?.reason || "Video unavailable";
                throw new Error(reason);
            }

            // Extract captions
            const captions = innertubeData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!captions || captions.length === 0) {
                throw new Error("No captions found for this video.");
            }

            // Prefer English, then French, then first available
            const track = captions.find(t => t.languageCode === 'en') ||
                captions.find(t => t.languageCode === 'fr') ||
                captions[0];
            let transcriptUrl = track.baseUrl;

            // Remove fmt=srv3 if present (as done in Python library)
            transcriptUrl = transcriptUrl.replace("&fmt=srv3", "");

            // Fetch and parse the transcript XML
            const transcriptXml = await fetch(transcriptUrl).then(res => res.text());
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(transcriptXml, "text/xml");
            const textNodes = xmlDoc.getElementsByTagName("text");

            const segments = [];
            for (let i = 0; i < textNodes.length; i++) {
                const node = textNodes[i];
                const text = this._decodeHtmlEntities(node.textContent);
                const start = parseFloat(node.getAttribute('start') || '0');
                segments.push({
                    text: text,
                    start: start,
                    timestamp: this._formatTimestamp(start)
                });
            }

            return segments;
        } catch (error) {
            console.error("Error fetching transcript:", error);
            throw error;
        }
    }
}


class YouTubeSummarizerUI {
    constructor() {
        this.sidebarId = 'yt-summarizer-sidebar';
        this.headerBtnContainerId = 'yts-header-integration';
        this.cachedTranscript = null;
        this.cachedSummary = null;
        this.qaHistory = [];
        this.init();
    }

    init() {
        this.injectSidebar();
        this.observeNavigation();
        this.injectHeaderButtons();
    }

    observeNavigation() {
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                this.onUrlChange();
            }
            // Check if header buttons were removed by YT's SPA navigation
            if (this.isVideoPage() && !document.getElementById(this.headerBtnContainerId)) {
                this.injectHeaderButtons();
            }
        }).observe(document.body, { subtree: true, childList: true });
    }

    onUrlChange() {
        if (this.isVideoPage()) {
            this.injectHeaderButtons();
            this.resetSidebarContent();
        } else {
            this.closeSidebar();
            this.removeHeaderButtons();
        }
    }

    isVideoPage() {
        return window.location.pathname === '/watch' && new URLSearchParams(window.location.search).has('v');
    }

    _setHTMLSafe(element, htmlString) {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        element.replaceChildren(...Array.from(doc.body.childNodes));
    }

    injectSidebar() {
        if (document.getElementById(this.sidebarId)) return;

        const sidebar = document.createElement('div');
        sidebar.id = this.sidebarId;
        const logoUrl = chrome.runtime.getURL('logo.png');
        const t = (k) => chrome.i18n.getMessage(k) || k;
        this._setHTMLSafe(sidebar, `
            <div id="yt-summarizer-panel-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${logoUrl}" style="width:24px; height:24px; border-radius:4px; object-fit:cover;">
                    <span id="yt-summarizer-panel-title">${t('panelTitle')}</span>
                </div>
                <div id="yt-summarizer-panel-actions">
                    <button id="yts-copy-btn" class="panel-action-btn" title="${t('copyToClipboardTitle')}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                    <button id="yts-export-btn" class="panel-action-btn" title="${t('exportMarkdownTitle')}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    </button>
                    <button id="yts-close-sidebar" class="panel-action-btn" title="${t('closeTitle')}">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
            </div>
            <div id="yt-summarizer-panel-content">
                <div id="yts-display-area">
                    <div class="yts-loading-container" style="display:none;">
                        <div class="yts-spinner"></div>
                        <div class="yts-loading-text">${t('thinking')}</div>
                    </div>
                    <div id="yts-text-content">${t('welcomeMessage')}</div>
                </div>
            </div>
            <div id="yt-summarizer-panel-footer">
                <div id="yts-qa-input-container">
                    <input type="text" id="yts-question-input" placeholder="${t('askPlaceholder')}" />
                    <button id="yts-ask-btn" class="yts-ask-btn" title="${t('askTitle')}">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <button id="yts-summarize-btn" class="yts-primary-btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-4v-2h4v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    ${t('summarize')}
                </button>
                <button id="yts-transcript-btn" class="yts-secondary-btn">${t('showTranscript')}</button>
            </div>
            <div id="yts-toast">${t('copiedToast')}</div>
        `);

        document.body.appendChild(sidebar);

        // Events
        document.getElementById('yts-close-sidebar').addEventListener('click', () => this.closeSidebar());
        document.getElementById('yts-copy-btn').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('yts-export-btn').addEventListener('click', (e) => this.exportToMarkdown(e));
        document.getElementById('yts-transcript-btn').addEventListener('click', () => this.handleShowTranscript());
        document.getElementById('yts-summarize-btn').addEventListener('click', () => this.handleSummarize());
        document.getElementById('yts-ask-btn').addEventListener('click', () => this.handleAskQuestion());
        document.getElementById('yts-question-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleAskQuestion();
        });
    }

    injectHeaderButtons() {
        if (!this.isVideoPage()) return;
        if (document.getElementById(this.headerBtnContainerId)) return;

        const target = document.querySelector('#buttons.ytd-masthead');
        if (!target) return;

        const container = document.createElement('div');
        container.id = this.headerBtnContainerId;
        container.className = 'yts-header-integration';
        const logoUrl = chrome.runtime.getURL('logo.png');
        const t = (k) => chrome.i18n.getMessage(k) || k;
        this._setHTMLSafe(container, `
            <button class="yts-pill-btn" title="${t('summarizeVideoTitle')}">
                <img src="${logoUrl}">
                ${t('summarize')}
            </button>
        `);

        // Insert before notifications
        target.parentNode.insertBefore(container, target);

        container.addEventListener('click', () => {
            this.openSidebar();
        });
    }

    removeHeaderButtons() {
        const el = document.getElementById(this.headerBtnContainerId);
        if (el) el.remove();
    }

    toggleSidebar() {
        const sidebar = document.getElementById(this.sidebarId);
        sidebar.classList.toggle('open');
    }

    openSidebar() {
        const sidebar = document.getElementById(this.sidebarId);
        sidebar.classList.add('open');
    }

    closeSidebar() {
        const sidebar = document.getElementById(this.sidebarId);
        sidebar.classList.remove('open');
    }

    resetSidebarContent() {
        const textArea = document.getElementById('yts-text-content');
        if (textArea) textArea.textContent = chrome.i18n.getMessage('welcomeMessage');
        this.cachedTranscript = null;
        this.cachedSummary = null;
        this.qaHistory = [];
        this.setLoading(false);
    }

    setLoading(isLoading, text = chrome.i18n.getMessage('thinking')) {
        const loader = document.querySelector('.yts-loading-container');
        const textContent = document.getElementById('yts-text-content');
        const loaderText = document.querySelector('.yts-loading-text');

        if (isLoading) {
            loader.style.display = 'flex';
            textContent.style.display = 'none';
            if (loaderText) loaderText.textContent = text;
        } else {
            loader.style.display = 'none';
            textContent.style.display = 'block';
        }
    }

    async handleShowTranscript() {
        this.setLoading(true, chrome.i18n.getMessage('fetchingTranscript'));
        try {
            const segments = await TranscriptFetcher.getTranscript();
            this.cachedTranscript = segments;
            const container = document.getElementById('yts-text-content');
            container.replaceChildren();
            const transcriptContent = document.createElement('div');
            transcriptContent.className = 'yts-transcript-content';
            segments.forEach(seg => {
                const line = document.createElement('div');
                line.className = 'yts-transcript-line';
                const ts = document.createElement('span');
                ts.className = 'yts-transcript-timestamp';
                ts.textContent = seg.timestamp;
                ts.addEventListener('click', () => {
                    const video = document.querySelector('video');
                    if (video) video.currentTime = seg.start;
                });
                const text = document.createElement('span');
                text.className = 'yts-transcript-text';
                text.textContent = seg.text;
                line.appendChild(ts);
                line.appendChild(text);
                transcriptContent.appendChild(line);
            });
            container.appendChild(transcriptContent);
        } catch (error) {
            document.getElementById('yts-text-content').textContent = chrome.i18n.getMessage('errorPrefix', [error.message]);
        } finally {
            this.setLoading(false);
        }
    }

    async handleSummarize() {
        this.setLoading(true, chrome.i18n.getMessage('aiAnalyzing'));
        try {
            const settings = await chrome.storage.sync.get({ apiKey: '', userPrompt: '', aiService: 'gemini' });
            if (!settings.apiKey) {
                const wrapper = document.createElement('div');
                wrapper.style.textAlign = 'center';
                wrapper.style.padding = '20px';
                const msg = document.createElement('p');
                msg.textContent = chrome.i18n.getMessage('apiKeyNotSet');
                const btn = document.createElement('button');
                btn.id = 'yts-open-opts';
                btn.className = 'yts-secondary-btn';
                btn.style.marginTop = '10px';
                btn.textContent = chrome.i18n.getMessage('openOptions');
                btn.addEventListener('click', () => {
                    chrome.runtime.sendMessage({ action: "openOptions" });
                });
                wrapper.appendChild(msg);
                wrapper.appendChild(btn);
                document.getElementById('yts-text-content').replaceChildren(wrapper);
                return;
            }

            const segments = await TranscriptFetcher.getTranscript();
            this.cachedTranscript = segments;
            const response = await chrome.runtime.sendMessage({
                action: "summarize",
                transcript: TranscriptFetcher.toPlainText(segments),
                aiService: settings.aiService,
                apiKey: settings.apiKey,
                userPrompt: settings.userPrompt
            });

            if (response.error) throw new Error(response.error);
            this.cachedSummary = response.summary;
            const modelBadge = response.model ? `<div class="yts-model-badge">${chrome.i18n.getMessage('modelPrefix', [response.model])}</div>` : '';
            this._setHTMLSafe(document.getElementById('yts-text-content'), modelBadge + this.renderMarkdown(response.summary));
        } catch (error) {
            document.getElementById('yts-text-content').textContent = chrome.i18n.getMessage('errorPrefix', [error.message]);
        } finally {
            this.setLoading(false);
        }
    }

    async handleAskQuestion() {
        const input = document.getElementById('yts-question-input');
        const question = input.value.trim();
        if (!question) return;

        input.value = '';

        if (!this.cachedTranscript) {
            this.setLoading(true, chrome.i18n.getMessage('fetchingTranscript'));
            try {
                this.cachedTranscript = await TranscriptFetcher.getTranscript();
            } catch (error) {
                document.getElementById('yts-text-content').textContent = chrome.i18n.getMessage('transcriptErrorPrefix', [error.message]);
                this.setLoading(false);
                return;
            }
            this.setLoading(false);
        }

        this.appendQABubble('question', question);
        const loadingId = this.appendQABubble('loading', chrome.i18n.getMessage('thinking'));

        try {
            const settings = await chrome.storage.sync.get({ apiKey: '', userPrompt: '', aiService: 'gemini' });
            if (!settings.apiKey) {
                this.replaceQABubble(loadingId, 'answer', chrome.i18n.getMessage('apiKeyNotSetLong'));
                return;
            }

            const response = await chrome.runtime.sendMessage({
                action: "askQuestion",
                transcript: TranscriptFetcher.toPlainText(this.cachedTranscript),
                question: question,
                qaHistory: this.qaHistory.slice(-10),
                aiService: settings.aiService,
                apiKey: settings.apiKey,
                userPrompt: settings.userPrompt
            });

            if (response.error) throw new Error(response.error);
            this.qaHistory.push({ question, answer: response.answer });
            this.replaceQABubble(loadingId, 'answer', response.answer, response.model);
        } catch (error) {
            this.replaceQABubble(loadingId, 'answer', chrome.i18n.getMessage('errorPrefix', [error.message]));
        }
    }

    appendQABubble(type, content) {
        const container = document.getElementById('yts-text-content');

        if (!container.querySelector('.yts-qa-separator')) {
            const sep = document.createElement('hr');
            sep.className = 'yts-qa-separator';
            container.appendChild(sep);
        }

        const bubble = document.createElement('div');
        const id = 'yts-qa-' + Date.now();
        bubble.id = id;
        bubble.className = `yts-qa-bubble yts-qa-${type}`;

        if (type === 'question') {
            bubble.textContent = content;
        } else if (type === 'loading') {
            const spinner = document.createElement('div');
            spinner.className = 'yts-qa-spinner';
            bubble.appendChild(spinner);
            bubble.appendChild(document.createTextNode(' ' + content));
        }

        container.appendChild(bubble);
        document.getElementById('yt-summarizer-panel-content').scrollTop =
            document.getElementById('yt-summarizer-panel-content').scrollHeight;
        return id;
    }

    replaceQABubble(id, type, content, model) {
        const bubble = document.getElementById(id);
        if (!bubble) return;
        bubble.className = `yts-qa-bubble yts-qa-${type}`;
        const modelBadge = model ? `<div class="yts-model-badge" style="margin-bottom:8px;">${chrome.i18n.getMessage('modelPrefix', [model])}</div>` : '';
        this._setHTMLSafe(bubble, modelBadge + this.renderMarkdown(content));
        document.getElementById('yt-summarizer-panel-content').scrollTop =
            document.getElementById('yt-summarizer-panel-content').scrollHeight;
    }

    renderMarkdown(text) {
        if (!text) return '';

        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Horizontal rules
        html = html.replace(/^---$/gm, '<hr class="yts-md-hr">');

        // Headers (h1 to h4)
        html = html.replace(/^#### (.+)$/gm, '<h5 class="yts-md-h5">$1</h5>');
        html = html.replace(/^### (.+)$/gm, '<h4 class="yts-md-h4">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 class="yts-md-h3">$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2 class="yts-md-h2">$1</h2>');

        // Unordered lists — process BEFORE bold/italic so `* item` is not parsed as emphasis
        // Nested (indented) items first, then top-level
        html = html.replace(/^[ \t]+[\-\*] (.+)$/gm, '<uli2>$1</uli2>');
        html = html.replace(/^[\-\*] (.+)$/gm, '<uli>$1</uli>');

        // Numbered lists
        html = html.replace(/^[ \t]+\d+\. (.+)$/gm, '<oli2>$1</oli2>');
        html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');

        // Bold and italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Wrap nested items in sub-lists
        html = html.replace(/((?:<uli2>[\s\S]*?<\/uli2>\n?)+)/g, '<ul class="yts-md-ul yts-md-ul-nested">$1</ul>');
        html = html.replace(/((?:<oli2>[\s\S]*?<\/oli2>\n?)+)/g, '<ol class="yts-md-ol yts-md-ol-nested">$1</ol>');

        // Wrap top-level items in lists
        html = html.replace(/((?:<uli>[\s\S]*?<\/uli>\n?)+)/g, '<ul class="yts-md-ul">$1</ul>');
        html = html.replace(/((?:<oli>[\s\S]*?<\/oli>\n?)+)/g, '<ol class="yts-md-ol">$1</ol>');

        // Convert temp tags to li
        html = html.replace(/<(\/?)[uo]li2?>/g, '<$1li>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="yts-md-code">$1</code>');

        // Line breaks for paragraphs
        html = html.replace(/\n\n/g, '</p><p class="yts-md-p">');
        html = '<p class="yts-md-p">' + html + '</p>';

        // Clean up paragraphs wrapping block elements
        html = html.replace(/<p class="yts-md-p"><\/p>/g, '');
        html = html.replace(/<p class="yts-md-p">\s*(<(?:h[2-5]|ul|ol|hr)[^>]*>)/g, '$1');
        html = html.replace(/(<\/(?:h[2-5]|ul|ol|hr)>)\s*<\/p>/g, '$1');

        // Clean stray newlines
        html = html.replace(/\n/g, '');

        return '<div class="yts-markdown-content">' + html + '</div>';
    }

    copyToClipboard() {
        let content;
        const transcriptEl = document.querySelector('.yts-transcript-content');
        if (transcriptEl && Array.isArray(this.cachedTranscript)) {
            content = this.cachedTranscript.map(s => `[${s.timestamp}] ${s.text}`).join('\n');
        } else {
            content = document.getElementById('yts-text-content').textContent;
        }
        const welcome = chrome.i18n.getMessage('welcomeMessage') || 'welcomeMessage';
        if (!content || content.trim() === welcome) return;

        navigator.clipboard.writeText(content).then(() => {
            this.showToast(chrome.i18n.getMessage('copiedToast'));
        });
    }

    showToast(message) {
        const toast = document.getElementById('yts-toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    getVideoMetadata() {
        const title = document.querySelector('meta[property="og:title"]')?.content
            || document.title.replace(' - YouTube', '').trim()
            || chrome.i18n.getMessage('untitledVideo');
        const url = window.location.href;
        const date = document.querySelector('meta[itemprop="datePublished"]')?.content
            || new Date().toISOString().split('T')[0];
        return { title, url, date };
    }

    sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);
    }

    buildMarkdownExport() {
        const { title, url, date } = this.getVideoMetadata();
        const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        let md = `---\ntitle: "${escapedTitle}"\ndate: ${date}\nurl: ${url}\n---\n`;

        if (this.cachedSummary) {
            md += `\n## Summary\n\n${this.cachedSummary}\n`;
        }

        if (this.qaHistory.length > 0) {
            md += `\n## Questions & Answers\n`;
            for (const qa of this.qaHistory) {
                md += `\n**Q: ${qa.question}**\n\n${qa.answer}\n`;
            }
        }

        if ((this.cachedSummary || this.qaHistory.length > 0) && this.cachedTranscript) {
            md += `\n---\n`;
        }

        if (this.cachedTranscript) {
            md += `\n## Transcript\n\n`;
            md += this.cachedTranscript.map(s => `[${s.timestamp}] ${s.text}`).join('\n');
            md += '\n';
        }

        return md;
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportToMarkdown(event) {
        if (!this.cachedSummary && !this.cachedTranscript && this.qaHistory.length === 0) {
            this.showToast(chrome.i18n.getMessage('nothingToExport'));
            return;
        }

        const markdown = this.buildMarkdownExport();
        const { title } = this.getVideoMetadata();
        const filename = this.sanitizeFilename(title) + '.md';

        if (event.shiftKey) {
            navigator.clipboard.writeText(markdown).then(() => {
                this.showToast(chrome.i18n.getMessage('markdownCopied'));
            });
        } else {
            this.downloadFile(filename, markdown);
            this.showToast(chrome.i18n.getMessage('markdownExported'));
        }
    }
}

// Start the UI
new YouTubeSummarizerUI();
