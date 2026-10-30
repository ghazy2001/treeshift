import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function getNavFilePath(): string {
  return path.join(os.tmpdir(), "treeshift-target-dir");
}

export function recordTargetDirectory(targetPath: string): void {
  try {
    fs.writeFileSync(getNavFilePath(), targetPath, "utf8");
  } catch {
    // ignore
  }
}

export function clearTargetDirectory(): void {
  try {
    const navFile = getNavFilePath();
    if (fs.existsSync(navFile)) {
      fs.unlinkSync(navFile);
    }
  } catch {
    // ignore
  }
}

export function getShellIntegration(shellType: "bash" | "zsh" | "fish" | "powershell"): string {
  const navFilePosix = getNavFilePath().replace(/\\/g, "/");

  switch (shellType) {
    case "bash":
    case "zsh":
      return `
# treeshift shell integration for ${shellType}
treeshift_wrapper() {
  local target_file="${navFilePosix}"
  rm -f "$target_file"
  command treeshift "$@"
  local exit_code=$?
  if [ $exit_code -eq 0 ] && [ -f "$target_file" ]; then
    local target_dir
    target_dir="$(cat "$target_file")"
    rm -f "$target_file"
    if [ -n "$target_dir" ] && [ -d "$target_dir" ]; then
      cd "$target_dir" || return
    fi
  fi
  return $exit_code
}

alias treeshift=treeshift_wrapper
alias ts=treeshift_wrapper
alias wt=treeshift_wrapper
`.trim();

    case "fish":
      return `
# treeshift shell integration for fish
function treeshift_wrapper
  set -l target_file "${navFilePosix}"
  rm -f "$target_file"
  command treeshift $argv
  set -l exit_code $status
  if test $exit_code -eq 0; and test -f "$target_file"
    set -l target_dir (cat "$target_file")
    rm -f "$target_file"
    if test -n "$target_dir"; and test -d "$target_dir"
      cd "$target_dir"
    end
  end
  return $exit_code
end

alias treeshift=treeshift_wrapper
alias ts=treeshift_wrapper
alias wt=treeshift_wrapper
`.trim();

    case "powershell":
      return `
# treeshift shell integration for PowerShell
function Invoke-Treeshift {
    $targetFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "treeshift-target-dir")
    if (Test-Path $targetFile) { Remove-Item $targetFile -Force -ErrorAction SilentlyContinue }
    
    treeshift.cmd @args
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0 -and (Test-Path $targetFile)) {
        $targetDir = (Get-Content $targetFile -Raw).Trim()
        Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
        if ($targetDir -and (Test-Path $targetDir)) {
            Set-Location $targetDir
        }
    }
}

Set-Alias -Name ts -Value Invoke-Treeshift -Option AllScope -Force
Set-Alias -Name wt -Value Invoke-Treeshift -Option AllScope -Force
`.trim();

    default:
      return "";
  }
}
