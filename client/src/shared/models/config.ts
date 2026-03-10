// ─────────────────────────────────────────────────────────────
// Configuration Models
// ─────────────────────────────────────────────────────────────

/** Configuration for a single document type */
export interface DocumentTypeConfig {
  key: string;
  name: string;
  description: string;
  systemPrompt: string;
  isActive: boolean;
  sortOrder: number;
  createdAtUtc: string;
  lastModifiedAtUtc?: string;
}

/** Configuration for a folder card in Documents UI */
export interface FolderConfig {
  key: string;
  displayName: string;
  tag?: string;
  description?: string;
  previewImageUrl?: string;
  sortOrder: number;
  createdAtUtc: string;
  lastModifiedAtUtc?: string;
}

/** Top-level system configuration document */
export interface SystemConfig {
  _id?: string;
  configType: 'system';
  globalSystemPrompt: string;
  documentTypes: DocumentTypeConfig[];
  folderConfigs: FolderConfig[];
  lastModifiedAtUtc: string;
  lastModifiedBy: string;
}

/** Request to update the global system prompt */
export interface UpdateGlobalPromptRequest {
  globalSystemPrompt: string;
}

/** Request to create or update a document type */
export interface UpsertDocumentTypeRequest {
  key: string;
  name: string;
  description: string;
  systemPrompt: string;
  isActive: boolean;
  sortOrder?: number;
}

/** Request to create or update a folder config */
export interface UpsertFolderConfigRequest {
  key: string;
  displayName: string;
  tag?: string;
  description?: string;
  previewImageUrl?: string;
  sortOrder?: number;
}
