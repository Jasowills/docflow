/**
 * Shared types for the DocFlow Recorder extension.
 * Mirrors a subset of @docflow/shared models for standalone use.
 */

export type RecordingEventType =
  | 'click'
  | 'navigation'
  | 'input'
  | 'keyboard'
  | 'selection_change'
  | 'form_interaction'
  | 'api_call'
  | 'state_change'
  | 'focus'
  | 'error'
  | 'custom';

export type ProductArea =
  | 'dashboard'
  | 'device_management'
  | 'alerts'
  | 'reporting'
  | 'settings'
  | 'user_management'
  | 'other';

export type RecordingEnvironment = 'production' | 'staging' | 'development' | 'test' | 'demo';

export interface RecordingEvent {
  sequenceNumber: number;
  timestampMs: number;
  type: RecordingEventType;
  data: Record<string, unknown>;
}

export interface SpeechTranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface RecordingMetadata {
  recordedBy: string;
  productVersion: string;
  productArea: ProductArea;
  environment: RecordingEnvironment;
  locale: string;
  title: string;
  description: string;
  tags: string[];
  captureMicrophone?: boolean;
  captureScreenshots?: boolean;
  screenshotWidth?: number;
  screenshotHeight?: number;
  screenshotQuality?: number;
  tabId?: number;
}


