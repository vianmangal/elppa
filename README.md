<div align="center">

<img src="client/public/elppa-logo.png" alt="Elppa logo" width="96" />

# Elppa

**Turn a GitHub repository into a concise, AI-generated codebase walkthrough.**

[Live demo](https://elppa.vian1.tech) · [Report an issue](https://github.com/vianmangal/elppa/issues)

</div>

Elppa helps developers understand an unfamiliar repository without reading every file first. Paste a GitHub URL and the app collects repository metadata, maps the file tree, selects useful entry-point files, and generates a structured Markdown explanation through OpenRouter.

## Features

- Accepts GitHub repository URLs with or without `https://` and validates them server-side.
- Fetches repository metadata, the recursive file tree, and a curated set of important files through the GitHub API.
- Generates an onboarding-style explanation covering purpose, architecture, stack, important files, local setup, and a suggested reading order.
- Displays the repository tree and highlights files included in the analysis.
- Renders GitHub-flavoured Markdown with syntax-highlighted code blocks.
- Uses configurable OpenRouter models with automatic fallbacks.
- Includes request rate limiting and a one-hour in-memory analysis cache.
- Provides clear error states for invalid URLs, inaccessible repositories, provider limits, and missing configuration.

## How it works

```text
React + Vite client
        |
        | GET /api/repo?url=...
        v
Express API
   |                 |
   | GitHub API      | OpenRouter API
   v                 v
Repository context -> AI walkthrough
        |
        v
Markdown explanation + visual file tree
```

The backend intentionally sends a focused repository snapshot rather than every source file. This keeps prompts manageable and makes the result useful as an orientation guide rather than pretending to be a complete code audit.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS |
| Rendering | React Markdown, Remark GFM, Highlight.js |
| Backend | Node.js, Express 5 |
| Repository data | GitHub REST API |
| AI provider | OpenRouter through the OpenAI-compatible SDK |
| Reliability | Express rate limiting, model fallbacks, in-memory caching |

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm
- An [OpenRouter](https://openrouter.ai/) API key
- A GitHub token is recommended for higher API limits and repositories the token is allowed to read

### 1. Clone the repository

```bash
git clone https://github.com/vianmangal/elppa.git
cd elppa
```

### 2. Configure and start the API

```bash
cd server
npm install
cp .env.example .env
```

Update `server/.env`:

```dotenv
PORT=5001
GITHUB_TOKEN=your_github_token
OPENROUTER_API_KEY=your_openrouter_api_key

# Keep the app usable if the AI provider is unavailable or its key is rotated.
ENABLE_LOCAL_ANALYSIS_FALLBACK=true

# Optional model overrides
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
OPENROUTER_FALLBACK_MODELS=openrouter/free
```

Start the server:

```bash
node index.js
```

### 3. Start the client

In a second terminal:

```bash
cd client
npm install
```

Create `client/.env.local` when the API is not running at the default address:

```dotenv
VITE_API_BASE_URL=http://localhost:5001
```

Then start Vite:

```bash
npm run dev
```

Open the URL printed by Vite, paste a GitHub repository URL such as `github.com/expressjs/express`, and select **Analyze repository**.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic server status |
| `GET` | `/api/repo?url=<github-url>` | Return repository context and a generated walkthrough |
| `GET` | `/api/repo/stream?url=<github-url>` | Return the walkthrough through the event-stream endpoint |

The analysis endpoint is limited to 10 requests per 15 minutes per client. Successful results are cached in memory for one hour.

If OpenRouter rejects a key or is unavailable, Elppa serves a clearly labeled repository-derived overview by default. Set `ENABLE_LOCAL_ANALYSIS_FALLBACK=false` to return provider failures instead. A 401 from OpenRouter means the deployed `OPENROUTER_API_KEY` must be replaced with a valid key and the API redeployed.

## Project structure

```text
elppa/
├── client/                  # React interface
│   ├── public/              # Logo and background assets
│   └── src/components/      # Input, file tree, background, and explanation UI
├── server/
│   ├── index.js             # Express routes, cache, limits, and error handling
│   └── services/
│       ├── aiService.js     # Prompt construction and OpenRouter model fallback
│       └── githubService.js # GitHub URL parsing and repository collection
└── plan.md                  # Original product and learning plan
```

## Current limitations

- The cache is process-local and is cleared whenever the server restarts.
- Elppa analyzes a curated set of entry-point files, not the complete repository.
- Generated explanations may be incomplete or incorrect; verify important claims against the source.
- There is no user account, saved history, or persistent analysis database yet.
- Provider availability, context limits, and API rate limits affect results.

## Security

Keep `GITHUB_TOKEN` and `OPENROUTER_API_KEY` only in the server environment. Never expose them through `VITE_*` variables or commit a populated `.env` file.

## License

The server package currently declares the ISC license. Add a root `LICENSE` file before distributing the complete application as an open-source package.
