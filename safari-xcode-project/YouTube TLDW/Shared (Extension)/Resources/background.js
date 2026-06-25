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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarize") {
        summarizeVideo(request.transcript, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => sendResponse({ summary: result.summary, model: result.model }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    } else if (request.action === "askQuestion") {
        askQuestion(request.transcript, request.question, request.qaHistory, request.aiService, request.apiKey, request.userPrompt, request.lang)
            .then(result => sendResponse({ answer: result.answer, model: result.model }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    } else if (request.action === "getApiKey") {
        nativeKeychain({ action: "getApiKey" })
            .then(res => sendResponse({ apiKey: res.apiKey || "" }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    } else if (request.action === "setApiKey") {
        nativeKeychain({ action: "setApiKey", apiKey: request.apiKey })
            .then(res => sendResponse({ ok: !!res.ok }))
            .catch(error => sendResponse({ error: error.message }));
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

// Clicking the toolbar icon opens the options page — the only reliable way to
// reach settings on Safari (the in-page button only shows when a key is missing).
if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener(() => {
        try {
            chrome.runtime.openOptionsPage();
        } catch (e) {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
    });
}

// New installs default to Apple Intelligence when the device supports it, so the
// extension works with no API key out of the box. An explicit prior choice wins.
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get({ aiService: null }, (items) => {
        if (items.aiService) return;
        nativeKeychain({ action: "aiAvailability" })
            .then(res => { if (res && res.available) chrome.storage.sync.set({ aiService: 'apple' }); })
            .catch(() => {});
    });
});

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
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!summary) throw new Error(chrome.i18n.getMessage("errNoSummary", ["Gemini"]));
    return { summary, model: 'gemini-3.1-flash-lite' };
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

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `${service} API Error: ${response.status}`);
    }

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
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

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

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) throw new Error(chrome.i18n.getMessage("errNoAnswer", ["Gemini"]));
    return { answer, model: 'gemini-3.1-flash-lite' };
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

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `${service} API Error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error(chrome.i18n.getMessage("errNoAnswer", [service]));
    return { answer, model };
}
