# V5 launch drafts — not sent

## LinkedIn

A contract agent's output should be a Word document someone can review.

We built an open TypeScript demo: Jev evaluates clauses; SuperDoc turns approved language into tracked changes, verifies the targets and revisions, and exports an editable DOCX. Table cells, numbered safeguards, anchored comments, and existing counsel revisions are part of the workflow.

Then we swapped the decision model. Same contract, approved language, and SuperDoc engine. Five runs each for Jev, GPT-5.4 mini, and GPT-5.4. All 15 produced the same five verified changes.

On this fictional sample, Jev + SuperDoc versus GPT-5.4 mini + SuperDoc used 1.18 seconds less median processing (24.4%) and $0.000732 less estimated model spend per run (82.4%). Reported cache discounts are included. Those are workload-specific execution results, not a legal-accuracy claim.

The useful part: you can inspect every response and operation receipt, rerun the comparison, review each redline, download Word, and reuse the integration.

Demo: https://superdoc-jev.superdoc-1393.chatgpt.site/
Code + results: https://github.com/jelkes1/superdoc-jev-demo

[Attach the captioned 60-second video. AI-generated narration is credited in the film.]

## X

Jev decides. SuperDoc turns approved language into real Word redlines.

Our fictional sample: same 5 verified edits, 24.4% shorter processing and 82.4% lower model spend vs GPT-5.4 mini. 5 runs/model; cache discounts included.

Try it + inspect the code ↓

[Attach 25-second branded cut. Reply with demo, code and methodology links. Do not post automatically.]

## TypeSafe preview

Draft for the TypeSafe team — please review our representation of Jev before promotion.

We built a public SuperDoc × Jev demo: Jev classifies bounded clause questions; application code uses approved text to create and verify tracked Word edits; people accept or reject the changes. We preserve Jev's native confidence/probabilities, and we do not invent analogous confidence scores for OpenAI.

The new comparison holds the fictional DOCX, policy, evidence, questions, replacement language, and SuperDoc execution constant. It runs jev-1.13.0, gpt-5.4-mini-2026-03-17, and gpt-5.4-2026-03-05 (reasoning none), sequentially on independent copies. Five repetitions/model yielded the same five verified edits each time. Every result, cache-adjusted model cost, receipt, and methodological limit is retained.

Could you check the Jev description, native-confidence presentation, and benchmark framing before we share the videos? No comparative legal-accuracy claim is made.

Preview: https://superdoc-jev.superdoc-1393.chatgpt.site/
Methodology: https://github.com/jelkes1/superdoc-jev-demo/blob/main/docs/workflow-roi-methodology.md
Release: https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.5.0
