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
| Forgetting which worktrees are dirty vs clean | Interactive TUI dashboard showing status (`[clean]`, `[dirty]`, time ago). |
| Accumulating dozens of dead worktrees from merged PRs | `treeshift clean` detects merged branches and safely bulk-prunes them in 1-click. |
| Having to manually `cd` to nested worktree folders | Shell integration automatically jumps your terminal (`cd`) when you switch. |

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
│  feat/auth-v2 [dirty]
│    treeshift-feat-auth-v2 · 12m ago "fix(auth): session refresh token"
│
│  + Create new worktree
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

Because subshells cannot change their parent process's directory, `treeshift` provides a lightweight wrapper so selecting a worktree in the TUI automatically `cd`s into it:

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

> **Pro Tip:** Shell integration registers both `treeshift`, `ts`, and `wt` aliases for maximum speed!

---

## 📖 Command Reference

### `treeshift` (or `ts`)
Opens the interactive TUI switcher showing all active worktrees, commit info, and clean/dirty status.

```bash
treeshift
```

### `treeshift switch [branch]` (alias: `sw`)
Switch directly to an existing worktree, or prompts to create one if it doesn't exist yet:

```bash
treeshift switch feat/billing
```

### `treeshift add <branch> [base]` (aliases: `new`, `create`)
Creates a new worktree in an isolated directory (`.worktrees/<branch>`):
* Automatically checks out existing local branch, tracks remote `origin/<branch>`, or branches off default base (`main`).
* **Auto-syncs `.env` files** (`.env`, `.env.local`, `.env.development`, etc.) safely from the main repository.

```bash
# Branch from default (main/master)
treeshift add feat/google-auth

# Branch off a custom base branch
treeshift add fix/safari-bug staging

# Custom path or skip env sync
treeshift add feat/experiment --path ../my-experiment --no-env
```

### `treeshift list` (alias: `ls`)
Prints a clean overview of all active worktrees and their status:

```bash
treeshift list

# Or output machine-readable JSON for scripts:
treeshift list --json
```

### `treeshift remove [branch-or-path]` (aliases: `rm`, `delete`)
Safely deletes a worktree and prunes Git references:
* Prevents accidental deletion of the main repository.
* Warns if the worktree contains uncommitted or unstaged changes.
* Offers to delete the local Git branch in the same step.

```bash
# Interactive selection
treeshift remove

# Direct removal
treeshift remove feat/old-feature --force
```

### `treeshift clean` (alias: `prune`)
Scans all worktrees whose branches have already been **merged into `main` (or `master`)**, and lets you bulk-delete them in one step:

```bash
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
  "defaultBaseBranch": "main"
}
```

* `location`: `"internal"` (inside `.worktrees/<branch>`) or `"sibling"` (alongside repo: `../<repo>-<branch>`).
* `syncEnv`: Whether to automatically copy `.env*` files to new worktrees (default: `true`).

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/ghazy2001/treeshift.git
cd treeshift

# Install dependencies
bun install

# Run tests
bun test

# Build Node distribution and standalone binary
bun run build
bun run build:binary
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check [issues page](https://github.com/ghazy2001/treeshift/issues).

---

## 📄 License

MIT © [Mahmoud Ghazy](https://github.com/ghazy2001)
