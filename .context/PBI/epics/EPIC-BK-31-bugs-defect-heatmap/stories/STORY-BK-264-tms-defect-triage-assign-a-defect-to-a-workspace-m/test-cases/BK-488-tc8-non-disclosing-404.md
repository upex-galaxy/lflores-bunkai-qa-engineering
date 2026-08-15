# BK-488: TC8: should return a non-disclosing 404 given the bug does not exist or is outside the caller's workspace

- **Jira key**: BK-488
- **Story**: BK-264
- **AC**: beyond-AC (risk: security/tenant isolation)
- **Verdict**: Candidate (ROI 8.0)
- **Status**: Candidate
- **Parent epic**: BK-70 (QA Test Repository)
- **Component**: Bugs & Defect Heatmap
- **Labels**: regression, automation-candidate, api, high, epic-BK-31
- **Link**: BK-488 "tests" BK-264
- **Parametrization**: 2 case combinations in one Scenario Outline (case=nonexistent-id, case=foreign-workspace-id — both return the same 404 not_found shape; per test-session-memory.md's Observation, the foreign-workspace-id row was exercised via a substituted nonexistent id because the harness's safety classifier blocked a live write against real foreign-tenant data)

Full Gherkin, preconditions, variables table, and refinement notes live in the Jira Description (source of truth). This file is the local traceability pointer for `/test-automation`.
