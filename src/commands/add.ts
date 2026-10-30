import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import fs from "node:fs";
import {
  isGitRepo,
  getMainRepoRoot,
  getDefaultBranch,
  listBranches,
  listWorktrees,
  addWorktree,
} from "../core/git.js";
import { loadConfig, resolveWorktreePath } from "../core/config.js";
import { syncEnvFiles } from "../core/env-sync.js";
import { recordTargetDirectory } from "../core/shell.js";

export interface AddOptions {
  base?: string;
  path?: string;
  noEnv?: boolean;
  switch?: boolean;
}

export async function addCommand(
  branchInput?: string,
  options: AddOptions = {}
): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const mainRoot = await getMainRepoRoot();
  const config = loadConfig(mainRoot);
  const defaultBase = config.defaultBaseBranch || (await getDefaultBranch());

  let branch = branchInput?.trim();

  if (!branch) {
    const input = await p.text({
      message: "Enter branch name for the new worktree:",
      placeholder: "feat/new-feature",
      validate: (value) => {
        if (!value.trim()) return "Branch name cannot be empty.";
        if (value.includes(" ")) return "Branch name cannot contain spaces.";
      },
    });

    if (p.isCancel(input)) {
      p.cancel("Operation cancelled.");
      return;
    }
    branch = (input as string).trim();
  }

  // Check if a worktree for this branch already exists
  const existingWorktrees = await listWorktrees();
  const alreadyAttached = existingWorktrees.find((wt) => wt.branch === branch);
  if (alreadyAttached) {
    p.log.warn(
      `Branch ${pc.blue(branch)} is already attached to worktree:\n  ${pc.dim(alreadyAttached.path)}`
    );
    const shouldSwitch = await p.confirm({
      message: "Switch to existing worktree instead?",
      initialValue: true,
    });
    if (!p.isCancel(shouldSwitch) && shouldSwitch) {
      recordTargetDirectory(alreadyAttached.path);
      p.outro(pc.green(`Switched to: ${alreadyAttached.path}`));
    }
    return;
  }

  // Check branch existence
  const { local, remote } = await listBranches();
  const existsLocal = local.includes(branch);
  const existsRemote = remote.includes(`origin/${branch}`);

  let createBranch = false;
  let baseBranch: string | undefined = undefined;

  if (existsLocal) {
    p.log.info(`Checking out existing local branch: ${pc.blue(branch)}`);
  } else if (existsRemote) {
    p.log.info(`Tracking remote branch: ${pc.blue(`origin/${branch}`)}`);
    createBranch = true;
    baseBranch = `origin/${branch}`;
  } else {
    createBranch = true;
    baseBranch = options.base || defaultBase;
    p.log.info(`Creating new branch ${pc.blue(branch)} based on ${pc.cyan(baseBranch)}`);
  }

  // Resolve target directory
  const targetPath = options.path
    ? path.resolve(options.path)
    : resolveWorktreePath(mainRoot, branch, config);

  if (fs.existsSync(targetPath)) {
    p.cancel(pc.red(`Target path already exists: ${targetPath}`));
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Creating worktree at ${pc.dim(path.relative(mainRoot, targetPath) || targetPath)}...`);

  try {
    await addWorktree({
      branch,
      targetPath,
      createBranch,
      baseBranch,
      cwd: mainRoot,
    });
    s.stop(`Created worktree for ${pc.blue(branch)}`);
  } catch (err: any) {
    s.stop(pc.red("Failed to create worktree."));
    p.cancel(err.message);
    process.exit(1);
  }

  // Environment sync
  const shouldSyncEnv = !options.noEnv && config.syncEnv;
  if (shouldSyncEnv) {
    const syncRes = await syncEnvFiles(mainRoot, targetPath, {
      customFiles: config.envFiles,
    });

    if (syncRes.synced.length > 0) {
      p.log.success(
        `Synced env files: ${pc.dim(syncRes.synced.join(", "))}`
      );
    }
    if (syncRes.errors.length > 0) {
      for (const err of syncRes.errors) {
        p.log.warn(`Could not sync ${err.file}: ${err.error}`);
      }
    }
  }

  // Auto switch (default true)
  if (options.switch !== false) {
    recordTargetDirectory(targetPath);
  }

  p.outro(
    `${pc.green("Worktree ready!")} 🚀\n  ${pc.bold("Location:")} ${pc.cyan(targetPath)}\n  ${pc.bold("Branch:")}   ${pc.blue(branch)}`
  );
}
