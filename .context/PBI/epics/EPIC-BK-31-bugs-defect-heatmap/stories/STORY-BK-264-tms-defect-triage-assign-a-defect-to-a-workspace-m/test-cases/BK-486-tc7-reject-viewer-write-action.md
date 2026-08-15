# BK-486: TC7: should reject a write action given the actor is a Viewer-role member

- **Jira key**: BK-486
- **Story**: BK-264
- **AC**: beyond-AC (risk: authorization boundary)
- **Verdict**: Candidate (ROI 8.0)
- **Status**: Candidate
- **Parent epic**: BK-70 (QA Test Repository)
- **Component**: Bugs & Defect Heatmap
- **Labels**: regression, automation-candidate, api, high, epic-BK-31
- **Link**: BK-486 "tests" BK-264
- **Parametrization**: 2 action combinations in one Scenario Outline (action=assign, action=status-change — both return 403 with reason `not_a_member`, per test-session-memory.md's Observation on the imprecise reason slug)

Full Gherkin, preconditions, variables table, and refinement notes live in the Jira Description (source of truth). This file is the local traceability pointer for `/test-automation`.
