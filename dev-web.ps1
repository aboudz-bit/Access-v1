# ---------------------------------------------------------------------------
# Local dev helper: start the Access frontend (Vite dev server).
# Serves on http://localhost:24510 and proxies /api -> http://localhost:8080.
# Start dev-api.ps1 in another terminal first.
# Usage:  .\dev-web.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Load .env (KEY=VALUE lines) — picks up optional API_PROXY_TARGET, etc.
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
}

# Vite requires these two; frontend runs on 24510 with base path "/".
$env:PORT = "24510"
$env:BASE_PATH = "/"

Push-Location $root
try {
  corepack pnpm@10 --filter "@workspace/access" run dev
} finally {
  Pop-Location
}
