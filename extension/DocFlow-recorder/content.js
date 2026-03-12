"use strict";
/**
 * DocFlow Recorder - Content Script
 *
 * Injected into supported web pages. Captures DOM events (clicks, navigation,
 * form inputs, key interactions) and forwards them to the background service
 * worker as RecordingEvent objects.
 */
function debugLogContent(..._args) {
    // Intentionally silent in production/dev to reduce extension console noise.
}
let capturing = false;
let sequenceNumber = 0;
let sessionStartTime = null;
let extensionContextValid = true;
let lastPointerEventAt = 0;
let speechRecognition = null;
let shouldKeepSpeechRecognitionAlive = false;
let micStream = null;
let micAudioContext = null;
let micSourceNode = null;
let micWorkletNode = null;
let micSilenceNode = null;
let micWorkletModuleUrl = null;
let micProcessorNode = null;
let micPcmChunks = [];
let micCaptureMode = null;
let micNoDataTimer = null;
let micMediaRecorder = null;
let micMediaChunks = [];
let isMicrophoneEnabledForSession = true;
let isScreenshotCaptureEnabledForSession = true;
let lastInputValues = new WeakMap();
let contextCacheUrl = null;
let contextCache = null;
let originalFetch = null;
let originalXhrOpen = null;
let originalXhrSend = null;
const PCM_WORKLET_PROCESSOR = 'docflow-pcm-capture-processor';
const ENABLE_AUDIO_WORKLET_CAPTURE = true;
// ──────────────────────────────────────────────────────────────
// Message handling from background
// ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING_CAPTURE') {
        sendResponse({ ok: true });
        return false;
    }
    if (msg.type === "START_CAPTURE") {
        const payload = (msg.payload || {});
        startCapture(payload.captureMicrophone !== false, payload.captureScreenshots !== false);
        sendResponse({ ok: true });
        return false;
    }
    else if (msg.type === "STOP_CAPTURE") {
        void stopCapture()
            .then(() => sendResponse({ ok: true }))
            .catch((error) => sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        }));
        return true;
    }
    return false;
});
// Receive upload auth from Doc Studio web app and forward to extension storage via background.
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data)
        return;
    if (!extensionContextValid)
        return;
    const data = event.data;
    if (data.source !== 'docflow-app') {
        return;
    }
    if (data.type === 'PING_EXTENSION') {
        window.postMessage({
            source: 'docflow-recorder-extension',
            type: 'PING_EXTENSION_RESULT',
            ok: true,
            nonce: data.payload?.nonce,
        }, '*');
        return;
    }
    if (data.type === 'GET_EXTENSION_UPLOAD_AUTH_STATUS') {
        sendRuntimeMessage({ type: 'GET_UPLOAD_AUTH_STATUS' }, (resp) => {
            const typedResp = (resp || {});
            window.postMessage({
                source: 'docflow-recorder-extension',
                type: 'GET_EXTENSION_UPLOAD_AUTH_STATUS_RESULT',
                ok: !!typedResp.ok,
                connected: !!typedResp.connected,
                expiresAtUtc: typedResp.expiresAtUtc || null,
                nonce: data.payload?.nonce,
            }, '*');
        });
        return;
    }
    if (data.type !== 'SET_EXTENSION_UPLOAD_AUTH')
        return;
    const payload = data.payload || {};
    sendRuntimeMessage({ type: 'SET_UPLOAD_AUTH', payload }, (resp) => {
        const typedResp = (resp || {});
        window.postMessage({
            source: 'docflow-recorder-extension',
            type: 'SET_EXTENSION_UPLOAD_AUTH_RESULT',
            ok: !!typedResp.ok,
        }, '*');
    });
});
// ──────────────────────────────────────────────────────────────
// Capture lifecycle
// ──────────────────────────────────────────────────────────────
function startCapture(captureMicrophone = true, captureScreenshots = true) {
    if (capturing)
        return;
    debugLogContent('[DocFlow][CONTENT] startCapture');
    capturing = true;
    sequenceNumber = 0;
    sessionStartTime = Date.now();
    isMicrophoneEnabledForSession = captureMicrophone;
    isScreenshotCaptureEnabledForSession = captureScreenshots;
    // Emit a navigation event for the current page
    emitEvent('navigation', buildNavigationData());
    queueScreenshotCandidate('navigation');
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('pointerdown', onPointerCapture, true);
    document.addEventListener('input', onInputCapture, true);
    document.addEventListener('change', onChangeCapture, true);
    document.addEventListener('submit', onSubmitCapture, true);
    document.addEventListener('focusin', onFocusCapture, true);
    document.addEventListener('keydown', onKeydownCapture, true);
    // Observe URL changes (SPA navigation)
    observeNavigation();
    patchApiCalls();
    if (isMicrophoneEnabledForSession) {
        startSpeechCapture();
    }
}
async function stopCapture() {
    debugLogContent('[DocFlow][CONTENT] stopCapture begin');
    capturing = false;
    document.removeEventListener('click', onClickCapture, true);
    document.removeEventListener('pointerdown', onPointerCapture, true);
    document.removeEventListener('input', onInputCapture, true);
    document.removeEventListener('change', onChangeCapture, true);
    document.removeEventListener('submit', onSubmitCapture, true);
    document.removeEventListener('focusin', onFocusCapture, true);
    document.removeEventListener('keydown', onKeydownCapture, true);
    if (navObserver)
        navObserver.disconnect();
    restoreApiCallPatches();
    await stopSpeechCapture();
    debugLogContent('[DocFlow][CONTENT] stopCapture done');
}
// ──────────────────────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────────────────────
function onClickCapture(e) {
    if (Date.now() - lastPointerEventAt < 250) {
        return;
    }
    const el = getEventElement(e.target);
    if (!el)
        return;
    emitEvent('click', {
        ...extractElementContext(el),
        x: e.clientX,
        y: e.clientY,
    });
}
function onInputCapture(e) {
    const el = getEventElement(e.target);
    if (!el)
        return;
    const before = lastInputValues.get(el) || '';
    const after = getSanitizedElementValue(el);
    if (typeof after === 'string') {
        lastInputValues.set(el, after);
    }
    emitEvent('input', {
        ...extractElementContext(el),
        previousValue: sanitizeValue(before, 500),
        value: typeof after === 'string' ? sanitizeValue(after, 500) : after,
    });
}
function onChangeCapture(e) {
    const el = getEventElement(e.target);
    if (!el)
        return;
    const before = lastInputValues.get(el) || '';
    const after = getSanitizedElementValue(el);
    if (typeof after === 'string') {
        lastInputValues.set(el, after);
    }
    emitEvent('form_interaction', {
        ...extractElementContext(el),
        previousValue: sanitizeValue(before, 500),
        value: typeof after === 'string' ? sanitizeValue(after, 500) : after,
    });
    queueScreenshotCandidate('form_interaction', el);
}
function onSubmitCapture(e) {
    const form = e.target;
    emitEvent('form_interaction', {
        ...extractElementContext(form),
        tag: 'form',
        id: form.id || undefined,
        action: form.action || undefined,
        method: form.method || undefined,
    });
    queueScreenshotCandidate('form_interaction', form);
}
function onFocusCapture(e) {
    const el = getEventElement(e.target);
    if (!el)
        return;
    const value = getSanitizedElementValue(el);
    if (typeof value === 'string') {
        lastInputValues.set(el, value);
    }
    emitEvent('focus', {
        ...extractElementContext(el),
    });
}
function onKeydownCapture(e) {
    if (e.repeat)
        return;
    if (!['Enter', 'Tab', 'Escape'].includes(e.key))
        return;
    const el = getEventElement(e.target);
    if (!el)
        return;
    emitEvent('keyboard', {
        ...extractElementContext(el),
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
    });
    if (e.key === 'Enter') {
        queueScreenshotCandidate('state_change', el);
    }
}
// ──────────────────────────────────────────────────────────────
// SPA navigation detection
// ──────────────────────────────────────────────────────────────
let lastUrl = location.href;
let navObserver = null;
function observeNavigation() {
    // Detect pushState/replaceState
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);
    history.pushState = function (...args) {
        origPushState(...args);
        checkUrlChange();
    };
    history.replaceState = function (...args) {
        origReplaceState(...args);
        checkUrlChange();
    };
    window.addEventListener("popstate", checkUrlChange);
    // Fallback: watch for DOM mutations that might indicate route change
    navObserver = new MutationObserver(() => {
        checkUrlChange();
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
}
function checkUrlChange() {
    if (!capturing)
        return;
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        contextCacheUrl = null;
        contextCache = null;
        emitEvent('navigation', buildNavigationData());
        queueScreenshotCandidate('navigation');
    }
}
// ──────────────────────────────────────────────────────────────
// Emit event to background
// ──────────────────────────────────────────────────────────────
function emitEvent(type, data) {
    if (!capturing)
        return;
    const appContext = getAppContext();
    const event = {
        sequenceNumber: sequenceNumber++,
        timestampMs: Date.now() - (sessionStartTime ?? Date.now()),
        type,
        data: {
            appContext,
            ...data,
        },
    };
    sendRuntimeMessage({ type: 'CAPTURE_EVENT', payload: event });
}
function onPointerCapture(e) {
    lastPointerEventAt = Date.now();
    const el = getEventElement(e.target);
    if (!el)
        return;
    emitEvent('click', {
        ...extractElementContext(el),
        pointerType: e.pointerType,
        x: e.clientX,
        y: e.clientY,
    });
    queueScreenshotCandidate('click', el);
}
function queueScreenshotCandidate(reason, el) {
    if (!capturing)
        return;
    if (!isScreenshotCaptureEnabledForSession)
        return;
    const payload = {
        reason,
        sequenceNumber: Math.max(0, sequenceNumber - 1),
        timestampMs: Date.now() - (sessionStartTime ?? Date.now()),
        url: location.href,
        title: document.title,
    };
    if (el) {
        const ctx = extractElementContext(el);
        payload.selector = ctx.selector;
        payload.label = ctx.label || ctx.ariaLabel || ctx.text || undefined;
        payload.focusRect = getElementFocusRect(el);
    }
    sendRuntimeMessage({ type: 'SCREENSHOT_CANDIDATE', payload });
}
function getElementFocusRect(el) {
    if (!(el instanceof HTMLElement))
        return undefined;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0)
        return undefined;
    return {
        x: Math.max(0, rect.left),
        y: Math.max(0, rect.top),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
    };
}
function buildNavigationData() {
    const url = new URL(location.href);
    return {
        url: location.href,
        title: document.title,
        origin: url.origin,
        host: url.host,
        path: url.pathname,
        queryKeys: getQueryKeys(url),
        referrer: document.referrer || undefined,
    };
}
function extractElementContext(el) {
    const textCandidate = (el instanceof HTMLElement ? el.innerText : el.textContent) || '';
    const label = (el instanceof HTMLElement && el.getAttribute('aria-label')) ||
        findAssociatedLabel(el) ||
        undefined;
    const selector = buildElementSelector(el);
    const form = el instanceof HTMLElement
        ? el.closest('form')
        : null;
    const nameLike = getAttr(el, 'name') ||
        getAttr(el, 'id') ||
        undefined;
    return {
        tag: el.tagName.toLowerCase(),
        id: getAttr(el, 'id') || undefined,
        className: getAttr(el, 'class') || undefined,
        role: getAttr(el, 'role') || undefined,
        title: getAttr(el, 'title') || undefined,
        name: getAttr(el, 'name') || undefined,
        type: getAttr(el, 'type') || undefined,
        placeholder: getAttr(el, 'placeholder') || undefined,
        text: sanitizeValue(textCandidate, 200),
        href: getLinkHref(el),
        ariaLabel: getAttr(el, 'aria-label') || undefined,
        automationId: getAttr(el, 'data-automation-id') ||
            getAttr(el, 'data-testid') ||
            undefined,
        selector,
        fieldName: nameLike,
        formId: form?.id || undefined,
        formName: form?.getAttribute('name') || undefined,
        label: label ? sanitizeValue(label, 160) : undefined,
        checked: getCheckedState(el),
    };
}
function getAppContext() {
    if (contextCache && contextCacheUrl === location.href) {
        return contextCache;
    }
    const url = new URL(location.href);
    const context = {
        productName: detectProductName(),
        pageOrigin: url.origin,
        host: url.host,
        path: url.pathname,
        queryKeys: getQueryKeys(url),
        title: document.title || undefined,
    };
    contextCacheUrl = location.href;
    contextCache = context;
    return context;
}
function detectProductName() {
    const metaProductName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
        document.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
        document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content');
    return metaProductName?.trim() || document.title || undefined;
}
function getQueryKeys(url) {
    const keys = [];
    url.searchParams.forEach((_value, key) => {
        if (!keys.includes(key) && keys.length < 12) {
            keys.push(key);
        }
    });
    return keys;
}
function getEventElement(target) {
    if (!target)
        return null;
    if (target instanceof Element)
        return target;
    if (target instanceof Node && target.parentElement)
        return target.parentElement;
    return null;
}
function buildElementSelector(el) {
    const tag = el.tagName.toLowerCase();
    const id = getAttr(el, 'id');
    if (id)
        return `${tag}#${id}`;
    const dataAutomationId = getAttr(el, 'data-automation-id');
    if (dataAutomationId)
        return `${tag}[data-automation-id="${dataAutomationId}"]`;
    const name = getAttr(el, 'name');
    if (name)
        return `${tag}[name="${name}"]`;
    const className = getAttr(el, 'class');
    if (className) {
        const firstClass = className.split(/\s+/).find(Boolean);
        if (firstClass)
            return `${tag}.${firstClass}`;
    }
    return tag;
}
function findAssociatedLabel(el) {
    const id = getAttr(el, 'id');
    if (id) {
        const explicit = document.querySelector(`label[for="${id}"]`)?.textContent?.trim();
        if (explicit)
            return explicit;
    }
    const parentLabel = el.closest('label')?.textContent?.trim();
    if (parentLabel)
        return parentLabel;
    const ariaLabelledBy = getAttr(el, 'aria-labelledby');
    if (ariaLabelledBy) {
        const fromAria = ariaLabelledBy
            .split(/\s+/)
            .map((labelId) => document.getElementById(labelId)?.textContent?.trim() || '')
            .find((value) => value.length > 0);
        if (fromAria)
            return fromAria;
    }
    return null;
}
function getCheckedState(el) {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        return el.checked;
    }
    return undefined;
}
function getLinkHref(el) {
    const anchor = el instanceof HTMLAnchorElement ? el : el.closest('a');
    return anchor?.href || undefined;
}
function getAttr(el, attr) {
    return el.getAttribute(attr)?.trim() || '';
}
function getSanitizedElementValue(el) {
    if (el instanceof HTMLInputElement) {
        if (el.type === 'password' ||
            el.type === 'email' ||
            el.type === 'tel' ||
            el.type === 'number') {
            return '__redacted__';
        }
        if (el.type === 'checkbox' || el.type === 'radio') {
            return el.checked;
        }
        return el.value || '';
    }
    if (el instanceof HTMLTextAreaElement) {
        return el.value || '';
    }
    if (el instanceof HTMLSelectElement) {
        return el.value || '';
    }
    return undefined;
}
function sanitizeValue(value, maxLen) {
    if (!value)
        return undefined;
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized)
        return undefined;
    return normalized.slice(0, maxLen);
}
function patchApiCalls() {
    if (!originalFetch && typeof window.fetch === 'function') {
        originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const startedAt = performance.now();
            const method = init?.method || 'GET';
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            try {
                const response = await originalFetch(input, init);
                emitEvent('api_call', {
                    source: 'fetch',
                    method: method.toUpperCase(),
                    url: sanitizeValue(url, 600),
                    status: response.status,
                    ok: response.ok,
                    durationMs: Math.round(performance.now() - startedAt),
                });
                return response;
            }
            catch (error) {
                emitEvent('api_call', {
                    source: 'fetch',
                    method: method.toUpperCase(),
                    url: sanitizeValue(url, 600),
                    status: 'failed',
                    durationMs: Math.round(performance.now() - startedAt),
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        };
    }
    if (!originalXhrOpen && !originalXhrSend) {
        originalXhrOpen = XMLHttpRequest.prototype.open;
        originalXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
            this.__docflowMethod = method;
            this.__docflowUrl = typeof url === 'string' ? url : url.toString();
            return originalXhrOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
        };
        XMLHttpRequest.prototype.send = function (body) {
            this.__docflowStart = performance.now();
            const onDone = () => {
                const durationMs = Math.round(performance.now() - (this.__docflowStart ?? performance.now()));
                emitEvent('api_call', {
                    source: 'xhr',
                    method: (this.__docflowMethod || 'GET').toUpperCase(),
                    url: sanitizeValue(this.__docflowUrl, 600),
                    status: this.status || undefined,
                    ok: this.status >= 200 && this.status < 400,
                    durationMs,
                    readyState: this.readyState,
                });
            };
            this.addEventListener('loadend', onDone, { once: true });
            return originalXhrSend.call(this, body);
        };
    }
}
function restoreApiCallPatches() {
    if (originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
    }
    if (originalXhrOpen) {
        XMLHttpRequest.prototype.open = originalXhrOpen;
        originalXhrOpen = null;
    }
    if (originalXhrSend) {
        XMLHttpRequest.prototype.send = originalXhrSend;
        originalXhrSend = null;
    }
}
function sendRuntimeMessage(message, callback) {
    if (!extensionContextValid)
        return;
    try {
        chrome.runtime.sendMessage(message, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) {
                if (err.message?.includes('Extension context invalidated')) {
                    extensionContextValid = false;
                    stopCapture();
                    return;
                }
                return;
            }
            callback?.(resp);
        });
    }
    catch {
        extensionContextValid = false;
        stopCapture();
    }
}
function startSpeechCapture() {
    debugLogContent('[DocFlow][CONTENT] startSpeechCapture');
    startBrowserSpeechRecognition();
    void startMicrophoneCapture();
}
async function stopSpeechCapture() {
    // Keep this stopped to ensure transcript generation happens via backend Azure Speech.
    stopBrowserSpeechRecognition();
    await stopMicrophoneCapture();
    debugLogContent('[DocFlow][CONTENT] stopSpeechCapture done');
}
function startBrowserSpeechRecognition() {
    // Avoid multiple recognition engines when content script runs in all frames.
    if (window.top !== window)
        return;
    const SpeechCtor = window.SpeechRecognition ||
        window
            .webkitSpeechRecognition;
    if (!SpeechCtor)
        return;
    debugLogContent('[DocFlow][CONTENT] browser speech fallback available');
    shouldKeepSpeechRecognitionAlive = true;
    if (!speechRecognition) {
        speechRecognition = new SpeechCtor();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = false;
        speechRecognition.lang = navigator.language || 'en-US';
        speechRecognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                if (!result?.isFinal)
                    continue;
                const text = result[0]?.transcript?.trim();
                if (!text)
                    continue;
                const now = Date.now();
                const startMs = Math.max(0, now - (sessionStartTime ?? now));
                const segment = {
                    startMs,
                    endMs: startMs,
                    text,
                    confidence: typeof result[0]?.confidence === 'number' ? result[0].confidence : 0.8,
                };
                sendRuntimeMessage({ type: 'CAPTURE_TRANSCRIPT', payload: segment });
            }
        };
        speechRecognition.onerror = () => {
            // Ignore recognition errors; capture should continue.
        };
        speechRecognition.onend = () => {
            if (capturing && shouldKeepSpeechRecognitionAlive) {
                try {
                    speechRecognition?.start();
                }
                catch {
                    // Ignore restart failures.
                }
            }
        };
    }
    try {
        speechRecognition.start();
    }
    catch {
        // start() can throw if already started.
    }
}
function stopBrowserSpeechRecognition() {
    shouldKeepSpeechRecognitionAlive = false;
    try {
        speechRecognition?.stop();
    }
    catch {
        // Ignore stop failures.
    }
}
async function startMicrophoneCapture() {
    if (window.top !== window)
        return;
    if (!navigator.mediaDevices?.getUserMedia)
        return;
    if (micStream)
        return;
    debugLogContent('[DocFlow][CONTENT] mic capture start requested');
    try {
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            },
            video: false,
        });
        debugLogContent('[DocFlow][CONTENT] mic stream granted');
        startMediaRecorderCapture(micStream);
    }
    catch (error) {
        console.error('[DocFlow][CONTENT] mic getUserMedia failed', error);
        emitEvent('error', {
            source: 'microphone',
            stage: 'getUserMedia',
            error: error instanceof Error
                ? `${error.name}: ${error.message}`
                : String(error),
        });
        return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        console.error('[DocFlow][CONTENT] AudioContext unavailable');
        emitEvent('error', {
            source: 'microphone',
            stage: 'audio-context',
            error: 'AudioContext not available in page context',
        });
        stopMicStreamOnly();
        return;
    }
    try {
        micAudioContext = new AudioCtx({ sampleRate: 16000 });
    }
    catch {
        micAudioContext = new AudioCtx();
    }
    if (micAudioContext.state !== 'running') {
        try {
            await micAudioContext.resume();
            debugLogContent('[DocFlow][CONTENT] mic audio context resumed');
        }
        catch (error) {
            console.warn('[DocFlow][CONTENT] failed to resume audio context', error);
        }
    }
    debugLogContent('[DocFlow][CONTENT] mic audio context created', {
        sampleRate: micAudioContext.sampleRate,
        state: micAudioContext.state,
    });
    micPcmChunks = [];
    micSourceNode = micAudioContext.createMediaStreamSource(micStream);
    clearMicNoDataTimer();
    if (ENABLE_AUDIO_WORKLET_CAPTURE &&
        typeof AudioWorkletNode !== 'undefined' &&
        micAudioContext.audioWorklet) {
        try {
            await ensurePcmCaptureWorklet(micAudioContext);
            micWorkletNode = new AudioWorkletNode(micAudioContext, PCM_WORKLET_PROCESSOR);
            micSilenceNode = micAudioContext.createGain();
            micSilenceNode.gain.value = 0;
            micWorkletNode.port.onmessage = (event) => {
                if (!capturing)
                    return;
                const input = event.data;
                if (!input || input.length === 0)
                    return;
                micPcmChunks.push(floatToInt16(input));
            };
            micSourceNode.connect(micWorkletNode);
            micWorkletNode.connect(micSilenceNode);
            micSilenceNode.connect(micAudioContext.destination);
            micCaptureMode = 'worklet';
            micNoDataTimer = window.setTimeout(() => {
                if (!capturing || !micAudioContext)
                    return;
                if (micCaptureMode === 'worklet' && micPcmChunks.length === 0) {
                    console.warn('[DocFlow][CONTENT] worklet produced no frames; switching to ScriptProcessor');
                    void switchToScriptProcessorCapture();
                }
            }, 3000);
            debugLogContent('[DocFlow][CONTENT] using AudioWorklet capture path');
            return;
        }
        catch {
            console.warn('[DocFlow][CONTENT] AudioWorklet capture failed; falling back to ScriptProcessor');
            // Fall back to ScriptProcessor below for older/incompatible environments.
            micWorkletNode = null;
            if (micSilenceNode) {
                try {
                    micSilenceNode.disconnect();
                }
                catch {
                    // Ignore disconnect failures.
                }
            }
            micSilenceNode = null;
        }
    }
    await switchToScriptProcessorCapture();
}
async function stopMicrophoneCapture() {
    debugLogContent('[DocFlow][CONTENT] stopMicrophoneCapture begin');
    clearMicNoDataTimer();
    const mediaBlob = await stopMediaRecorderCapture();
    if (micWorkletNode) {
        try {
            micWorkletNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micWorkletNode.port.onmessage = null;
        micWorkletNode = null;
    }
    if (micProcessorNode) {
        try {
            micProcessorNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micProcessorNode.onaudioprocess = null;
        micProcessorNode = null;
    }
    if (micSilenceNode) {
        try {
            micSilenceNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micSilenceNode = null;
    }
    if (micSourceNode) {
        try {
            micSourceNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micSourceNode = null;
    }
    if (micAudioContext) {
        try {
            await micAudioContext.close();
        }
        catch {
            // Ignore close failures.
        }
    }
    const sampleRate = micAudioContext?.sampleRate ?? 16000;
    micAudioContext = null;
    if (micWorkletModuleUrl) {
        URL.revokeObjectURL(micWorkletModuleUrl);
        micWorkletModuleUrl = null;
    }
    micCaptureMode = null;
    stopMicStreamOnly();
    let wavBuffer = null;
    if (micPcmChunks.length > 0) {
        wavBuffer = encodePcmToWav(micPcmChunks, sampleRate);
    }
    else if (mediaBlob) {
        console.warn('[DocFlow][CONTENT] no PCM chunks captured; using MediaRecorder fallback');
        try {
            wavBuffer = await decodeRecordedBlobToWav(mediaBlob);
        }
        catch (error) {
            console.error('[DocFlow][CONTENT] MediaRecorder fallback decode failed', error);
            emitEvent('error', {
                source: 'microphone',
                stage: 'decode-fallback',
                error: error instanceof Error ? error.message : String(error),
            });
            wavBuffer = null;
        }
    }
    micPcmChunks = [];
    if (!wavBuffer) {
        console.warn('[DocFlow][CONTENT] no WAV audio produced from mic capture');
        emitEvent('error', {
            source: 'microphone',
            stage: 'stop',
            error: `No WAV audio produced (mode=${micCaptureMode || 'unknown'})`,
        });
        return;
    }
    const wavBase64 = arrayBufferToBase64(wavBuffer);
    debugLogContent('[DocFlow][CONTENT] WAV prepared', {
        sampleRate: 16000,
        bytes: wavBuffer.byteLength,
    });
    sendRuntimeMessage({
        type: 'AUDIO_DATA',
        payload: {
            wavBase64,
        },
    });
    debugLogContent('[DocFlow][CONTENT] AUDIO_DATA sent to background');
    micCaptureMode = null;
}
function stopMicStreamOnly() {
    if (micStream) {
        for (const track of micStream.getTracks()) {
            track.stop();
        }
    }
    micStream = null;
}
function startMediaRecorderCapture(stream) {
    if (typeof MediaRecorder === 'undefined')
        return;
    if (micMediaRecorder)
        return;
    micMediaChunks = [];
    const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
    ];
    const selectedMimeType = mimeCandidates.find((mime) => MediaRecorder.isTypeSupported(mime));
    try {
        micMediaRecorder = selectedMimeType
            ? new MediaRecorder(stream, { mimeType: selectedMimeType })
            : new MediaRecorder(stream);
    }
    catch (error) {
        console.warn('[DocFlow][CONTENT] MediaRecorder init failed', error);
        micMediaRecorder = null;
        return;
    }
    micMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            micMediaChunks.push(event.data);
        }
    };
    micMediaRecorder.onerror = (event) => {
        console.warn('[DocFlow][CONTENT] MediaRecorder error', event);
    };
    try {
        micMediaRecorder.start(1000);
        debugLogContent('[DocFlow][CONTENT] MediaRecorder started', {
            mimeType: micMediaRecorder.mimeType,
        });
    }
    catch (error) {
        console.warn('[DocFlow][CONTENT] MediaRecorder start failed', error);
        micMediaRecorder = null;
        micMediaChunks = [];
    }
}
async function stopMediaRecorderCapture() {
    if (!micMediaRecorder)
        return null;
    const recorder = micMediaRecorder;
    if (recorder.state === 'inactive') {
        const existingBlob = micMediaChunks.length > 0
            ? new Blob(micMediaChunks, { type: recorder.mimeType || 'audio/webm' })
            : null;
        micMediaRecorder = null;
        return existingBlob;
    }
    const stopped = new Promise((resolve) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => resolve();
    });
    try {
        recorder.stop();
    }
    catch {
        // Ignore stop failures.
    }
    await stopped;
    const blob = micMediaChunks.length > 0
        ? new Blob(micMediaChunks, { type: recorder.mimeType || 'audio/webm' })
        : null;
    debugLogContent('[DocFlow][CONTENT] MediaRecorder stopped', {
        chunks: micMediaChunks.length,
        bytes: blob?.size ?? 0,
    });
    micMediaRecorder = null;
    micMediaChunks = [];
    return blob;
}
async function decodeRecordedBlobToWav(blob) {
    const input = await blob.arrayBuffer();
    const decodeContext = new AudioContext();
    let decoded;
    try {
        decoded = await decodeContext.decodeAudioData(input.slice(0));
    }
    finally {
        await decodeContext.close();
    }
    const targetSampleRate = 16000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * targetSampleRate)), targetSampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const mono = rendered.getChannelData(0);
    const pcm = floatToInt16(mono);
    return encodePcmToWav([pcm], targetSampleRate);
}
function clearMicNoDataTimer() {
    if (micNoDataTimer) {
        window.clearTimeout(micNoDataTimer);
        micNoDataTimer = null;
    }
}
async function switchToScriptProcessorCapture() {
    if (!micAudioContext || !micSourceNode)
        return;
    if (micWorkletNode) {
        try {
            micWorkletNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micWorkletNode.port.onmessage = null;
        micWorkletNode = null;
    }
    if (micSilenceNode) {
        try {
            micSilenceNode.disconnect();
        }
        catch {
            // Ignore disconnect failures.
        }
        micSilenceNode = null;
    }
    if (micAudioContext.state !== 'running') {
        try {
            await micAudioContext.resume();
        }
        catch {
            // Ignore resume failures.
        }
    }
    micProcessorNode = micAudioContext.createScriptProcessor(4096, 1, 1);
    micProcessorNode.onaudioprocess = (event) => {
        if (!capturing)
            return;
        const input = event.inputBuffer.getChannelData(0);
        micPcmChunks.push(floatToInt16(input));
    };
    micSilenceNode = micAudioContext.createGain();
    micSilenceNode.gain.value = 0;
    micSourceNode.connect(micProcessorNode);
    micProcessorNode.connect(micSilenceNode);
    micSilenceNode.connect(micAudioContext.destination);
    micCaptureMode = 'scriptprocessor';
    debugLogContent('[DocFlow][CONTENT] using ScriptProcessor capture path');
}
async function ensurePcmCaptureWorklet(context) {
    if (micWorkletModuleUrl)
        return;
    const workletCode = `
class DocFlowPcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('${PCM_WORKLET_PROCESSOR}', DocFlowPcmCaptureProcessor);
`;
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    micWorkletModuleUrl = URL.createObjectURL(blob);
    await context.audioWorklet.addModule(micWorkletModuleUrl);
}
function floatToInt16(input) {
    const pcmChunk = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcmChunk[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcmChunk;
}
function encodePcmToWav(chunks, sampleRate) {
    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytesPerSample = 2;
    const numChannels = 1;
    const dataSize = totalSamples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i += 1) {
            view.setInt16(offset, chunk[i], true);
            offset += 2;
        }
    }
    return buffer;
}
function writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
//# sourceMappingURL=content.js.map