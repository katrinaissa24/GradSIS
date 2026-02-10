export default function LandingPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>GradSIS</div>
        <nav style={{ display: "flex", gap: 14 }}>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="/auth">Log in</a>

        </nav>
      </header>

      <main style={{ marginTop: 64 }}>
        <h1 style={{ fontSize: 44, margin: 0 }}>Plan your graduation in minutes.</h1>
        <p style={{ fontSize: 18, maxWidth: 720, lineHeight: 1.4 }}>
          Generate a semester-by-semester plan, track requirements, and avoid prerequisite mistakes.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <a
            href="/auth"
            style={{ background: "#111", color: "#fff", padding: "12px 16px", borderRadius: 10, textDecoration: "none" }}
          >
            Sign up
          </a>
          <a
            href="#features"
            style={{ border: "1px solid #ddd", color: "#111", padding: "12px 16px", borderRadius: 10, textDecoration: "none" }}
          >
            See features
          </a>
        </div>

        <section id="features" style={{ marginTop: 64 }}>
          <h2>Features</h2>
          <ul>
            <li>Generate a semester plan</li>
            <li>Track graduation requirements</li>
            <li>Prerequisite validation (later)</li>
            <li>Save / export plan (later)</li>
          </ul>
        </section>

        <section id="how" style={{ marginTop: 40 }}>
          <h2>How it works</h2>
          <ol>
            <li>Create an account</li>
            <li>Select major + starting term</li>
            <li>Generate and edit your plan</li>
          </ol>
        </section>
      </main>

      <footer style={{ marginTop: 80, borderTop: "1px solid #eee", paddingTop: 16, color: "#666" }}>
        © {new Date().getFullYear()} GradSIS
      </footer>
    </div>
  );
}
