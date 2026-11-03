import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import {
  isGitRepo,
  listWorktrees,
  lockWorktree,
  unlockWorktree,
  type WorktreeInfo,
} from "../core/git.js";

export async function lockCommand(
  target?: string,
  options: { reason?: string } = {}
): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const worktrees = await listWorktrees();
  let selectedWt: WorktreeInfo | undefined;

  if (target) {
    const norm = path.normalize(target).toLowerCase();
    selectedWt = worktrees.find(
      (wt) =>
        wt.branch === target ||
        path.normalize(wt.path).toLowerCase() === norm ||
        path.basename(wt.path).toLowerCase() === norm
    );
  } else {
    // Interactive selection
    const nonMain = worktrees.filter((wt) => !wt.isMain);
    if (nonMain.length === 0) {
      p.log.info("No lockable worktrees found.");
      return;
    }

    const choice = await p.select({
      message: "Select a worktree to lock:",
      options: nonMain.map((wt) => ({
        value: wt.path,
        label: `${wt.branch || path.basename(wt.path)} ${wt.isLocked ? pc.yellow("[already locked]") : pc.green("[unlocked]")}`,
        hint: wt.path,
      })),
    });

    if (p.isCancel(choice)) {
      p.cancel("Operation cancelled.");
      return;
    }

    selectedWt = worktrees.find((wt) => wt.path === choice);
  }

  if (!selectedWt) {
    p.cancel(pc.red(`Worktree not found for: ${target}`));
    return;
  }

  if (selectedWt.isLocked) {
    p.log.info(`Worktree at ${pc.cyan(selectedWt.path)} is already locked.`);
    return;
  }

  let reason = options.reason;
  if (reason === undefined && !target) {
    const reasonInput = await p.text({
      message: "Optional lock reason (press Enter to skip):",
      placeholder: "e.g., active long-running build or rebase in progress",
    });
    if (!p.isCancel(reasonInput) && (reasonInput as string).trim()) {
      reason = (reasonInput as string).trim();
    }
  }

  try {
    await lockWorktree(selectedWt.path, reason);
    p.outro(
      `${pc.green("Worktree locked successfully!")} 🔒\n  ${pc.bold("Location:")} ${pc.cyan(selectedWt.path)}${reason ? `\n  ${pc.bold("Reason:")}   ${reason}` : ""}`
    );
  } catch (err: any) {
    p.cancel(pc.red(`Failed to lock worktree: ${err.message}`));
  }
}

export async function unlockCommand(target?: string): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const worktrees = await listWorktrees();
  let selectedWt: WorktreeInfo | undefined;

  if (target) {
    const norm = path.normalize(target).toLowerCase();
    selectedWt = worktrees.find(
      (wt) =>
        wt.branch === target ||
        path.normalize(wt.path).toLowerCase() === norm ||
        path.basename(wt.path).toLowerCase() === norm
    );
  } else {
    // Interactive selection of locked worktrees
    const lockedWorktrees = worktrees.filter((wt) => wt.isLocked);
    if (lockedWorktrees.length === 0) {
      p.log.info("No locked worktrees found.");
      return;
    }

    const choice = await p.select({
      message: "Select a worktree to unlock:",
      options: lockedWorktrees.map((wt) => ({
        value: wt.path,
        label: `${wt.branch || path.basename(wt.path)} ${wt.lockReason ? pc.dim(`(${wt.lockReason})`) : ""}`,
        hint: wt.path,
      })),
    });

    if (p.isCancel(choice)) {
      p.cancel("Operation cancelled.");
      return;
    }

    selectedWt = worktrees.find((wt) => wt.path === choice);
  }

  if (!selectedWt) {
    p.cancel(pc.red(`Worktree not found for: ${target}`));
    return;
  }

  if (!selectedWt.isLocked) {
    p.log.info(`Worktree at ${pc.cyan(selectedWt.path)} is not locked.`);
    return;
  }

  try {
    await unlockWorktree(selectedWt.path);
    p.outro(
      `${pc.green("Worktree unlocked successfully!")} 🔓\n  ${pc.bold("Location:")} ${pc.cyan(selectedWt.path)}`
    );
  } catch (err: any) {
    p.cancel(pc.red(`Failed to unlock worktree: ${err.message}`));
  }
}
