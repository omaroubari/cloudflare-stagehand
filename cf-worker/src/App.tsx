import { useState, useCallback } from "react";
import "./App.css";

type Tab = "navigate" | "act" | "extract" | "observe" | "screenshot";

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("navigate");

  const [modelName, setModelName] = useState("google/gemini-2.5-flash-lite");
  const [url, setUrl] = useState("https://www.qandaskin.com/");
  const [action, setAction] = useState("");
  const [extractInstruction, setExtractInstruction] = useState("");
  const [observeInstruction, setObserveInstruction] = useState("");

  const fetchApi = useCallback(
    async (endpoint: string, options?: RequestInit) => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch(`/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...options,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Request failed");
        }

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleNavigate = async () => {
    try {
      const data = await fetchApi("navigate", {
        body: JSON.stringify({ url, modelName }),
      });
      setResult(data);
    } catch {
      // error handled in fetchApi
    }
  };

  const handleAct = async () => {
    try {
      const data = await fetchApi("act", {
        body: JSON.stringify({ url, action, modelName }),
      });
      setResult(data);
    } catch {
      // error handled in fetchApi
    }
  };

  const handleExtract = async () => {
    try {
      const data = await fetchApi("extract", {
        body: JSON.stringify({
          url,
          instruction: extractInstruction || undefined,
          modelName,
        }),
      });
      setResult(data);
    } catch {
      // error handled in fetchApi
    }
  };

  const handleObserve = async () => {
    try {
      const data = await fetchApi("observe", {
        body: JSON.stringify({
          url,
          instruction: observeInstruction || undefined,
          modelName,
        }),
      });
      setResult(data);
    } catch {
      // error handled in fetchApi
    }
  };

  const handleScreenshot = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, modelName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Screenshot failed");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setScreenshotUrl(objectUrl);
      setResult({ success: true, message: "Screenshot captured" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "navigate", label: "Navigate" },
    { id: "act", label: "Act" },
    { id: "extract", label: "Extract" },
    { id: "observe", label: "Observe" },
    { id: "screenshot", label: "Screenshot" },
  ];

  return (
    <>
      <header id="header">
        <h1>Stagehand Test UI</h1>
      </header>

      <section id="controls">
        <div className="control-group">
          <label htmlFor="model">Model</label>
          <select
            id="model"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          >
            <option value="google/gemini-2.5-flash-lite">
              Gemini 2.5 Flash Lite
            </option>
            <option value="openai/gpt-4.1">GPT-4.1</option>
            <option value="openai/gpt-4o">GPT-4o</option>
            <option value="anthropic/claude-3-7-sonnet-latest">
              Claude 3.7 Sonnet
            </option>
            <option value="anthropic/claude-haiku-4-5">Claude Haiku 4.5</option>
          </select>
        </div>
      </section>

      <nav id="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section id="panel">
        {activeTab === "navigate" && (
          <div className="panel-content">
            <div className="input-group">
              <label htmlFor="url">URL</label>
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleNavigate}
              disabled={loading}
            >
              Navigate
            </button>
          </div>
        )}

        {activeTab === "act" && (
          <div className="panel-content">
            <div className="input-group">
              <label htmlFor="act-url">URL</label>
              <input
                id="act-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="input-group">
              <label htmlFor="action">Action</label>
              <input
                id="action"
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Click the login button"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAct}
              disabled={loading}
            >
              Execute
            </button>
          </div>
        )}

        {activeTab === "extract" && (
          <div className="panel-content">
            <div className="input-group">
              <label htmlFor="extract-url">URL</label>
              <input
                id="extract-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="input-group">
              <label htmlFor="extract-instruction">
                Instruction (optional)
              </label>
              <input
                id="extract-instruction"
                type="text"
                value={extractInstruction}
                onChange={(e) => setExtractInstruction(e.target.value)}
                placeholder="Extract all product prices"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={loading}
            >
              Extract
            </button>
          </div>
        )}

        {activeTab === "observe" && (
          <div className="panel-content">
            <div className="input-group">
              <label htmlFor="observe-url">URL</label>
              <input
                id="observe-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="input-group">
              <label htmlFor="observe-instruction">
                Instruction (optional)
              </label>
              <input
                id="observe-instruction"
                type="text"
                value={observeInstruction}
                onChange={(e) => setObserveInstruction(e.target.value)}
                placeholder="Find the search bar"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleObserve}
              disabled={loading}
            >
              Observe
            </button>
          </div>
        )}

        {activeTab === "screenshot" && (
          <div className="panel-content">
            <div className="input-group">
              <label htmlFor="screenshot-url">URL</label>
              <input
                id="screenshot-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleScreenshot}
              disabled={loading}
            >
              Take Screenshot
            </button>
            {screenshotUrl && (
              <div className="screenshot-container">
                <img src={screenshotUrl} alt="Page screenshot" />
              </div>
            )}
          </div>
        )}
      </section>

      {error && (
        <section id="error" className="output-section">
          <h3>Error</h3>
          <pre className="error-text">{error}</pre>
        </section>
      )}

      {result && (
        <section id="result" className="output-section">
          <h3>Result</h3>
          <pre className="result-text">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}

      <section id="spacer"></section>
    </>
  );
}

export default App;
