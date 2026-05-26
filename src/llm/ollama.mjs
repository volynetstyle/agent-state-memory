const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export class OllamaError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "OllamaError";
    this.cause = cause;
  }
}

export async function generateWithOllama(prompt, {
  model = process.env.OLLAMA_MODEL ?? "llama3.2:3b",
  baseUrl = process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
  temperature = 0,
  seed = 42
} = {}) {
  let response;

  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          seed,
          num_predict: 64
        }
      })
    });
  } catch (error) {
    throw new OllamaError(
      `Could not connect to Ollama at ${baseUrl}. Start Ollama and pull the model '${model}'.`,
      error
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new OllamaError(`Ollama returned HTTP ${response.status}: ${text}`);
  }

  const payload = await response.json();
  return String(payload.response ?? "").trim();
}
