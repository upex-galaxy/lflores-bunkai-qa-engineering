# BK-482: TC11: should reject a status change given it moves backward or repeats the current status

- **Jira key**: BK-482
- **Story**: BK-264
- **AC**: AC6
- **Verdict**: Candidate (ROI 8.0 — backward-transition + same-status guardrail)
- **Status**: Candidate
- **Parent epic**: BK-70 (QA Test Repository)
- **Component**: Bugs & Defect Heatmap
- **Labels**: regression, automation-candidate, api, high, epic-BK-31
- **Link**: BK-482 "tests" BK-264
- **Parametrization**: 4 combinations in one Scenario Outline (resolved->open, in_progress->open, closed->in_progress, in_progress->in_progress same-status) — all 4 return the same 422 reason `status_transition_backward`; same-status is folded into the backward bucket, not a distinct code (empirically resolved outline #15).

Full Gherkin, preconditions, variables table, and refinement notes live in the Jira Description (source of truth). This file is the local traceability pointer for `/test-automation`.
