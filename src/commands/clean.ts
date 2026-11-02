import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  isGitRepo,
  getDefaultBranch,
  getMergedBranches,
  listWorktrees,
  removeWorktree,
  pruneWorktrees,
  deleteBranch,
} from "../core/git.js";

export async function cleanCommand(options: { force?: boolean } = {}): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const defaultBranch = await getDefaultBranch();
  const s = p.spinner();
  s.start(`Scanning for worktrees merged into ${pc.cyan(defaultBranch)} (including squash merges)...`);

  const worktrees = await listWorktrees();
  const candidateBranches = worktrees
    .filter((wt) => !wt.isMain && wt.branch)
    .map((wt) => wt.branch as string);

  const { merged, squashed, all } = await getMergedBranches(
    defaultBranch,
    candidateBranches
  );

  s.stop(`Scanned ${worktrees.length} worktrees against ${pc.cyan(defaultBranch)}.`);

  // Find worktrees associated with merged or squashed branches (exclude main repo)
  const candidateWorktrees = worktrees.filter(
    (wt) => !wt.isMain && wt.branch && all.includes(wt.branch)
  );

  if (candidateWorktrees.length === 0) {
    p.outro(pc.green("✨ No merged worktrees found. Your workspace is clean!"));
    return;
  }

  const choices = candidateWorktrees.map((wt) => {
    const isSquashed = squashed.includes(wt.branch!);
    const mergeTag = isSquashed ? pc.magenta("[squash-merged]") : pc.cyan("[merged]");
    const dirtyTag = wt.isDirty ? pc.yellow("[dirty]") : pc.green("[clean]");
    return {
      value: wt.path,
      label: `${pc.blue(wt.branch!)} ${mergeTag} ${dirtyTag}`,
      hint: wt.path,
    };
  });

  const selectedPaths = await p.multiselect({
    message: `Found ${candidateWorktrees.length} merged worktrees. Select to clean up:`,
    options: choices,
    initialValues: candidateWorktrees.filter((wt) => !wt.isDirty).map((wt) => wt.path),
  });

  if (p.isCancel(selectedPaths) || (selectedPaths as string[]).length === 0) {
    p.cancel("No worktrees selected. Aborting.");
    return;
  }

  const pathsToDelete = selectedPaths as string[];

  const deleteBranchesToo = await p.confirm({
    message: "Also delete the corresponding merged Git branches?",
    initialValue: true,
  });

  const shouldDeleteBranches = !p.isCancel(deleteBranchesToo) && deleteBranchesToo;

  const cleanSpinner = p.spinner();
  cleanSpinner.start(`Cleaning ${pathsToDelete.length} worktrees...`);

  let removedCount = 0;
  for (const wtPath of pathsToDelete) {
    const wt = candidateWorktrees.find((c) => c.path === wtPath);
    try {
      await removeWorktree(wtPath, { force: options.force || wt?.isDirty });
      if (shouldDeleteBranches && wt?.branch) {
        // Squash-merged branches require -D because git doesn't share ancestry
        const isSquashed = squashed.includes(wt.branch);
        await deleteBranch(wt.branch, isSquashed);
      }
      removedCount++;
    } catch (err: any) {
      p.log.warn(`Failed to clean ${wtPath}: ${err.message}`);
    }
  }

  await pruneWorktrees();
  cleanSpinner.stop(`Cleaned up ${pc.bold(removedCount.toString())} worktrees.`);

  p.outro(pc.green("Cleanup complete! 🧹"));
}
