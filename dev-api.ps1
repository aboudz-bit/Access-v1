# ---------------------------------------------------------------------------
# Local dev helper: start the Access API server (REST + WebRTC signaling).
# Loads .env, builds, then runs on PORT 8080.
# Usage:  .\dev-api.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Load .env (KEY=VALUE lines) into this process's environment.
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $idx = $line.IndexOf("=")
      $key = $line.Substring(0, $idx).Trim()
      $val = $line.Substring($idx + 1).Trim()
      Set-Item -Path "Env:$key" -Value $val
    }
  }
} else {
  Write-Warning ".env not found. Run: Copy-Item .env.example .env"
}

# API server listens on 8080 (matches the Vite proxy target).
$env:PORT = "8080"

Push-Location $root
try {
  corepack pnpm@10 --filter "@workspace/api-server" run build
  corepack pnpm@10 --filter "@workspace/api-server" run start
} finally {
  Pop-Location
}
