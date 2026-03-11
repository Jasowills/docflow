/**
 * DocFlow Recorder - Background Service Worker (Manifest V3)
 * Manages recording state and message routing between popup/content scripts.
 */

import type { RecordingEvent, RecordingMetadata, SpeechTranscriptSegment } from './types';

function debugLogBg(..._args: unknown[]) {
  // Intentionally silent in production/dev to reduce extension console noise.
}

interface RecordingState {
  status: 'idle' | 'recording' | 'stopped';
  metadata: RecordingMetadata | null;
  events: RecordingEvent[];
  screenshots: RecordingScreenshot[];
  startedAt: string | null;
  tabId: number | null;
  audioWavBase64: string | null;
  transcript: SpeechTranscriptSegment[];
}

interface RecordingScreenshot {
  id: string;
  timestampMs: number;
  eventSequence?: number;
  reason: 'click' | 'form_interaction' | 'navigation' | 'state_change';
  url?: string;
  title?: string;
  selector?: string;
  label?: string;
  imageDataUrl: string;
  thumbnailDataUrl?: string;
}

interface ScreenshotFocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
}

interface ScreenshotCandidatePayload {
  reason: RecordingScreenshot['reason'];
  sequenceNumber?: number;
  timestampMs?: number;
  url?: string;
  title?: string;
  selector?: string;
  label?: string;
  focusRect?: ScreenshotFocusRect;
}

type MsgType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'CAPTURE_EVENT'
  | 'SCREENSHOT_CANDIDATE'
  | 'CAPTURE_TRANSCRIPT'
  | 'GET_STATUS'
  | 'GET_UPLOAD_AUTH_STATUS'
  | 'AUDIO_DATA'
  | 'DOWNLOAD_RECORDING'
  | 'UPLOAD_RECORDING'
  | 'SET_UPLOAD_AUTH';

interface BaseMsg {
  type: MsgType;
  payload?: unknown;
}

let state: RecordingState = {
  status: 'idle',
  metadata: null,
  events: [],
  screenshots: [],
  startedAt: null,
  tabId: null,
  audioWavBase64: null,
  transcript: [],
};

let audioDataWaiters: Array<() => void> = [];
let screenshotCaptureInFlight = false;
let lastScreenshotAtMs = 0;

const DEFAULT_SCREENSHOT_OUTPUT_WIDTH = 2560;
const DEFAULT_SCREENSHOT_OUTPUT_HEIGHT = 1440;
const DEFAULT_SCREENSHOT_QUALITY = 100;
const DEFAULT_SCREENSHOT_THUMBNAIL_QUALITY = 0.8;

interface ResolvedScreenshotSettings {
  outputWidth: number;
  outputHeight: number;
  outputQuality: number;
  thumbnailMaxSide: number;
  thumbnailQuality: number;
}

const CONTENT_SCRIPT_ELIGIBLE_URL = /^https?:\/\//i;

chrome.runtime.onMessage.addListener((message: BaseMsg, _sender, sendResponse) => {
  handleMessage(message, sendResponse).catch((error) => {
    console.error('Background message handler failed:', error);
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown background error',
    });
  });
  return true;
});

async function handleMessage(msg: BaseMsg, sendResponse: (resp: unknown) => void): Promise<void> {
  switch (msg.type) {
    case 'START_RECORDING': {
      const meta = msg.payload as RecordingMetadata;
      debugLogBg('[DocFlow][BG] START_RECORDING', {
        tabId: meta?.tabId,
        title: meta?.title,
      });
      if (!meta.tabId) {
        sendResponse({ ok: false, error: 'No active tab selected for capture' });
        return;
      }

      const captureReady = await ensureCaptureReady(meta.tabId);
      debugLogBg('[DocFlow][BG] captureReady', { tabId: meta.tabId, captureReady });
      if (!captureReady) {
        sendResponse({
          ok: false,
          error: 'Could not attach capture script to this tab. Reload the page and try again.',
        });
        return;
      }

      state = {
        status: 'recording',
        metadata: meta,
        events: [],
        screenshots: [],
        startedAt: new Date().toISOString(),
        tabId: meta.tabId ?? null,
        audioWavBase64: null,
        transcript: [],
      };
      screenshotCaptureInFlight = false;
      lastScreenshotAtMs = 0;

      if (state.tabId) {
        try {
          await chrome.tabs.sendMessage(state.tabId, {
            type: 'START_CAPTURE',
            payload: {
              captureMicrophone: meta.captureMicrophone !== false,
              captureScreenshots: meta.captureScreenshots !== false,
            },
          });
        } catch {
          // Content script may not be available on unsupported pages.
          sendResponse({
            ok: false,
            error: 'Failed to start capture in the selected tab',
          });
          return;
        }
      }

      sendResponse({ ok: true, status: state.status });
      return;
    }

    case 'STOP_RECORDING': {
      debugLogBg('[DocFlow][BG] STOP_RECORDING', {
        tabId: state.tabId,
        events: state.events.length,
        transcriptSegments: state.transcript.length,
      });
      if (state.tabId) {
        try {
          await chrome.tabs.sendMessage(state.tabId, { type: 'STOP_CAPTURE' });
        } catch {
          // Ignore when receiver is not available.
        }
      }
      state.status = 'stopped';
      await waitForAudioData(1200);

      const recording = buildRecording();
      await persistLastRecordingSnapshot(recording);
      debugLogBg('[DocFlow][BG] recording finalized', {
        events: recording.events.length,
        transcriptSegments: state.transcript.length,
        hasAudioWav: !!state.audioWavBase64,
        audioWavBytesApprox: state.audioWavBase64 ? Math.floor((state.audioWavBase64.length * 3) / 4) : 0,
      });
      sendResponse({ ok: true, recording, audioWavBase64: state.audioWavBase64 });
      return;
    }

    case 'CAPTURE_EVENT': {
      if (state.status === 'recording') {
        state.events.push(msg.payload as RecordingEvent);
      }
      sendResponse({ ok: true });
      return;
    }

    case 'SCREENSHOT_CANDIDATE': {
      if (state.status === 'recording') {
        await captureKeyScreenshot(msg.payload as ScreenshotCandidatePayload);
      }
      sendResponse({ ok: true });
      return;
    }

    case 'CAPTURE_TRANSCRIPT': {
      if (state.status === 'recording') {
        state.transcript.push(msg.payload as SpeechTranscriptSegment);
      }
      sendResponse({ ok: true });
      return;
    }

    case 'AUDIO_DATA': {
      const payload = msg.payload as { wavBase64?: string };
      if (payload?.wavBase64) {
        state.audioWavBase64 = payload.wavBase64;
        audioDataWaiters.forEach((resolve) => resolve());
        audioDataWaiters = [];
        debugLogBg('[DocFlow][BG] AUDIO_DATA received', {
          bytesApprox: Math.floor((payload.wavBase64.length * 3) / 4),
          status: state.status,
        });
      }
      sendResponse({ ok: true });
      return;
    }

    case 'GET_STATUS': {
      sendResponse({
        status: state.status,
        eventCount: state.events.length,
        screenshotCount: state.screenshots.length,
        startedAt: state.startedAt,
        metadata: state.metadata,
      });
      return;
    }

    case 'DOWNLOAD_RECORDING': {
      const stored = await chrome.storage.session.get([
        'lastRecording',
        'lastRecordingAudioWav',
      ]);
      const fallbackRecording = state.status === 'stopped' ? buildRecording() : null;
      const fallbackAudioWav = state.status === 'stopped' ? state.audioWavBase64 : null;
      debugLogBg('[DocFlow][BG] DOWNLOAD_RECORDING', {
        hasRecording: !!(stored.lastRecording ?? fallbackRecording),
        hasAudioWav: !!(stored.lastRecordingAudioWav ?? fallbackAudioWav),
      });
      sendResponse({
        recording: stored.lastRecording ?? fallbackRecording ?? null,
        audioWavBase64: stored.lastRecordingAudioWav ?? fallbackAudioWav ?? null,
      });
      return;
    }

    case 'SET_UPLOAD_AUTH': {
      const payload = msg.payload as { apiBaseUrl?: string; bearerToken?: string };
      const current = await chrome.storage.sync.get('docStudioUploadSettings');
      const existing = (current.docStudioUploadSettings || {}) as {
        apiBaseUrl?: string;
        bearerToken?: string;
      };
      const next = {
        apiBaseUrl: payload.apiBaseUrl || existing.apiBaseUrl || 'http://localhost:3001',
        bearerToken: payload.bearerToken || '',
      };
      await chrome.storage.sync.set({ docStudioUploadSettings: next });
      sendResponse({ ok: true });
      return;
    }

    case 'GET_UPLOAD_AUTH_STATUS': {
      const current = await chrome.storage.sync.get('docStudioUploadSettings');
      const existing = (current.docStudioUploadSettings || {}) as {
        apiBaseUrl?: string;
        bearerToken?: string;
      };
      const token = (existing.bearerToken || '').trim();
      const expiry = readTokenExpiry(token);
      const connected = !!token && !!expiry && expiry.getTime() > Date.now();
      sendResponse({
        ok: true,
        connected,
        expiresAtUtc: expiry ? expiry.toISOString() : null,
      });
      return;
    }

    default:
      sendResponse({ ok: false, error: `Unknown message type: ${msg.type}` });
  }
}

async function waitForAudioData(timeoutMs: number): Promise<void> {
  if (state.audioWavBase64) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      audioDataWaiters = audioDataWaiters.filter((waiter) => waiter !== onAudioData);
      resolve();
    }, timeoutMs);
    const onAudioData = () => {
      clearTimeout(timeout);
      resolve();
    };
    audioDataWaiters.push(onAudioData);
  });
}

async function ensureCaptureReady(tabId: number): Promise<boolean> {
  const alive = await pingCaptureScript(tabId);
  if (alive) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
    });
  } catch {
    return false;
  }

  return pingCaptureScript(tabId);
}

async function pingCaptureScript(tabId: number): Promise<boolean> {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING_CAPTURE' }) as { ok?: boolean };
    return !!resp?.ok;
  } catch {
    return false;
  }
}

function buildRecording() {
  const endedAt = new Date().toISOString();
  const durationMs = state.startedAt
    ? new Date(endedAt).getTime() - new Date(state.startedAt).getTime()
    : 0;

  return {
    schemaVersion: '1.0',
    metadata: {
      ...(state.metadata ?? {}),
      capturedAt: state.startedAt,
      durationMs,
    },
    events: state.events,
    screenshots: state.screenshots,
    speechTranscript: state.transcript.length > 0 ? state.transcript : undefined,
  };
}

async function persistLastRecordingSnapshot(recording: ReturnType<typeof buildRecording>): Promise<void> {
  try {
    await chrome.storage.session.set({
      lastRecording: recording,
    });
  } catch (error) {
    console.warn('Session storage quota hit while persisting full recording; falling back to compact snapshot.', error);
    try {
      await chrome.storage.session.set({
        lastRecording: compactRecordingForSession(recording),
      });
    } catch (fallbackError) {
      console.warn('Failed to persist compact recording snapshot to session storage.', fallbackError);
    }
  }
}

function compactRecordingForSession(recording: ReturnType<typeof buildRecording>) {
  return {
    ...recording,
    screenshots: (recording.screenshots ?? []).map((shot) => ({
      id: shot.id,
      timestampMs: shot.timestampMs,
      eventSequence: shot.eventSequence,
      reason: shot.reason,
      url: shot.url,
      title: shot.title,
      selector: shot.selector,
      label: shot.label,
    })),
  };
}

async function captureKeyScreenshot(payload: ScreenshotCandidatePayload): Promise<void> {
  if (!state.tabId) return;
  if (screenshotCaptureInFlight) return;
  if (state.screenshots.length >= 12) return;
  const screenshotSettings = resolveScreenshotSettings(state.metadata);

  const now = Date.now();
  const minIntervalMs = payload.reason === 'navigation' ? 700 : 1400;
  if (now - lastScreenshotAtMs < minIntervalMs) return;

  screenshotCaptureInFlight = true;
  try {
    const tab = await chrome.tabs.get(state.tabId);
    if (!tab.windowId) return;
    // Capture source pixels as PNG to avoid an extra lossy JPEG pass before resizing/cropping.
    const rawDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });

    let focusedDataUrl = rawDataUrl;
    try {
      focusedDataUrl = await buildFocusedScreenshotDataUrl(
        rawDataUrl,
        payload.focusRect,
        screenshotSettings,
      );
    } catch (error) {
      console.warn('Focused screenshot crop failed, using full screenshot', error);
      focusedDataUrl = rawDataUrl;
    }

    const thumbnailDataUrl = await createThumbnailDataUrl(
      focusedDataUrl,
      screenshotSettings.thumbnailMaxSide,
      screenshotSettings.thumbnailQuality,
    );
    const timestampMs = payload.timestampMs ?? computeTimestampMs();
    state.screenshots.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      timestampMs,
      eventSequence: payload.sequenceNumber,
      reason: payload.reason,
      url: payload.url,
      title: payload.title,
      selector: payload.selector,
      label: payload.label,
      imageDataUrl: focusedDataUrl,
      thumbnailDataUrl,
    });
    lastScreenshotAtMs = now;
  } catch (error) {
    console.warn('Screenshot capture failed', error);
  } finally {
    screenshotCaptureInFlight = false;
  }
}

function computeTimestampMs(): number {
  if (!state.startedAt) return 0;
  return Math.max(0, Date.now() - new Date(state.startedAt).getTime());
}

async function buildFocusedScreenshotDataUrl(
  sourceDataUrl: string,
  focusRect?: ScreenshotFocusRect,
  settings?: ResolvedScreenshotSettings,
): Promise<string> {
  const resolved = settings ?? resolveScreenshotSettings(state.metadata);
  return renderFixedFrameWithHighlight(
    sourceDataUrl,
    resolved.outputWidth,
    resolved.outputHeight,
    resolved.outputQuality,
    focusRect,
  );
}

async function createThumbnailDataUrl(
  sourceDataUrl: string,
  maxSide: number,
  quality: number,
): Promise<string> {
  return downscaleDataUrl(sourceDataUrl, maxSide, quality);
}

async function downscaleDataUrl(
  sourceDataUrl: string,
  maxSide: number,
  quality: number,
): Promise<string> {
  const sourceBlob = dataUrlToBlob(sourceDataUrl);
  const bitmap = await createImageBitmap(sourceBlob);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.max(1, Math.round(bitmap.width * ratio));
  const targetH = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return sourceDataUrl;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();
  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return blobToDataUrl(outBlob);
}

async function renderFixedFrameWithHighlight(
  sourceDataUrl: string,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  focusRect?: ScreenshotFocusRect,
): Promise<string> {
  const sourceBlob = dataUrlToBlob(sourceDataUrl);
  const bitmap = await createImageBitmap(sourceBlob);
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return sourceDataUrl;
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  if (focusRect && focusRect.width > 0 && focusRect.height > 0) {
    const viewportW = Math.max(1, focusRect.viewportWidth);
    const viewportH = Math.max(1, focusRect.viewportHeight);
    const scaleX = bitmap.width / viewportW;
    const scaleY = bitmap.height / viewportH;

    const fx = clamp(focusRect.x * scaleX, 0, bitmap.width - 1);
    const fy = clamp(focusRect.y * scaleY, 0, bitmap.height - 1);
    const fw = clamp(focusRect.width * scaleX, 1, bitmap.width);
    const fh = clamp(focusRect.height * scaleY, 1, bitmap.height);
    const focusCx = fx + fw / 2;
    const focusCy = fy + fh / 2;

    const targetAspect = targetWidth / targetHeight;
    const minCropW = bitmap.width * 0.45;
    const minCropH = bitmap.height * 0.45;
    let cropW = Math.max(fw * 3.2, minCropW);
    let cropH = Math.max(fh * 3.2, minCropH);

    if (cropW / cropH < targetAspect) {
      cropW = cropH * targetAspect;
    } else {
      cropH = cropW / targetAspect;
    }

    cropW = Math.min(cropW, bitmap.width);
    cropH = Math.min(cropH, bitmap.height);

    let cropX = focusCx - cropW / 2;
    let cropY = focusCy - cropH / 2;
    cropX = clamp(cropX, 0, bitmap.width - cropW);
    cropY = clamp(cropY, 0, bitmap.height - cropH);

    ctx.drawImage(
      bitmap,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    // Keep the focused target centered without drawing visual overlays.
  } else {
    // No focus target: keep full viewport visible with consistent output size.
    const fitRatio = Math.min(targetWidth / bitmap.width, targetHeight / bitmap.height);
    const drawWidth = Math.max(1, Math.round(bitmap.width * fitRatio));
    const drawHeight = Math.max(1, Math.round(bitmap.height * fitRatio));
    const offsetX = Math.floor((targetWidth - drawWidth) / 2);
    const offsetY = Math.floor((targetHeight - drawHeight) / 2);
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, offsetX, offsetY, drawWidth, drawHeight);
  }

  bitmap.close();
  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return blobToDataUrl(outBlob);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(data || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${blob.type || 'image/jpeg'};base64,${base64}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readTokenExpiry(token: string): Date | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded) as { exp?: number };
    if (!parsed.exp) return null;
    return new Date(parsed.exp * 1000);
  } catch {
    return null;
  }
}

function resolveScreenshotSettings(
  metadata: RecordingMetadata | null,
): ResolvedScreenshotSettings {
  const width = Math.round(
    clamp(
      Number(metadata?.screenshotWidth) || DEFAULT_SCREENSHOT_OUTPUT_WIDTH,
      960,
      3840,
    ),
  );
  const height = Math.round(
    clamp(
      Number(metadata?.screenshotHeight) || DEFAULT_SCREENSHOT_OUTPUT_HEIGHT,
      540,
      2160,
    ),
  );
  const quality = Math.round(
    clamp(
      Number(metadata?.screenshotQuality) || DEFAULT_SCREENSHOT_QUALITY,
      60,
      100,
    ),
  );

  const shorterSide = Math.min(width, height);
  return {
    outputWidth: width,
    outputHeight: height,
    outputQuality: clamp(quality / 100, 0.6, 1),
    thumbnailMaxSide: Math.round(clamp(shorterSide * 0.32, 280, 560)),
    thumbnailQuality: DEFAULT_SCREENSHOT_THUMBNAIL_QUALITY,
  };
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    if (!url || !CONTENT_SCRIPT_ELIGIBLE_URL.test(url)) {
      return;
    }

    const alive = await pingCaptureScript(tabId);
    if (alive) return;

    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
    });
  } catch {
    // Ignore tabs where script injection is not permitted.
  }
}

async function ensureContentScriptInjectedAllTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs
        .map((tab) => tab.id)
        .filter((id): id is number => typeof id === 'number')
        .map((tabId) => ensureContentScriptInjected(tabId)),
    );
  } catch {
    // Ignore bulk-injection failures.
  }
}

// Keep service worker alive while recording.
// Guard alarms API usage to avoid registration failures if permission/API is unavailable.
if (chrome.alarms?.onAlarm) {
  try {
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
  } catch (error) {
    console.warn('Failed to create keepAlive alarm:', error);
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive' && state.status === 'recording') {
      // no-op
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureContentScriptInjectedAllTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureContentScriptInjectedAllTabs();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    void ensureContentScriptInjected(tabId);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void ensureContentScriptInjected(activeInfo.tabId);
});

