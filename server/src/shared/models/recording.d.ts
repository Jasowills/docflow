/** Supported application areas for captured workflows */
export type ProductArea = "Marketing Site" | "Web App" | "Admin Console" | "Customer Portal" | "Developer Portal" | "Mobile Web" | "API" | "Other";
/** Deployment environment where recording was taken */
export type RecordingEnvironment = "DEV" | "UAT" | "STAGING" | "PROD" | "DEMO";
/** Type of captured browser event */
export type RecordingEventType = "navigation" | "click" | "input" | "modal_open" | "modal_close" | "scroll" | "custom";
/** Metadata attached to every recording */
export interface RecordingMetadata {
    recordingId: string;
    name: string;
    createdAtUtc: string;
    createdBy: string;
    productName: string;
    productArea: ProductArea | string;
    applicationVersion?: string;
    environment?: RecordingEnvironment | string;
}
/** Single captured browser event */
export interface RecordingEvent {
    timestampMs: number;
    type: RecordingEventType;
    url?: string;
    title?: string;
    selector?: string;
    label?: string;
    fieldName?: string;
    value?: string;
    description?: string;
    eventContext?: string;
}
/** Time-aligned speech transcript segment */
export interface SpeechTranscriptSegment {
    timestampMs: number;
    speaker: string;
    text: string;
}
/** Key screenshot captured during recording */
export interface RecordingScreenshot {
    id: string;
    timestampMs: number;
    eventSequence?: number;
    reason: "click" | "form_interaction" | "navigation" | "state_change";
    url?: string;
    title?: string;
    selector?: string;
    label?: string;
    imageDataUrl?: string;
    thumbnailDataUrl?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
}
/** Complete recording object produced by the browser extension */
export interface Recording {
    metadata: RecordingMetadata;
    events: RecordingEvent[];
    speechTranscripts: SpeechTranscriptSegment[];
    screenshots?: RecordingScreenshot[];
}
/** Recording as persisted in DB (adds internal fields) */
export interface RecordingDocument extends Recording {
    _id?: string;
    userId: string;
    uploadedAtUtc: string;
    lastModifiedAtUtc?: string;
}
//# sourceMappingURL=recording.d.ts.map
