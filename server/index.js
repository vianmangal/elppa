require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const {
  parseGithubUrl,
  getRepoMetadata,
  getRepoTree,
  getImportantFiles,
} = require("./services/githubService");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/api/repo", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "GitHub URL required",
      });
    }

    const { owner, repo } = parseGithubUrl(url);

    const metadata = await getRepoMetadata(
      owner,
      repo
    );

    const tree = await getRepoTree(
      owner,
      repo
    );

    const files = await getImportantFiles(
      owner,
      repo,
      tree
    );

    res.json({
      repository: {
        name: metadata.name,
        description: metadata.description,
        stars: metadata.stargazers_count,
        forks: metadata.forks_count,
        language: metadata.language,
      },
      tree: tree.map((item) => item.path),
      files,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});
console.log("GitHub token:", process.env.GITHUB_TOKEN);
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
