import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { detectPackageManager } from "../src/core/deps.js";
import { executeHook } from "../src/core/hooks.js";
import { resolveWorktreePath, DEFAULT_CONFIG } from "../src/core/config.js";
import { isBareRepo } from "../src/core/git.js";

describe("package manager detection", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-deps-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects bun when bun.lock exists", () => {
    fs.writeFileSync(path.join(tempDir, "bun.lock"), "");
    const pm = detectPackageManager(tempDir);
    expect(pm?.name).toBe("bun");
    expect(pm?.command).toBe("bun");
    expect(pm?.args).toEqual(["install"]);
  });

  it("detects pnpm when pnpm-lock.yaml exists", () => {
    fs.writeFileSync(path.join(tempDir, "pnpm-lock.yaml"), "");
    const pm = detectPackageManager(tempDir);
    expect(pm?.name).toBe("pnpm");
    expect(pm?.command).toBe("pnpm");
  });

  it("detects cargo when Cargo.toml exists", () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), "");
    const pm = detectPackageManager(tempDir);
    expect(pm?.name).toBe("cargo");
  });

  it("detects poetry when poetry.lock exists", () => {
    fs.writeFileSync(path.join(tempDir, "poetry.lock"), "");
    const pm = detectPackageManager(tempDir);
    expect(pm?.name).toBe("poetry");
  });

  it("detects npm fallback when package.json exists", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
    const pm = detectPackageManager(tempDir);
    expect(pm?.name).toBe("npm");
  });
});

describe("lifecycle hooks engine", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-hooks-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores undefined or empty hook command safely", async () => {
    const res = await executeHook("postAdd", undefined, tempDir);
    expect(res.executed).toBe(false);
    expect(res.success).toBe(true);
  });

  it("executes valid shell command with environment variables", async () => {
    const markerFile = path.join(tempDir, "hook-ran.txt");
    const cmd = process.platform === "win32"
      ? `echo ok > "${markerFile}"`
      : `echo "ok" > "${markerFile}"`;

    const res = await executeHook("postAdd", cmd, tempDir);
    expect(res.executed).toBe(true);
    expect(res.success).toBe(true);
    expect(fs.existsSync(markerFile)).toBe(true);
  });
});

describe("bare repository handling", () => {
  let bareDir: string;

  beforeEach(() => {
    bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-bare-"));
    execSync("git init --bare", { cwd: bareDir });
  });

  afterEach(() => {
    if (fs.existsSync(bareDir)) {
      fs.rmSync(bareDir, { recursive: true, force: true });
    }
  });

  it("identifies bare git repositories correctly", async () => {
    const isBare = await isBareRepo(bareDir);
    expect(isBare).toBe(true);
  });

  it("resolves worktrees outside bare repo into sibling folder", () => {
    const resolved = resolveWorktreePath(bareDir, "feat/bare-test", DEFAULT_CONFIG, { isBare: true });
    const parent = path.dirname(bareDir);
    expect(resolved.startsWith(parent)).toBe(true);
    expect(resolved).not.toContain(path.join(bareDir, ".worktrees"));
  });
});
