require("dotenv").config();

const axios = require("axios");

const token = process.env.GITHUB_TOKEN;

const github = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    ...(token &&
      token !== "your_github_personal_access_token" &&
      token !== "check env" && {
        Authorization: `Bearer ${token}`,
      }),
  },
});

function parseGithubUrl(url) {
  try {
    const value = String(url || "").trim();
    const normalizedUrl = /^(?:www\.)?github\.com\//i.test(value)
      ? `https://${value}`
      : value;
    const parsed = new URL(normalizedUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname !== "github.com" && hostname !== "www.github.com") {
      throw new Error("Invalid GitHub URL");
    }

    const parts = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, ""),
    };
  } catch (error) {
    throw new Error("Invalid GitHub URL");
  }
}

async function getRepoMetadata(owner, repo) {
  const response = await github.get(`/repos/${owner}/${repo}`);

  return response.data;
}

async function getRepoTree(owner, repo) {
  const response = await github.get(
    `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
  );

  return response.data.tree || [];
}

async function getFileContent(owner, repo, path) {
  try {
    const response = await github.get(`/repos/${owner}/${repo}/contents/${path}`);

    if (!response.data.content) {
      return null;
    }

    return Buffer.from(response.data.content, "base64").toString("utf-8");
  } catch (error) {
    return null;
  }
}

async function getImportantFiles(owner, repo, tree) {
  const filesToLookFor = [
    "README.md",
    "package.json",
    "tsconfig.json",
    "vite.config.js",
    "vite.config.ts",
    "next.config.js",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "index.js",
    "main.py",
    "app.py",
    "server.js",
  ];

  const matches = filesToLookFor
    .map((file) =>
      tree.find((item) => {
        return item.type === "blob" &&
          item.path.toLowerCase() === file.toLowerCase();
      })
    )
    .filter(Boolean);

  const entries = await Promise.all(
    matches.map(async (match) => {
      const content = await getFileContent(owner, repo, match.path);

      if (!content) {
        return null;
      }

      return [match.path, content];
    })
  );

  return Object.fromEntries(entries.filter(Boolean));
}

module.exports = {
  github,
  parseGithubUrl,
  getRepoMetadata,
  getRepoTree,
  getFileContent,
  getImportantFiles,
};
