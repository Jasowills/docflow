export type AppToastVariant = "info" | "success" | "error";

export interface AppToastDetail {
  title: string;
  message?: string;
  variant?: AppToastVariant;
}

export const APP_TOAST_EVENT = "docflow:toast";

export function showAppToast(detail: AppToastDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail }));
}
