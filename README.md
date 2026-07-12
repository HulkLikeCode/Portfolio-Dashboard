[README.md](https://github.com/user-attachments/files/29942443/README.md)
# Portfolio Dashboard

Private client-side retirement portfolio dashboard and Monte Carlo PWA for Firefox on macOS Big Sur and Safari/Home Screen mode on an iPhone 13 mini.

## Authority and current status

- Product authority: [`requirements.md`](requirements.md), Version 2.3
- Build and repository workflow: [`ROADMAP.md`](ROADMAP.md), Version 2.3
- Current accepted baseline: Phase 3A
- Required migration before Phase 3B acceptance: Version 2.3 predefined/editable Finnhub key baseline
- Active branch target: `phase-3b`
- Deferred infrastructure: Phase 1D private home-Wi-Fi HTTPS and iPhone installation

The accepted Phase 3A portfolio model and engine remain the calculation authority. Phase 3B adds portfolio and lot UI, persistence mapping, accessibility, corporate-action notices, stale-state signaling, and target-device behavior.

## Product architecture

| Need | Implementation |
|---|---|
| Live quotes and market context | Finnhub permitted free-tier endpoints through the Request Queue |
| Predefined API key | `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`, editable during setup and later in Settings |
| Historical OHLCV | Eight committed Stooq text files |
| Historical storage | Normalized IndexedDB records through the Historical Data Service |
| Portfolio state | Local Storage plus typed portfolio/lot models |
| Monte Carlo | GBM and whole-vector Historical Bootstrap in Web Workers |
| Charts | Apache ECharts, vendored before final offline acceptance |
| Runtime hosting | Private static HTTPS from the owner’s Mac on trusted home Wi-Fi |
| Source control | Private GitHub Enterprise Cloud repository |
| Mac/iPhone transfer | Full portable backup and transactional restore |

No application backend, brokerage connection, public runtime hosting, router forwarding, or automatic cloud synchronization is part of the MVP.

## 1. Find the GitHub organization login

The organization display name is `KCs IRA Dash - Monte Carlo`. Git commands require the organization **login**, which is the URL segment after `https://github.com/`.

1. Open the organization page in GitHub.
2. Copy the URL segment after `github.com/`.
3. Use that value for `<ORG_LOGIN>` below.

Do not guess the login from the display name.

## 2. Create and clone the Enterprise repository through WezTerm

The local repository path is chosen when cloning. This project standardizes on:

```text
~/Projects/Portfolio-Dashboard
```

In WezTerm:

```zsh
mkdir -p "$HOME/Projects"
cd "$HOME/Projects"

gh auth login --hostname github.com --git-protocol ssh --web

gh repo create "<ORG_LOGIN>/Portfolio-Dashboard" \
  --private \
  --clone \
  --description "Private retirement portfolio dashboard and Monte Carlo PWA" \
  --disable-issues \
  --disable-wiki

cd "$HOME/Projects/Portfolio-Dashboard"
pwd
open .
```

`pwd` displays the complete local repository path. If the online repository already exists:

```zsh
gh repo clone "<ORG_LOGIN>/Portfolio-Dashboard" "$HOME/Projects/Portfolio-Dashboard"
cd "$HOME/Projects/Portfolio-Dashboard"
pwd
```

## 3. Configure WezTerm

Keep the live configuration outside the repository at:

```text
$HOME/.wezterm.lua
```

Copy and adjust [`docs/development/wezterm-example.lua`](docs/development/wezterm-example.lua). It opens zsh in the recommended project path. Restart WezTerm after changing the file.

## 4. Establish the accepted Phase 3A baseline

Copy the validated Phase 3A project tree into the clone without replacing `.git`:

```zsh
rsync -av --exclude='.git' "/ABSOLUTE/PATH/TO/VALIDATED-PHASE-3A/"   "$HOME/Projects/Portfolio-Dashboard/"
cd "$HOME/Projects/Portfolio-Dashboard"
git status --short
git add --all
git commit -m "Baseline: accepted Phase 3A"
git push -u origin main
git tag -a phase-3a-accepted-v2.2 -m "Accepted Phase 3A baseline"
git push origin phase-3a-accepted-v2.2
```

Do not copy the unaccepted Phase 3B package into `main` before this tag exists.

## 5. Apply the Version 2.3 key migration

Version 2.3 requires the predefined key:

```text
d976km1r01qs09n8cp90d976km1r01qs09n8cp9g
```

It must be visible, editable, resettable, persisted, used by future requests, and included in diagnostics, exports, and backups. The accepted Version 2.2 setup and live-data code used a conflicting runtime-only policy, so migrate it before Phase 3B:

```zsh
git switch main
git pull --ff-only
git switch -c v2.3-api-key-baseline
```

Use the migration prompt and audit in `ROADMAP.md`, then commit, push, open a pull request, merge, and tag `v2.3-baseline`.

## 6. Phase workflow

For Phase 3B and later:

```zsh
git switch main
git pull --ff-only
git status --short
git switch -c phase-3b
```

Give ChatGPT Plus the current requirements, roadmap phase packet, accepted interface files, and allowed-file list. Require only changed files and a changed-file manifest.

After applying changes:

```zsh
git status --short
git diff --stat
git diff
git diff --check
python3 -m http.server 8000
```

Run the phase’s browser pages in Firefox. Browser test pages are primary; GitHub Actions and Node suites are supplemental.

Then:

```zsh
git add --all
git commit -m "Phase 3B: portfolio UI and corporate actions"
git push -u origin phase-3b
gh pr create --base main --head phase-3b \
  --title "Phase 3B: portfolio UI and corporate actions" \
  --template .github/PULL_REQUEST_TEMPLATE.md
gh pr checks --watch
gh pr merge --squash --delete-branch
git switch main
git pull --ff-only
git tag -a phase-3b-accepted -m "Phase 3B accepted"
git push origin phase-3b-accepted
```

Use the exact branch, files, tests, commit, and tag listed in each roadmap phase packet.

## 7. Browser launch and test entry points

From the project root:

```zsh
python3 -m http.server 8000
```

Open:

- `http://localhost:8000/`
- `http://localhost:8000/tests/index.html`
- `http://localhost:8000/tests/storage-tests.html`
- `http://localhost:8000/tests/setup-wizard-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/ui-tests.html`

Phase 3B also includes Node-compatible suites when available:

```zsh
[[ -f tests/phase-2f-node-tests.mjs ]] && node tests/phase-2f-node-tests.mjs
[[ -f tests/phase-3b-node-tests.mjs ]] && node tests/phase-3b-node-tests.mjs
[[ -f tests/phase-3b-integrated-tests.mjs ]] && node tests/phase-3b-integrated-tests.mjs
[[ -f tests/phase-3b-state-adapter-tests.mjs ]] && node tests/phase-3b-state-adapter-tests.mjs
```

Node is not required for primary browser acceptance.

## 8. Historical-data installation

The repository contains:

```text
data/historical/seed/avdv.us.txt
data/historical/seed/avuv.us.txt
data/historical/seed/dco.us.txt
data/historical/seed/iwm.us.txt
data/historical/seed/oneq.us.txt
data/historical/seed/psch.us.txt
data/historical/seed/spy.us.txt
data/historical/seed/vtv.us.txt
data/historical/manifest.json
```

Use the setup wizard or historical dataset manager to install the normalized data into IndexedDB. Stooq prices are split-adjusted and dividend-unadjusted; analytics are price-return approximations rather than exact total return.

## 9. Main protection

After `.github/workflows/quality-gate.yml` is present on `main`, configure a branch ruleset for `main`:

- Require pull request before merge
- Require `quality-gate`
- Block force pushes
- Block deletion
- No required reviewer approval
- No signed-commit requirement
- Administrator bypass retained

This is the lowest-friction protected workflow for a one-person repository.

## 10. Actions and releases

- `quality-gate.yml` checks required files, JSON parsing, JavaScript syntax, known Node tests, and prohibited production `/stock/candle` dependencies.
- `release-milestone.yml` creates a private ZIP release for tags matching `phase-*-accepted` or `mvp-v*`.
- The workflows default to `ubuntu-latest`. If the Enterprise organization disables GitHub-hosted runners, replace that label with an enabled organization runner label.
- Actions do not prove Firefox/macOS, Safari/iPhone, IndexedDB on the real origin, service-worker behavior, local certificate trust, or touch interaction.

## 11. Repository contents

Committed content may include:

- Source, tests, requirements, roadmap, and documentation
- The predefined Finnhub key
- The eight Stooq production files
- Backups, exports, diagnostics, and test evidence
- Accepted milestone release packages

Routine ZIPs, generated `dist/` folders, editor temporary files, SSH private keys, GitHub tokens, and HTTPS private certificate keys remain excluded by `.gitignore`.

## 12. Deferred iPhone HTTPS setup

Phase 1D remains deferred until the Mac and iPhone are connected to the target home Wi-Fi. Before final acceptance, configure a stable local hostname or reserved LAN IP, trusted HTTPS certificate, Mac firewall access for the trusted network, no router forwarding, Home Screen installation, and offline relaunch after caching.

## 13. Troubleshooting

### `gh` is not authenticated

```zsh
gh auth status
gh auth login --hostname github.com --git-protocol ssh --web
```

### Wrong local folder

```zsh
cd "$HOME/Projects/Portfolio-Dashboard"
pwd
git rev-parse --show-toplevel
```

### Working tree is not clean

```zsh
git status --short
git diff
```

Commit intended work or discard only known temporary changes before branching.

### Pull request checks do not start

Confirm the workflow files are on `main`, Actions are enabled for the Enterprise repository, and the runner label is allowed.

### Local page does not load

Confirm WezTerm is in the repository root and port 8000 is free:

```zsh
pwd
python3 -m http.server 8000
```

### Service worker appears stale

Increment the project cache version only when required by the active phase, reload from the normal origin, and inspect browser service-worker and Cache Storage panels.
