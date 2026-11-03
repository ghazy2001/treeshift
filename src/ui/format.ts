import pc from "picocolors";
import path from "node:path";
import type { WorktreeInfo } from "../core/git.js";

export function formatStatus(arg?: boolean | WorktreeInfo): string {
  if (arg === undefined) return pc.dim("[?]");
  if (typeof arg === "boolean") {
    return arg ? pc.yellow("[dirty]") : pc.green("[clean]");
  }
  const wt = arg;
  if (wt.isDirty === undefined) return pc.dim("[?]");
  if (!wt.isDirty) return pc.green("[clean]");

  if (wt.statusSummary) {
    const details: string[] = [];
    if (wt.statusSummary.modified > 0) details.push(`+${wt.statusSummary.modified}`);
    if (wt.statusSummary.untracked > 0) details.push(`?${wt.statusSummary.untracked}`);
    if (details.length > 0) {
      return pc.yellow(`[dirty ${details.join(" ")}]`);
    }
  }
  return pc.yellow("[dirty]");
}

export function formatAheadBehind(wt: WorktreeInfo): string {
  if (!wt.aheadBehind) return "";
  const parts: string[] = [];
  if (wt.aheadBehind.ahead > 0) parts.push(`↑${wt.aheadBehind.ahead}`);
  if (wt.aheadBehind.behind > 0) parts.push(`↓${wt.aheadBehind.behind}`);
  if (parts.length > 0) {
    return pc.cyan(` [${parts.join(" ")}]`);
  }
  return "";
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
  const lockBadge = wt.isLocked ? pc.red(" 🔒[locked]") : "";
  const aheadBehindBadge = formatAheadBehind(wt);
  const dirtyBadge = formatStatus(wt);
  const timeHint = wt.lastCommit?.relativeTime ? ` · ${wt.lastCommit.relativeTime}` : "";
  const commitMsg = wt.lastCommit?.message ? pc.dim(`"${wt.lastCommit.message}"`) : "";
  const lockReason = wt.lockReason ? pc.dim(` · reason: ${wt.lockReason}`) : "";

  const branchName = wt.branch || `detached:${wt.head.slice(0, 7)}`;
  const label = `${branchName}${currentBadge}${mainBadge}${lockBadge}${aheadBehindBadge} ${dirtyBadge}`;
  const hint = `${path.basename(wt.path)}${timeHint}${lockReason} ${commitMsg}`.trim();

  return {
    value: wt.path,
    label,
    hint,
  };
}

export function printBanner(): void {
  console.log(
    pc.cyan(
      `\n  ▲ treeshift ${pc.dim("v0.2.0")} — Blazing-fast Git Worktree Manager\n`
    )
  );
}
