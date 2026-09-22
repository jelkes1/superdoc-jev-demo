# Launch drafts — not sent

Status: publication copy. Do not post until the live hosted run and videos pass the launch checklist. Replace the link placeholders with verified destinations. Do not add performance claims without measured evidence.

## LinkedIn

A contract-review decision should be something you can inspect in the document.

We built a small SuperDoc × Jev example that opens a real Word agreement, checks it against a vendor playbook, and turns supported findings into tracked changes.

Jev evaluates the clauses. SuperDoc applies and verifies the document edits. A person accepts or rejects the redlines.

Ambiguous findings stay open for review, with a bounded reasoning-model draft when useful. Change the liability policy, rerun, then download the DOCX with its revisions intact.

The interactive demo and runnable TypeScript example are for developers building document agents and legal-tech applications.

Try it: [verified public demo]
Code: [verified GitHub repository]
Watch: [verified captioned video]

## X

From a contract decision to a real Word redline.

Jev evaluates the clause. SuperDoc applies and verifies a tracked edit. You accept or reject it.

Interactive demo + TypeScript example for document-agent builders: [demo] [code]

[Attach verified 20–30s clip]

## TypeSafe preview message

Hi TypeSafe team — we’re preparing a small SuperDoc × Jev developer demo and would value your feedback before we promote it.

The workflow is: Jev evaluates bounded contract clauses against an explicit playbook; application code routes the results; SuperDoc applies supported replacements as verified tracked changes; a human accepts or rejects them. Ambiguous findings remain unresolved and can receive a separate reasoning-model draft.

We display Jev’s returned choice, confidence and full probability distribution separately, and report measured usage and latency. We make no legal-accuracy or comparative-speed claims.

Preview: [verified demo]
Code: [verified repository]
Video: [verified 60–90s recording]

Does this accurately represent Jev’s intended role and response semantics? We’d especially appreciate feedback on the relevance/judgment criteria and our handling of NEEDS_REVIEW.

Thanks!

## Technical walkthrough

Use `docs/architecture.md` and the live `/walkthrough` page. Keep attribution visible: Jev supplies decisions; the reasoning model supplies draft text; SuperDoc owns document reading, mutation, tracked revisions, navigation and export. Application code owns routing, validation and usage limits.
