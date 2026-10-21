import { ipcMain, desktopCapturer } from "electron";
import { captureFullScreen } from "./capture";
import {
  updateHotkeys,
  DEFAULT_SHORTCUTS,
  type ShortcutBindings,
} from "./hotkeys";
import Store from "electron-store";
import https from "https";
import http from "http";

const OLLAMA_URL = "http://127.0.0.1:11434";

// Only models activated by BuddieAI are tracked here.
let activeOllamaModel: string | null = null;

// Prevent multiple shutdown cleanup operations.
let ollamaShutdownInProgress = false;

const store = new Store({
  name: "BuddieAI-data",
  encryptionKey: "BuddieAI-secure-key-v1",
  defaults: {
    settings: {
      activeProvider: "gemini",
      activeModel: "gemini-3.5-flash",
      interviewType: "dsa",
      language: "python",
      apiKeys: {
        gemini: "",
        openai: "",
        anthropic: "",
        groq: "",
      },
    },
    history: [],
    savedProfile: null,
    user: null,
    subscription: { plan: "free", status: "active", expires_at: null },
    ads: [],
    shortcuts: DEFAULT_SHORTCUTS,
  },
});

export function getStoredShortcuts(): ShortcutBindings {
  return {
    ...DEFAULT_SHORTCUTS,
    ...(store.get("shortcuts") as
      | Partial<ShortcutBindings>
      | undefined),
  };
}

/**
 * Unload a specific Ollama model from memory.
 *
 * keep_alive: 0 tells Ollama to unload the model immediately
 * after this request completes.
 */
async function unloadOllamaModel(model: string): Promise<void> {
  if (!model) return;

  console.log(`[Ollama] Unloading BuddieAI model: ${model}`);

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      prompt: "",
      stream: false,
      keep_alive: 0,
    });

    const req = http.request(
      `${OLLAMA_URL}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (
            res.statusCode &&
            res.statusCode >= 200 &&
            res.statusCode < 300
          ) {
            console.log(`[Ollama] ✅ Unloaded ${model}`);
          } else {
            console.warn(
              `[Ollama] ⚠️ Could not unload ${model}: HTTP ${
                res.statusCode || "unknown"
              } ${data}`,
            );
          }

          resolve();
        });
      },
    );

    req.on("error", (error) => {
      console.warn(
        `[Ollama] ⚠️ Failed to unload ${model}:`,
        error.message,
      );

      resolve();
    });

    req.write(body);
    req.end();
  });
}

/**
 * Stop the model currently owned by BuddieAI.
 *
 * This does NOT stop Ollama itself.
 * It only unloads the model BuddieAI activated.
 */
export async function stopActiveOllamaModel(): Promise<void> {
  if (ollamaShutdownInProgress) {
    return;
  }

  ollamaShutdownInProgress = true;

  const model = activeOllamaModel;

  if (!model) {
    console.log("[Ollama] No BuddieAI model is currently active.");
    ollamaShutdownInProgress = false;
    return;
  }

  try {
    await unloadOllamaModel(model);
  } finally {
    activeOllamaModel = null;
    ollamaShutdownInProgress = false;
  }
}

/**
 * Activate one Ollama model for BuddieAI.
 *
 * If another model was previously activated by BuddieAI,
 * it is unloaded first.
 */
async function activateOllamaModel(model: string): Promise<void> {
  if (!model || typeof model !== "string") {
    throw new Error("No Ollama model selected.");
  }

  if (activeOllamaModel === model) {
    console.log(`[Ollama] ${model} is already active.`);
    return;
  }

  // Stop the previous BuddieAI model first.
  if (activeOllamaModel) {
    const previousModel = activeOllamaModel;

    console.log(
      `[Ollama] Switching ${previousModel} → ${model}`,
    );

    activeOllamaModel = null;

    await unloadOllamaModel(previousModel);
  }

  console.log(`[Ollama] Loading BuddieAI model: ${model}`);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      prompt: "",
      stream: false,

      // Keep the selected BuddieAI model loaded while BuddieAI is running.
      keep_alive: -1,
    });

    const req = http.request(
      `${OLLAMA_URL}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (
            res.statusCode &&
            res.statusCode >= 200 &&
            res.statusCode < 300
          ) {
            activeOllamaModel = model;

            console.log(
              `[Ollama] ✅ BuddieAI active model: ${model}`,
            );

            resolve();
          } else {
            reject(
              new Error(
                `Failed to activate Ollama model "${model}". ${
                  data || `HTTP ${res.statusCode || "unknown"}`
                }`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (error) => {
      reject(
        new Error(
          `Could not connect to Ollama at ${OLLAMA_URL}: ${error.message}`,
        ),
      );
    });

    req.write(body);
    req.end();
  });
}

export function registerIpcHandlers(): void {
  // User / Auth
  ipcMain.handle("get-user", () => store.get("user") || null);

  ipcMain.handle("save-user", (_event, user: any) => {
    store.set("user", user);
  });

  ipcMain.handle("logout-user", () => {
    store.set("user", null);
    store.set("ads", []);
  });

  // Ads
  ipcMain.handle("get-ads", () => store.get("ads") || []);

  ipcMain.handle("save-ads", (_event, ads: any[]) => {
    store.set("ads", ads);
  });

  // Desktop sources
  ipcMain.handle("BuddieAI:get-desktop-sources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        fetchWindowIcons: false,
      });

      return sources.map((s) => ({
        id: s.id,
        name: s.name,
      }));
    } catch (error) {
      console.error(
        "Failed to get desktop sources:",
        error,
      );

      throw error;
    }
  });

  // Full-screen capture
  ipcMain.handle("BuddieAI:capture-fullscreen", async () => {
    try {
      return await captureFullScreen();
    } catch (error) {
      console.error(
        "Failed to capture fullscreen:",
        error,
      );

      throw error;
    }
  });

  // Legacy capture
  ipcMain.handle("capture-screen", async () => {
    try {
      return await captureFullScreen();
    } catch (error) {
      console.error(
        "Failed to capture screen:",
        error,
      );

      throw error;
    }
  });

  // Keyboard shortcuts
  ipcMain.handle(
    "BuddieAI:get-shortcuts",
    () => getStoredShortcuts(),
  );

  ipcMain.handle(
    "BuddieAI:update-shortcuts",
    (_event, bindings: ShortcutBindings) => {
      if (!bindings || typeof bindings !== "object") {
        return {
          ok: false,
          failed: [],
        };
      }

      const merged = {
        ...DEFAULT_SHORTCUTS,
        ...bindings,
      };

      const result = updateHotkeys(merged);

      if (result.ok) {
        store.set("shortcuts", merged);
      }

      return result;
    },
  );

  ipcMain.handle(
    "BuddieAI:reset-shortcuts",
    () => {
      const result = updateHotkeys(DEFAULT_SHORTCUTS);

      store.set(
        "shortcuts",
        DEFAULT_SHORTCUTS,
      );

      return result;
    },
  );

  // Settings
  const DEAD_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
  ];

  const DEAD_GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
  ];

  ipcMain.handle("get-settings", () => {
    const settings = store.get("settings") as any;

    if (
      settings?.activeProvider === "gemini" &&
      DEAD_GEMINI_MODELS.includes(settings.activeModel)
    ) {
      settings.activeModel = "gemini-3.5-flash";
      store.set("settings", settings);
    }

    if (
      settings?.activeProvider === "groq" &&
      DEAD_GROQ_MODELS.includes(settings.activeModel)
    ) {
      settings.activeModel =
        "openai/gpt-oss-120b";

      store.set("settings", settings);
    }

    return settings;
  });

  ipcMain.handle(
    "save-settings",
    (_event, settings: any) => {
      if (
        settings &&
        typeof settings === "object" &&
        !Array.isArray(settings)
      ) {
        store.set("settings", settings);
      }
    },
  );

  // ============================================================
  // OLLAMA
  // ============================================================

  /**
   * Return only models installed locally in Ollama.
   */
  ipcMain.handle(
    "ollama:list-models",
    async () => {
      return new Promise((resolve, reject) => {
        const req = http.get(
          `${OLLAMA_URL}/api/tags`,
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                try {
                  const parsed = JSON.parse(data);

                  resolve(
                    Array.isArray(parsed.models)
                      ? parsed.models
                          .map((m: any) => m.name)
                          .filter(Boolean)
                      : [],
                  );
                } catch {
                  reject(
                    new Error(
                      "Invalid response from Ollama.",
                    ),
                  );
                }
              } else {
                reject(
                  new Error(
                    `Ollama is not available (HTTP ${
                      res.statusCode || "unknown"
                    }).`,
                  ),
                );
              }
            });
          },
        );

        req.on("error", () => {
          reject(
            new Error(
              "Ollama is not running. Please start Ollama.",
            ),
          );
        });
      });
    },
  );

  /**
   * Activate a model selected in BuddieAI.
   *
   * This unloads the previous BuddieAI model first.
   */
  ipcMain.handle(
    "ollama:use-model",
    async (_event, model: string) => {
      await activateOllamaModel(model);

      return {
        ok: true,
        model,
      };
    },
  );

  /**
   * Explicitly stop the currently active BuddieAI Ollama model.
   */
  ipcMain.handle(
    "ollama:stop-model",
    async () => {
      await stopActiveOllamaModel();

      return {
        ok: true,
      };
    },
  );

  /**
   * Return the model currently owned by BuddieAI.
   */
  ipcMain.handle(
    "ollama:get-active-model",
    () => activeOllamaModel,
  );

  // History
  ipcMain.handle(
    "get-history",
    () => store.get("history") || [],
  );

  ipcMain.handle(
    "save-history",
    (_event, history: any[]) => {
      if (Array.isArray(history)) {
        store.set(
          "history",
          history.slice(0, 30),
        );
      }
    },
  );

  // Saved Profile
  ipcMain.handle(
    "get-saved-profile",
    () => store.get("savedProfile") || null,
  );

  ipcMain.handle(
    "save-profile",
    (_event, profile: any) => {
      if (
        profile === null ||
        (profile &&
          typeof profile === "object" &&
          !Array.isArray(profile))
      ) {
        store.set("savedProfile", profile);
      }
    },
  );

  // NVIDIA API proxy
  ipcMain.handle(
    "nvidia-api-call",
    async (
      _event,
      {
        apiKey,
        body,
      }: {
        apiKey: string;
        body: any;
      },
    ) => {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);

        const options = {
          hostname: "integrate.api.nvidia.com",
          port: 443,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "Content-Length":
              Buffer.byteLength(postData),
          },
        };

        const req = https.request(
          options,
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                resolve({
                  ok: true,
                  status: res.statusCode,
                  data,
                });
              } else {
                resolve({
                  ok: false,
                  status: res.statusCode,
                  data,
                });
              }
            });
          },
        );

        req.on("error", (error) => {
          reject(error);
        });

        req.write(postData);
        req.end();
      });
    },
  );

  // NVIDIA key test
  ipcMain.handle(
    "nvidia-test-key",
    async (
      _event,
      { apiKey }: { apiKey: string },
    ) => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname:
            "integrate.api.nvidia.com",
          port: 443,
          path: "/v1/models",
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        };

        const req = https.request(
          options,
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                resolve({
                  ok: true,
                  status: res.statusCode,
                  data,
                });
              } else {
                resolve({
                  ok: false,
                  status: res.statusCode,
                  data,
                });
              }
            });
          },
        );

        req.on("error", (error) =>
          reject(error),
        );

        req.end();
      });
    },
  );

  // Anthropic API proxy
  ipcMain.handle(
    "anthropic-api-call",
    async (
      _event,
      {
        apiKey,
        body,
      }: {
        apiKey: string;
        body: any;
      },
    ) => {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);

        const options = {
          hostname: "api.anthropic.com",
          port: 443,
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "x-api-key": apiKey,
            "anthropic-version":
              "2023-06-01",
            "Content-Length":
              Buffer.byteLength(postData),
          },
        };

        const req = https.request(
          options,
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                resolve({
                  ok: true,
                  status: res.statusCode,
                  data,
                });
              } else {
                resolve({
                  ok: false,
                  status: res.statusCode,
                  data,
                });
              }
            });
          },
        );

        req.on("error", (error) => {
          reject(error);
        });

        req.write(postData);
        req.end();
      });
    },
  );
}