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

// OpenAI/OpenRouter origins are optional_permissions: requesting them at
// install time would disable the extension on update for existing users.
const SERVICE_ORIGINS = {
  openai: ['https://api.openai.com/*'],
  openrouter: ['https://openrouter.ai/*']
};

// Must be called directly from a user-gesture handler (no await before it),
// or Firefox rejects the request. Resolves true without prompting when the
// permission is already granted.
const requestServicePermission = (service) => {
  const origins = SERVICE_ORIGINS[service];
  if (!origins) return Promise.resolve(true);
  return browser.permissions.request({ origins });
};

const showStatus = (message, kind) => {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = kind;
  status.style.display = 'block';
  setTimeout(() => {
    status.textContent = '';
    status.style.display = 'none';
  }, kind === 'success' ? 1500 : 3000);
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

  requestServicePermission(aiService).then((granted) => {
    if (!granted) {
      showStatus(i18n('permissionDenied'), 'error');
      return;
    }
    browser.storage.sync.set({ aiService, apiKey, userPrompt, openrouterModel }).then(() => {
      showStatus(i18n('settingsSaved'), 'success');
    });
  });
};

const restoreOptions = () => {
  browser.storage.sync.get({ aiService: 'gemini', apiKey: '', userPrompt: '', openrouterModel: '' }).then((items) => {
    document.getElementById('aiService').value = items.aiService;
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('userPrompt').value = items.userPrompt;
    document.getElementById('openrouterModel').value = items.openrouterModel;
    updateLabel(items.aiService);
  });
};

document.getElementById('aiService').addEventListener('change', (e) => {
  const service = e.target.value;
  updateLabel(service);
  requestServicePermission(service).then((granted) => {
    if (!granted) {
      e.target.value = 'gemini';
      updateLabel('gemini');
      showStatus(i18n('permissionDenied'), 'error');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  localizeStatic();
  restoreOptions();
});
document.getElementById('save').addEventListener('click', saveOptions);
