"use strict";
/**
 * DocFlow Recorder - Popup Script
 * Controls recording UI and token-based authorized upload.
 */
const SETTINGS_KEY = 'docStudioUploadSettings';
const CAPTURE_MIC_KEY = 'docflowCaptureMicrophoneEnabled';
const CAPTURE_SCREENSHOTS_KEY = 'docflowCaptureScreenshotsEnabled';
const SCREENSHOT_WIDTH_KEY = 'docflowScreenshotWidth';
const SCREENSHOT_HEIGHT_KEY = 'docflowScreenshotHeight';
const SCREENSHOT_QUALITY_KEY = 'docflowScreenshotQuality';
const DEFAULT_SETTINGS = {
    apiBaseUrl: 'http://localhost:3001',
    bearerToken: '',
};
const DEFAULT_SCREENSHOT_WIDTH = 2560;
const DEFAULT_SCREENSHOT_HEIGHT = 1440;
const DEFAULT_SCREENSHOT_QUALITY = 100;
function mustGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required popup element: #${id}`);
    }
    return element;
}
const statusBar = mustGetElement('statusBar');
const statusSubText = mustGetElement('statusSubText');
const idleSection = mustGetElement('idleSection');
const recordingSection = mustGetElement('recordingSection');
const stoppedSection = mustGetElement('stoppedSection');
const titleInput = mustGetElement('title');
const descriptionInput = mustGetElement('description');
const productAreaSelect = mustGetElement('productArea');
const environmentSelect = mustGetElement('environment');
const productVersionInput = mustGetElement('productVersion');
const localeInput = mustGetElement('locale');
const tagsInput = mustGetElement('tags');
const captureMicInput = mustGetElement('captureMic');
const captureScreenshotsInput = mustGetElement('captureScreenshots');
const screenshotWidthInput = mustGetElement('screenshotWidth');
const screenshotHeightInput = mustGetElement('screenshotHeight');
const screenshotQualityInput = mustGetElement('screenshotQuality');
const btnStart = mustGetElement('btnStart');
const btnStop = mustGetElement('btnStop');
const btnDownload = mustGetElement('btnDownload');
const btnUpload = mustGetElement('btnUpload');
const btnReset = mustGetElement('btnReset');
const uploadProgressWrap = mustGetElement('uploadProgress');
const uploadProgressFill = mustGetElement('uploadProgressFill');
const uploadProgressText = mustGetElement('uploadProgressText');
const uploadProgressPct = mustGetElement('uploadProgressPct');
const eventCountEl = mustGetElement('eventCount');
const durationEl = mustGetElement('duration');
const finalEventCountEl = mustGetElement('finalEventCount');
const studioTagEl = mustGetElement('studioTag');
const btnClearToken = mustGetElement('btnClearToken');
const authStatusEl = document.getElementById('authStatus');
let durationInterval = null;
let settings = { ...DEFAULT_SETTINGS };
let uploadInFlight = false;
async function init() {
    await loadSettings();
    renderSettings();
    renderAuthStatus();
    restoreMicPreference();
    restoreScreenshotPreference();
    restoreScreenshotImageSettings();
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== 'sync' || !changes[SETTINGS_KEY])
            return;
        await loadSettings();
        renderSettings();
        renderAuthStatus();
    });
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (resp) => {
        if (resp?.status === 'recording') {
            showRecordingUI(resp.eventCount, resp.startedAt);
        }
        else if (resp?.status === 'stopped') {
            showStoppedUI(resp.eventCount);
        }
        else {
            showIdleUI();
        }
    });
    captureMicInput.addEventListener('change', () => {
        localStorage.setItem(CAPTURE_MIC_KEY, captureMicInput.checked ? '1' : '0');
    });
    captureScreenshotsInput.addEventListener('change', () => {
        localStorage.setItem(CAPTURE_SCREENSHOTS_KEY, captureScreenshotsInput.checked ? '1' : '0');
    });
    screenshotWidthInput.addEventListener('change', () => {
        const value = clampNumberInput(screenshotWidthInput, 960, 3840, DEFAULT_SCREENSHOT_WIDTH);
        localStorage.setItem(SCREENSHOT_WIDTH_KEY, String(value));
    });
    screenshotHeightInput.addEventListener('change', () => {
        const value = clampNumberInput(screenshotHeightInput, 540, 2160, DEFAULT_SCREENSHOT_HEIGHT);
        localStorage.setItem(SCREENSHOT_HEIGHT_KEY, String(value));
    });
    screenshotQualityInput.addEventListener('change', () => {
        const value = clampNumberInput(screenshotQualityInput, 60, 100, DEFAULT_SCREENSHOT_QUALITY);
        localStorage.setItem(SCREENSHOT_QUALITY_KEY, String(value));
    });
}
btnClearToken.addEventListener('click', async () => {
    settings.bearerToken = '';
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    renderAuthStatus();
});
btnStart.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
        titleInput.style.borderColor = '#d92d20';
        titleInput.focus();
        return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        setStatus('idle', 'No active tab found');
        return;
    }
    const metadata = {
        recordedBy: 'extension-user',
        productVersion: productVersionInput.value.trim() || '0.0.0',
        productArea: productAreaSelect.value,
        environment: environmentSelect.value,
        locale: localeInput.value.trim() || 'en-US',
        title,
        description: descriptionInput.value.trim(),
        tags: tagsInput.value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        captureMicrophone: captureMicInput.checked,
        captureScreenshots: captureScreenshotsInput.checked,
        screenshotWidth: clampNumberInput(screenshotWidthInput, 960, 3840, DEFAULT_SCREENSHOT_WIDTH),
        screenshotHeight: clampNumberInput(screenshotHeightInput, 540, 2160, DEFAULT_SCREENSHOT_HEIGHT),
        screenshotQuality: clampNumberInput(screenshotQualityInput, 60, 100, DEFAULT_SCREENSHOT_QUALITY),
        tabId: tab.id,
    };
    chrome.runtime.sendMessage({ type: 'START_RECORDING', payload: metadata }, (resp) => {
        if (chrome.runtime.lastError) {
            setStatus('recording', 'Failed to start. Reload extension and try again.');
            return;
        }
        if (resp?.ok) {
            showRecordingUI(0, new Date().toISOString());
            return;
        }
        setStatus('recording', 'Failed to start recording');
    });
});
btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (resp) => {
        if (resp?.ok) {
            showStoppedUI(resp.recording?.events?.length ?? 0);
        }
    });
});
btnDownload.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_RECORDING' }, (resp) => {
        if (!resp?.recording)
            return;
        const blob = new Blob([JSON.stringify(resp.recording, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = String(resp.recording.metadata?.title ?? 'recording')
            .replace(/[^a-z0-9]/gi, '_')
            .slice(0, 60);
        a.download = `docflow_${safeName}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
btnUpload.addEventListener('click', async () => {
    if (uploadInFlight)
        return;
    uploadInFlight = true;
    setUploadActionState(true, 'Preparing...');
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_RECORDING' }, async (resp) => {
        if (!resp?.recording) {
            uploadInFlight = false;
            setUploadActionState(false);
            return;
        }
        if (!settings.bearerToken) {
            uploadInFlight = false;
            setUploadActionState(false);
            setStatus('recording', 'Extension not connected. Use "Connect Extension" in DocFlow.');
            return;
        }
        try {
            setButtonBusy(btnUpload, true, 'Uploading...');
            setUploadProgress(5, 'Preparing upload...');
            const sourceRecording = resp.recording;
            const payload = toBackendUploadPayload(sourceRecording);
            let transcriptWarning = null;
            // Use browser SpeechRecognition transcripts (captured live during recording)
            if (sourceRecording.speechTranscript && sourceRecording.speechTranscript.length > 0) {
                payload.speechTranscripts = sourceRecording.speechTranscript.map((seg) => ({
                    timestampMs: seg.startMs ?? 0,
                    speaker: 'host',
                    text: seg.text?.trim() || '',
                })).filter((seg) => seg.text.length > 0);
            }
            else {
                const micWasEnabled = sourceRecording.metadata?.captureMicrophone !== false;
                if (!micWasEnabled) {
                    transcriptWarning = 'Microphone was off. Uploading without transcript.';
                }
                else {
                    transcriptWarning = 'No speech detected. Uploading without transcript.';
                }
            }
            setUploadProgress(30, 'Compressing...');
            // Gzip compress to bypass Vercel 4.5MB limit
            const jsonStr = JSON.stringify(payload);
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(new TextEncoder().encode(jsonStr));
            writer.close();
            const compressedBuffer = await new Response(cs.readable).arrayBuffer();
            setUploadProgress(35, 'Uploading recording...');
            const res = await postGzippedWithUploadProgress(`${settings.apiBaseUrl}/api/recordings/extension-upload-raw`, settings.bearerToken, compressedBuffer, (loaded, total) => {
                if (!total || total <= 0)
                    return;
                const portion = loaded / total;
                const pct = 35 + Math.round(portion * 60);
                setUploadProgress(Math.min(95, pct), 'Uploading recording...');
            });
            if (res.status === 401) {
                throw new Error('Unauthorized: token rejected or expired');
            }
            if (!res.ok) {
                const err = parseJsonOrFallback(res.bodyText, {
                    message: res.statusText,
                });
                throw new Error(err.message || 'Upload failed');
            }
            setUploadProgress(100, 'Upload complete');
            uploadInFlight = false;
            setUploadActionState(false);
            setButtonBusy(btnUpload, false, 'Uploaded');
            btnUpload.disabled = true;
            setStatus('stopped', transcriptWarning ? `Upload successful. ${transcriptWarning}` : 'Upload successful');
        }
        catch (err) {
            uploadInFlight = false;
            setUploadActionState(false);
            hideUploadProgress();
            setButtonBusy(btnUpload, false, 'Upload failed');
            console.error('Upload error:', err);
            setStatus('recording', err instanceof Error ? err.message : 'Upload failed');
            setTimeout(() => {
                const uploadBtn = document.getElementById('btnUpload');
                if (!uploadBtn)
                    return;
                uploadBtn.textContent = 'Upload to Studio';
                uploadBtn.disabled = false;
            }, 2000);
        }
    });
});
btnReset.addEventListener('click', () => {
    showIdleUI();
});
async function loadSettings() {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    settings = {
        ...DEFAULT_SETTINGS,
        ...stored[SETTINGS_KEY],
    };
}
function renderSettings() {
    // UI intentionally has no editable settings; values are pushed from Doc Studio.
}
function restoreMicPreference() {
    const stored = localStorage.getItem(CAPTURE_MIC_KEY);
    if (stored === '0') {
        captureMicInput.checked = false;
        return;
    }
    if (stored === '1') {
        captureMicInput.checked = true;
    }
}
function restoreScreenshotPreference() {
    const stored = localStorage.getItem(CAPTURE_SCREENSHOTS_KEY);
    if (stored === '0') {
        captureScreenshotsInput.checked = false;
        return;
    }
    if (stored === '1') {
        captureScreenshotsInput.checked = true;
    }
}
function restoreScreenshotImageSettings() {
    const width = parseStoredNumber(SCREENSHOT_WIDTH_KEY, DEFAULT_SCREENSHOT_WIDTH);
    const height = parseStoredNumber(SCREENSHOT_HEIGHT_KEY, DEFAULT_SCREENSHOT_HEIGHT);
    const quality = parseStoredNumber(SCREENSHOT_QUALITY_KEY, DEFAULT_SCREENSHOT_QUALITY);
    screenshotWidthInput.value = String(clampNumber(width, 960, 3840));
    screenshotHeightInput.value = String(clampNumber(height, 540, 2160));
    screenshotQualityInput.value = String(clampNumber(quality, 60, 100));
}
function renderAuthStatus() {
    if (!settings.bearerToken) {
        studioTagEl.textContent = 'Not Connected';
        studioTagEl.classList.remove('connected');
        studioTagEl.classList.add('disconnected');
        if (authStatusEl)
            authStatusEl.textContent = 'Not connected';
        return;
    }
    const expiry = readTokenExpiry(settings.bearerToken);
    if (!expiry || expiry.getTime() <= Date.now()) {
        settings.bearerToken = '';
        void chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
        studioTagEl.textContent = 'Not Connected';
        studioTagEl.classList.remove('connected');
        studioTagEl.classList.add('disconnected');
        if (authStatusEl)
            authStatusEl.textContent = 'Not connected';
        return;
    }
    studioTagEl.textContent = 'Connected';
    studioTagEl.classList.remove('disconnected');
    studioTagEl.classList.add('connected');
    if (authStatusEl) {
        authStatusEl.textContent = expiry
            ? `Connected until ${expiry.toLocaleTimeString()}`
            : 'Connected';
    }
}
function showIdleUI() {
    setStatus('idle', 'Ready to start a new recording');
    idleSection.classList.remove('hidden');
    recordingSection.classList.add('hidden');
    stoppedSection.classList.add('hidden');
    hideUploadProgress();
    if (durationInterval)
        clearInterval(durationInterval);
}
function showRecordingUI(eventCount, startedAt) {
    setStatus('recording', 'Recording in progress');
    idleSection.classList.add('hidden');
    recordingSection.classList.remove('hidden');
    stoppedSection.classList.add('hidden');
    eventCountEl.textContent = String(eventCount);
    const start = new Date(startedAt).getTime();
    if (durationInterval)
        clearInterval(durationInterval);
    durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const ss = String(elapsed % 60).padStart(2, '0');
        durationEl.textContent = `${mm}:${ss}`;
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (r) => {
            if (r)
                eventCountEl.textContent = String(r.eventCount);
        });
    }, 1000);
}
function showStoppedUI(eventCount) {
    uploadInFlight = false;
    setStatus('stopped', 'Recording complete');
    idleSection.classList.add('hidden');
    recordingSection.classList.add('hidden');
    stoppedSection.classList.remove('hidden');
    hideUploadProgress();
    finalEventCountEl.textContent = String(eventCount);
    setUploadActionState(false);
    btnUpload.disabled = false;
    btnUpload.textContent = 'Upload to Studio';
    if (durationInterval)
        clearInterval(durationInterval);
}
function setStatus(mode, message) {
    if (!statusBar || !statusSubText)
        return;
    statusBar.className = `status-strip ${mode}`;
    statusSubText.textContent = message;
}
function setButtonBusy(btn, busy, textWhenBusy) {
    if (!btn)
        return;
    if (!btn.dataset.defaultText) {
        btn.dataset.defaultText = btn.textContent || '';
    }
    btn.disabled = busy;
    btn.classList.toggle('is-busy', busy);
    btn.textContent = busy ? textWhenBusy : btn.dataset.defaultText;
    if (busy) {
        const spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        btn.prepend(spinner);
    }
}
function setUploadActionState(busy, textWhenBusy = 'Uploading...') {
    setButtonBusy(btnUpload, busy, textWhenBusy);
    btnDownload.disabled = busy;
    btnReset.disabled = busy;
}
function setUploadProgress(percent, message) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    uploadProgressWrap.classList.remove('hidden');
    uploadProgressFill.style.width = `${clamped}%`;
    uploadProgressText.textContent = message;
    uploadProgressPct.textContent = `${clamped}%`;
}
function hideUploadProgress() {
    uploadProgressWrap.classList.add('hidden');
    uploadProgressFill.style.width = '0%';
    uploadProgressText.textContent = 'Preparing upload...';
    uploadProgressPct.textContent = '0%';
}
function parseJsonOrFallback(raw, fallback) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
async function postJsonWithUploadProgress(url, bearerToken, payload, onProgress) {
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${bearerToken}`);
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable)
                return;
            onProgress?.(event.loaded, event.total);
        };
        xhr.onerror = () => reject(new Error('Network error while uploading recording'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.onload = () => {
            resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                bodyText: xhr.responseText || '',
            });
        };
        xhr.send(body);
    });
}
async function postGzippedWithUploadProgress(url, uploadToken, compressedBuffer, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('Content-Encoding', 'gzip');
        xhr.setRequestHeader('X-Upload-Token', uploadToken);
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable)
                return;
            onProgress?.(event.loaded, event.total);
        };
        xhr.onerror = () => reject(new Error('Network error while uploading recording'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.onload = () => {
            resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                bodyText: xhr.responseText || '',
            });
        };
        xhr.send(compressedBuffer);
    });
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parseStoredNumber(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw)
        return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function clampNumberInput(input, min, max, fallback) {
    const parsed = Number.parseInt(input.value, 10);
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    const clamped = clampNumber(safe, min, max);
    input.value = String(clamped);
    return clamped;
}
function sendMessageAsync(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (resp) => {
            if (chrome.runtime.lastError) {
                resolve(undefined);
                return;
            }
            resolve(resp);
        });
    });
}
function toBackendUploadPayload(source) {
    const metadata = source.metadata ?? {};
    const now = new Date().toISOString();
    const recordingId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const events = (source.events ?? []).map((event) => {
        const data = event.data ?? {};
        const eventContext = buildEventContext(event.type, data);
        return {
            timestampMs: event.timestampMs ?? 0,
            type: normalizeEventType(event.type),
            url: toShortString(data.url),
            title: toShortString(data.title),
            selector: buildSelector(data) || undefined,
            label: (toShortString(data.text) || toShortString(data.ariaLabel)) || undefined,
            fieldName: (toShortString(data.name) || toShortString(data.id)) || undefined,
            value: toShortString(data.value) || undefined,
            description: buildEventDescription(event.type, data),
            eventContext: eventContext || undefined,
        };
    });
    const speechTranscripts = (source.speechTranscript ?? [])
        .filter((seg) => typeof seg.text === 'string' && seg.text.trim().length > 0)
        .map((seg) => ({
        timestampMs: seg.startMs ?? 0,
        speaker: 'host',
        text: seg.text.trim(),
    }));
    const screenshots = (source.screenshots ?? [])
        .filter((shot) => typeof shot.imageDataUrl === 'string' && shot.imageDataUrl.startsWith('data:image/'))
        .slice(0, 12)
        .map((shot, index) => ({
        id: shot.id || `${recordingId}-shot-${index + 1}`,
        timestampMs: shot.timestampMs ?? 0,
        eventSequence: shot.eventSequence,
        reason: shot.reason || 'state_change',
        url: toShortString(shot.url) || undefined,
        title: toShortString(shot.title) || undefined,
        selector: toShortString(shot.selector) || undefined,
        label: toShortString(shot.label) || undefined,
        imageDataUrl: shot.imageDataUrl,
        thumbnailDataUrl: typeof shot.thumbnailDataUrl === 'string' && shot.thumbnailDataUrl.startsWith('data:image/')
            ? shot.thumbnailDataUrl
            : undefined,
    }));
    return {
        metadata: {
            recordingId,
            name: toShortString(metadata.title) || 'DocFlow Recording',
            createdAtUtc: toShortString(metadata.capturedAt) || now,
            createdBy: toShortString(metadata.recordedBy) || 'extension-user',
            productName: 'DocFlow Capture',
            productArea: toShortString(metadata.productArea) || 'Other',
            applicationVersion: toShortString(metadata.productVersion) || undefined,
            environment: toShortString(metadata.environment) || undefined,
        },
        events,
        speechTranscripts,
        screenshots,
    };
}
function normalizeEventType(type) {
    switch (type) {
        case 'navigation':
        case 'click':
        case 'input':
            return type;
        default:
            return 'custom';
    }
}
function buildSelector(data) {
    const tag = toShortString(data.tag);
    const id = toShortString(data.id);
    const className = toShortString(data.className);
    if (id)
        return `${tag || '*'}#${id}`;
    if (className)
        return `${tag || '*'} .${className.split(' ')[0]}`;
    return tag || '';
}
function buildEventDescription(type, data) {
    if (type === 'navigation')
        return `Navigated to ${toShortString(data.url) || 'new page'}`;
    if (type === 'click')
        return `Clicked ${toShortString(data.tag) || 'element'}`;
    if (type === 'input' || type === 'form_interaction') {
        return `Interacted with ${toShortString(data.name) || toShortString(data.id) || 'field'}`;
    }
    return `Captured ${type} event`;
}
function buildEventContext(type, data) {
    const context = {
        type,
        role: data.role,
        ariaLabel: data.ariaLabel,
        placeholder: data.placeholder,
        automationId: data.automationId,
        selector: data.selector,
        appContext: data.appContext,
        previousValue: data.previousValue,
        pointerType: data.pointerType,
        key: data.key,
        code: data.code,
        method: data.method,
        status: data.status,
        durationMs: data.durationMs,
        source: data.source,
        reason: data.reason,
        query: data.query,
    };
    const compactEntries = Object.entries(context).filter(([, value]) => {
        if (value === null || value === undefined)
            return false;
        if (typeof value === 'string' && value.trim().length === 0)
            return false;
        return true;
    });
    if (compactEntries.length === 0)
        return '';
    try {
        return JSON.stringify(Object.fromEntries(compactEntries)).slice(0, 1600);
    }
    catch {
        return '';
    }
}
function toShortString(value) {
    if (typeof value !== 'string')
        return '';
    return value.trim().slice(0, 300);
}
function readTokenExpiry(token) {
    try {
        const payload = token.split('.')[1];
        if (!payload)
            return null;
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const parsed = JSON.parse(decoded);
        if (!parsed.exp)
            return null;
        return new Date(parsed.exp * 1000);
    }
    catch {
        return null;
    }
}
void init();
//# sourceMappingURL=popup.js.map