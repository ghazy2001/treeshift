import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface TreeshiftConfig {
  /**
   * Location format for worktrees:
   * - 'internal': inside `<repo>/.worktrees/<branch>`
   * - 'sibling': alongside repo e.g. `<parent>/<repo>-<branch>`
   * Default: 'internal'
   */
  location: "internal" | "sibling";
  /** Custom directory name when using internal mode (default: ".worktrees") */
  internalDir: string;
  /** Automatically copy .env files to new worktrees (default: true) */
  syncEnv: boolean;
  /** Specific files to copy (default: auto-detected .env*) */
  envFiles?: string[];
  /** Default base branch to branch off from (default: detected default branch) */
  defaultBaseBranch?: string;
}

export const DEFAULT_CONFIG: TreeshiftConfig = {
  location: "internal",
  internalDir: ".worktrees",
  syncEnv: true,
};

export function sanitizeBranchName(branch: string): string {
  // Replace invalid filesystem characters or slashes for directory naming if needed
  return branch.replace(/[\/\\]/g, "-").replace(/[:*?"<>|]/g, "_");
}

export function resolveWorktreePath(
  repoRoot: string,
  branch: string,
  config: TreeshiftConfig = DEFAULT_CONFIG
): string {
  const sanitized = sanitizeBranchName(branch);
  const repoName = path.basename(repoRoot);

  if (config.location === "sibling") {
    const parentDir = path.dirname(repoRoot);
    return path.join(parentDir, `${repoName}-${sanitized}`);
  }

  return path.join(repoRoot, config.internalDir, sanitized);
}

export function loadConfig(repoRoot?: string): TreeshiftConfig {
  let config: TreeshiftConfig = { ...DEFAULT_CONFIG };

  // 1. Try global user config: ~/.config/treeshift/config.json
  try {
    const globalConfigPath = path.join(os.homedir(), ".config", "treeshift", "config.json");
    if (fs.existsSync(globalConfigPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalConfigPath, "utf8"));
      config = { ...config, ...parsed };
    }
  } catch {
    // ignore
  }

  // 2. Try project config: .treeshiftrc or .treeshiftrc.json
  if (repoRoot) {
    try {
      const candidates = [
        path.join(repoRoot, ".treeshiftrc"),
        path.join(repoRoot, ".treeshiftrc.json"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
          config = { ...config, ...parsed };
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  return config;
}
