import { useCallback, useEffect, useMemo, useRef } from "react";
import { createApiClient, createPublicApiClient } from "../services/api-client";
import { useAccessToken } from "../auth/use-access-token";
import type {
  Recording,
  RecordingDocument,
  RecordingSummary,
  GeneratedDocument,
  DocumentSummary,
  SystemConfig,
  PaginatedResponse,
  GenerateDocumentRequest,
  RecordingListQuery,
  DocumentListQuery,
  UpsertDocumentTypeRequest,
  UpsertFolderConfigRequest,
  ExtensionReleaseInfo,
  AuthProviderConfig,
  DashboardSummary,
  GithubConnectionStatus,
  GithubInstallUrlResponse,
  GithubRepoSelection,
  GithubRepositorySummary,
  ConnectGithubRequest,
  UpdateGithubRepoSelectionsRequest,
  AttachTestPlanSuitesRequest,
  CreateTestPlanRequest,
  CreateTestPlanRunRequest,
  TestPlan,
  TestPlanDetail,
  WorkspaceDetails,
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceMemberRoleRequest,
  UpdateWorkspaceRequest,
  WorkspaceInvitation,
} from "@docflow/shared";

/**
 * Hook for accessing all backend API operations.
 */
export function useApi() {
  const { getAccessToken } = useAccessToken();
  const getAccessTokenRef = useRef(getAccessToken);

  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const api = useMemo(
    () => createApiClient(() => getAccessTokenRef.current()),
    [],
  );
  const publicApi = useMemo(() => createPublicApiClient(), []);

  // ── Recordings ──────────────────────────────────
  const uploadRecording = useCallback(
    (recording: Recording) =>
      api<RecordingDocument>("/recordings", {
        method: "POST",
        body: recording,
      }),
    [api],
  );

  const listRecordings = useCallback(
    (query?: RecordingListQuery) => {
      const params = new URLSearchParams();
      if (query?.page) params.set("page", String(query.page));
      if (query?.pageSize) params.set("pageSize", String(query.pageSize));
      if (query?.productArea) params.set("productArea", query.productArea);
      if (query?.search) params.set("search", query.search);
      const qs = params.toString();
      return api<PaginatedResponse<RecordingSummary>>(
        `/recordings${qs ? `?${qs}` : ""}`,
        {
          debugSource: "useApi.listRecordings",
          debugMeta: {
            page: query?.page,
            pageSize: query?.pageSize,
            search: query?.search || "",
            productArea: query?.productArea || "",
          },
        },
      );
    },
    [api],
  );

  const getRecording = useCallback(
    (id: string) => api<RecordingDocument>(`/recordings/${id}`),
    [api],
  );

  const deleteRecording = useCallback(
    (id: string) => api<void>(`/recordings/${id}`, { method: "DELETE" }),
    [api],
  );

  const createExtensionUploadToken = useCallback(
    () =>
      api<{ token: string; expiresAtUtc: string }>(
        "/auth/extension-upload-token",
        {
          method: "POST",
        },
      ),
    [api],
  );

  const getLatestExtensionRelease = useCallback(
    () => api<ExtensionReleaseInfo>("/extensions/releases/latest"),
    [api],
  );

  const getAuthProviders = useCallback(
    () => publicApi<AuthProviderConfig>("/auth/providers"),
    [publicApi],
  );

  const getGithubStatus = useCallback(
    () => api<GithubConnectionStatus>("/integrations/github/status"),
    [api],
  );

  const getGithubInstallUrl = useCallback(
    () => api<GithubInstallUrlResponse>("/integrations/github/app/install-url"),
    [api],
  );

  const connectGithub = useCallback(
    (request: ConnectGithubRequest) =>
      api<GithubConnectionStatus>("/integrations/github/connect", {
        method: "POST",
        body: request,
      }),
    [api],
  );

  const disconnectGithub = useCallback(
    () => api<void>("/integrations/github/connect", { method: "DELETE" }),
    [api],
  );

  const listGithubRepos = useCallback(
    () => api<GithubRepositorySummary[]>("/integrations/github/repos"),
    [api],
  );

  const listSelectedGithubRepos = useCallback(
    () => api<GithubRepoSelection[]>("/integrations/github/repos/selected"),
    [api],
  );

  const updateSelectedGithubRepos = useCallback(
    (request: UpdateGithubRepoSelectionsRequest) =>
      api<GithubRepoSelection[]>("/integrations/github/repos/selected", {
        method: "PUT",
        body: request,
      }),
    [api],
  );

  const listTestPlans = useCallback(
    () => api<TestPlan[]>("/test-plans"),
    [api],
  );

  const createTestPlan = useCallback(
    (request: CreateTestPlanRequest) =>
      api<TestPlan>("/test-plans", {
        method: "POST",
        body: request,
      }),
    [api],
  );

  const getTestPlanDetail = useCallback(
    (planId: string) => api<TestPlanDetail>(`/test-plans/${planId}`),
    [api],
  );

  const attachTestPlanSuites = useCallback(
    (planId: string, request: AttachTestPlanSuitesRequest) =>
      api<TestPlanDetail>(`/test-plans/${planId}/test-suites`, {
        method: "PUT",
        body: request,
      }),
    [api],
  );

  const createTestPlanRun = useCallback(
    (planId: string, request: CreateTestPlanRunRequest) =>
      api(`/test-plans/${planId}/runs`, {
        method: "POST",
        body: request,
      }),
    [api],
  );

  const getCurrentWorkspace = useCallback(
    () => api<WorkspaceDetails>("/workspaces/current"),
    [api],
  );

  const updateCurrentWorkspace = useCallback(
    (request: UpdateWorkspaceRequest) =>
      api("/workspaces/current", {
        method: "PATCH",
        body: request,
      }),
    [api],
  );

  const inviteWorkspaceMember = useCallback(
    (request: InviteWorkspaceMemberRequest) =>
      api<WorkspaceInvitation>("/workspaces/current/invitations", {
        method: "POST",
        body: request,
      }),
    [api],
  );

  const updateWorkspaceMemberRole = useCallback(
    (userId: string, request: UpdateWorkspaceMemberRoleRequest) =>
      api<void>(`/workspaces/current/members/${userId}`, {
        method: "PATCH",
        body: request,
      }),
    [api],
  );

  const revokeWorkspaceInvitation = useCallback(
    (invitationId: string) =>
      api<void>(`/workspaces/current/invitations/${invitationId}`, {
        method: "DELETE",
      }),
    [api],
  );

  const getDashboardSummary = useCallback(
    () => api<DashboardSummary>("/dashboard/summary"),
    [api],
  );

  const updateOnboarding = useCallback(
    (body: { completed?: boolean; state?: Record<string, unknown> }) =>
      api("/auth/onboarding", {
        method: "PATCH",
        body,
      }),
    [api],
  );

  const updateAccountSetup = useCallback(
    (body: { accountType: "individual" | "team"; teamName?: string }) =>
      api("/auth/account-setup", {
        method: "PATCH",
        body,
      }),
    [api],
  );

  // ── Documents ──────────────────────────────────
  const generateDocuments = useCallback(
    (request: GenerateDocumentRequest) =>
      api<GeneratedDocument[]>("/documents/generate", {
        method: "POST",
        body: request,
      }),
    [api],
  );

  const listDocuments = useCallback(
    (query?: DocumentListQuery) => {
      const params = new URLSearchParams();
      if (query?.page) params.set("page", String(query.page));
      if (query?.pageSize) params.set("pageSize", String(query.pageSize));
      if (query?.documentType) params.set("documentType", query.documentType);
      if (query?.productArea) params.set("productArea", query.productArea);
      if (query?.folder) params.set("folder", query.folder);
      if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
      if (query?.dateTo) params.set("dateTo", query.dateTo);
      if (query?.search) params.set("search", query.search);
      const qs = params.toString();
      return api<PaginatedResponse<DocumentSummary>>(
        `/documents${qs ? `?${qs}` : ""}`,
        {
          debugSource: "useApi.listDocuments",
          debugMeta: {
            page: query?.page,
            pageSize: query?.pageSize,
            search: query?.search || "",
            documentType: query?.documentType || "",
            folder: query?.folder || "",
          },
        },
      );
    },
    [api],
  );

  const getDocument = useCallback(
    (id: string) => api<GeneratedDocument>(`/documents/${id}`),
    [api],
  );

  const deleteDocument = useCallback(
    (id: string) => api<void>(`/documents/${id}`, { method: "DELETE" }),
    [api],
  );

  const moveDocumentToFolder = useCallback(
    (id: string, folder: string) =>
      api<GeneratedDocument>(`/documents/${id}/folder`, {
        method: "PATCH",
        body: { folder },
      }),
    [api],
  );

  // ── Config ─────────────────────────────────────
  const getConfig = useCallback(() => api<SystemConfig>("/config"), [api]);

  const updateGlobalPrompt = useCallback(
    (globalSystemPrompt: string) =>
      api<SystemConfig>("/config/global-prompt", {
        method: "PUT",
        body: { globalSystemPrompt },
      }),
    [api],
  );

  const upsertDocumentType = useCallback(
    (docType: UpsertDocumentTypeRequest) =>
      api<SystemConfig>("/config/document-types", {
        method: "POST",
        body: docType,
      }),
    [api],
  );

  const deleteDocumentType = useCallback(
    (key: string) =>
      api<SystemConfig>(`/config/document-types/${key}`, {
        method: "DELETE",
      }),
    [api],
  );

  const upsertFolderConfig = useCallback(
    (folderConfig: UpsertFolderConfigRequest) =>
      api<SystemConfig>("/config/folder-configs", {
        method: "POST",
        body: folderConfig,
      }),
    [api],
  );

  const deleteFolderConfig = useCallback(
    (key: string) =>
      api<SystemConfig>(`/config/folder-configs/${key}`, {
        method: "DELETE",
      }),
    [api],
  );

  const uploadFolderPreviewImage = useCallback(
    (dataUrl: string, folderKey?: string) =>
      api<{ url: string }>("/config/folder-configs/upload-image", {
        method: "POST",
        body: { dataUrl, folderKey },
      }),
    [api],
  );

  const deleteAccount = useCallback(
    () => api<void>("/auth/account", { method: "DELETE" }),
    [api],
  );

  return {
    // Recordings
    uploadRecording,
    listRecordings,
    getRecording,
    deleteRecording,
    createExtensionUploadToken,
    getLatestExtensionRelease,
    getAuthProviders,
    getGithubStatus,
    getGithubInstallUrl,
    connectGithub,
    disconnectGithub,
    listGithubRepos,
    listSelectedGithubRepos,
    updateSelectedGithubRepos,
    listTestPlans,
    createTestPlan,
    getTestPlanDetail,
    attachTestPlanSuites,
    createTestPlanRun,
    getDashboardSummary,
    updateOnboarding,
    updateAccountSetup,
    getCurrentWorkspace,
    updateCurrentWorkspace,
    inviteWorkspaceMember,
    updateWorkspaceMemberRole,
    revokeWorkspaceInvitation,
    // Documents
    generateDocuments,
    listDocuments,
    getDocument,
    deleteDocument,
    moveDocumentToFolder,
    // Config
    getConfig,
    updateGlobalPrompt,
    upsertDocumentType,
    deleteDocumentType,
    upsertFolderConfig,
    deleteFolderConfig,
    uploadFolderPreviewImage,
    // Auth
    deleteAccount,
  };
}
