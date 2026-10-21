import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("BuddieAI", {
  // Open URL in system browser (Chrome etc)
  openExternal: (url: string): void => ipcRenderer.send("BuddieAI:open-external", url),

  // System Audio source fetcher
  getDesktopSources: (): Promise<{id: string, name: string}[]> =>
    ipcRenderer.invoke("BuddieAI:get-desktop-sources"),

  // Mouse click-through control
  enableMouse: (): void => ipcRenderer.send("BuddieAI:enable-mouse"),
  disableMouse: (): void => ipcRenderer.send("BuddieAI:disable-mouse"),

  // Window control
  hide: (): void => ipcRenderer.send("BuddieAI:hide"),
  show: (): void => ipcRenderer.send("BuddieAI:show"),
  quit: (): void => ipcRenderer.send("BuddieAI:quit"),
  getVersion: (): string => ipcRenderer.sendSync("BuddieAI:get-version"),
  onShow: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:show", listener);
    return () => ipcRenderer.removeListener("BuddieAI:show", listener);
  },

  // Capture
  captureFullscreen: (): Promise<string> =>
    ipcRenderer.invoke("BuddieAI:capture-fullscreen"),

  // Settings persistence
  getSettings: (): Promise<any> => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: any): Promise<void> =>
    ipcRenderer.invoke("save-settings", settings),

  // Opacity control
  setOpacity: (value: number): void => ipcRenderer.send("BuddieAI:set-opacity", value),

  // History persistence
  getHistory: (): Promise<any[]> => ipcRenderer.invoke("get-history"),
  saveHistory: (history: any[]): Promise<void> =>
    ipcRenderer.invoke("save-history", history),

  // Profile persistence
  getSavedProfile: (): Promise<any> => ipcRenderer.invoke("get-saved-profile"),
  saveProfile: (profile: any): Promise<void> =>
    ipcRenderer.invoke("save-profile", profile),

  // Auth / User
  getUser: (): Promise<any> => ipcRenderer.invoke("get-user"),
  saveUser: (user: any): Promise<void> => ipcRenderer.invoke("save-user", user),
  logoutUser: (): Promise<void> => ipcRenderer.invoke("logout-user"),
  getAds: (): Promise<any[]> => ipcRenderer.invoke("get-ads"),
  saveAds: (ads: any[]): Promise<void> => ipcRenderer.invoke("save-ads", ads),
  onAuthToken: (cb: (data: { token: string; user: any }) => void): (() => void) => {
    const listener = (_: any, data: { token: string; user: any }): void => cb(data);
    ipcRenderer.on("BuddieAI:auth-token", listener);
    return () => ipcRenderer.removeListener("BuddieAI:auth-token", listener);
  },
  getPendingAuthToken: (): Promise<{ token: string; user: any } | null> =>
    ipcRenderer.invoke("BuddieAI:get-pending-auth-token"),

  // Deep link callback (Google OAuth)
  onDeepLink: (cb: (url: string) => void): (() => void) => {
    const listener = (_: any, url: string): void => cb(url);
    ipcRenderer.on("BuddieAI:deep-link", listener);
    return () => ipcRenderer.removeListener("BuddieAI:deep-link", listener);
  },

  // Events from main process (hotkeys)
  onScreenshot: (cb: (b64: string) => void): (() => void) => {
    const listener = (_: any, b64: string): void => cb(b64);
    ipcRenderer.on("BuddieAI:screenshot", listener);
    return () => ipcRenderer.removeListener("BuddieAI:screenshot", listener);
  },

  onSolve: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:solve", listener);
    return () => ipcRenderer.removeListener("BuddieAI:solve", listener);
  },

  onStartOver: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:start-over", listener);
    return () => ipcRenderer.removeListener("BuddieAI:start-over", listener);
  },

  onNextQuestion: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:next-question", listener);
    return () => ipcRenderer.removeListener("BuddieAI:next-question", listener);
  },

  onManualSend: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:manual-send", listener);
    return () => ipcRenderer.removeListener("BuddieAI:manual-send", listener);
  },

  onPrevQuestion: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:prev-question", listener);
    return () => ipcRenderer.removeListener("BuddieAI:prev-question", listener);
  },

  onNextQuestionPage: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:next-question-page", listener);
    return () => ipcRenderer.removeListener("BuddieAI:next-question-page", listener);
  },

  // Auto updater
  onUpdateAvailable: (cb: (version: string) => void): (() => void) => {
    const listener = (_: any, version: string): void => cb(version);
    ipcRenderer.on("BuddieAI:update-available", listener);
    return () => ipcRenderer.removeListener("BuddieAI:update-available", listener);
  },
  onUpdateProgress: (cb: (percent: number) => void): (() => void) => {
    const listener = (_: any, percent: number): void => cb(percent);
    ipcRenderer.on("BuddieAI:update-progress", listener);
    return () => ipcRenderer.removeListener("BuddieAI:update-progress", listener);
  },
  onUpdateDownloaded: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:update-downloaded", listener);
    return () => ipcRenderer.removeListener("BuddieAI:update-downloaded", listener);
  },
  onUpdateNotAvailable: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on("BuddieAI:update-not-available", listener);
    return () => ipcRenderer.removeListener("BuddieAI:update-not-available", listener);
  },
  onUpdateError: (cb: (msg: string) => void): (() => void) => {
    const listener = (_: any, msg: string): void => cb(msg);
    ipcRenderer.on("BuddieAI:update-error", listener);
    return () => ipcRenderer.removeListener("BuddieAI:update-error", listener);
  },
  downloadUpdate: (): void => ipcRenderer.send("BuddieAI:download-update"),
  installUpdate: (): void => ipcRenderer.send("BuddieAI:install-update"),
  checkForUpdates: (): void => ipcRenderer.send("BuddieAI:check-update"),

  // NVIDIA API proxy
  nvidiaApiCall: (apiKey: string, body: any): Promise<{ ok: boolean; status: number; data: string }> =>
    ipcRenderer.invoke("nvidia-api-call", { apiKey, body }),
  nvidiaTestKey: (apiKey: string): Promise<{ ok: boolean; status: number; data: string }> =>
    ipcRenderer.invoke("nvidia-test-key", { apiKey }),

  // Anthropic API proxy
  anthropicApiCall: (apiKey: string, body: any): Promise<{ ok: boolean; status: number; data: string }> =>
    ipcRenderer.invoke("anthropic-api-call", { apiKey, body }),

    // ADDED: Local Ollama model list
  ollamaListModels: (): Promise<string[]> =>
    ipcRenderer.invoke("ollama:list-models"),

  // ADDED: Load selected local Ollama model
  ollamaUseModel: (model: string): Promise<{ ok: boolean; model: string }> =>
    ipcRenderer.invoke("ollama:use-model", model),

  // Keyboard shortcuts
  getShortcuts: (): Promise<Record<string, string>> => ipcRenderer.invoke("BuddieAI:get-shortcuts"),
  updateShortcuts: (bindings: Record<string, string>): Promise<{ ok: boolean; failed: string[] }> =>
    ipcRenderer.invoke("BuddieAI:update-shortcuts", bindings),
  resetShortcuts: (): Promise<{ ok: boolean; failed: string[] }> =>
    ipcRenderer.invoke("BuddieAI:reset-shortcuts"),
});
