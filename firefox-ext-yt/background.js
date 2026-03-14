browser.runtime.onMessage.addListener((request, sender) => {
    if (request.action === "summarize") {
        return summarizeVideo(request.transcript, request.aiService, request.apiKey, request.userPrompt)
            .then(result => ({ summary: result.summary, model: result.model }))
            .catch(error => ({ error: error.message }));
    } else if (request.action === "askQuestion") {
        return askQuestion(request.transcript, request.question, request.qaHistory, request.aiService, request.apiKey, request.userPrompt)
            .then(result => ({ answer: result.answer, model: result.model }))
            .catch(error => ({ error: error.message }));
    } else if (request.action === "openOptions") {
        browser.runtime.openOptionsPage();
    }
});

// Fixed prompt - not user configurable
const FIXED_PROMPT = `Please summarize the transcription of the YouTube video. Be precise and structured; the summary should allow the reader to avoid watching the video while still understanding all the points and details discussed. Give me the summary without any other sentence, the summary must be formatted in markdown.

Transcript:
{{transcript}}`;

const QA_PROMPT = `You are a helpful assistant answering questions about a YouTube video based on its transcript. Answer the user's question precisely, using only information from the transcript. If the answer is not in the transcript, say so. Format your answer in markdown.

Transcript:
{{transcript}}`;

async function summarizeVideo(transcript, aiService, apiKey, userPrompt) {
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in the extension options.");
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
        throw new Error("Unsupported AI service: " + aiService);
    }
}

async function summarizeWithGemini(apiKey, promptText) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

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
    if (!summary) throw new Error("No summary returned from Gemini.");
    return { summary, model: 'gemini-3.1-flash-lite-preview' };
}

async function summarizeWithOpenAICompatible(service, apiKey, promptText) {
    let apiUrl, model;

    if (service === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-4o'; // Default model
    } else {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        model = 'google/gemini-2.0-flash-001'; // Default recommended OpenRouter model
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
        headers['HTTP-Referer'] = 'https://github.com/sebastienmouret/firefox-ext-yt';
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
    if (!summary) throw new Error(`No summary returned from ${service}.`);
    return { summary, model };
}

async function askQuestion(transcript, question, qaHistory, aiService, apiKey, userPrompt) {
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in the extension options.");
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
        throw new Error("Unsupported AI service: " + aiService);
    }
}

async function askWithGemini(apiKey, systemContext, question, qaHistory) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

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
    if (!answer) throw new Error("No answer returned from Gemini.");
    return { answer, model: 'gemini-3.1-flash-lite-preview' };
}

async function askWithOpenAICompatible(service, apiKey, systemContext, question, qaHistory) {
    let apiUrl, model;
    if (service === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-4o';
    } else {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        model = 'google/gemini-2.0-flash-001';
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
        headers['HTTP-Referer'] = 'https://github.com/sebastienmouret/firefox-ext-yt';
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
    if (!answer) throw new Error(`No answer returned from ${service}.`);
    return { answer, model };
}
