# Launch drafts — not sent

## LinkedIn

The Jev experiments I find interesting are about small decisions inside a workflow: classify a clause, flag a deviation, expose uncertainty, check again when the document changes.

We built a SuperDoc × Jev example that continues past the review table.

Start with an agreement already marked up by counsel. Jev evaluates the supplied terms. SuperDoc turns approved decisions into tracked clause replacements, table-cell edits and a real numbered safeguard. Existing concessions stay in place. The unresolved points stay visible. A person accepts or rejects the changes and returns a DOCX.

The developer view exposes the target, revision, receipt and verification. The Node example runs the same document operations headlessly, then hands the file to the browser for human review.

Fictional agreement, bounded workflow, real model calls and real Word changes. Try it or run the code: https://superdoc-jev.superdoc-1393.chatgpt.site/ / https://github.com/jelkes1/superdoc-jev-demo

Inspired by the early tabular-review and uncertainty work in the Jev community. Research links are included in the repo. This is an infrastructure example, not an accuracy benchmark.

## X

Jev → decision. SuperDoc → a real Word redline.

We built a live deal desk: clause + table edits, a tracked numbered insertion, counsel’s revisions preserved, and human approval where the deal isn’t settled.

Change the document. Recheck changed clauses. Inspect the receipt. Download DOCX.

Video: https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.3.0
Demo: https://superdoc-jev.superdoc-1393.chatgpt.site/
Code: https://github.com/jelkes1/superdoc-jev-demo

## TypeSafe preview — unsent

Hi TypeSafe team — we built a SuperDoc × Jev developer example around an agreement already under negotiation. Jev returns actual typed judgments, separate confidence, and the full probability distribution. Application code routes uncertainty and owns the document operation; SuperDoc applies verified tracked changes for human review.

The new version includes a clickable review matrix, changed-context rechecks, table-cell replacements, a numbered insertion and a runnable Node path. We preserved the ≥95% automatic-proposal threshold; lower-confidence results require explicit approval. We show measured provider-call timing and token usage without comparative speed or legal-accuracy claims.

Could you review how we represent Jev’s confidence/distribution and the model boundary before we promote it? Preview: https://superdoc-jev.superdoc-1393.chatgpt.site/. Code and methodology: https://github.com/jelkes1/superdoc-jev-demo. Nothing is posted yet.
