require("dotenv").config();

const axios = require("axios");

const token = process.env.GITHUB_TOKEN;

const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    ...(token &&
      token !== "your_github_personal_access_token" && {
        Authorization: `Bearer ${token}`,
      }),
  },
});

/**
 * Parse GitHub URL
 * Example:
 * https://github.com/expressjs/express
 */
function parseGithubUrl(url) {
  try {
    const cleaned = url.replace(/\/$/, "");
    const parts = cleaned.split("/");

    if (
      parts.length < 5 ||
      parts[2] !== "github.com"
    ) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[3],
      repo: parts[4],
    };
  } catch (error) {
    throw new Error("Invalid GitHub URL");
  }
}

/**
 * Fetch repository metadata
 */
async function getRepoMetadata(owner, repo) {
  const response = await github.get(
    `/repos/${owner}/${repo}`
  );

  return response.data;
}

/**
 * Fetch repository tree recursively
 */
async function getRepoTree(owner, repo) {
  const response = await github.get(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
  );

  return response.data.tree;
}

/**
 * Fetch file content
 */
async function getFileContent(owner, repo, path) {
  try {
    const response = await github.get(
      `/repos/${owner}/${repo}/contents/${path}`
    );

    if (!response.data.content) {
      return null;
    }

    return Buffer.from(
      response.data.content,
      "base64"
    ).toString("utf-8");
  } catch (error) {
    return null;
  }
}

/**
 * Fetch important project files
 */
async function getImportantFiles(owner, repo, tree) {
  const filesToLookFor = [
    "README.md",
    "README.MD",
    "package.json",
    "requirements.txt",
    "index.js",
    "main.py",
    "app.py",
    "server.js",
    "vite.config.js",
    "next.config.js",
  ];

  const results = {};

  for (const file of filesToLookFor) {
    const match = tree.find(
      (item) =>
        item.type === "blob" &&
        item.path.toLowerCase() === file.toLowerCase()
    );

    if (match) {
      const content = await getFileContent(
        owner,
        repo,
        match.path
      );

      if (content) {
        results[match.path] = content;
      }
    }
  }

  return results;
}

module.exports = {
  github,
  parseGithubUrl,
  getRepoMetadata,
  getRepoTree,
  getFileContent,
  getImportantFiles,
};