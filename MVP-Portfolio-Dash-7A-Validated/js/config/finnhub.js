// A credential is entered by the owner at runtime and is never shipped with the app.
export const DEFAULT_FINNHUB_API_KEY = "";

export const FINNHUB_API_KEY_SOURCES = Object.freeze({
  SESSION: "session-entry",
  LEGACY_MIGRATION: "legacy-migration"
});
