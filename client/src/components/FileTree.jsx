function describeAnalyzedFile(path) {
  const filename = path.split("/").pop().toLowerCase();

  if (filename === "readme.md") {
    return "Project purpose, setup, and usage documentation";
  }

  if (filename === "package.json") {
    return "Dependencies, scripts, and package metadata";
  }

  if (filename.includes("config")) {
    return "Build or tooling configuration";
  }

  if (/^(index|main|app|server)\./.test(filename)) {
    return "Likely application entry point";
  }

  return "Selected source context";
}

function FileTree({ analyzedFiles }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">AI context</p>
          <h2>What the AI inspected</h2>
        </div>
      </div>

      <p className="panel__hint">
        These file contents were included in the prompt and directly informed
        the explanation.
      </p>

      <div className="analyzed-list" aria-label="Files read by the AI">
        {analyzedFiles.length ? (
          analyzedFiles.map((file) => (
            <div className="analyzed-file" key={file}>
              <code>{file}</code>
              <span>{describeAnalyzedFile(file)}</span>
            </div>
          ))
        ) : (
          <p className="panel__hint">No file contents were available.</p>
        )}
      </div>

    </section>
  );
}

export default FileTree;
