# 🗺️ Project Plan: "Explain Any Codebase" Tool

> A full-stack learning project where you paste a GitHub URL and get a senior engineer's walkthrough of the codebase.

---

## What You're Building

A web app that:
1. Takes a GitHub repo URL as input
2. Fetches the repo's file structure and key files via the GitHub API
3. Sends relevant content to Claude (Anthropic API) with a well-crafted prompt
4. Returns a structured explanation: purpose, architecture, key files, how to run it, and how to contribute

---

## Recommended Tech Stack

Chosen specifically for **full-stack learning** — each piece teaches you something real.

| Layer | Technology | Why It Teaches |
|---|---|---|
| **Frontend** | React (Vite) | Component thinking, state, async UI |
| **Styling** | Tailwind CSS | Utility-first CSS, fast prototyping |
| **Backend** | Node.js + Express | REST APIs, routing, middleware |
| **AI** | Anthropic Claude API | Prompt engineering, streaming responses |
| **External API** | GitHub REST API | Auth headers, rate limits, pagination |
| **Deployment** | Vercel (frontend) + Railway or Render (backend) | Real deployment, env vars, CI/CD basics |

**Why not Next.js?** You could use it, but splitting frontend/backend teaches you more clearly what each side does. Once you understand both, Next.js will make much more sense.

---

## Phase 1 — Foundation (Do This First)

**Goal:** Get a working end-to-end prototype, no polish.

### Step 1.1 — Project Setup
- Create two folders: `client/` (React via Vite) and `server/` (Node + Express)
- Initialize git, add a `.gitignore` for `node_modules` and `.env`
- Install dependencies:
  - Client: `react`, `vite`, `tailwindcss`
  - Server: `express`, `axios`, `dotenv`, `cors`

### Step 1.2 — GitHub API Integration (Server)
- Create a `GET /api/repo` endpoint that accepts a `?url=` query param
- Parse the GitHub URL to extract `owner` and `repo` name
- Use the GitHub REST API to fetch:
  - Repo metadata (`/repos/{owner}/{repo}`)
  - File tree (`/repos/{owner}/{repo}/git/trees/HEAD?recursive=1`)
  - Key file contents (README, `package.json`, `requirements.txt`, main entry files)
- Return a structured JSON object to the frontend

**What you'll learn:** URL parsing, async/await, HTTP requests from a server, API keys in environment variables.

### Step 1.3 — Claude API Integration (Server)
- Add your Anthropic API key to `.env`
- Write a function that takes the repo data and builds a prompt
- Call the Claude API with that prompt
- Return the response to the frontend

**Starter prompt structure:**
```
You are a senior engineer onboarding a new developer onto a codebase.
Given the following repo information, explain:
1. What this project does (2-3 sentences)
2. The tech stack and why it likely exists
3. The folder structure and what each major part does
4. The most important files and what they contain
5. How to run the project locally
6. Where a new developer should start reading

Repo name: {name}
README: {readme}
File tree: {tree}
Key files: {files}
```

**What you'll learn:** Prompt engineering, working with AI APIs, structuring LLM output.

### Step 1.4 — Basic Frontend
- Single input field for a GitHub URL
- Submit button that calls your `/api/repo` endpoint
- Display the raw Claude response in a `<pre>` tag (no formatting yet)
- Show a loading state while waiting

**What you'll learn:** React state (`useState`), `fetch`/`axios`, controlled inputs, conditional rendering.

### ✅ Phase 1 Done When:
You can paste `https://github.com/expressjs/express` and see a coherent explanation appear in the browser.

---

## Phase 2 — Make It Real

**Goal:** Turn the prototype into something you'd actually show someone.

### Step 2.1 — Streaming Responses
- Switch from a single response to streaming (Claude supports server-sent events)
- Show the explanation appearing word-by-word like ChatGPT
- **What you'll learn:** Streams, `ReadableStream`, real-time UI updates

### Step 2.2 — Structured Output
- Prompt Claude to return Markdown
- Use a Markdown renderer (`react-markdown`) to display it nicely
- Add syntax highlighting for any code blocks (`highlight.js` or `prism`)
- **What you'll learn:** Markdown parsing, third-party React libraries

### Step 2.3 — Better UI
- Show a visual file tree of the repo
- Highlight which files Claude analyzed
- Add a "copy explanation" button
- Add error states: private repo, invalid URL, rate limit hit
- **What you'll learn:** UI component composition, error handling UX

### Step 2.4 — Rate Limiting & Caching
- Add simple in-memory caching on the server (cache results by repo URL for ~1 hour)
- Add rate limiting so one user can't spam the API
- **What you'll learn:** Server-side caching, `express-rate-limit`, thinking about costs

### ✅ Phase 2 Done When:
The app looks good, handles errors gracefully, and streams results. You'd share it in a portfolio.

---

## Phase 3 — Go Deeper (Pick What Interests You)

These are optional extensions depending on what you want to learn next.

### Option A — Authentication
- Add GitHub OAuth so users log in with their GitHub account
- Unlock private repo analysis for the logged-in user
- **Teaches:** OAuth flow, sessions/JWT, cookies

### Option B — Database + History
- Store past analyses in a database (PostgreSQL via Supabase, or SQLite)
- Let users revisit previous explanations without re-fetching
- **Teaches:** SQL basics, ORMs (Prisma), data modeling

### Option C — Deeper Analysis
- Analyze more files (not just README + entry point)
- Let users ask follow-up questions about the codebase (chat interface)
- Support GitLab and Bitbucket URLs
- **Teaches:** Multi-turn AI conversations, managing context windows

### Option D — Deploy It Publicly
- Deploy backend to Railway or Render
- Deploy frontend to Vercel
- Add a custom domain
- Set up environment variables in production
- **Teaches:** Real deployment, environment config, debugging in prod

---

## Suggested File Structure

```
explain-codebase/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── RepoInput.jsx
│   │   │   ├── ExplanationDisplay.jsx
│   │   │   └── FileTree.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
│
├── server/                    # Express backend
│   ├── routes/
│   │   └── repo.js            # /api/repo endpoint
│   ├── services/
│   │   ├── github.js          # GitHub API calls
│   │   └── claude.js          # Anthropic API calls
│   ├── utils/
│   │   └── parseGithubUrl.js
│   ├── index.js               # Express app entry
│   └── .env                   # API keys (never commit this)
│
├── .gitignore
└── README.md
```

---

## What to Build First

1. `mkdir explain-codebase && cd explain-codebase`
2. `mkdir client server`
3. In `server/`: `npm init -y && npm install express axios dotenv cors`
4. In `client/`: `npm create vite@latest . -- --template react && npm install`
5. Write the `parseGithubUrl` utility — takes a full URL, returns `{ owner, repo }`
6. Write the GitHub service — fetches README and file tree for a given owner/repo
7. Wire up a single Express route that returns that data as JSON
8. Test it with Postman or your browser before touching the frontend

Start small. Get data flowing. Build up from there.