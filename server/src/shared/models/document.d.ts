/** Built-in document type keys (extensible via admin config) */
export type BuiltInDocumentType = 'user_reference' | 'tutorial' | 'release_notes';
/** Generated document stored in DB */
export interface GeneratedDocument {
    _id?: string;
    documentId: string;
    recordingId: string;
    documentType: string;
    documentTitle: string;
    content: string;
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
}
/** Request to generate documentation */
export interface GenerateDocumentRequest {
    recordingId: string;
    documentTypes: string[];
    documentTitle: string;
    folder?: string;
    guidance?: string;
    locale: string;
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
//# sourceMappingURL=document.d.ts.map
