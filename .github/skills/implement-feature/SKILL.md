---
name: implement-feature
description: Implement a scoped feature completely in an existing codebase, including focused tests and validation.
---

# Implement a feature

Use this workflow when asked to add or change a bounded product behavior.

1. Read the feature request, the relevant implementation, its tests, and nearby code before editing.
2. State the smallest implementation and test changes needed. Preserve existing public behavior unless the request explicitly changes it.
3. Implement the production change using the repository's existing patterns.
4. Add or update focused tests that demonstrate the requested behavior, including a meaningful edge case when the request has one.
5. Run the narrowest relevant validation command. If it fails, diagnose and correct the implementation rather than weakening or skipping tests.
6. Review the diff for unrelated edits, then summarize the behavior implemented and validation run.

Do not change dependency manifests, disable checks, or broaden the requested scope unless the feature cannot be implemented without doing so. Explain such a blocker instead of guessing.
