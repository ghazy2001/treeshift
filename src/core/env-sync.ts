import fs from "node:fs";
import path from "node:path";

export interface EnvSyncResult {
  synced: string[];
  skipped: string[];
  errors: { file: string; error: string }[];
}

const DEFAULT_IGNORED_PATTERNS = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
];

export function findEnvFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  try {
    const files = fs.readdirSync(dir);
    return files.filter((f) => {
      // Must start with .env
      if (!f.startsWith(".env")) return false;
      // Skip templates / examples
      for (const pattern of DEFAULT_IGNORED_PATTERNS) {
        if (pattern.test(f)) return false;
      }
      const fullPath = path.join(dir, f);
      try {
        return fs.statSync(fullPath).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export async function syncEnvFiles(
  sourceDir: string,
  targetDir: string,
  options: { overwrite?: boolean; customFiles?: string[] } = {}
): Promise<EnvSyncResult> {
  const result: EnvSyncResult = {
    synced: [],
    skipped: [],
    errors: [],
  };

  if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
    return result;
  }

  const filesToSync = options.customFiles?.length
    ? options.customFiles
    : findEnvFiles(sourceDir);

  for (const file of filesToSync) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(targetDir, file);

    if (!fs.existsSync(srcPath)) {
      continue;
    }

    if (fs.existsSync(destPath) && !options.overwrite) {
      result.skipped.push(file);
      continue;
    }

    try {
      fs.copyFileSync(srcPath, destPath);
      result.synced.push(file);
    } catch (err: any) {
      result.errors.push({ file, error: err.message });
    }
  }

  return result;
}
