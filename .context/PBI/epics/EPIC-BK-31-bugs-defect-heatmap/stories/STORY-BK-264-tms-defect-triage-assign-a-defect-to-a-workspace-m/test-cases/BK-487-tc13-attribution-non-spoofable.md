# BK-487: TC13: should attribute an action to the actual calling actor, not the bug's assignee

- **Jira key**: BK-487
- **Story**: BK-264
- **AC**: beyond-AC (risk: audit trail / non-spoofable attribution)
- **Verdict**: Candidate (ROI 3.75 — audit-trail integrity risk beyond the AC floor)
- **Status**: Candidate
- **Parent epic**: BK-70 (QA Test Repository)
- **Component**: Bugs & Defect Heatmap
- **Labels**: regression, automation-candidate, api, medium, epic-BK-31
- **Link**: BK-487 "tests" BK-264
- **Parametrization**: 2 actor/action pairs in one Scenario Outline (owner-performs-assign, member-performs-status-change)

Full Gherkin, preconditions, variables table, and refinement notes live in the Jira Description (source of truth). This file is the local traceability pointer for `/test-automation`.
