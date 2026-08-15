function RepoInput({ url, onUrlChange, onSubmit, loading, status }) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__content">
        <h1>Explain any public codebase.</h1>
        <p className="hero-panel__lede">
          Paste a GitHub repository URL—with or without https://—and watch the walkthrough stream in with
          structure, context, and a visual map of the files that were analyzed.
        </p>

        <form className="repo-form" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="repo-url">
            GitHub repository URL
          </label>

          <input
            id="repo-url"
            type="text"
            inputMode="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="github.com/expressjs/express"
            autoComplete="off"
            spellCheck="false"
          />

          <button type="submit" disabled={loading || !url.trim()}>
            {loading ? "Analyzing..." : "Analyze repository"}
          </button>
        </form>

        <div className="hero-panel__footer">
          <p>Streaming Markdown, highlighted code blocks, file tree, cache, and rate limits.</p>
          {status && <span className="live-pill">{status}</span>}
        </div>
      </div>
    </section>
  );
}

export default RepoInput;
