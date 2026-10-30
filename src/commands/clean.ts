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
  s.start(`Scanning for branches merged into ${pc.cyan(defaultBranch)}...`);

  const [mergedBranches, worktrees] = await Promise.all([
    getMergedBranches(defaultBranch),
    listWorktrees(),
  ]);

  s.stop(`Scanned ${worktrees.length} worktrees against ${pc.cyan(defaultBranch)}.`);

  // Find worktrees associated with merged branches (exclude main repo)
  const candidateWorktrees = worktrees.filter(
    (wt) => !wt.isMain && wt.branch && mergedBranches.includes(wt.branch)
  );

  if (candidateWorktrees.length === 0) {
    p.outro(pc.green("✨ No merged worktrees found. Your workspace is clean!"));
    return;
  }

  const choices = candidateWorktrees.map((wt) => ({
    value: wt.path,
    label: `${pc.blue(wt.branch!)} ${wt.isDirty ? pc.yellow("[dirty]") : pc.green("[clean]")}`,
    hint: wt.path,
  }));

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
        await deleteBranch(wt.branch, false);
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
