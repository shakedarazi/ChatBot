# Repository Structure Refactor — Execute-Ready Plan

## 1) Audit Results

### VERIFIED

| Check                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun workspaces `apps/*`**            | [Bun docs](https://bun.com/docs/pm/workspaces) confirm glob patterns like `apps/*` are supported for workspace discovery. Same semantics as `packages/*`.                                                                                                                                                                                                                                       |
| **concurrently in root**               | [package.json](package.json) line 8: `"concurrently":"^9.2.1"` in devDependencies. Root script `bun run index.ts` resolves it.                                                                                                                                                                                                                                                                  |
| **Dev runner uses concurrently + cwd** | [index.ts](index.ts) lines 3–16: `concurrently([{ cwd: 'packages/server' }, { cwd: 'packages/client' }])`. Only change needed: update cwd values.                                                                                                                                                                                                                                               |
| **history.json CWD-relative**          | [packages/server/repositories/conversation.repository.ts](packages/server/repositories/conversation.repository.ts) line 20: `Bun.file(HISTORY_FILE)` with `HISTORY_FILE = 'history.json'`. Resolves relative to process CWD. Server runs with `cwd: packages/server` (→ `apps/server` after move).                                                                                              |
| **Python DATA_DIR + chroma_db**        | [python-service/index_kb.py](python-service/index_kb.py) line 26: `DATA_DIR = "../data/products"`; line 23: `CHROMA_DB_PATH = "./chroma_db"`. [python-service/kb_service.py](python-service/kb_service.py) line 16: same CHROMA_DB_PATH. Both relative to CWD when running from service dir. After move to `services/python/`, DATA_DIR must become `../../data/products`; chroma_db unchanged. |
| **sample_logs not used by code**       | Grep: `sample_logs` only in docs (README, verification_guide, repo_map, architecture). No imports or runtime references.                                                                                                                                                                                                                                                                        |
| **packages/ contents**                 | Only `packages/server` and `packages/client`. No shared libs. After moves, `packages/` is empty.                                                                                                                                                                                                                                                                                                |
| **No CI/path-specific tooling**        | No `.github/`, `.circleci/`, Dockerfiles. [.lintstagedrc](.lintstagedrc) uses globs only. [.husky/pre-commit](.husky/pre-commit) runs `bunx lint-staged` — no paths.                                                                                                                                                                                                                            |
| **Server .env path**                   | [packages/server/index.ts](packages/server/index.ts) line 15: `path.join(import.meta.dir, '.env')` — uses module directory, survives move.                                                                                                                                                                                                                                                      |

### UNVERIFIED

| Item                                                   | Fallback                                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bun `bun install` behavior after workspaces change** | If `bun install` fails post-migration: run `bun install` from root after config edits; workspaces are resolved at install time. No code assumes `packages/` in import paths. |

### Path References Requiring Updates

- **Docs:** `README.md`, `docs/repo_map.md`, `docs/architecture.md`, `docs/architecture_overview.md`, `docs/verification_guide.md`
- **Python README:** `services/python/README.md` (after move): `cd python-service` → `cd services/python`, `../data/products` → `../../data/products`
- **Code (optional):** File-header comments `// packages/server/...` in `apps/server/**/*.ts` — cosmetic only, update for consistency

---

## 2) Final Commands

Run from repository root. Execute in order.

### Phase 1: Create Directories

```bash
mkdir -p apps scripts examples services
git status
# Expected: no changes (empty dirs are typically untracked; .gitignore may ignore)
```

### Phase 2: Git Moves (Preserve History)

```bash
git mv packages/server apps/server
git mv packages/client apps/client
git mv python-service services/python
git mv index.ts scripts/dev.ts
git mv sample_logs examples/sample_logs
git status
# Expected: renamed/moved entries for all five items
```

### Phase 3: Remove Empty packages/

```bash
# Only if packages/ is empty (no other subdirs or root files)
ls packages 2>/dev/null || true
# If empty or "cannot access": safe to remove
rmdir packages 2>/dev/null || true
# If rmdir fails (e.g. .DS_Store): remove explicitly then rmdir
# git status should show packages/ deletion if it was tracked
```

### Commit Boundary Suggestion

```bash
git add -A
git commit -m "refactor: restructure repo to apps/, services/, scripts/, examples/"
```

### Phase 4: Config Edits (After Commit or Same Commit)

Apply diffs below for: `package.json`, `scripts/dev.ts`, `services/python/index_kb.py`, `.gitignore`.

### Phase 5: Docs Updates

Run the automated command in Section 4, then manually verify.

### Commit Boundary Suggestion

```bash
git add -A
git commit -m "refactor: update config and docs for new layout"
```

---

## 3) Required File Diffs

### root package.json

```diff
 {
   "name": "ChatBot",
-  "module": "index.ts",
   "type": "module",
   "private": true,
   "scripts": {
-    "dev": "bun run index.ts",
+    "dev": "bun run scripts/dev.ts",
     "format": "prettier --write .",
     "prepare": "husky"
   },
-  "workspaces": ["packages/*"],
+  "workspaces": ["apps/*"],
   "devDependencies": {
```

### scripts/dev.ts (formerly index.ts)

```diff
 import concurrently from 'concurrently';

 concurrently([
    {
       name: 'server',
       command: 'bun run dev',
-      cwd: 'packages/server',
+      cwd: 'apps/server',
       prefixColor: 'cyan',
    },
    {
       name: 'client',
       command: 'bun run dev',
-      cwd: 'packages/client',
+      cwd: 'apps/client',
       prefixColor: 'green',
    },
 ]);
```

### services/python/index_kb.py

```diff
-DATA_DIR = os.environ.get("DATA_DIR", "../data/products")
+DATA_DIR = os.environ.get("DATA_DIR", "../../data/products")
```

### .gitignore

```diff
 # Runtime data
 history.json
-packages/server/history.json
+apps/server/history.json
```

---

## 4) Docs Update Checklist

### Files to Edit

| File                                                                | Replacements                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md](README.md)                                              | `packages/server` → `apps/server`, `packages/client` → `apps/client`, `python-service` → `services/python`, `sample_logs` → `examples/sample_logs`, `cd python-service` → `cd services/python` |
| [docs/repo_map.md](docs/repo_map.md)                                | Same pattern                                                                                                                                                                                   |
| [docs/architecture.md](docs/architecture.md)                        | Same pattern                                                                                                                                                                                   |
| [docs/architecture_overview.md](docs/architecture_overview.md)      | Same pattern                                                                                                                                                                                   |
| [docs/verification_guide.md](docs/verification_guide.md)            | Same pattern                                                                                                                                                                                   |
| [apps/server/README.md](apps/server/README.md) (after move)         | `packages/server` → `apps/server`, `../sample_logs` → `../examples/sample_logs`                                                                                                                |
| [services/python/README.md](services/python/README.md) (after move) | `cd python-service` → `cd services/python` or `cd services/python` (redundant if already in dir), `../data/products` → `../../data/products`                                                   |

### Automated Replace (Scoped to docs + README)

Run from repo root **after** Phase 2 moves:

```bash
# Replace in docs/ and README.md only (no code)
rg -l 'packages/server|packages/client|python-service|sample_logs' docs/ README.md 2>/dev/null
```

Then apply replacements. Example with `sed` (GNU sed; Windows use WSL or PowerShell equivalent):

```bash
# Linux/macOS
find docs README.md -type f -name '*.md' 2>/dev/null | xargs -I {} sed -i.bak \
  -e 's|packages/server|apps/server|g' \
  -e 's|packages/client|apps/client|g' \
  -e 's|python-service|services/python|g' \
  -e 's|sample_logs/|examples/sample_logs/|g' \
  -e 's|cd python-service|cd services/python|g' \
  -e 's|from python-service|from services/python|g' \
  {}
# Remove backups: find docs README.md -name '*.bak' -delete
```

Manual verification recommended after automated replace.

### Optional: File-Header Comments in apps/server

```bash
# Update // packages/server/... to // apps/server/...
find apps/server -name '*.ts' -exec grep -l '// packages/server' {} \; | xargs sed -i.bak 's|// packages/server|// apps/server|g'
```

---

## 5) Verification

Run from repo root after all edits:

```bash
# 1. Reinstall
bun install
# Expected: Exit 0; workspaces resolved from apps/server, apps/client

# 2. Server typecheck
cd apps/server && bun run build
# Expected: tsc --noEmit exits 0

# 3. Client build
cd ../client && bun run build
# Expected: Vite build succeeds

# 4. Root dev
cd ../.. && bun run dev
# Expected: Server on :3000; client dev server starts; no path errors
```

Python (separate terminal):

```bash
cd services/python
python index_kb.py --rebuild
# Expected: Indexing completes; chroma_db/ created (or verify with DATA_DIR=../../data/products)
uvicorn server:app --reload --host 0.0.0.0 --port 8000
# Expected: Service responds on :8000
```

Format:

```bash
bun run format
# Expected: Prettier runs without error
```

---

## 6) Rollback

### (a) Uncommitted Changes Only

```bash
git checkout -- .
git clean -fd apps scripts examples services 2>/dev/null || true
# Restores index.ts, packages/, python-service/, sample_logs/
```

### (b) Committed in Phases (Incremental Revert)

```bash
# Revert last commit (config + docs)
git revert HEAD --no-edit

# Revert move commit
git revert HEAD~1 --no-edit
# Resolves path conflicts; resolve to restore packages/, python-service/, etc.
```

### (c) Abandon Branch Entirely

```bash
git checkout main
git branch -D refactor/repo-structure
```

### Safe Workflow (Recommended)

```bash
git checkout -b refactor/repo-structure
# Execute Phase 1–3, commit
# Execute Phase 4–5, commit
# Verify
# If broken: git checkout main; git branch -D refactor/repo-structure
```
