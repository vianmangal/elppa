import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

function ExplanationDisplay({ content, loading, copied, onCopy }) {
  return (
    <section className="panel panel--explanation">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Walkthrough</p>
          <h2>Repository explanation</h2>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onCopy}
          disabled={!content.trim()}
        >
          {copied ? "Copied" : "Copy explanation"}
        </button>
      </div>

      {!content && loading && (
        <div className="empty-state">
          <p className="empty-state__title">Starting the stream...</p>
          <p>The repository is being fetched and the explanation will appear here in real time.</p>
        </div>
      )}

      {!content && !loading && (
        <div className="empty-state">
          <p className="empty-state__title">No explanation yet</p>
          <p>Run an analysis to see a streamed Markdown walkthrough of the repository.</p>
        </div>
      )}

      {content && (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              a: ({ ...props }) => (
                <a {...props} target="_blank" rel="noreferrer" />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}

export default ExplanationDisplay;
