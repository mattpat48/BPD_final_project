<#
Stops processes started by `start-all.ps1` using the PIDs recorded in `.run/processes.json`.

Usage (PowerShell):
  .\stop-all.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

function Stop-ProcessOnPort {
    param(
        [int]$Port
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        if ($connection.OwningProcess) {
            Write-Host "Stopping process on port $Port (PID $($connection.OwningProcess))"
            & taskkill /PID $connection.OwningProcess /T /F | Out-Null
        }
    }
}

$stateFile = Join-Path $root '.run\processes.json'
if (-not (Test-Path $stateFile)) {
    Write-Host "No .run/processes.json found. Falling back to port-based shutdown." -ForegroundColor Yellow
} else {
    try {
        $entries = Get-Content $stateFile -Raw | ConvertFrom-Json
    } catch {
        Write-Host "Unable to read .run/processes.json: $_" -ForegroundColor Red
        Pop-Location
        return
    }

    foreach ($entry in $entries) {
        try {
            if ($entry.pid) {
                Write-Host "Stopping $($entry.name) (PID $($entry.pid))"
                & taskkill /PID $entry.pid /T /F | Out-Null
            }
        } catch {
            Write-Host "Process $($entry.pid) could not be stopped or is not running: $_" -ForegroundColor Yellow
        }
    }
}

foreach ($port in 8080, 8888, 9080, 9090) {
    Stop-ProcessOnPort -Port $port
}

Remove-Item $stateFile -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root '.run\logs') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Stopped processes and removed .run/processes.json"

Pop-Location
