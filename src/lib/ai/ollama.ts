import type {
  AIProvider,
  AIRequestOptions,
} from "./types";

const OLLAMA_URL = "http://127.0.0.1:11434";

export class OllamaProvider implements AIProvider {
  name = "ollama";

  listModels(): string[] {
    return [];
  }

  async *streamSolution(
    options: AIRequestOptions,
  ): AsyncGenerator<string> {
    const {
      base64Image,
      prompt,
      messages = [],
      model,
      maxTokens = 4096,
    } = options;

    if (!model) {
      throw new Error(
        "No Ollama model selected.",
      );
    }

    const apiMessages: Array<{
      role: "user" | "assistant";
      content: string;
      images?: string[];
    }> = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const imageData =
      base64Image?.includes(",")
        ? base64Image.split(",")[1]
        : base64Image;

    const userMessage: {
      role: "user";
      content: string;
      images?: string[];
    } = {
      role: "user",
      content: prompt,
    };

    if (imageData) {
      userMessage.images = [imageData];
    }

    apiMessages.push(userMessage);

    const response = await fetch(
      `${OLLAMA_URL}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,

          // Stream the answer to BuddieAI.
          stream: true,

          // Disable Qwen3-style thinking.
          think: false,

          /*
           * IMPORTANT:
           *
           * Do NOT use keep_alive: -1 here.
           *
           * The Electron main process is responsible
           * for keeping the selected model loaded and
           * unloading it when BuddieAI closes.
           *
           * The model was already activated through:
           *
           *     ollama:use-model
           *
           * before this request starts.
           */
          options: {
            num_predict: maxTokens,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Ollama error: ${
          errorText ||
          response.statusText
        }`,
      );
    }

    if (!response.body) {
      throw new Error(
        "Ollama returned an empty response.",
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

    try {
      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true,
          },
        );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          try {
            const data =
              JSON.parse(line);

            const text =
              data.message?.content;

            if (
              typeof text ===
                "string" &&
              text.length > 0
            ) {
              yield text;
            }

            if (data.done) {
              return;
            }
          } catch {
            // Ignore malformed streaming lines.
          }
        }
      }

      // Process final buffered JSON.
      if (buffer.trim()) {
        try {
          const data =
            JSON.parse(buffer);

          const text =
            data.message?.content;

          if (
            typeof text ===
              "string" &&
            text.length > 0
          ) {
            yield text;
          }
        } catch {
          // Ignore incomplete final data.
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}