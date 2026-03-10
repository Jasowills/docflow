/** Standard paginated list response */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
/** Standard error response body */
export interface ApiErrorResponse {
    statusCode: number;
    message: string;
    error?: string;
    timestamp: string;
}
/** Query parameters for document listing */
export interface DocumentListQuery {
    page?: number;
    pageSize?: number;
    documentType?: string;
    productArea?: string;
    folder?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
}
/** Query parameters for recording listing */
export interface RecordingListQuery {
    page?: number;
    pageSize?: number;
    productArea?: string;
    search?: string;
}
/** Authenticated user context */
export interface UserContext {
    userId: string;
    email: string;
    displayName: string;
    roles: string[];
}
//# sourceMappingURL=api.d.ts.map
