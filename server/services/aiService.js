require("dotenv").config();

const OpenAI = require("openai");

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";
const FALLBACK_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
];

const LOCAL_FALLBACK_ENABLED =
  process.env.ENABLE_LOCAL_ANALYSIS_FALLBACK !== "false";

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

function toInlineCode(value) {
  return `\`${String(value).replace(/`/g, "\\`")}\``;
}

function getTopLevelFolders(tree) {
  return [...new Set(
    (tree || [])
      .map((item) => item.path.split("/")[0])
      .filter(Boolean)
  )].slice(0, 12);
}

function describeFile(path) {
  const filename = path.split("/").pop().toLowerCase();

  if (filename === "readme.md") return "project overview and contributor guidance";
  if (filename === "package.json") return "Node.js dependencies and npm scripts";
  if (filename === "requirements.txt" || filename === "pyproject.toml") {
    return "Python dependencies and project configuration";
  }
  if (filename.startsWith("vite.config") || filename.startsWith("next.config")) {
    return "frontend build configuration";
  }
  if (/^(index|main|app|server)\.(js|jsx|ts|tsx|py)$/.test(filename)) {
    return "a likely application entry point";
  }

  return "a file selected as useful onboarding context";
}

function getRunCommands(files) {
  const packageJsonEntry = Object.entries(files || {}).find(([path]) =>
    path.toLowerCase() === "package.json"
  );

  if (packageJsonEntry) {
    try {
      const scripts = JSON.parse(packageJsonEntry[1]).scripts || {};
      const command = scripts.dev ? "npm run dev" : scripts.start ? "npm start" : null;

      if (command) {
        return ["`npm install`", `\`${command}\``];
      }
    } catch {
      // A malformed package.json should not prevent a useful fallback overview.
    }

    return ["`npm install`", "Inspect `package.json` for the available npm scripts."];
  }

  if (Object.keys(files || {}).some((path) => path.toLowerCase() === "requirements.txt")) {
    return ["`python -m venv .venv`", "Activate the environment, then run `pip install -r requirements.txt`."];
  }

  return ["Start with the repository README for its setup instructions."];
}

function buildLocalRepoExplanation(repoData, reason) {
  const repository = repoData.repository || {};
  const analyzedFiles = repoData.analyzedFiles || [];
  const folders = getTopLevelFolders(repoData.tree);
  const runCommands = getRunCommands(repoData.files);
  const description = repository.description || "This repository does not provide a description.";
  const language = repository.language || "an undetected primary language";
  const repositoryUrl = repository.url || "";
  const repoLink = repositoryUrl ? `[${repository.fullName || repository.name}](${repositoryUrl})` : repository.fullName || repository.name || "this repository";

  const fileList = analyzedFiles.length
    ? analyzedFiles.map((path) => `- ${toInlineCode(path)} — ${describeFile(path)}`).join("\n")
    : "- No source files were available to inspect.";
  const folderList = folders.length
    ? folders.map((folder) => toInlineCode(folder)).join(", ")
    : "No folders were returned by GitHub.";
  const readingOrder = analyzedFiles.length
    ? analyzedFiles.slice(0, 6).map((path, index) => `${index + 1}. ${toInlineCode(path)}`).join("\n")
    : "1. Read the repository README.\n2. Inspect the main application entry point.";

  return `# ${repository.name || "Repository"} overview

> **Limited mode:** ${reason} This overview was generated directly from the repository metadata, file tree, and selected source files.

## What the project does

${repoLink} is described as: ${description}

The repository's primary language is **${language}** and its default branch is ${toInlineCode(repository.defaultBranch || "unknown")}.

## Architecture snapshot

- Top-level paths: ${folderList}
- The analysis selected ${analyzedFiles.length} file${analyzedFiles.length === 1 ? "" : "s"} as likely entry points or configuration.
- Start with the files below to verify how the application is composed.

## Important files

${fileList}

## How to run it locally

1. Clone ${repoLink}.
${runCommands.map((command, index) => `${index + 2}. ${command}`).join("\n")}

## Suggested reading order

${readingOrder}

## Next step

Restore the AI provider credentials to receive the full generated walkthrough. Until then, use this repository-derived map as a reliable starting point and verify behavior in the source.`;
}

function isAuthenticationError(error) {
  const status = error?.status || error?.response?.status;

  return status === 401 || /(?:invalid|incorrect|unauthorized).*api.?key/i.test(error?.message || "");
}

function fallbackReason(errors) {
  if (errors.some(isAuthenticationError)) {
    return "The configured AI provider credential was rejected.";
  }

  if (errors.some((error) => /missing openrouter_api_key/i.test(error?.message || ""))) {
    return "No AI provider credential is configured on the server.";
  }

  return "The AI provider is temporarily unavailable.";
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

async function getRepoExplanation(repoData) {
  const prompt = buildRepoPrompt(repoData);
  const candidateModels = getCandidateModels();
  const errors = [];
  let client;

  try {
    client = createAiClient();
  } catch (error) {
    if (LOCAL_FALLBACK_ENABLED) {
      return {
        content: buildLocalRepoExplanation(repoData, fallbackReason([error])),
        source: "local-fallback",
      };
    }

    throw error;
  }

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

      return {
        content: text,
        source: "ai",
      };
    } catch (error) {
      console.error(`OpenRouter provider error for model ${model}:`, error);

      errors.push(error);

      // Retrying another model cannot resolve an invalid provider credential.
      if (isAuthenticationError(error)) {
        break;
      }
    }
  }

  if (LOCAL_FALLBACK_ENABLED) {
    return {
      content: buildLocalRepoExplanation(repoData, fallbackReason(errors)),
      source: "local-fallback",
    };
  }

  throw new Error(
    `Failed to generate repository analysis. Tried models: ${errors
      .map((error, index) => `${candidateModels[index]}: ${error?.message || "Unknown provider error"}`)
      .join(" | ")}`
  );
}

async function explainRepo(repoData) {
  const explanation = await getRepoExplanation(repoData);

  return explanation.content;
}

module.exports = {
  buildRepoPrompt,
  buildLocalRepoExplanation,
  explainRepo,
  getRepoExplanation,
  streamRepoExplanation,
};
