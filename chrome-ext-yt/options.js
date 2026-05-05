const i18n = (key, ...args) => chrome.i18n.getMessage(key, args.length ? args : undefined) || key;

const localizeStatic = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = i18n(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-attr-placeholder]').forEach(el => {
    const msg = i18n(el.dataset.i18nAttrPlaceholder);
    if (msg) el.placeholder = msg;
  });
};

const updateLabel = (service) => {
  const label = document.getElementById('apiKeyLabel');
  if (service === 'gemini') label.textContent = i18n('apiKeyLabelGemini');
  else if (service === 'openai') label.textContent = i18n('apiKeyLabelOpenAI');
  else if (service === 'openrouter') label.textContent = i18n('apiKeyLabelOpenRouter');
  document.getElementById('openrouterModelGroup').style.display =
    service === 'openrouter' ? 'block' : 'none';
};

const saveOptions = () => {
  const aiService = document.getElementById('aiService').value;
  const apiKey = document.getElementById('apiKey').value;
  const userPrompt = document.getElementById('userPrompt').value;
  const openrouterModel = document.getElementById('openrouterModel').value.trim();

  chrome.storage.sync.set({ aiService, apiKey, userPrompt, openrouterModel }, () => {
    const status = document.getElementById('status');
    status.textContent = i18n('settingsSaved');
    status.className = 'success';
    status.style.display = 'block';
    setTimeout(() => {
      status.textContent = '';
      status.style.display = 'none';
    }, 1500);
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({ aiService: 'gemini', apiKey: '', userPrompt: '', openrouterModel: '' }, (items) => {
    document.getElementById('aiService').value = items.aiService;
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('userPrompt').value = items.userPrompt;
    document.getElementById('openrouterModel').value = items.openrouterModel;
    updateLabel(items.aiService);
  });
};

document.getElementById('aiService').addEventListener('change', (e) => {
  updateLabel(e.target.value);
});

document.addEventListener('DOMContentLoaded', () => {
  localizeStatic();
  restoreOptions();
});
document.getElementById('save').addEventListener('click', saveOptions);
