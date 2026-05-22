export {};

declare global {
  interface Window {
    __API_BASE__?: string;
    __ENV?: string;
    __SENTRY_DSN?: string;
  }
}
