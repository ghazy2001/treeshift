import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import {
  isGitRepo,
  listWorktrees,
  removeWorktree,
  pruneWorktrees,
  deleteBranch,
  getDefaultBranch,
  getUnpushedCommits,
  getMainRepoRoot,
  type WorktreeInfo,
} from "../core/git.js";
import { loadConfig } from "../core/config.js";
import { executeHook } from "../core/hooks.js";

export async function removeCommand(
  target?: string,
  options: { force?: boolean; deleteBranch?: boolean; dryRun?: boolean } = {}
): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const worktrees = await listWorktrees();
  let selectedWt: WorktreeInfo | undefined;

  if (target) {
    const normTarget = path.normalize(target).toLowerCase();
    selectedWt = worktrees.find(
      (wt) =>
        wt.branch === target ||
        path.normalize(wt.path).toLowerCase() === normTarget ||
        path.basename(wt.path).toLowerCase() === normTarget
    );
  } else {
    // Interactive selection
    const nonMain = worktrees.filter((wt) => !wt.isMain);
    if (nonMain.length === 0) {
      p.log.info("No removable worktrees found (only main worktree exists).");
      return;
    }

    const choice = await p.select({
      message: "Select a worktree to remove:",
      options: nonMain.map((wt) => ({
        value: wt.path,
        label: `${wt.branch || path.basename(wt.path)} ${wt.isDirty ? pc.yellow("[dirty]") : pc.green("[clean]")}`,
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

  if (selectedWt.isMain) {
    p.cancel(pc.red("Cannot remove the main repository worktree."));
    return;
  }

  if (selectedWt.isLocked && !options.force) {
    p.cancel(
      pc.red(
        `Cannot remove locked worktree at ${selectedWt.path}${selectedWt.lockReason ? ` (reason: ${selectedWt.lockReason})` : ""}.\nUnlock it first using 'treeshift unlock' or pass --force to override.`
      )
    );
    return;
  }

  if (options.dryRun) {
    p.log.info(pc.yellow("[dry-run] Removal preview:"));
    p.log.message(`  • Worktree path: ${pc.cyan(selectedWt.path)}`);
    p.log.message(`  • Branch: ${pc.blue(selectedWt.branch || "(detached)")}`);
    p.log.message(`  • Status: ${selectedWt.isDirty ? pc.yellow("[dirty]") : pc.green("[clean]")}`);
    if (options.deleteBranch && selectedWt.branch) {
      p.log.message(`  • Would also delete branch: ${pc.red(selectedWt.branch)}`);
    }
    p.outro(pc.cyan("[dry-run] No files or git refs were modified."));
    return;
  }

  // Check dirty status
  if (selectedWt.isDirty && !options.force) {
    p.log.warn(`Worktree at ${pc.cyan(selectedWt.path)} has uncommitted changes!`);
    const confirmForce = await p.confirm({
      message: "Are you sure you want to force remove it and discard changes?",
      initialValue: false,
    });

    if (p.isCancel(confirmForce) || !confirmForce) {
      p.cancel("Removal cancelled.");
      return;
    }
    options.force = true;
  }

  const mainRoot = await getMainRepoRoot();
  const config = loadConfig(mainRoot);

  if (config.hooks?.preRemove) {
    const sHook = p.spinner();
    sHook.start(`Running preRemove hook: ${pc.dim(config.hooks.preRemove)}...`);
    const hookRes = await executeHook("preRemove", config.hooks.preRemove, selectedWt.path);
    if (hookRes.success) {
      sHook.stop(pc.green("Ran preRemove hook successfully."));
    } else {
      sHook.stop(pc.yellow(`preRemove hook failed: ${hookRes.error}`));
    }
  }

  const s = p.spinner();
  s.start(`Removing worktree: ${pc.cyan(selectedWt.path)}...`);

  try {
    await removeWorktree(selectedWt.path, { force: options.force });
    await pruneWorktrees();
    s.stop(`Removed worktree at ${pc.dim(selectedWt.path)}`);
  } catch (err: any) {
    s.stop(pc.red("Failed to remove worktree."));
    p.cancel(err.message);
    return;
  }

  // Ask to delete branch if branch exists
  if (selectedWt.branch) {
    let shouldDeleteBranch = options.deleteBranch;
    if (shouldDeleteBranch === undefined) {
      const askBranch = await p.confirm({
        message: `Also delete local branch ${pc.blue(selectedWt.branch)}?`,
        initialValue: false,
      });
      shouldDeleteBranch = !p.isCancel(askBranch) && askBranch;
    }

    if (shouldDeleteBranch) {
      // Check for unpushed / unmerged commits before deleting
      const defaultBranch = await getDefaultBranch();
      const unpushed = await getUnpushedCommits(selectedWt.branch, defaultBranch);

      let forceDelete = options.force;
      if (unpushed.length > 0) {
        p.log.warn(
          `Branch ${pc.blue(selectedWt.branch)} has ${pc.yellow(unpushed.length.toString())} unpushed/unmerged commit(s):`
        );
        for (const commit of unpushed.slice(0, 3)) {
          p.log.message(`  ${pc.dim("•")} ${commit}`);
        }
        if (unpushed.length > 3) {
          p.log.message(`  ${pc.dim(`...and ${unpushed.length - 3} more`)}`);
        }

        const confirmNuke = await p.confirm({
          message: `Are you sure you want to delete branch ${pc.blue(selectedWt.branch)} and discard these commits?`,
          initialValue: false,
        });

        if (p.isCancel(confirmNuke) || !confirmNuke) {
          p.log.info(`Skipped deleting branch ${pc.blue(selectedWt.branch)}.`);
          p.outro(pc.green("Worktree removed successfully (branch preserved)."));
          return;
        }
        forceDelete = true;
      }

      try {
        await deleteBranch(selectedWt.branch, forceDelete);
        p.log.success(`Deleted branch ${pc.blue(selectedWt.branch)}`);
      } catch (err: any) {
        p.log.warn(`Could not delete branch ${selectedWt.branch}: ${err.message}`);
      }
    }
  }

  p.outro(pc.green("Worktree removed successfully."));
}
