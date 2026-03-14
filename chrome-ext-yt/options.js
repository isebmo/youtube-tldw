// Saves options to chrome.storage
const saveOptions = () => {
  const aiService = document.getElementById('aiService').value;
  const apiKey = document.getElementById('apiKey').value;
  const userPrompt = document.getElementById('userPrompt').value;

  chrome.storage.sync.set(
    {
      aiService: aiService,
      apiKey: apiKey,
      userPrompt: userPrompt
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      status.className = 'success';
      status.style.display = 'block';
      setTimeout(() => {
        status.textContent = '';
        status.style.display = 'none';
      }, 1500);
    }
  );
};

// Restores settings from chrome.storage
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      aiService: 'gemini',
      apiKey: '',
      userPrompt: 'Summary should be in french'
    },
    (items) => {
      document.getElementById('aiService').value = items.aiService;
      document.getElementById('apiKey').value = items.apiKey;
      document.getElementById('userPrompt').value = items.userPrompt;
      updateLabel(items.aiService);
    }
  );
};

const updateLabel = (service) => {
  const label = document.getElementById('apiKeyLabel');
  if (service === 'gemini') {
    label.textContent = 'Gemini API Key:';
  } else if (service === 'openai') {
    label.textContent = 'OpenAI API Key:';
  } else if (service === 'openrouter') {
    label.textContent = 'OpenRouter API Key:';
  }
};

document.getElementById('aiService').addEventListener('change', (e) => {
  updateLabel(e.target.value);
});

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
