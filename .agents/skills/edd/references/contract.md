# The evidence contract

The contract says which checks a delivery needs, how deep the agentic part goes and where each check runs. It lives in the `evidence:` block of `.agents/project.yaml`, next to the push and merge policy in `git_strategy.policy`. Values live only in that file; the keys are documented in the project's schema file beside it. The gate reads the contract from the base branch (`origin/<base>`), so a change cannot weaken the contract that judges it.

## Keys

| Key | Holds | Notes |
|---|---|---|
| `evidence.include` | skills whose `evidence.yaml` fragment adds checks | merged in list order, then the project's own lists; the same `id` twice keeps the project's |
| `evidence.static` | `{id, cmd, where}` rows | `where` is `pre-push`, `ci` or both. Commands come from `package.json`, never invented |
| `evidence.agentic` | `{id, kind, tool, envs, min_depth, paths}` rows | `kind` names the artifact the check must leave (`screenshots`, `exploratory`, `test-run`, `api-calls`). `paths` (optional globs) makes the check required only when the change touches one. A `test-run` check leaves a JUnit XML or Playwright JSON report of the changed tests: at least one test, none failing |
| `evidence.depth.default` | depth of a file no rule matches | |
| `evidence.depth.rules` | `{paths, depth}` rows | the first matching rule decides a file's depth |
| `evidence.human.paths`, `evidence.human.keys` | paths and `project.yaml` keys that make up the gate itself | a match sets `touches_gate` in the record and adds one line to the PR's evidence block, information for the reader. These paths take depth `standard` or deeper through a depth rule, and a repo on `human-approves` lists them in CODEOWNERS. A changed key takes depth `standard` (see "What counts as a change to the gate") |
| `evidence.review.bot` | login of a review bot whose findings must be resolved before merge | `null` when there is none |
| `evidence.review.max_rounds` | how many fix rounds the agent runs against the bot | after the cap the finding goes to a person (`human-gates.md`) |
| `evidence.record.artifact_retention_days` | how long local artifacts stay after merge | records themselves are never pruned |
| `git_strategy.policy.direct_push_to_protected` | `forbidden`, `confirm`, `allowed` or `evidence` | `flows.md` |
| `git_strategy.policy.merge_mode` | `auto`, `human-approves` or `manual` | `flows.md` |

A missing `evidence:` block does not mean "no gate". The gate falls back to the static checks whose `package.json` scripts exist and to depth `none`, so a fresh project has a working gate before it declares anything. The exact fallback is the gate script's, read it there.

## Depth

The gate computes depth from the files the change touches (`git diff --name-only <base>...<head>`). Each file takes the depth of the first rule that matches it, else the default, and the change takes the highest. The order is `none < light < standard < deep`.

| Depth | Agentic requirement |
|---|---|
| `none` | static checks only |
| `light` | screenshots on one environment: `attest` needs at least one, and the tester covers every top-level page or view the app exposes |
| `standard` | every agentic check with `min_depth` up to `standard`, run against the change's acceptance criteria |
| `deep` | `standard`, plus the flows next to the touched ones (the smoke of the touched modules), on every environment the check lists |

The paths in `evidence.human.paths` (the gate itself) need a rule of their own placed before any rule that would give them `none`, so a change that replaces the verifier or the signers still carries evidence.

A depth above `none` must ask for at least one agentic check. In a declared contract, every glob of a rule at `light` or deeper needs a check whose `min_depth` is at most that depth and whose `paths` are absent, name the same glob, or hold a `<dir>/**` glob whose directory contains it (`tests/**` covers `tests/fixtures/**`, `api/*` does not cover `api/**`), and a default above `none` needs such a check with no `paths`. A contract that breaks this is a contract error: `bun run edd check` reports it and the gate refuses, so a path cannot take a depth and still pass with no evidence. Give the path a check of its own or set its depth to `none`.

## What counts as a change to the gate

A change to a gate key takes depth `standard` or deeper on every path: the pre-push gate, the PR check and the CI push check. The verifier compares the key at the fork point of the change with the key at its head. These are gate keys:

- the five keys that decide which branch is protected and which policy applies: `evidence`, `git_strategy.strategy`, `git_strategy.branches`, `git_strategy.protected` and `git_strategy.policy`. They count whatever `evidence.human.keys` lists, and that list can only add keys;
- the resolved contract: a change that leaves the `evidence:` block alone but changes what the contract resolves to (an included fragment, the shipped default set a project with no block gets from `package.json`);
- each `package.json` script a static `cmd` of the base contract reaches, followed from script to script and reported as `package.json scripts.<name>`. The verifier splits each command at `;`, `&&`, `||`, `|` and newlines, drops leading `NAME=value` and `env`, reads inside `sh -c`, `bash -c` and `zsh -c`, strips quotes, and skips flags on both sides of `run`. It reads a script name from `bun run <name>`, `bun <name>` (so `types:check` running `bun check` makes a `check` script a gate key), `npm run <name>` and `npm test`, `pnpm [run] <name>` and `yarn [run] <name>`. `bun x` and `bunx` run a package binary, not a script, so they reach nothing;
- the `prettier` and `eslintConfig` keys of every `package.json` or `package.yaml` the change touches, at any level, reported as `<path> prettier` or `<path> eslintConfig`: prettier reads the nearest such key ahead of `.prettierrc`;
- the whole `scripts` block of `package.json`, when a reached command runs a script whose name it cannot read: a runner or a name built from a variable or a command substitution (`$npm_execpath run <name>`, `bun run $NAME`), or when the reach passes the verifier's cap on reached names. Any change to any script is then a gate key, reported as `package.json scripts (a reached script runs a script whose name cannot be read)`.

The following reads the text of `package.json` scripts and nothing else. It also watches a name Bun resolves to a built-in (`bun test`) or to a file as a script name.

The configuration files of the lint, type and format tools are gate paths of their own, in any directory, because eslint and prettier read the config nearest to each file: the eslint config and the KATA eslint plugin, `tsconfig*.json`, the prettier config, `.prettierignore` and `.editorconfig` (prettier reads it), `bunfig.toml` and the oxlint config. The shipped contract lists them in `evidence.human.paths` and in its first depth rule, so a change to one takes depth `standard`. A file one of those configs reaches inside the repository, through `extends` (a tsconfig, an oxlint config) or a relative import (an eslint config), followed from file to file, takes the depth and the checks of the config that reaches it; a package in `node_modules` stays ordinary code.

The owner decided where this stops: `bun.lock`, `node_modules/`, the `dependencies` and `devDependencies` of `package.json`, and the script files a static check executes (`scripts/*.ts`, at any level) stay ordinary code, at the depth their paths take. So does the root `.gitignore`, which the shipped eslint config reads: it changes for many other reasons, so it is not a gate path, and a limit follows in plain words: an ignore entry can take a file out of lint at depth `none`. The reason is that the gate catches mistakes and drift, not a deliberate weakening. With `depth.default: none` and no rule for those paths, such a change needs no agentic evidence, and the static checks run on the pushed tree with it in place.

A gate change never passes with zero agentic evidence. When no agentic check of the base contract covers a changed gate path or gate key (a key counts as its file: `.agents/project.yaml`, or the `package.json` or `package.yaml` it sits in), every agentic check the base contract declares applies to the change, at depth `standard` or deeper. When the base contract declares no agentic check at all, the gate asks for the built-in `gate-review` check instead: artifacts under `gate-review/<env>/` with a `verdict.json` from a tester other than the author session, in a signed evidence commit. A project with a thin contract can therefore still land the change that repairs it.

The shipped contract scopes a `test-run` check to the gate paths, `.agents/project.yaml` and `package.json`, so a change to the gate asks for a report of the gate's own test suites as its agentic evidence. A test in `scripts/lib/edd` fails when a gate path of the shipped contract, or of this repo's, would require no agentic check.

The agent may raise depth for one delivery with `--depth` when it judges the change riskier than its paths say. It never lowers it. A rule that sets the wrong depth is fixed in the contract, in its own change, so the reader sees the correction.

## Skill fragments

A workflow skill that knows its own risk ships an `evidence.yaml` with the same `static`, `agentic` and `depth.rules` shape. The project opts in by naming the skill in `evidence.include`. A fragment can only add checks or rules; the project's own list wins on a clash.

## Two shapes of contract

These are examples of shape, not this project's values. A repository of application code and a repository of test code differ in what their agentic checks exercise, not in how the contract works.

```yaml
# A web application
evidence:
  include: [<the repo's development skill>]
  static:
    - { id: lint, cmd: bun run lint:check, where: [pre-push, ci] }
    - { id: types, cmd: bun run types:check, where: [pre-push, ci] }
    - { id: unit, cmd: bun run test, where: [pre-push, ci] }
  agentic:
    - { id: app-screens, kind: screenshots, tool: playwright-cli, envs: [local], min_depth: light }
    - { id: api-contract, kind: api-calls, tool: openapi, envs: [local], min_depth: standard }
  depth:
    default: standard
    rules:
      - { paths: ['.github/workflows/**', '.husky/**', '.agents/edd/**'], depth: standard }
      - { paths: ['**/*.md', 'docs/**'], depth: none }
      - { paths: ['**/*.css', 'styles/**'], depth: light }
      - { paths: ['db/migrations/**', 'middleware.ts'], depth: deep }

# A test-automation repository
evidence:
  include: [<the repo's test-writing skill>, <the repo's manual-testing skill>]
  static:
    - { id: lint, cmd: bun run lint:check, where: [pre-push, ci] }
    - { id: unit, cmd: bun test, where: [pre-push, ci] }
  agentic:
    - { id: changed-specs, kind: test-run, tool: playwright, envs: [local, staging], min_depth: standard }
  depth:
    default: none
    rules:
      - { paths: ['.github/workflows/**', '.husky/**', '.agents/edd/**'], depth: standard }
      - { paths: ['tests/**'], depth: standard }
      - { paths: ['tests/fixtures/**', 'playwright.config.ts'], depth: deep }
```
