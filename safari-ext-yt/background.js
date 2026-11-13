// ----- Errors ----------------------------------------------------------------
// AI-call failures carry a `details` object (step, redacted URL, HTTP status,
// raw cause) that the content script turns into a copyable debug report: a bare
// network error ("Load failed" in Safari, "Failed to fetch" in Chrome) says
// nothing about which request failed or why.
function redactUrl(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.has('key')) u.searchParams.set('key', '***');
        return u.toString();
    } catch (e) {
        return String(url);
    }
}

async function apiFetch(step, url, options = {}) {
    const base = { step, method: options.method || 'GET', url: redactUrl(url) };
    let response;
    try {
        response = await fetch(url, options);
    } catch (e) {
        const err = new Error(chrome.i18n.getMessage('errNetwork', [new URL(url).host]));
        err.details = { ...base, cause: `${e.name}: ${e.message}` };
        throw err;
    }
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        let apiMessage = null;
        try { apiMessage = JSON.parse(body).error?.message; } catch (e) { /* not JSON */ }
        const err = new Error(apiMessage || `${step}: HTTP ${response.status}`);
        err.details = { ...base, status: response.status, body: body.slice(0, 500) };
        throw err;
    }
    return response;
}

function errorResponse(error, aiService) {
    return {
        error: error?.message || String(error),
        details: {
            aiService,
            ...(error?.details || {}),
            name: error?.name,
            stack: (error?.stack || '').split('\n').slice(0, 6).join('\n')
        }
    };
}

// Keychain bridge: routes apiKey reads/writes through the native handler so the
// key syncs across iOS + macOS via iCloud Keychain instead of plain storage.sync.
function nativeKeychain(message) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendNativeMessage("application.id", message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!response) { reject(new Error("Empty native response")); return; }
                if (response.error) { reject(new Error(response.error)); return; }
                resolve(response);
            });
        } catch (e) {
            reject(e);
        }
    });
}

// Apple Intelligence can take minutes on a long video. Safari stops the service
// worker long before that and the pending reply is lost (content.js received
// `undefined`). So AI requests run as jobs that content.js polls: every poll is
// a new event, which keeps the worker alive until the result is ready.
const jobs = new Map();

function startJob(request) {
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const run = request.action === "askQuestion"
        ? askQuestion(request.transcript, request.question, request.qaHistory, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => ({ answer: result.answer, model: result.model }))
        : summarizeVideo(request.transcript, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => ({ summary: result.summary, model: result.model }));
    jobs.set(jobId, { done: false });
    run.catch(error => errorResponse(error, request.aiService))
        .then(result => jobs.set(jobId, { done: true, result }));
    return jobId;
}

function pollJob(jobId) {
    const job = jobs.get(jobId);
    // Unknown id: the worker was restarted and the job died with it.
    if (!job) return { done: true, result: { error: chrome.i18n.getMessage("errJobInterrupted") } };
    if (job.done) jobs.delete(jobId);
    return job;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startJob") {
        sendResponse({ jobId: startJob(request.job) });
    } else if (request.action === "pollJob") {
        sendResponse(pollJob(request.jobId));
    } else if (request.action === "summarize") {
        summarizeVideo(request.transcript, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => sendResponse({ summary: result.summary, model: result.model }))
            .catch(error => sendResponse(errorResponse(error, request.aiService)));
        return true;
    } else if (request.action === "askQuestion") {
        askQuestion(request.transcript, request.question, request.qaHistory, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => sendResponse({ answer: result.answer, model: result.model }))
            .catch(error => sendResponse(errorResponse(error, request.aiService)));
        return true;
    } else if (request.action === "getApiKey") {
        nativeKeychain({ action: "getApiKey", service: request.service || "gemini" })
            .then(res => sendResponse({ apiKey: res.apiKey || "" }))
            .catch(error => sendResponse(errorResponse(error, request.aiService)));
        return true;
    } else if (request.action === "setApiKey") {
        nativeKeychain({ action: "setApiKey", apiKey: request.apiKey, service: request.service || "gemini" })
            .then(res => sendResponse({ ok: !!res.ok }))
            .catch(error => sendResponse(errorResponse(error, request.aiService)));
        return true;
    } else if (request.action === "aiAvailability") {
        nativeKeychain({ action: "aiAvailability" })
            .then(res => sendResponse({ available: !!res.available, reason: res.reason || null }))
            .catch(() => sendResponse({ available: false, reason: "bridge" }));
        return true;
    } else if (request.action === "openOptions") {
        try {
            chrome.runtime.openOptionsPage();
        } catch (e) {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
    }
});

// These optional registrations must NEVER throw at the service-worker's top
// level: an uncaught error during SW evaluation kills the whole worker —
// including the onMessage listener above — which makes every sendMessage from
// the content script resolve to `undefined`. Guard each API and wrap in try.

// Clicking the toolbar icon opens the options page — the only reliable way to
// reach settings on Safari (the in-page button only shows when a key is missing).
try {
    if (chrome.action && chrome.action.onClicked && chrome.action.onClicked.addListener) {
        chrome.action.onClicked.addListener(() => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (e) {
                chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
            }
        });
    }
} catch (e) { /* action API unavailable in this browser */ }

// New installs default to Apple Intelligence when the device supports it, so the
// extension works with no API key out of the box. An explicit prior choice wins.
try {
    if (chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener) {
        chrome.runtime.onInstalled.addListener(() => {
            chrome.storage.sync.get({ aiService: null }, (items) => {
                if (items.aiService) return;
                nativeKeychain({ action: "aiAvailability" })
                    .then(res => { if (res && res.available) chrome.storage.sync.set({ aiService: 'apple' }); })
                    .catch(() => {});
            });
        });
    }
} catch (e) { /* onInstalled unavailable in this browser */ }

// The Gemini model is a setting so a renamed/retired model can be fixed without
// shipping a new version; empty means the default below.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

async function getGeminiModel() {
    const { geminiModel } = await chrome.storage.sync.get({ geminiModel: '' });
    return (geminiModel || '').trim().replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
}

async function getOpenRouterModel() {
    const { openrouterModel } = await chrome.storage.sync.get({ openrouterModel: '' });
    return openrouterModel || 'google/gemini-2.5-flash';
}

// Fixed prompt - not user configurable
const FIXED_PROMPT = `Please summarize the transcription of the YouTube video. Be precise and structured; the summary should allow the reader to avoid watching the video while still understanding all the points and details discussed. Give me the summary without any other sentence, the summary must be formatted in markdown.

Transcript:
{{transcript}}`;

const QA_PROMPT = `You are a helpful assistant answering questions about a YouTube video based on its transcript. Answer the user's question precisely, using only information from the transcript. If the answer is not in the transcript, say so. Format your answer in markdown.

Transcript:
{{transcript}}`;

// On-device Apple Intelligence: no API key, summarization runs natively.
function summarizeWithAppleIntelligence(transcript, userPrompt, lang) {
    return nativeKeychain({ action: "aiSummarize", transcript, userPrompt: userPrompt || "", lang: lang || "" })
        .then(res => ({ summary: res.summary, model: res.model || "Apple Intelligence" }));
}

function askWithAppleIntelligence(transcript, question, qaHistory, userPrompt, lang) {
    return nativeKeychain({ action: "aiAsk", transcript, question, qaHistory: qaHistory || [], userPrompt: userPrompt || "", lang: lang || "" })
        .then(res => ({ answer: res.answer, model: res.model || "Apple Intelligence" }));
}

async function summarizeVideo(transcript, aiService, apiKey, userPrompt, lang) {
    // Apple Intelligence runs on-device and needs no key.
    if (aiService === 'apple') {
        return summarizeWithAppleIntelligence(transcript, userPrompt, lang);
    }

    if (!apiKey) {
        throw new Error(chrome.i18n.getMessage("errApiKeyMissing"));
    }

    // Use fixed prompt + user additions
    let promptText = FIXED_PROMPT.replace('{{transcript}}', transcript);
    if (userPrompt) {
        promptText += "\n\nAdditional instructions:\n" + userPrompt;
    }

    if (aiService === 'gemini') {
        return summarizeWithGemini(apiKey, promptText);
    } else if (aiService === 'openai' || aiService === 'openrouter') {
        return summarizeWithOpenAICompatible(aiService, apiKey, promptText);
    } else {
        throw new Error(chrome.i18n.getMessage("errUnsupportedService", [aiService]));
    }
}

async function summarizeWithGemini(apiKey, promptText) {
    const model = await getGeminiModel();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    const response = await apiFetch('Gemini API', apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) throw new Error(chrome.i18n.getMessage("errNoSummary", ["Gemini"]));
    return { summary, model };
}

async function summarizeWithOpenAICompatible(service, apiKey, promptText) {
    let apiUrl, model;

    if (service === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-5-mini'; // Default model
    } else {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        model = await getOpenRouterModel();
    }

    const payload = {
        model: model,
        messages: [
            { role: "user", content: promptText }
        ]
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // OpenRouter specific headers
    if (service === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/sebastienmouret/chrome-ext-yt';
        headers['X-Title'] = 'YouTube Summarizer';
    }

    const response = await apiFetch(`${service} API`, apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;
    if (!summary) throw new Error(chrome.i18n.getMessage("errNoSummary", [service]));
    return { summary, model };
}

async function askQuestion(transcript, question, qaHistory, aiService, apiKey, userPrompt, lang) {
    if (aiService === 'apple') {
        return askWithAppleIntelligence(transcript, question, qaHistory, userPrompt, lang);
    }

    if (!apiKey) {
        throw new Error(chrome.i18n.getMessage("errApiKeyMissing"));
    }

    let systemContext = QA_PROMPT.replace('{{transcript}}', transcript);
    if (userPrompt) {
        systemContext += "\n\nAdditional instructions:\n" + userPrompt;
    }

    if (aiService === 'gemini') {
        return askWithGemini(apiKey, systemContext, question, qaHistory);
    } else if (aiService === 'openai' || aiService === 'openrouter') {
        return askWithOpenAICompatible(aiService, apiKey, systemContext, question, qaHistory);
    } else {
        throw new Error(chrome.i18n.getMessage("errUnsupportedService", [aiService]));
    }
}

async function askWithGemini(apiKey, systemContext, question, qaHistory) {
    const model = await getGeminiModel();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    const contents = [];
    if (qaHistory.length === 0) {
        contents.push({ role: "user", parts: [{ text: systemContext + "\n\nQuestion: " + question }] });
    } else {
        contents.push({ role: "user", parts: [{ text: systemContext + "\n\nQuestion: " + qaHistory[0].question }] });
        contents.push({ role: "model", parts: [{ text: qaHistory[0].answer }] });
        for (let i = 1; i < qaHistory.length; i++) {
            contents.push({ role: "user", parts: [{ text: qaHistory[i].question }] });
            contents.push({ role: "model", parts: [{ text: qaHistory[i].answer }] });
        }
        contents.push({ role: "user", parts: [{ text: question }] });
    }

    const response = await apiFetch('Gemini API', apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) throw new Error(chrome.i18n.getMessage("errNoAnswer", ["Gemini"]));
    return { answer, model };
}

async function askWithOpenAICompatible(service, apiKey, systemContext, question, qaHistory) {
    let apiUrl, model;
    if (service === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-5-mini';
    } else {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        model = await getOpenRouterModel();
    }

    const messages = [{ role: "system", content: systemContext }];
    for (const turn of qaHistory) {
        messages.push({ role: "user", content: turn.question });
        messages.push({ role: "assistant", content: turn.answer });
    }
    messages.push({ role: "user", content: question });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    if (service === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/sebastienmouret/chrome-ext-yt';
        headers['X-Title'] = 'YouTube Summarizer';
    }

    const response = await apiFetch(`${service} API`, apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages })
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error(chrome.i18n.getMessage("errNoAnswer", [service]));
    return { answer, model };
}
