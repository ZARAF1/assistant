import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { OpenRouterProvider } from "./openrouter";
import { NvidiaProvider } from "./nvidia";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GrokProvider } from "./grok";

// ADDED: Import local Ollama provider
import { OllamaProvider } from "./ollama";

import type { AIProvider } from "./types";

// ADDED: Ollama is now part of the supported provider list
export type ProviderName =
  | "groq"
  | "gemini"
  | "openrouter"
  | "nvidia"
  | "openai"
  | "anthropic"
  | "grok"
  | "ollama";

const providers: Record<ProviderName, AIProvider> = {
  groq: new GroqProvider(),
  gemini: new GeminiProvider(),
  openrouter: new OpenRouterProvider(),
  nvidia: new NvidiaProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  grok: new GrokProvider(),

  // ADDED: Register local Ollama provider
  ollama: new OllamaProvider(),
};

// EXISTING/RESTORED:
// Home.tsx uses this to obtain the active AI provider.
export function getProvider(name: ProviderName): AIProvider {
  const provider = providers[name];

  if (!provider) {
    throw new Error(
      `Unknown AI provider "${name}" — no implementation is registered for it.`
    );
  }

  return provider;
}

// EXISTING/RESTORED
export function getAllProviders(): Record<ProviderName, AIProvider> {
  return providers;
}

// EXISTING/RESTORED
export { providers };