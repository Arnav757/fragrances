"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f1e8", color: "#161514", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>Something went wrong</h1>
          <p style={{ color: "#6b655d" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", background: "#161514", color: "#fbf8f2", border: 0, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
