// ─────────────────────────────────────────────────────────────
// Document Models
// ─────────────────────────────────────────────────────────────

/** Built-in document type keys (extensible via admin config) */
export type BuiltInDocumentType =
  | 'user_reference'
  | 'tutorial'
  | 'test_case_suite'
  | 'release_notes';

export interface TestCaseGenerationContext {
  featureName?: string;
  targetPersona?: string;
  acceptanceCriteria?: string;
  environmentContext?: string;
  riskLevel?: string;
  outOfScope?: string;
}

/** Generated document stored in DB */
export interface GeneratedDocument {
  _id?: string;
  documentId: string;
  recordingId: string;
  documentType: string;
  documentTitle: string;
  content: string; // Markdown
  locale: string;
  createdAtUtc: string;
  createdBy: string;
  createdByName?: string;
  lastModifiedAtUtc?: string;
  lastModifiedBy?: string;
  /** Snapshot of recording metadata for reference */
  recordingName: string;
  productArea: string;
  folder?: string;
  workspaceId?: string;
}

/** Request to generate documentation */
export interface GenerateDocumentRequest {
  recordingId: string;
  documentTypes: string[];
  documentTitle: string;
  folder?: string;
  guidance?: string;
  locale: string;
  testCaseContext?: TestCaseGenerationContext;
}

/** Response after document generation */
export interface GenerateDocumentResponse {
  documents: GeneratedDocument[];
}

/** Summary for document list views */
export interface DocumentSummary {
  documentId: string;
  documentTitle: string;
  documentType: string;
  recordingId: string;
  recordingName: string;
  productArea: string;
  folder?: string;
  createdAtUtc: string;
  createdBy: string;
}
