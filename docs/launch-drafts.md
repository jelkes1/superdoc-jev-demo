# V2 launch drafts — not sent

These are drafts for review. Nothing has been sent or posted. Ask TypeSafe for feedback on the Jev representation before promoting. Use the measured recording, and make no comparative-speed or legal-accuracy claim.

## LinkedIn

A contract agent needs to work inside a negotiation already in progress.

We built a SuperDoc × Jev example that starts with a Word agreement containing counsel's redlines and comments. One supplied deal instruction connects the liability clause, an order-form table, and the data-protection schedule.

Jev evaluates the clauses. SuperDoc turns the supported proposal into real tracked changes and anchored comments. A person resolves the overlapping counsel edit and decides which redlines stay.

Try editing the document after the proposal is prepared. The old proposal is blocked. Fresh review keeps your work, and the exported Word file carries the negotiation forward.

For developers: the example includes the document targets, revision guards, atomic operation plan, receipts, verification, and human review flow. Bring your own models and legal intelligence.

This is a guided fictional scenario with supplied fallback language, not a legal-accuracy benchmark.

Demo: https://superdoc-jev.superdoc-1393.chatgpt.site
Code: https://github.com/jelkes1/superdoc-jev-demo
Video: https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.2.0

## X

One deal instruction → linked Word redlines in a clause, table, and schedule.

Edit the document while the proposal is pending: your work stays protected.

SuperDoc × Jev. Live demo + runnable example:
https://superdoc-jev.superdoc-1393.chatgpt.site

Attach the v0.2.0 social cut. Put the code link in a follow-up if needed.

## TypeSafe preview message

Hi TypeSafe team — we'd value your feedback on a SuperDoc × Jev developer demo before we promote it.

The main scenario starts with a fictional agreement returned by counsel, including existing revisions and comments. Jev evaluates three bounded clause locations against explicitly supplied liability instructions. Application code handles eligibility, overlaps, and document state. SuperDoc applies and verifies a connected tracked-change plan; a person reviews the result.

We display Jev's actual choice, confidence, and complete probability distribution separately, with measured usage and timing. NEEDS_REVIEW stays unresolved unless a person explicitly reviews the supplied fallback. We make no legal-accuracy or comparative-speed claim.

The original five-rule playbook is also available; that route can request a separate bounded OpenAI reasoning draft. The main negotiation route uses supplied fallback language and does not call a drafting model.

Demo: https://superdoc-jev.superdoc-1393.chatgpt.site
Code: https://github.com/jelkes1/superdoc-jev-demo
Recording: https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.2.0

Does the demo accurately represent Jev's intended role and response semantics? We'd especially appreciate feedback on the judgment criteria and handling of uncertainty.

## Technical walkthrough

The live `/walkthrough` page and `docs/architecture.md` explain the responsibilities. The core v2 implementation is `lib/negotiation/document.ts`, with fallback definitions in `lib/negotiation/scenario.ts`. Explain that the three locations are explicitly bounded for this example; do not imply arbitrary dependency discovery or guaranteed legal consistency.
