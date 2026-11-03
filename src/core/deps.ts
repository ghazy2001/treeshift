import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PackageManagerInfo {
  name: string;
  command: string;
  args: string[];
}

export function detectPackageManager(projectDir: string): PackageManagerInfo | null {
  if (
    fs.existsSync(path.join(projectDir, "bun.lock")) ||
    fs.existsSync(path.join(projectDir, "bun.lockb"))
  ) {
    return { name: "bun", command: "bun", args: ["install"] };
  }

  if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) {
    return { name: "pnpm", command: "pnpm", args: ["install"] };
  }

  if (fs.existsSync(path.join(projectDir, "yarn.lock"))) {
    return { name: "yarn", command: "yarn", args: ["install"] };
  }

  if (fs.existsSync(path.join(projectDir, "package-lock.json"))) {
    return { name: "npm", command: "npm", args: ["install"] };
  }

  if (
    fs.existsSync(path.join(projectDir, "Cargo.lock")) ||
    fs.existsSync(path.join(projectDir, "Cargo.toml"))
  ) {
    return { name: "cargo", command: "cargo", args: ["check"] };
  }

  if (fs.existsSync(path.join(projectDir, "poetry.lock"))) {
    return { name: "poetry", command: "poetry", args: ["install"] };
  }

  if (fs.existsSync(path.join(projectDir, "uv.lock"))) {
    return { name: "uv", command: "uv", args: ["sync"] };
  }

  if (fs.existsSync(path.join(projectDir, "go.mod"))) {
    return { name: "go", command: "go", args: ["mod", "download"] };
  }

  if (fs.existsSync(path.join(projectDir, "package.json"))) {
    return { name: "npm", command: "npm", args: ["install"] };
  }

  return null;
}

export async function runPackageInstall(
  targetDir: string,
  pm?: PackageManagerInfo
): Promise<{ success: boolean; error?: string }> {
  const detected = pm || detectPackageManager(targetDir);
  if (!detected) {
    return {
      success: false,
      error: "No recognizable package manager or lockfile found in worktree.",
    };
  }

  try {
    await execFileAsync(detected.command, detected.args, {
      cwd: targetDir,
      shell: process.platform === "win32",
      timeout: 120_000,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
