import Link from "next/link";
export default function Walkthrough() {
  return (
    <main
      style={{
        maxWidth: 850,
        margin: "64px auto",
        padding: "0 24px",
        lineHeight: 1.8,
      }}
    >
      <Link href="/">← Open the demo</Link>
      <h1 style={{ margin: "28px 0" }}>From a decision to a Word redline</h1>
      <p>
        Jev evaluates the contract. SuperDoc executes the document changes. A
        human reviews the redlines.
      </p>
      <h2>1. Read the real document</h2>
      <p>
        SuperDoc opens a DOCX in the browser. Published document APIs read
        headings, paragraphs and table cells with stable targets. The
        application assembles bounded clause context without an LLM
        preprocessing step.
      </p>
      <h2>2. Ask a decision model</h2>
      <p>
        The server sends batches to Jev with five vendor rules. Each response
        includes a choice, confidence and a full probability distribution.
        Results appear as completed batches, with measured latency and token
        usage.
      </p>
      <h2>3. Propose a tracked edit</h2>
      <p>
        A confident violation with an exact supported replacement pattern can
        become a proposal. Application code checks the document revision,
        resolves the original text, and calls SuperDoc in tracked mode. It
        checks the operation receipt, original and resulting text, and created
        revisions before showing “verified.”
      </p>
      <h2>4. Keep uncertain findings open</h2>
      <p>
        Ambiguous findings stay unresolved. OpenAI can draft up to two narrow
        replacements per review. A person must choose to propose each draft,
        then accept or reject its tracked changes. Every exported DOCX keeps
        unresolved redlines.
      </p>
      <h2>Small interfaces, clear responsibilities</h2>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: 20,
          background: "#eaf0f6",
          borderRadius: 8,
        }}
      >
        {
          "Browser: extract → POST /api/review → route → tracked replacement → verify\nServer: Jev decisions + POST /api/reason for bounded drafting\nHuman: accept / reject → download DOCX"
        }
      </pre>
      <p>
        English text-based DOCX, up to 10 MB and 25,000 tokens. The application
        stores operational counters, not contracts. Extracted text is processed
        by the model providers when you run review.
      </p>
      <p>
        <a href="https://docs.superdoc.dev">SuperDoc documentation ↗</a> ·{" "}
        <a href="https://docs.typesafe.ai">TypeSafe documentation ↗</a>
      </p>
    </main>
  );
}
