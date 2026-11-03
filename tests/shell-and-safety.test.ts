import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getNavFilePath,
  recordTargetDirectory,
  clearTargetDirectory,
  getShellIntegration,
} from "../src/core/shell.js";
import { ensureGitignoreEntry } from "../src/core/git.js";

describe("shell integration & isolation", () => {
  const originalEnv = process.env.TREESHIFT_TARGET_FILE;

  beforeEach(() => {
    delete process.env.TREESHIFT_TARGET_FILE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TREESHIFT_TARGET_FILE = originalEnv;
    } else {
      delete process.env.TREESHIFT_TARGET_FILE;
    }
  });

  it("uses process-specific env target file when TREESHIFT_TARGET_FILE is set", () => {
    const customTarget = path.join(os.tmpdir(), "treeshift-target-custom-pid-1234");
    process.env.TREESHIFT_TARGET_FILE = customTarget;
    expect(getNavFilePath()).toBe(customTarget);
  });

  it("falls back to default target file when env is unset", () => {
    expect(getNavFilePath()).toBe(path.join(os.tmpdir(), "treeshift-target-dir"));
  });

  it("records and clears target directory properly", () => {
    const tmpFile = path.join(os.tmpdir(), `treeshift-test-${Date.now()}`);
    process.env.TREESHIFT_TARGET_FILE = tmpFile;

    recordTargetDirectory("/my/target/path");
    expect(fs.existsSync(tmpFile)).toBe(true);
    expect(fs.readFileSync(tmpFile, "utf8")).toBe("/my/target/path");

    clearTargetDirectory();
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it("generates correct shell integration scripts including Nushell", () => {
    const bashScript = getShellIntegration("bash");
    expect(bashScript).toContain("treeshift-target-$$");
    expect(bashScript).toContain("TREESHIFT_TARGET_FILE=");

    const psScript = getShellIntegration("powershell");
    expect(psScript).toContain("treeshift-target-$PID");
    expect(psScript).toContain("$env:TREESHIFT_TARGET_FILE");

    const nuScript = getShellIntegration("nu");
    expect(nuScript).toContain("treeshift-target-($nu.pid)");
    expect(nuScript).toContain("with-env { TREESHIFT_TARGET_FILE:");
  });
});

describe("gitignore safety guard", () => {
  let tempRepoDir: string;

  beforeEach(() => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-repo-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempRepoDir)) {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    }
  });

  it("creates .gitignore if missing and adds entry with trailing slash", () => {
    const added = ensureGitignoreEntry(tempRepoDir, ".worktrees");
    expect(added).toBe(true);

    const gitignorePath = path.join(tempRepoDir, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);
    expect(fs.readFileSync(gitignorePath, "utf8").trim()).toBe(".worktrees/");
  });

  it("does not duplicate entry if already present", () => {
    const gitignorePath = path.join(tempRepoDir, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n.worktrees/\n.env\n", "utf8");

    const added = ensureGitignoreEntry(tempRepoDir, ".worktrees");
    expect(added).toBe(false);

    const lines = fs
      .readFileSync(gitignorePath, "utf8")
      .split("\n")
      .filter((l) => l.trim() === ".worktrees/");
    expect(lines.length).toBe(1);
  });
});
