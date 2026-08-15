require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const {
  getRepoExplanation,
} = require("./services/aiService");
const {
  parseGithubUrl,
  getRepoMetadata,
  getRepoTree,
  getImportantFiles,
} = require("./services/githubService");

const PORT = process.env.PORT || 5001;
const CACHE_TTL_MS = 60 * 60 * 1000;
const analysisCache = new Map();

app.use(cors());
app.use(express.json());

const repoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many analysis requests. Please wait a few minutes and try again.",
      code: "APP_RATE_LIMIT",
    });
  },
});

function cleanupExpiredCacheEntries() {
  const now = Date.now();

  for (const [key, value] of analysisCache.entries()) {
    if (value.expiresAt <= now) {
      analysisCache.delete(key);
    }
  }
}

function buildCacheKey(url) {
  const { owner, repo } = parseGithubUrl(url);

  return `${owner}/${repo}`.toLowerCase();
}

function getCachedAnalysis(url) {
  cleanupExpiredCacheEntries();

  const entry = analysisCache.get(buildCacheKey(url));

  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.payload;
}

function setCachedAnalysis(url, payload) {
  analysisCache.set(buildCacheKey(url), {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function buildRepoPayload(url) {
  const { owner, repo } = parseGithubUrl(url);
  const metadata = await getRepoMetadata(owner, repo);
  const tree = await getRepoTree(owner, repo);
  const files = await getImportantFiles(owner, repo, tree);

  return {
    repository: {
      name: metadata.name,
      fullName: metadata.full_name,
      description: metadata.description,
      stars: metadata.stargazers_count,
      forks: metadata.forks_count,
      language: metadata.language,
      url: metadata.html_url,
      defaultBranch: metadata.default_branch,
      visibility: metadata.private ? "private" : "public",
    },
    tree: tree
      .map((item) => ({
        path: item.path,
        type: item.type,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    analyzedFiles: Object.keys(files).sort((left, right) =>
      left.localeCompare(right)
    ),
    files,
  };
}

function formatAppError(error) {
  if (error.message === "Invalid GitHub URL") {
    return {
      status: 400,
      code: "INVALID_GITHUB_URL",
      message: "Enter a GitHub repository URL like github.com/owner/repo.",
    };
  }

  const upstreamStatus = error.response?.status;
  const rateLimitRemaining = error.response?.headers?.["x-ratelimit-remaining"];

  if (upstreamStatus === 404) {
    return {
      status: 404,
      code: "REPOSITORY_NOT_FOUND",
      message: "That repository could not be accessed. It may be private or the URL may be wrong.",
    };
  }

  if (upstreamStatus === 403 && rateLimitRemaining === "0") {
    return {
      status: 429,
      code: "GITHUB_RATE_LIMIT",
      message: "GitHub rate limit reached. Try again in a little while or add a GitHub token.",
    };
  }

  if (upstreamStatus === 403) {
    return {
      status: 403,
      code: "PRIVATE_REPOSITORY",
      message: "This repository appears to be private or inaccessible with the current GitHub token.",
    };
  }

  if (
    /missing openrouter_api_key/i.test(error.message) ||
    /missing anthropic_api_key/i.test(error.message)
  ) {
    return {
      status: 500,
      code: "CONFIGURATION_ERROR",
      message: error.message,
    };
  }

  if (upstreamStatus === 429) {
    return {
      status: 429,
      code: "PROVIDER_RATE_LIMIT",
      message: "The AI provider is rate limiting requests right now. Please try again shortly.",
    };
  }

  return {
    status: 500,
    code: "ANALYSIS_FAILED",
    message: error.message || "Something went wrong while analyzing this repository.",
  };
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/api/repo", repoLimiter, async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "GitHub URL required",
        code: "INVALID_GITHUB_URL",
      });
    }

    const cached = getCachedAnalysis(url);

    if (cached) {
      return res.json({
        ...cached,
        cached: true,
      });
    }

    const repoData = await buildRepoPayload(url);
    const explanation = await getRepoExplanation(repoData);
    const payload = {
      repository: repoData.repository,
      tree: repoData.tree,
      analyzedFiles: repoData.analyzedFiles,
      analysis: explanation.content,
      analysisSource: explanation.source,
    };

    setCachedAnalysis(url, payload);

    res.json({
      ...payload,
      cached: false,
    });
  } catch (error) {
    const appError = formatAppError(error);

    console.error("Failed to process /api/repo request:", error);

    res.status(appError.status).json({
      error: appError.message,
      code: appError.code,
    });
  }
});

app.get("/api/repo/stream", repoLimiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: "GitHub URL required",
      code: "INVALID_GITHUB_URL",
    });
  }

  try {
    const cached = getCachedAnalysis(url);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    if (cached) {
      writeSseEvent(res, "meta", {
        repository: cached.repository,
        tree: cached.tree,
        analyzedFiles: cached.analyzedFiles,
        analysisSource: cached.analysisSource,
        cached: true,
      });

      writeSseEvent(res, "delta", {
        content: cached.analysis,
      });

      writeSseEvent(res, "complete", {
        cached: true,
      });
      res.end();
      return;
    }

    const repoData = await buildRepoPayload(url);

    writeSseEvent(res, "meta", {
      repository: repoData.repository,
      tree: repoData.tree,
      analyzedFiles: repoData.analyzedFiles,
      cached: false,
    });

    const explanation = await getRepoExplanation(repoData);
    const streamedAnalysis = explanation.content;

    writeSseEvent(res, "delta", {
      content: streamedAnalysis,
    });

    const payload = {
      repository: repoData.repository,
      tree: repoData.tree,
      analyzedFiles: repoData.analyzedFiles,
      analysis: streamedAnalysis,
      analysisSource: explanation.source,
    };

    setCachedAnalysis(url, payload);

    writeSseEvent(res, "complete", {
      cached: false,
    });
    res.end();
  } catch (error) {
    const appError = formatAppError(error);

    console.error("Failed to process /api/repo/stream request:", error);

    if (!res.headersSent) {
      return res.status(appError.status).json({
        error: appError.message,
        code: appError.code,
      });
    }

    writeSseEvent(res, "error", {
      error: appError.message,
      code: appError.code,
    });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
