import Link from "next/link";
export default function Walkthrough() {
  return (
    <main
      style={{
        maxWidth: 850,
        margin: "56px auto",
        padding: "0 24px",
        lineHeight: 1.8,
      }}
    >
      <Link href="/">← Open the living deal desk</Link>
      <h1 style={{ fontFamily: "Georgia", fontSize: 36, margin: "25px 0" }}>
        A decision is only useful when the document can act on it.
      </h1>
      <p>
        The fictional agreement arrives with counsel’s revisions and comments
        already in place. Eight known locations cover data use, renewal, payment
        and unresolved negotiation points. Jev judges the supplied terms;
        application code chooses a supported operation; SuperDoc changes the
        actual DOCX; a person reviews it.
      </p>
      <h2>Read → decide → execute → review</h2>
      <ol>
        <li>
          <b>Read the current agreement.</b> Published SuperDoc APIs extract
          paragraphs, tables, numbered items and stable targets. Bounded nearby
          context is assembled without an LLM preprocessing step.
        </li>
        <li>
          <b>Ask Jev focused questions.</b> POST /api/deal-desk returns actual
          typed decisions, separate confidence, full probability distributions
          and measured usage. A ≥95% confident violation can qualify for a
          supported automatic proposal. Other replacements require explicit
          approval.
        </li>
        <li>
          <b>Make document-native changes.</b> The application resolves a fresh
          target and document revision, enforces tracked mode, then checks the
          receipt, resulting text, new revisions and preservation of existing
          revisions. The four replacements are individually guarded, sequential
          operations, not an atomic transaction.
        </li>
        <li>
          <b>Handle a structural change.</b> A missing safeguard needs human
          approval. SuperDoc inserts it as a real numbered list item, inheriting
          its list context and remaining accept/rejectable. Its explanation
          comment is anchored to the preceding item.
        </li>
        <li>
          <b>Continue working.</b> Edit a clause in the editor or with “Try a
          counter-edit.” Rechecking sends only changed text/context/policy to
          Jev. Changing the agreed terms removes only unchanged pending
          suggestions owned by this session; accepted changes and counsel’s work
          remain. A modified pending suggestion blocks replacement.
        </li>
      </ol>
      <h2>Uncertainty stays visible</h2>
      <p>
        The telemetry exception and liability position have not been agreed.
        They remain human decisions even if Jev reports a high score. An
        eligible telemetry finding can request a bounded OpenAI draft, at most
        twice per review. Requesting a draft discloses that the clause goes to
        OpenAI; approving the language creates a tracked suggestion. Neither a
        classifier nor a drafting model is given authority to settle the deal.
      </p>
      <h2>The headless path</h2>
      <p>
        The{" "}
        <a href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/examples/headless.ts">
          Node.js example
        </a>{" "}
        uses the same extraction, policy routing, tracked operations and
        verification functions through @superdoc/sdk. A small adapter normalizes
        SDK transport envelopes and mutation options. Run it with your own Jev
        key, save a DOCX, and open that result in the browser for review. The
        hosted site keeps document operations in the browser.
      </p>
      <pre
        style={{
          padding: 20,
          background: "#edf2f8",
          borderRadius: 8,
          whiteSpace: "pre-wrap",
        }}
      >
        {
          "TYPESAFE_API_KEY=… npm run demo:headless -- ./public/deal-desk.docx\n\n# Explicitly approve the supplied fictional replacement language:\nnpm run demo:headless -- ./public/deal-desk.docx --approve-supplied-language"
        }
      </pre>
      <h2>Why this matters to developers</h2>
      <p>
        An LLM can draft text, and a Word add-in can make edits through Word
        APIs. This example shows the document infrastructure behind that
        experience: stable targeting, revision guards, tracked changes,
        comments, real numbering, a browser review surface, and a headless
        runtime. These are inspectable operations you can reuse in your own
        application with another decision model.
      </p>
      <p>
        The workflow takes inspiration from public Jev discussions about tabular
        legal review, typed decisions and repeated checks. Read the{" "}
        <a href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/docs/social-research-v3.md">
          research and original sources
        </a>
        . These are early experiments, not evidence of legal accuracy or
        endorsements.
      </p>
      <h2>Scope and limits</h2>
      <p>
        This guided workflow recognizes eight known locations in the fictional
        fixture. Uploaded documents with missing or duplicate targets are
        flagged, not guessed. For broader clause scanning, use the{" "}
        <Link href="/playbook">five-rule playbook example</Link>. The{" "}
        <Link href="/negotiation">
          previous atomic liability counterproposal
        </Link>{" "}
        is also retained.
      </p>
      <p>
        English text-based DOCX up to 10 MB and 25,000 extracted tokens. Review
        sends extracted text to TypeSafe; optional drafting sends a clause to
        OpenAI. The application stores operational counters, not contracts.
        Public usage is limited to five reviews per visitor/IP per hour and a
        shared $10/day model budget. Provider failures leave editing and export
        available.
      </p>
      <p>
        <a href="https://docs.superdoc.dev">SuperDoc documentation ↗</a> ·{" "}
        <a href="https://docs.typesafe.ai">TypeSafe documentation ↗</a> ·{" "}
        <a href="https://github.com/jelkes1/superdoc-jev-demo">
          Runnable source ↗
        </a>
      </p>
    </main>
  );
}
