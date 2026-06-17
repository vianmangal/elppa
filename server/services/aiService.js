require("dotenv").config();

const OpenAI = require("openai");

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";
const FALLBACK_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
];

function truncateText(value, maxLength) {
  if (!value) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`;
}

function hasConfiguredValue(value) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized !== "check env" &&
    normalized !== "your_openrouter_api_key";
}

function createAiClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!hasConfiguredValue(apiKey)) {
    throw new Error(
      "Missing OPENROUTER_API_KEY in server/.env. Add your OpenRouter API key and restart the server."
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });
}

function getCandidateModels() {
  const configuredModel = process.env.OPENROUTER_MODEL;
  const configuredFallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [
    configuredModel || DEFAULT_MODEL,
    ...configuredFallbacks,
    ...FALLBACK_MODELS,
  ].filter((model, index, models) => {
    return model && models.indexOf(model) === index;
  });
}

function extractText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!item) {
        return "";
      }

      if (typeof item === "string") {
        return item;
      }

      if (item.type === "text") {
        return item.text || "";
      }

      return "";
    })
    .join("");
}

function buildRepoPrompt(repoData) {
  const treePaths = Array.isArray(repoData.tree)
    ? repoData.tree.slice(0, 140).map((item) => item.path)
    : [];

  const keyFiles = Object.entries(repoData.files || {})
    .map(([path, content]) => {
      return `--- ${path} ---\n${truncateText(content, 1600)}`;
    })
    .join("\n\n");

  return `
You are a senior software engineer onboarding a teammate to a repository.

Analyze the repository below and respond in polished Markdown.

Formatting requirements:
- Start with a short title that includes the repository name.
- Use Markdown headings.
- Use bullet lists where they improve scanning.
- Reference important file paths in backticks.
- Include fenced code blocks only when they genuinely help explain setup or commands.
- Do not wrap the entire response in a code fence.

Cover these sections:
1. What the project does
2. Architecture snapshot
3. Tech stack
4. Important folders and files
5. How to run it locally
6. Suggested reading order for a new contributor

Repository metadata:
${JSON.stringify(repoData.repository, null, 2)}

Repository tree sample:
${JSON.stringify(treePaths, null, 2)}

Analyzed files:
${JSON.stringify(repoData.analyzedFiles, null, 2)}

Key file contents:
${keyFiles || "No key files were available."}
`;
}

async function streamRepoExplanation(repoData, options = {}) {
  const analysis = await explainRepo(repoData);

  if (typeof options.onChunk === "function") {
    options.onChunk(analysis);
  }

  return analysis;
}

async function explainRepo(repoData) {
  const prompt = buildRepoPrompt(repoData);
  const client = createAiClient();
  const candidateModels = getCandidateModels();
  const errors = [];

  for (const model of candidateModels) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const text = extractText(completion.choices?.[0]?.message?.content).trim();

      if (!text) {
        throw new Error("OpenRouter returned an empty response.");
      }

      return text;
    } catch (error) {
      console.error(`OpenRouter provider error for model ${model}:`, error);

      errors.push(`${model}: ${error?.message || "Unknown provider error"}`);
    }
  }

  throw new Error(
    `Failed to generate repository analysis. Tried models: ${errors.join(" | ")}`
  );
}

module.exports = {
  buildRepoPrompt,
  explainRepo,
  streamRepoExplanation,
};
