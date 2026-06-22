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

function sendBg(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.error) { reject(new Error(response.error)); return; }
      resolve(response || {});
    });
  });
}

async function getApiKey() {
  const res = await sendBg({ action: "getApiKey" });
  return res.apiKey || "";
}

async function setApiKey(apiKey) {
  const res = await sendBg({ action: "setApiKey", apiKey });
  // Swift reports Keychain failures as {ok:false} without an error message;
  // surface them so callers don't discard the storage.sync copy of the key.
  if (!res.ok) throw new Error(i18n('errKeychainWriteFailed'));
}

const updateLabel = (service) => {
  const label = document.getElementById('apiKeyLabel');
  if (service === 'gemini') label.textContent = i18n('apiKeyLabelGemini');
  else if (service === 'openai') label.textContent = i18n('apiKeyLabelOpenAI');
  else if (service === 'openrouter') label.textContent = i18n('apiKeyLabelOpenRouter');
  document.getElementById('openrouterModelGroup').style.display =
    service === 'openrouter' ? 'block' : 'none';
  // Apple Intelligence runs on-device, so no API key is needed.
  const isApple = service === 'apple';
  document.getElementById('apiKeyGroup').style.display = isApple ? 'none' : 'block';
  document.getElementById('appleHint').style.display = isApple ? 'block' : 'none';
};

const saveOptions = async () => {
  const status = document.getElementById('status');
  const aiService = document.getElementById('aiService').value;
  const apiKey = document.getElementById('apiKey').value;
  const userPrompt = document.getElementById('userPrompt').value;
  const openrouterModel = document.getElementById('openrouterModel').value.trim();

  try {
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({ aiService, userPrompt, openrouterModel }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
    await setApiKey(apiKey);

    status.textContent = i18n('settingsSaved');
    status.className = 'success';
    status.style.display = 'block';
    setTimeout(() => {
      status.textContent = '';
      status.style.display = 'none';
    }, 1500);
  } catch (e) {
    status.textContent = i18n('errorPrefix', e.message);
    status.className = 'error';
    status.style.display = 'block';
  }
};

const restoreOptions = async () => {
  const items = await new Promise((resolve) => {
    chrome.storage.sync.get(
      { aiService: 'gemini', apiKey: '', userPrompt: '', openrouterModel: '' },
      resolve
    );
  });

  document.getElementById('aiService').value = items.aiService;
  document.getElementById('userPrompt').value = items.userPrompt;
  document.getElementById('openrouterModel').value = items.openrouterModel;
  updateLabel(items.aiService);

  let apiKey = '';
  try {
    apiKey = await getApiKey();
  } catch (e) {
    console.warn('Keychain read failed:', e.message);
  }

  // One-shot migration: if Keychain is empty but a key was previously stored in
  // storage.sync, move it over and clear the plaintext copy.
  if (!apiKey && items.apiKey) {
    try {
      await setApiKey(items.apiKey);
      apiKey = items.apiKey;
      chrome.storage.sync.remove('apiKey');
    } catch (e) {
      console.warn('Keychain migration failed:', e.message);
      apiKey = items.apiKey;
    }
  }

  document.getElementById('apiKey').value = apiKey;

  // Probe Apple Intelligence; disable the option when the device can't run it,
  // and fall back to Gemini if it was the selected service.
  try {
    const avail = await sendBg({ action: 'aiAvailability' });
    const appleOpt = document.querySelector('#aiService option[value="apple"]');
    if (!avail.available) {
      if (appleOpt) {
        appleOpt.disabled = true;
        appleOpt.textContent = i18n('serviceApple') + ' — ' + i18n('appleUnavailable');
      }
      if (document.getElementById('aiService').value === 'apple') {
        document.getElementById('aiService').value = 'gemini';
      }
    }
  } catch (e) {
    console.warn('Apple Intelligence probe failed:', e.message);
  }
  updateLabel(document.getElementById('aiService').value);
};

document.getElementById('aiService').addEventListener('change', (e) => {
  updateLabel(e.target.value);
});

document.addEventListener('DOMContentLoaded', () => {
  localizeStatic();
  restoreOptions();
});
document.getElementById('save').addEventListener('click', saveOptions);
