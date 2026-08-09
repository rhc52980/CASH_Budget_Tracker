import React from "react";
import ReactDOM from "react-dom/client";
import BudgetBook from "./BudgetBook.jsx";
import "./index.css";

// If anything ever throws during render, show a calm fallback instead of a
// blank page — the ledger data in localStorage is untouched either way.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("CASH crashed:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        background: "var(--paper)", color: "var(--ink)",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", padding: 20,
      }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>¢</div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "var(--mute)", margin: "0 0 16px" }}>
            The app hit an unexpected error. Your ledger data is safe — it lives
            in this browser and wasn't touched. Reloading usually fixes it.
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "var(--brass)", color: "#fff", fontSize: 14, fontWeight: 600,
          }}>
            Reload CASH
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BudgetBook />
    </ErrorBoundary>
  </React.StrictMode>
);

// Offline/installable support — only in production builds so dev HMR stays clean
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    const reg = await navigator.serviceWorker.register(new URL("sw.js", window.location.href));
    // When a new version finishes installing behind the scenes, let the app
    // offer a refresh instead of silently serving stale code
    reg.addEventListener("updatefound", () => {
      const fresh = reg.installing;
      if (!fresh) return;
      fresh.addEventListener("statechange", () => {
        if (fresh.state === "installed" && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("cash:update-ready"));
        }
      });
    });
  });
}
