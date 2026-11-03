<div align="center">

# ▲ treeshift

### **Blazing-fast Git worktree manager with auto-sync and interactive TUI.**

Stop stashing uncommitted changes, wrestling with detached branches, and waiting for `npm install`.  
**treeshift** turns Git worktrees into a seamless, modern developer experience.

[![npm version](https://img.shields.io/npm/v/treeshift.svg?style=flat-square&color=38bdf8)](https://www.npmjs.com/package/treeshift)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg?style=flat-square)](#)
[![Cross-Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue.svg?style=flat-square)](#)

```bash
# Run instantly with npx (zero installation required)
npx treeshift
```

</div>

---

## ⚡ The Problem vs The treeshift Way

| The Everyday Pain 😫 | With `treeshift` 🚀 |
| :--- | :--- |
| `git stash` ➔ `git checkout branch` ➔ lose `.env` ➔ wait for rebuild | `treeshift add feat/auth` creates an isolated workspace with `.env` already synced. |
| Clunky commands: `git worktree add -b feat ../dir origin/main` | One command or interactive prompt: `treeshift new feat/auth` |
| Accidentally coding on `main` and manually transferring WIP | `treeshift add feat/auth --carry` stashes & transplants your dirty changes in 1-click. |
| Reviewing a PR requires switching away from current branch | `treeshift pr 142` mounts the PR into a sandbox worktree without interrupting work. |
| Re-running package installs manually for every new worktree | `treeshift add feat/auth --install` auto-detects `bun`, `pnpm`, `npm`, `cargo`, etc. |
| Forgetting which worktrees are dirty, locked, or ahead of remote | Interactive TUI dashboard showing status (`[clean]`, `[dirty +2 ?1]`, `↑2 ↓1`, `🔒`). |
| Accumulating dozens of dead worktrees from merged PRs | `treeshift clean` detects merged & squash-merged branches and safely bulk-prunes them. |
| Having to manually `cd` to nested worktree folders | Shell integration with PID session isolation jumps your terminal (`cd`) instantly. |

---

## 🖥️ Terminal Experience

Running `treeshift` (or `ts`) with no arguments launches the interactive dashboard:

```text
┌  ▲ treeshift  — Git Worktrees Dashboard
│
◇  Select a worktree to switch to, or choose an action:
│
│  ★ main (current) [main] [clean]
│    treeshift · 2h ago "feat(core): initial engine"
│
│  feat/auth-v2 [↑2 ↓1] [dirty +3 ?1]
│    treeshift-feat-auth-v2 · 12m ago "fix(auth): session refresh token"
│
│  fix/safari-rebase 🔒[locked] [clean]
│    treeshift-fix-safari · 1d ago "refactor: audio pipeline"
│
│  + Create new worktree
│  🐙 Mount GitHub Pull Request
│  🧹 Clean merged worktrees
│  🗑️ Remove a worktree
│
└  Switched to: /workspace/projects/treeshift/.worktrees/feat-auth-v2 🚀
```

---

## 📦 Installation

### 1. Zero-Install (Run on-demand)
```bash
npx treeshift
```

### 2. Global Install (via npm or bun)
```bash
npm install -g treeshift
# or
bun add -g treeshift
```

### 3. Standalone Binary (Single executable, zero Node/Bun runtime required)
Download the standalone binary for your OS (`treeshift` for Linux/macOS, `treeshift.exe` for Windows) directly from [GitHub Releases](https://github.com/ghazy2001/treeshift/releases).

---

## 🐚 Shell Integration (Instant `cd` Directory Jumping)

Because subshells cannot change their parent process's directory, `treeshift` provides a lightweight wrapper so selecting a worktree in the TUI automatically `cd`s into it (with complete PID isolation across multiple terminal tabs):

### Zsh (`~/.zshrc`)
```bash
eval "$(treeshift init zsh)"
```

### Bash (`~/.bashrc`)
```bash
eval "$(treeshift init bash)"
```

### Fish (`~/.config/fish/config.fish`)
```fish
treeshift init fish | source
```

### PowerShell (`$PROFILE`)
```powershell
treeshift init powershell | Out-String | Invoke-Expression
```

### Nushell (`~/.config/nushell/config.nu`)
```nushell
treeshift init nu | save -f ~/.config/nushell/treeshift.nu; use ~/.config/nushell/treeshift.nu *
```

> **Pro Tip:** Shell integration registers both `treeshift`, `ts`, and `wt` aliases for maximum speed!

---

## 📖 Command Reference

### `treeshift` (or `ts`)
Opens the interactive TUI switcher showing all active worktrees, commit info, ahead/behind counters, and clean/dirty stats.

```bash
treeshift

# Open directly in your favorite editor upon switching
treeshift --cursor
treeshift --code
treeshift --zed
```

### `treeshift switch [branch]` (alias: `sw`)
Switch directly to an existing worktree, or prompts to create one if it doesn't exist yet:

```bash
treeshift switch feat/billing
treeshift switch feat/billing --cursor
```

### `treeshift add <branch> [base]` (aliases: `new`, `create`)
Creates a new worktree in an isolated directory (`.worktrees/<branch>`):
* Automatically checks out existing local branch, tracks remote `origin/<branch>`, or branches off default base (`main`).
* **Auto-syncs `.env` files** (`.env`, `.env.local`, `.env.development`, etc.) safely from the main repository.
* **Auto `.gitignore` protection:** Ensures `.worktrees/` is safely ignored so untracked workspaces never pollute your main Git status.

```bash
# Branch from default (main/master)
treeshift add feat/google-auth

# Carry over all current uncommitted & untracked changes to the new worktree!
treeshift add feat/payment-intent --carry

# Auto-install dependencies upon worktree creation (bun, pnpm, npm, cargo, etc.)
treeshift add feat/checkout --install

# Open the new worktree directly in Cursor or VS Code
treeshift add feat/ai-agent --cursor
```

### `treeshift pr <number|url>`
Mounts a GitHub Pull Request into an isolated sandbox worktree for instant local testing, debugging, or code review:

```bash
# Mount by PR number
treeshift pr 142

# Mount directly by GitHub URL
treeshift pr https://github.com/org/repo/pull/142 --cursor
```

### `treeshift lock [branch-or-path]` & `treeshift unlock [branch-or-path]`
Locks a worktree using Git's native lock engine to safeguard it from accidental deletion or bulk cleanups:

```bash
treeshift lock feat/big-rebase --reason "Active complex rebase in progress"
treeshift unlock feat/big-rebase
```

### `treeshift list` (alias: `ls`)
Prints a clean overview of all active worktrees, ahead/behind status, and changed files:

```bash
treeshift list

# Or output machine-readable JSON for scripts:
treeshift list --json
```

### `treeshift remove [branch-or-path]` (aliases: `rm`, `delete`)
Safely deletes a worktree and prunes Git references:
* Prevents accidental deletion of the main repository.
* Respects locked worktrees (`🔒`).
* Warns if the worktree contains uncommitted changes or unpushed commits.

```bash
# Preview what would be removed without touching disk
treeshift remove feat/old-branch --dry-run

# Interactive removal
treeshift remove
```

### `treeshift clean` (alias: `prune`)
Scans all worktrees whose branches have already been **merged (or squash-merged)** into `main` (or `master`), and lets you bulk-delete them in one step:

```bash
# Preview cleanable worktrees without touching disk
treeshift clean --dry-run

# Run cleanup
treeshift clean
```

---

## ⚙️ Configuration (`.treeshiftrc.json`)

You can customize `treeshift` per repository by creating a `.treeshiftrc.json` in your repository root:

```json
{
  "location": "internal",
  "internalDir": ".worktrees",
  "syncEnv": true,
  "envFiles": [".env", ".env.local", ".env.development"],
  "defaultBaseBranch": "main",
  "autoInstall": true,
  "hooks": {
    "postAdd": "bun install",
    "preRemove": "docker compose down",
    "postSwitch": ""
  }
}
```

* `location`: `"internal"` (inside `.worktrees/<branch>`) or `"sibling"` (alongside repo: `../<repo>-<branch>`).
* `syncEnv`: Whether to automatically copy `.env*` files to new worktrees (default: `true`).
* `autoInstall`: Automatically run detected package manager (`bun`, `pnpm`, `npm`, `cargo`, etc.) on new worktrees (default: `false`).
* `hooks`: Custom shell commands triggered on lifecycle events.

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/ghazy2001/treeshift.git
cd treeshift

# Install dependencies
bun install

# Run comprehensive test suite
bun test

# Build Node distribution and standalone binary
bun run build
bun run build:binary
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/ghazy2001/treeshift/issues).

---

## 📄 License

MIT © [Mahmoud Ghazy](https://github.com/ghazy2001)
