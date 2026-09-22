# Numbered safeguard visibility

The demo originally displayed the missing safeguard among the review findings, but its separate insertion action was below the visible inspector panel. Before that action, there was no document change to show. The eventual explanation comment also anchored the preceding, unchanged numbered item.

Confirmed against application commit `05cd8963bbf1c5e72ae8343dde9eb94cf45580a5`, SuperDoc `2.16.0`, and the repository's Playwright Chromium runtime. The retained regression failed on both the action's viewport visibility and the comment's anchor block. This is an integration and presentation fix in the demo.

The inspector now leads with **Missing clause · Not added yet** and **Add as tracked change**. After insertion, it shows Accept/Reject, the actual saved comment text, and a **Show commented text** action using the public SuperDoc UI API. Navigation resets the inspector scroll so an earlier long finding cannot hide the new action.

The comment anchors the new item itself. Comment boundaries can cause SuperDoc to expose the inserted paragraph mark and inserted text as separate public revision records. The integration re-reads their final IDs and fingerprints before returning the operation receipt. They remain one verified document operation and resolve together. Reject also removes any explanation comment that remains after the revisions are resolved.

## Verification

```sh
npx playwright test tests/browser/guided.spec.ts tests/browser/deal-desk.spec.ts \
  --grep 'missing safeguard has|human-approved reasoning|guided journey'
npx tsc --noEmit
npx eslint app/deal-desk.tsx lib/deal-desk/document.ts \
  tests/browser/guided.spec.ts tests/browser/deal-desk.spec.ts
```

All three focused browser checks, typecheck and scoped lint passed. They verify:

- The insertion action is in the viewport and its saved comment anchors exactly the new text.
- The comment's UI focus/scroll action works, and Reject removes the text and its comment while restoring numbered markers 1, 2, 3.
- Export/reopen retains the inserted item, its exact comment anchor, markers 1–4, tables and counsel revisions.
- The guided journey still accepts/rejects changes, exports pending items and clears owned proposals on a policy recheck.

The existing tests for guarded document operations and modified pending suggestions also passed during this investigation. Browser decision fixtures are explicitly test-only; the document operations, rendering and DOCX exports use the real editor. Local reproduction screenshots, baseline failure trace and comment-anchor comparison are retained in ignored `outputs/safeguard`. The same browser test contains the failing-before/fixed-after assertion; no SDK patch or package upgrade is required.
