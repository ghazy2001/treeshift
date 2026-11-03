import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function getNavFilePath(): string {
  // If a session-specific or PID-specific target file is provided by the shell wrapper, use it
  if (process.env.TREESHIFT_TARGET_FILE && process.env.TREESHIFT_TARGET_FILE.trim()) {
    return process.env.TREESHIFT_TARGET_FILE.trim();
  }
  return path.join(os.tmpdir(), "treeshift-target-dir");
}

export function recordTargetDirectory(targetPath: string): void {
  try {
    const navFile = getNavFilePath();
    const navDir = path.dirname(navFile);
    if (!fs.existsSync(navDir)) {
      fs.mkdirSync(navDir, { recursive: true });
    }
    fs.writeFileSync(navFile, targetPath, "utf8");
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

export function getShellIntegration(
  shellType: "bash" | "zsh" | "fish" | "powershell" | "nu" | "nushell"
): string {
  const tmpDirPosix = os.tmpdir().replace(/\\/g, "/");

  switch (shellType) {
    case "bash":
    case "zsh":
      return `
# treeshift shell integration for ${shellType}
treeshift_wrapper() {
  local target_file="${tmpDirPosix}/treeshift-target-$$"
  rm -f "$target_file"
  TREESHIFT_TARGET_FILE="$target_file" command treeshift "$@"
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
  set -l target_file "${tmpDirPosix}/treeshift-target-$fish_pid"
  rm -f "$target_file"
  env TREESHIFT_TARGET_FILE="$target_file" command treeshift $argv
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
    $targetFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "treeshift-target-$PID")
    if (Test-Path $targetFile) { Remove-Item $targetFile -Force -ErrorAction SilentlyContinue }
    
    $env:TREESHIFT_TARGET_FILE = $targetFile
    try {
        treeshift.cmd @args
    } finally {
        Remove-Item Env:\TREESHIFT_TARGET_FILE -ErrorAction SilentlyContinue
    }
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

    case "nu":
    case "nushell":
      return `
# treeshift shell integration for nushell
def --env treeshift_wrapper [...args] {
    let target_file = ($nu.temp-path | path join $"treeshift-target-($nu.pid)")
    if ($target_file | path exists) { rm -f $target_file }
    with-env { TREESHIFT_TARGET_FILE: $target_file } {
        ^treeshift ...$args
    }
    if ($target_file | path exists) {
        let target_dir = (open $target_file | str trim)
        rm -f $target_file
        if ($target_dir != "" and ($target_dir | path exists)) {
            cd $target_dir
        }
    }
}

alias treeshift = treeshift_wrapper
alias ts = treeshift_wrapper
alias wt = treeshift_wrapper
`.trim();

    default:
      return "";
  }
}
