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
      <h1 style={{ margin: "28px 0" }}>
        From a deal decision to a counterproposal
      </h1>
      <p>
        A returned agreement already has counsel’s edits and comments. One
        supplied negotiation instruction connects the liability clause, an
        order-form table cell, and a data-protection schedule. Jev evaluates
        those locations. SuperDoc executes the document changes. A human
        resolves overlaps and reviews the redlines.
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
        POST /api/negotiate sends the three bounded locations and explicit cap
        instructions to Jev. Each actual response includes a choice, confidence,
        and full probability distribution. The interface reports measured usage
        and timing. These are three known locations in a guided fictional
        agreement, not a claim of exhaustive contract analysis.
      </p>
      <h2>3. Preview a connected change set</h2>
      <p>
        Supplied fallback language, supported patterns, and sufficient model
        confidence make a location eligible. Existing overlapping revisions
        require human resolution. The application resolves precise targets,
        calls mutations.preview, and holds the document revision. The visitor
        can inspect the whole proposal before it changes the document.
      </p>
      <h2>4. Protect the person working in the document</h2>
      <p>
        If a person edits the document after preparation, the old proposal is
        blocked. Fresh review uses the current text. A revision-guarded atomic
        plan creates tracked changes; receipts, original and resulting text, and
        retained revisions are checked before the application reports success.
        Explanation comments are anchored in the document.
      </p>
      <h2>5. Continue the negotiation</h2>
      <p>
        People accept or reject individual changes. Partial decisions expose
        remaining inconsistency. Reruns replace only unchanged pending
        suggestions owned by this review. Export preserves unresolved Word
        revisions and comments. The pinned integration has been exercised in a
        browser and its exported file opened in Microsoft Word.
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
          "Browser: snapshot → POST /api/negotiate → resolve overlap → preview\nSuperDoc: revision guard → atomic tracked plan → receipts + comments\nHuman: edit / review / accept / reject → download DOCX"
        }
      </pre>
      <p>
        <Link href="/playbook">The original five-rule playbook example</Link>{" "}
        also supports your own DOCX and up to two optional OpenAI reasoning
        drafts for unresolved findings. The negotiation example uses the
        supplied fallback language; it does not call a drafting model.
      </p>
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
