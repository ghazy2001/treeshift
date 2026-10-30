import pc from "picocolors";
import path from "node:path";
import type { WorktreeInfo } from "../core/git.js";

export function formatStatus(isDirty?: boolean): string {
  if (isDirty === undefined) return pc.dim("[?]");
  return isDirty ? pc.yellow("[dirty]") : pc.green("[clean]");
}

export function formatBranch(branch: string | null, isMain: boolean): string {
  if (!branch) return pc.dim("(detached HEAD)");
  if (isMain) return pc.bold(pc.cyan(`★ ${branch}`));
  return pc.bold(pc.blue(branch));
}

export function formatWorktreeOption(
  wt: WorktreeInfo,
  currentPath: string
): { value: string; label: string; hint?: string } {
  const isCurrent = path.normalize(wt.path).toLowerCase() === path.normalize(currentPath).toLowerCase();
  const currentBadge = isCurrent ? pc.magenta(" (current)") : "";
  const mainBadge = wt.isMain ? pc.cyan(" [main]") : "";
  const dirtyBadge = formatStatus(wt.isDirty);
  const timeHint = wt.lastCommit?.relativeTime ? ` · ${wt.lastCommit.relativeTime}` : "";
  const commitMsg = wt.lastCommit?.message ? pc.dim(`"${wt.lastCommit.message}"`) : "";

  const branchName = wt.branch || `detached:${wt.head.slice(0, 7)}`;
  const label = `${branchName}${currentBadge}${mainBadge} ${dirtyBadge}`;
  const hint = `${path.basename(wt.path)}${timeHint} ${commitMsg}`.trim();

  return {
    value: wt.path,
    label,
    hint,
  };
}

export function printBanner(): void {
  console.log(
    pc.cyan(
      `\n  ▲ treeshift ${pc.dim("v0.1.0")} — Blazing-fast Git Worktree Manager\n`
    )
  );
}
