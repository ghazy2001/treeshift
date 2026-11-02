import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  isBare: boolean;
  isLocked: boolean;
  lockReason?: string;
  isMain: boolean;
  isDirty?: boolean;
  lastCommit?: {
    hash: string;
    message: string;
    relativeTime: string;
  };
}

export async function runGit(args: string[], cwd: string = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.trim() : err.message;
    throw new Error(`Git error: ${stderr || err.message}`);
  }
}

export async function isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
  try {
    const res = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return res === "true";
  } catch {
    return false;
  }
}

export async function getMainRepoRoot(cwd: string = process.cwd()): Promise<string> {
  // Find the top-level directory of the current worktree
  const topLevel = await runGit(["rev-parse", "--show-toplevel"], cwd);

  // Check if this worktree is inside another or linked
  try {
    const gitDir = await runGit(["rev-parse", "--git-common-dir"], cwd);
    const resolvedGitDir = path.resolve(cwd, gitDir);
    // If git-common-dir is e.g. /repo/.git, the main root is parent of that .git
    if (resolvedGitDir.endsWith(".git") || path.basename(resolvedGitDir) === ".git") {
      return path.dirname(resolvedGitDir);
    }
  } catch {
    // fallback to topLevel
  }

  return path.resolve(topLevel);
}

export async function getDefaultBranch(cwd: string = process.cwd()): Promise<string> {
  try {
    const ref = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    return ref.replace("refs/remotes/origin/", "").trim();
  } catch {
    // fallback to checking local main or master
    try {
      await runGit(["rev-parse", "--verify", "main"], cwd);
      return "main";
    } catch {
      try {
        await runGit(["rev-parse", "--verify", "master"], cwd);
        return "master";
      } catch {
        return "main";
      }
    }
  }
}

export async function listWorktrees(cwd: string = process.cwd()): Promise<WorktreeInfo[]> {
  const output = await runGit(["worktree", "list", "--porcelain"], cwd);
  if (!output) return [];

  const mainRoot = await getMainRepoRoot(cwd);
  const normalizedMainRoot = path.normalize(mainRoot).toLowerCase();

  const blocks = output.split(/\r?\n\r?\n/).filter(Boolean);
  const worktrees: WorktreeInfo[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let wtPath = "";
    let head = "";
    let branch: string | null = null;
    let isBare = false;
    let isLocked = false;
    let lockReason: string | undefined;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        wtPath = line.substring(9).trim();
      } else if (line.startsWith("HEAD ")) {
        head = line.substring(5).trim();
      } else if (line.startsWith("branch refs/heads/")) {
        branch = line.substring("branch refs/heads/".length).trim();
      } else if (line === "bare") {
        isBare = true;
      } else if (line.startsWith("locked")) {
        isLocked = true;
        lockReason = line.substring(6).trim() || undefined;
      } else if (line === "detached") {
        branch = null;
      }
    }

    if (wtPath) {
      const resolvedPath = path.resolve(wtPath);
      const isMain = path.normalize(resolvedPath).toLowerCase() === normalizedMainRoot;

      worktrees.push({
        path: resolvedPath,
        head,
        branch,
        isBare,
        isLocked,
        lockReason,
        isMain,
      });
    }
  }

  // Populate dirty status & last commit in parallel
  await Promise.all(
    worktrees.map(async (wt) => {
      if (!fs.existsSync(wt.path)) return;
      try {
        wt.isDirty = await isWorktreeDirty(wt.path);
        wt.lastCommit = await getWorktreeCommitInfo(wt.path);
      } catch {
        // ignore errors for missing or corrupt worktrees
      }
    })
  );

  return worktrees;
}

export async function isWorktreeDirty(worktreePath: string): Promise<boolean> {
  try {
    const status = await runGit(["status", "--porcelain"], worktreePath);
    return status.length > 0;
  } catch {
    // Fail-safe: if git check fails (locked, permission error, corrupted index),
    // treat as dirty to prevent accidental deletion or data loss.
    return true;
  }
}

export async function getWorktreeCommitInfo(
  worktreePath: string
): Promise<{ hash: string; message: string; relativeTime: string }> {
  try {
    const raw = await runGit(
      ["log", "-1", "--format=%h%x09%s%x09%cr"],
      worktreePath
    );
    const parts = raw.split("\t");
    return {
      hash: parts[0] || "",
      message: parts[1] || "",
      relativeTime: parts[2] || "",
    };
  } catch {
    return { hash: "", message: "", relativeTime: "" };
  }
}

export async function listBranches(cwd: string = process.cwd()): Promise<{
  local: string[];
  remote: string[];
}> {
  const localOutput = await runGit(
    ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
    cwd
  );
  const local = localOutput ? localOutput.split(/\r?\n/).filter(Boolean) : [];

  let remote: string[] = [];
  try {
    const remoteOutput = await runGit(
      ["for-each-ref", "--format=%(refname:short)", "refs/remotes/"],
      cwd
    );
    remote = remoteOutput
      ? remoteOutput
          .split(/\r?\n/)
          .filter(Boolean)
          .filter((r) => !r.endsWith("/HEAD"))
      : [];
  } catch {
    // no remotes
  }

  return { local, remote };
}

export async function addWorktree(options: {
  branch: string;
  targetPath: string;
  createBranch?: boolean;
  baseBranch?: string;
  cwd?: string;
}): Promise<void> {
  const { branch, targetPath, createBranch = false, baseBranch, cwd = process.cwd() } = options;
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const args = ["worktree", "add"];
  if (createBranch) {
    args.push("-b", branch, targetPath);
    if (baseBranch) {
      args.push(baseBranch);
    }
  } else {
    args.push(targetPath, branch);
  }

  await runGit(args, cwd);
}

export async function removeWorktree(
  worktreePath: string,
  options: { force?: boolean; cwd?: string } = {}
): Promise<void> {
  const args = ["worktree", "remove"];
  if (options.force) {
    args.push("--force");
  }
  args.push(worktreePath);
  await runGit(args, options.cwd || process.cwd());
}

export async function pruneWorktrees(cwd: string = process.cwd()): Promise<void> {
  await runGit(["worktree", "prune"], cwd);
}

/**
 * Detects whether a branch's changes have been squash-merged into targetBranch.
 * Synthesizes a temporary commit of the branch's tree on top of the merge-base,
 * then uses `git cherry` to check if an equivalent patch exists on targetBranch.
 */
export async function isBranchSquashMerged(
  branch: string,
  targetBranch: string,
  cwd: string = process.cwd()
): Promise<boolean> {
  try {
    const mergeBase = await runGit(["merge-base", targetBranch, branch], cwd);
    if (!mergeBase) return false;

    // Get the tree SHA of the branch
    const tree = await runGit(["rev-parse", `${branch}^{tree}`], cwd);
    if (!tree) return false;

    // If the tree is identical to mergeBase, branch had no changes or was fast-forwarded/reset
    const baseTree = await runGit(["rev-parse", `${mergeBase}^{tree}`], cwd);
    if (tree === baseTree) {
      return true;
    }

    // Synthesize a dangling commit representing the squash of the entire branch
    const syntheticCommit = await runGit(
      ["commit-tree", tree, "-p", mergeBase, "-m", "_"],
      cwd
    );
    if (!syntheticCommit) return false;

    // Check if an equivalent commit exists on targetBranch
    // git cherry outputs "- <commit>" if patch is already integrated, "+ <commit>" if not
    const cherry = await runGit(
      ["cherry", targetBranch, syntheticCommit],
      cwd
    );
    return cherry.trim().startsWith("-");
  } catch {
    return false;
  }
}

export interface MergedBranchesResult {
  merged: string[];
  squashed: string[];
  all: string[];
}

export async function getMergedBranches(
  targetBranch: string,
  candidateBranches?: string[],
  cwd: string = process.cwd()
): Promise<MergedBranchesResult> {
  const merged: string[] = [];
  const squashed: string[] = [];

  try {
    const output = await runGit(["branch", "--merged", targetBranch], cwd);
    if (output) {
      const branches = output
        .split(/\r?\n/)
        .map((b) => b.replace(/^[*+]\s+/, "").trim())
        .filter((b) => b && b !== targetBranch && !b.startsWith("("));
      merged.push(...branches);
    }
  } catch {
    // ignore
  }

  // Check candidate branches for squash merges
  if (candidateBranches && candidateBranches.length > 0) {
    const candidatesToCheck = candidateBranches.filter(
      (b) => b !== targetBranch && !merged.includes(b)
    );

    await Promise.all(
      candidatesToCheck.map(async (branch) => {
        const isSquashed = await isBranchSquashMerged(branch, targetBranch, cwd);
        if (isSquashed) {
          squashed.push(branch);
        }
      })
    );
  }

  return {
    merged,
    squashed,
    all: Array.from(new Set([...merged, ...squashed])),
  };
}

/**
 * Checks if a branch has commits that have not been pushed to its upstream tracking branch,
 * or not integrated into the default branch if no upstream is configured.
 */
export async function getUnpushedCommits(
  branch: string,
  defaultBranch?: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  try {
    let upstream = "";
    try {
      upstream = await runGit(
        ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`],
        cwd
      );
    } catch {
      // No upstream tracking branch configured
    }

    const compareRef = upstream || defaultBranch;
    if (!compareRef) return [];

    const output = await runGit(
      ["log", `${compareRef}..${branch}`, "--oneline"],
      cwd
    );
    if (!output) return [];

    return output.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

export async function deleteBranch(
  branch: string,
  force: boolean = false,
  cwd: string = process.cwd()
): Promise<void> {
  await runGit(["branch", force ? "-D" : "-d", branch], cwd);
}
