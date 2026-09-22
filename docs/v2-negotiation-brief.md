# V2 proposal: one deal decision, a reviewable Word counterproposal

Status: implemented in v2. The original playbook remains available at `/playbook`. Verification and precise limitations are recorded in `verification-v2.md`.

## Audience and promise

Build for product and engineering teams creating legal document agents. A lawyer should understand the result immediately; a developer should be able to inspect and reuse the document execution underneath it.

**Your agent can negotiate inside the real document, with people still in control.**

The current demo puts most of its attention on classifying clauses. Three safe numerical replacements prove that the integration works, but hide the difficult document work: locating precise targets, preserving other people's edits, coordinating changes, checking document state, and producing a Word file that carries the negotiation forward.

Harvey already describes both an in-app Draft Editor and a Word add-in with redlining and playbooks. Legora advertises agentic drafting, redlining, review, and playbooks in Word. Browser placement or redlining alone is not a sufficient differentiation claim.

- [Harvey drafting tools](https://www.harvey.ai/blog/harveys-new-drafting-tools-meet-you-where-you-work)
- [Legora Word add-in](https://legora.com/product/word-add-in)

## The hero scenario

Open a fictional agreement returned by opposing counsel. It already has attributed redlines, comments, an order-form table, and a data-processing schedule. Keep the whole scenario in one DOCX initially.

Show a short deal brief beside the document:

> Prepare our counterproposal: use a 12-month general liability cap and a 24-month cap for the specified data-protection obligations. Align the liability clause, the order-form summary, and the data-processing schedule. Preserve the other negotiated changes.

These are fictional, explicitly supplied negotiation instructions and approved fallback language. The demo does not assert that they are appropriate for a real transaction.

The agent prepares a connected proposal with three document locations. Each proposed edit has a source clause, supplied negotiation instruction, replacement, and review state. One existing counterparty edit overlaps the requested change and needs a person to resolve it. Unrelated counterparty changes stay intact.

The visitor previews the proposal, edits one of its source clauses directly, and tries to apply the prepared proposal. The application detects the changed document, shows the affected location, and requires a fresh review. It never silently writes over the visitor's edit. This should use a real preview/apply boundary, not a staged model delay or simulated conflict.

After the conflict is resolved, apply the supported proposal as real tracked changes. Review the linked locations, inspect an anchored explanation comment, accept or reject changes, and export a Word counterproposal. Reopen the exact exported file to demonstrate the retained review history and document structure.

## What the visitor should see

| Moment | Visible outcome | What it demonstrates |
| --- | --- | --- |
| Start in an active negotiation | Existing opposing-counsel revisions and comments in a formatted agreement | The input is already a working document with history |
| Prepare one counterproposal | A single proposal connects a clause, table cell, and schedule | The application can coordinate document operations across locations |
| Inspect an edit | Native tracked changes and an explanation anchored to the affected text | Model output becomes reviewable document content |
| Edit before applying | The application identifies the stale source and requests a fresh review | Document state and human work are guarded |
| Continue negotiating | Accept one change, reject another, and rerun without duplicating or replacing accepted work | Human review remains part of the workflow |
| Export and reopen | Word shows the intended changes, authors, comments, table, and numbering | The output can continue through the actual negotiation |

Counts in the interface must come from the run. Do not hard-code a successful result, a particular model classification, or a claim that every inconsistency has been found.

## Product surface

Keep the existing visual direction. Replace the rule checklist as the primary surface with a deal brief and a proposal organized around the commercial decision. The document should visibly carry existing negotiation activity when the page opens.

The primary action is **Prepare counterproposal**. Proposed changes link to their exact locations. Review states distinguish ready, needs judgment, source changed, proposed, accepted, and rejected. If a visitor accepts only part of a dependent proposal, expose the remaining inconsistency rather than imply that the whole agreement is aligned.

A small **How this was applied** disclosure exposes the developer example: original document revision, resolved targets, intended operations, receipts, created revision IDs, and verification results. Keep implementation details out of the main lawyer-facing flow.

Keep uploads and the existing playbook review as an additional example. Clearly label the richer scenario as a guided negotiation example using supplied instructions and fallback language. Do not imply that arbitrary uploaded agreements support the same coordinated edits.

## Why SuperDoc belongs in this story

An LLM can judge language and propose replacements. A complete application also needs a document engine, target resolution, formatting and structure handling, revision authorship, comments, review controls, state guards, and DOCX export. An LLM plus other engineering can provide those capabilities; the demo should show the concrete implementation work SuperDoc supplies.

Word add-ins can also edit documents and use tracked changes. The relevant developer distinction is owning an embedded document experience and running document operations within the product's workflow, with a compatible Word handoff. Do not claim that an add-in cannot produce equivalent legal work or that SuperDoc necessarily improves legal reasoning.

SuperDoc documents a shared Document API across its editor and supported headless clients, with capability-dependent support. A later developer extension could show an unattended agent preparing a proposal and a browser reviewer continuing it. That extension needs its own verified implementation; it is not already demonstrated by v1.

- [SuperDoc engine and execution surfaces](https://docs.superdoc.dev/resources/how-superdoc-works/)
- [Document API reference](https://docs.superdoc.dev/document-api/reference/)

## Responsibilities

- **Jev:** clause relevance and bounded playbook/negotiation judgments, displaying actual probabilities and separate confidence. It should not invent dependencies or approved policy.
- **Reasoning model:** propose bounded wording where the supplied fallback does not suffice, subject to the existing two-draft limit and human review.
- **Application:** assemble context and linked changes, enforce authorization and limits, handle stale or overlapping edits, and verify the supplied negotiation constraints across affected locations. Model-dependent consistency checks must be labeled as such.
- **SuperDoc:** read and target document content; preview and execute supported operations; represent tracked changes and comments; support review and DOCX export.
- **Human:** resolve ambiguity and conflicts, then decide which proposed edits to accept or reject.

Keep operational counters and provider credentials server-side. Preserve the existing document-disclosure, privacy, rate-limit, and budget behavior.

## Capability proof before the full interface

The pinned SuperDoc 2.16.0 type declarations expose revision-guarded atomic mutation plans, previews, and comment attribution. These are API evidence, not proof that every required operation works in tracked mode on this fixture.

Build one focused executable proof against the pinned version:

1. Import a fixture containing real attributed revisions and comments, a table, and actual Word numbering.
2. Prepare supported text replacements in the body, a table cell, and a schedule. Discover runtime capabilities and resolve precise targets.
3. Preview and apply a tracked mutation plan. Verify its receipts, resulting text, revision identities, and original-text projection. Confirm all-or-none behavior with an intentionally invalid step before claiming atomicity.
4. Change a target between preview and application. Confirm the old plan cannot overwrite the new text. Re-read and re-review the affected source before producing a new proposal.
5. Exercise an existing revision that overlaps a requested change. Surface it for explicit human resolution; preserve unrelated revisions and comments.
6. Add an explanation comment through the public API and verify its anchor and author after export/reopen.
7. Accept/reject selected changes and rerun. Confirm accepted work and unrelated existing revisions survive without duplicate suggestions. Flag inconsistent partial decisions.
8. Reopen the exact export in SuperDoc and real Microsoft Word. Verify comments, authorship, pending revisions, tables, and actual numbering. Record the scope of inspection honestly.

V1's fixture uses literal numbered headings, so its previous export checks do not establish support for Word list renumbering. Automatic cross-reference repair, moving entire clauses, table structure changes, and multi-user collaboration are separate capability tests; they are not needed for the first version of this story.

If an operation fails, bring Andrii the exact fixture, public API call, expected behavior, and observed result. His general review is useful, but the proof can start without it.

## Video outline: approximately 85 seconds

| Time | Beat |
| --- | --- |
| 0–8 s | Show the incoming redlined agreement and supplied deal instruction |
| 8–23 s | Run the actual review and reveal the connected counterproposal |
| 23–38 s | Jump between clause, table, and schedule; show the proposed document changes |
| 38–55 s | Make a real manual edit before applying; demonstrate the detected stale proposal and fresh review |
| 55–70 s | Apply verified tracked changes; inspect a comment and make a human review decision |
| 70–85 s | Export and reopen the real Word file; end with the reusable example |

Timing is an editing target, not a latency claim. Use genuine runs and label compression. The short social cut should focus on one instruction producing linked document edits and the human edit being protected.

Suggested framing: **One deal decision. Every affected clause. Real Word redlines.** Use “every affected clause” only within the explicitly bounded, verified scenario; avoid claims of exhaustive detection on arbitrary contracts.

## Delivery order

First prove the coordinated edit, stale-plan guard, and Word round trip. Then build the proposal interface around that proven loop. Record and refresh the launch materials only after the hosted scenario passes the same checks. Publish observed results and retain the existing small integration modules as the developer entry point.
