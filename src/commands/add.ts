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
  ensureGitignoreEntry,
  createCarryStash,
  applyCarryStash,
  dropStash,
  isBareRepo,
} from "../core/git.js";
import { loadConfig, resolveWorktreePath } from "../core/config.js";
import { syncEnvFiles } from "../core/env-sync.js";
import { recordTargetDirectory } from "../core/shell.js";
import { detectPackageManager, runPackageInstall } from "../core/deps.js";
import { executeHook } from "../core/hooks.js";
import { openInEditor } from "../core/editor.js";

export interface AddOptions {
  base?: string;
  path?: string;
  noEnv?: boolean;
  switch?: boolean;
  carry?: boolean;
  install?: boolean;
  editor?: string;
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
        if (!value || !value.trim()) return "Branch name cannot be empty.";
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
  const isBare = await isBareRepo(mainRoot);
  const targetPath = options.path
    ? path.resolve(options.path)
    : resolveWorktreePath(mainRoot, branch, config, { isBare });

  if (fs.existsSync(targetPath)) {
    p.cancel(pc.red(`Target path already exists: ${targetPath}`));
    process.exit(1);
  }

  // Stash uncommitted changes if --carry is requested
  let carriedStashSha: string | null = null;
  if (options.carry) {
    const sCarry = p.spinner();
    sCarry.start("Stashing current uncommitted changes to carry over...");
    carriedStashSha = await createCarryStash(process.cwd());
    if (carriedStashSha) {
      sCarry.stop("Stashed uncommitted changes.");
    } else {
      sCarry.stop("No uncommitted changes found to carry.");
    }
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

    // Ensure internal worktree directory is ignored in .gitignore
    if (config.location === "internal") {
      const added = ensureGitignoreEntry(mainRoot, config.internalDir);
      if (added) {
        p.log.info(`Added ${pc.dim(config.internalDir + "/")} to .gitignore`);
      }
    }
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

  // Apply carried stash if one was created
  if (carriedStashSha) {
    const sApply = p.spinner();
    sApply.start("Applying carried changes to the new worktree...");
    const applyRes = await applyCarryStash(carriedStashSha, targetPath);
    if (applyRes.success) {
      await dropStash(carriedStashSha, process.cwd());
      sApply.stop("Applied carried changes successfully.");
      p.log.success(
        pc.green("Carried over all uncommitted changes to your new worktree!")
      );
    } else {
      sApply.stop(pc.yellow("Carried changes resulted in conflicts."));
      p.log.warn(
        `Changes are preserved in stash (${carriedStashSha}). You can inspect or apply them manually using:\n  ${pc.cyan(`git -C "${targetPath}" stash apply`)}`
      );
    }
  }

  // Auto dependency installation (--install or config.autoInstall)
  const shouldInstall = options.install || config.autoInstall;
  if (shouldInstall) {
    const pm = detectPackageManager(targetPath);
    if (pm) {
      const sDeps = p.spinner();
      sDeps.start(
        `Installing dependencies via ${pc.cyan(pm.name)} (${pm.command} ${pm.args.join(" ")})...`
      );
      const installRes = await runPackageInstall(targetPath, pm);
      if (installRes.success) {
        sDeps.stop(pc.green(`Dependencies installed successfully with ${pm.name}.`));
      } else {
        sDeps.stop(pc.yellow(`Package install failed: ${installRes.error}`));
      }
    }
  }

  // Lifecycle hook: postAdd
  if (config.hooks?.postAdd) {
    const sHook = p.spinner();
    sHook.start(`Running postAdd hook: ${pc.dim(config.hooks.postAdd)}...`);
    const hookRes = await executeHook("postAdd", config.hooks.postAdd, targetPath);
    if (hookRes.success) {
      sHook.stop(pc.green("Ran postAdd hook successfully."));
    } else {
      sHook.stop(pc.yellow(`postAdd hook failed: ${hookRes.error}`));
    }
  }

  // Auto switch (default true)
  if (options.switch !== false) {
    recordTargetDirectory(targetPath);
  }

  // Open in editor if requested (--editor, --code, --cursor, etc.)
  if (options.editor) {
    const launch = openInEditor(options.editor, targetPath);
    if (launch.launched) {
      p.log.success(`Opened worktree in ${pc.cyan(options.editor)} 🚀`);
    } else {
      p.log.warn(`Could not launch editor "${options.editor}": ${launch.error}`);
    }
  }

  p.outro(
    `${pc.green("Worktree ready!")} 🚀\n  ${pc.bold("Location:")} ${pc.cyan(targetPath)}\n  ${pc.bold("Branch:")}   ${pc.blue(branch)}`
  );
}
