function buildTree(items) {
  const root = [];

  for (const item of items) {
    const segments = item.path.split("/");
    let currentLevel = root;

    segments.forEach((segment, index) => {
      const currentPath = segments.slice(0, index + 1).join("/");
      let node = currentLevel.find((entry) => entry.path === currentPath);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          type: index === segments.length - 1 ? item.type : "tree",
          children: [],
        };
        currentLevel.push(node);
      }

      currentLevel = node.children;
    });
  }

  const sortNodes = (nodes) => {
    return nodes
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === "tree" ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(root);
}

function TreeBranch({ nodes, analyzed }) {
  return (
    <ul className="tree-list">
      {nodes.map((node) => {
        const isAnalyzed = node.type === "blob" && analyzed.has(node.path);

        return (
          <li key={node.path}>
            <div
              className={`tree-row ${node.type === "tree" ? "tree-row--folder" : ""} ${
                isAnalyzed ? "tree-row--analyzed" : ""
              }`}
            >
              <span className="tree-row__icon">
                {node.type === "tree" ? "▾" : "•"}
              </span>
              <span className="tree-row__name">{node.name}</span>
              {isAnalyzed && <span className="tree-badge">Analyzed</span>}
            </div>

            {node.children.length > 0 && (
              <TreeBranch nodes={node.children} analyzed={analyzed} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

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

function FileTree({ tree, analyzedFiles }) {
  const analyzed = new Set(analyzedFiles);
  const nestedTree = buildTree(tree);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">AI context</p>
          <h2>What the AI inspected</h2>
        </div>
      </div>

      <p className="panel__hint">
        File paths help the AI understand the repository structure. Only the
        selected files below were read in full.
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

      <details className="tree-disclosure">
        <summary>Browse the full repository tree ({tree.length} paths)</summary>
        <div className="tree-shell">
          <TreeBranch nodes={nestedTree} analyzed={analyzed} />
        </div>
      </details>
    </section>
  );
}

export default FileTree;
