import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findEnvFiles, syncEnvFiles } from "../src/core/env-sync.js";

describe("env-sync", () => {
  let tempSourceDir: string;
  let tempTargetDir: string;

  beforeEach(() => {
    tempSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-src-"));
    tempTargetDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-dst-"));
  });

  afterEach(() => {
    fs.rmSync(tempSourceDir, { recursive: true, force: true });
    fs.rmSync(tempTargetDir, { recursive: true, force: true });
  });

  it("finds valid .env files and ignores templates and examples", () => {
    fs.writeFileSync(path.join(tempSourceDir, ".env"), "KEY=val");
    fs.writeFileSync(path.join(tempSourceDir, ".env.local"), "SECRET=xyz");
    fs.writeFileSync(path.join(tempSourceDir, ".env.example"), "KEY=");
    fs.writeFileSync(path.join(tempSourceDir, ".env.sample"), "KEY=");
    fs.writeFileSync(path.join(tempSourceDir, "random.txt"), "hello");

    const found = findEnvFiles(tempSourceDir);
    expect(found.sort()).toEqual([".env", ".env.local"].sort());
  });

  it("syncs env files to target directory", async () => {
    fs.writeFileSync(path.join(tempSourceDir, ".env"), "DATABASE_URL=postgres://localhost");
    fs.writeFileSync(path.join(tempSourceDir, ".env.local"), "AUTH_SECRET=supersecret");

    const result = await syncEnvFiles(tempSourceDir, tempTargetDir);
    expect(result.synced.sort()).toEqual([".env", ".env.local"].sort());
    expect(result.skipped).toHaveLength(0);

    const targetEnv = fs.readFileSync(path.join(tempTargetDir, ".env"), "utf8");
    expect(targetEnv).toBe("DATABASE_URL=postgres://localhost");
  });

  it("skips existing files unless overwrite is true", async () => {
    fs.writeFileSync(path.join(tempSourceDir, ".env"), "ORIGINAL");
    fs.writeFileSync(path.join(tempTargetDir, ".env"), "EXISTING");

    const res1 = await syncEnvFiles(tempSourceDir, tempTargetDir, { overwrite: false });
    expect(res1.skipped).toContain(".env");
    expect(fs.readFileSync(path.join(tempTargetDir, ".env"), "utf8")).toBe("EXISTING");

    const res2 = await syncEnvFiles(tempSourceDir, tempTargetDir, { overwrite: true });
    expect(res2.synced).toContain(".env");
    expect(fs.readFileSync(path.join(tempTargetDir, ".env"), "utf8")).toBe("ORIGINAL");
  });
});
