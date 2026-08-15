# BK-484: TC12: should keep assignee and status changes independent of each other

- **Jira key**: BK-484
- **Story**: BK-264
- **AC**: beyond-AC (risk: data integrity / field cross-contamination)
- **Verdict**: Candidate (ROI 6.0 — data-integrity risk beyond the AC floor)
- **Status**: Candidate
- **Parent epic**: BK-70 (QA Test Repository)
- **Component**: Bugs & Defect Heatmap
- **Labels**: regression, automation-candidate, api, high, epic-BK-31
- **Link**: BK-484 "tests" BK-264
- **Parametrization**: 2 independence directions in one Scenario Outline (reassign checks status unchanged, status change checks assignee unchanged)

Full Gherkin, preconditions, variables table, and refinement notes live in the Jira Description (source of truth). This file is the local traceability pointer for `/test-automation`.
