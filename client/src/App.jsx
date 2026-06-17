import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";
import DarkVeil from "./components/DarkVeil";
import ExplanationDisplay from "./components/ExplanationDisplay";
import FileTree from "./components/FileTree";
import RepoInput from "./components/RepoInput";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"
).replace(/\/$/, "");

const ERROR_MESSAGES = {
  INVALID_GITHUB_URL: {
    title: "Invalid repository URL",
    hint: "Paste a full GitHub repository URL like https://github.com/expressjs/express.",
  },
  REPOSITORY_NOT_FOUND: {
    title: "Repository unavailable",
    hint: "Double-check the URL. If the repo is private, add a GitHub token with access to it.",
  },
  PRIVATE_REPOSITORY: {
    title: "Private repository",
    hint: "This app can only analyze repos your current GitHub token can read.",
  },
  APP_RATE_LIMIT: {
    title: "Slow down a bit",
    hint: "The server is rate limiting repeated requests to control API costs.",
  },
  GITHUB_RATE_LIMIT: {
    title: "GitHub rate limit hit",
    hint: "Wait for the limit to reset or configure `GITHUB_TOKEN` on the server.",
  },
  PROVIDER_RATE_LIMIT: {
    title: "AI provider busy",
    hint: "Try again in a minute. The upstream model provider is throttling requests.",
  },
  CONFIGURATION_ERROR: {
    title: "Server configuration issue",
    hint: "Check the backend environment variables and restart the server.",
  },
};

function createErrorState(code, message) {
  const copy = ERROR_MESSAGES[code] || {
    title: "Analysis failed",
    hint: "Try again, or check the server logs if the error keeps happening.",
  };

  return {
    title: copy.title,
    message,
    hint: copy.hint,
  };
}

function App() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [repoData, setRepoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const deferredAnalysis = useDeferredValue(analysis);

  const flushTimerRef = useRef(null);
  const pendingContentRef = useRef([]);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
      }

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function resetStreamingBuffer() {
    pendingContentRef.current = [];

    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }

  function enqueueContent(content) {
    pendingContentRef.current.push(...Array.from(content));

    if (flushTimerRef.current) {
      return;
    }

    flushTimerRef.current = window.setInterval(() => {
      const next = pendingContentRef.current.shift();

      if (typeof next !== "string") {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
        return;
      }

      startTransition(() => {
        setAnalysis((current) => current + next);
      });
    }, 24);
  }

  async function handleCopy() {
    if (!analysis.trim()) {
      return;
    }

    await navigator.clipboard.writeText(analysis);
    setCopied(true);

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    resetStreamingBuffer();
    setCopied(false);
    setAnalysis("");
    setRepoData(null);
    setError(null);
    setLoading(true);
    setStatus("Fetching repository context...");

    try {
      const query = new URLSearchParams({
        url: url.trim(),
      });
      const response = await fetch(`${API_BASE_URL}/api/repo?${query}`);

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw {
          code: payload.code,
          message: payload.error || "The server could not analyze this repository.",
        };
      }

      const payload = await response.json();

      setRepoData({
        repository: payload.repository,
        tree: payload.tree,
        analyzedFiles: payload.analyzedFiles,
        cached: payload.cached,
      });
      setStatus(
        payload.cached
          ? "Loaded from cache and replaying the explanation..."
          : "Generating the walkthrough..."
      );
      enqueueContent(payload.analysis || "");
      setLoading(false);
      setStatus(
        payload.cached
          ? "Ready. This explanation came from the server cache."
          : "Ready. Fresh analysis complete."
      );
    } catch (caughtError) {
      setLoading(false);
      setStatus("");
      setError(
        createErrorState(
          caughtError?.code,
          caughtError?.message || "Something went wrong while streaming the response."
        )
      );
    }
  }

  const hasResults = Boolean(repoData || analysis || error);

  return (
    <>
      <div className="app-background" aria-hidden="true">
        <div className="app-background__veil">
          <DarkVeil
            hueShift={35}
            noiseIntensity={0}
            scanlineIntensity={0.2}
            speed={0.6}
            scanlineFrequency={0.5}
            warpAmount={0}
            resolutionScale={1}
          />
        </div>
        <div className="app-background__overlay" />
      </div>

      <main className="app-shell">
        <RepoInput
          url={url}
          onUrlChange={setUrl}
          onSubmit={handleSubmit}
          loading={loading}
          status={status}
        />

        {error && (
          <section className="notice-panel notice-panel--error">
            <p className="notice-panel__eyebrow">Request status</p>
            <h2>{error.title}</h2>
            <p>{error.message}</p>
            <p className="notice-panel__hint">{error.hint}</p>
          </section>
        )}

        {hasResults && (
          <section className="results-grid">
            <div className="results-grid__main">
              <ExplanationDisplay
                content={deferredAnalysis}
                loading={loading}
                copied={copied}
                onCopy={handleCopy}
              />
            </div>

            <aside className="results-grid__side">
              {repoData && (
                <section className="panel">
                  <div className="panel__header">
                    <div>
                      <p className="panel__eyebrow">Repository</p>
                      <h2>{repoData.repository.fullName}</h2>
                    </div>

                    {repoData.cached && (
                      <span className="status-chip">Cached</span>
                    )}
                  </div>

                  <p className="repo-summary">
                    {repoData.repository.description ||
                      "No description provided."}
                  </p>

                  <dl className="repo-stats">
                    <div>
                      <dt>Language</dt>
                      <dd>{repoData.repository.language || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Stars</dt>
                      <dd>{repoData.repository.stars}</dd>
                    </div>
                    <div>
                      <dt>Forks</dt>
                      <dd>{repoData.repository.forks}</dd>
                    </div>
                    <div>
                      <dt>Branch</dt>
                      <dd>{repoData.repository.defaultBranch}</dd>
                    </div>
                  </dl>
                </section>
              )}

              {repoData && (
                <FileTree
                  tree={repoData.tree}
                  analyzedFiles={repoData.analyzedFiles}
                />
              )}
            </aside>
          </section>
        )}
      </main>
    </>
  );
}

export default App;
