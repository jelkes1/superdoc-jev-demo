# Jev document workflows: research used in v3

Research date: September 21, 2026 (Pacific). This is a small qualitative sample of public posts and creator-submitted prototypes, not a survey or evidence of production adoption. Nothing here establishes legal accuracy, and neither Harvey nor Legora has endorsed this demo.

| First-party source | What the author/community is exploring | Concrete change in this demo |
| --- | --- | --- |
| [Ryan McDonough on LinkedIn](https://www.linkedin.com/posts/ryanjamesmcdonough_introducing-system-one-models-jev-typesafe-activity-7506089022876864513-FyRx) | Legal workflows composed of bounded decisions: clause type, playbook deviation, escalation and routing. Separate specialized decision models from generative reasoning. | Eight typed judgments; full distributions; explicit routing; separate optional reasoning draft. |
| [vibecode.law: Build with Jev](https://vibecode.law/inspiration/challenges/build-with-jev) | The challenge proposes tabular document review, contract screening, triage and scope monitoring, with visible uncertainty and human handoff. These suggestions are not claims that all have shipped. | A clickable review matrix mapped to real document targets, with execution status for each row. |
| [Matt Roberts: Document Classification with Open Legal Ontology](https://vibecode.law/showcase/document-classification-with-open-legal-ontology-using-jev-282833) | A creator-submitted CLI prototype walks FOLIO with bounded questions and retains alternative paths and a trace. | Copyable Node runner and inspectable decision-to-operation trace. We do not implement FOLIO classification or claim equivalence to this prototype. |
| [Ciaran McGonagle: Probabilistic Legal Reasoning](https://vibecode.law/showcase/probabilistic-legal-reasoning-289242) | An experimental hierarchy of factual/legal propositions, explicit uncertainty, and a separate LLM narrative. The author discusses an uncertain fungibility assessment. | Missing safeguard and unagreed telemetry/liability remain gated regardless of confidence. The reasoning draft needs explicit human approval. |
| [Tobi Block on LinkedIn](https://de.linkedin.com/posts/tobiblock_eine-ki-die-rechnungen-vorbereitet-ist-activity-7506410650219433984-yDCo) | Repeated checks before and after workflow steps, comparing contract/work-order evidence, with software handling fixed rules. | Edit the actual clause; its decision becomes stale; recheck only changed text/context/policy. No-op reruns make no provider request. |

The inference we take from these examples: the interesting unit is a decision inside an ongoing workflow. SuperDoc's contribution is making that decision actionable inside the document people must review and return.

We also found Nader Dabit's predictive spreadsheet post via an index: [original X URL](https://x.com/dabit3/status/2100780008193020049). X returned 403 in the research tool. We did not independently verify its video, timings, engagement counts or implementation and do not cite those as evidence. Similar indexed code-review and Clippy experiments were treated as leads only.

## Position against mature legal applications

[Harvey's engineering article](https://www.harvey.ai/blog/building-an-agent-for-complex-document-drafting-and-editing) describes a mutable document model, structured tools, deterministic document handling, and tracked Word edits. [Legora's editor](https://legora.com/product/editor) and [Word add-in](https://legora.com/product/word-add-in) already provide substantial editing workflows.

The demo therefore demonstrates reusable infrastructure, not that these products cannot redline. An LLM can propose language; a Word add-in can operate through Word APIs. The integration shown here makes document targeting, tracked operations, verification, headless execution and embedded human review available to a developer using SuperDoc. The repository exposes the boundary and its limitations for inspection.
