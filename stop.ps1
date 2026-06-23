param(
    [switch]$Quiet
)

$ErrorActionPreference = "SilentlyContinue"

$patterns = @(
    "services/posting-service.jar",
    "services\posting-service.jar",
    "services/user-service.jar",
    "services\user-service.jar",
    "services/zones-service.jar",
    "services\zones-service.jar",
    "BPD-Camunda-Project.jar",
    "frontend/server.js",
    "frontend\server.js"
)

if (-not $Quiet) {
    Write-Host "Stopping project services..."
}

$processes = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -in @("java.exe", "node.exe") }

foreach ($process in $processes) {
    $commandLine = $process.CommandLine
    if (-not $commandLine) {
        continue
    }

    $matchesProjectProcess = $false
    foreach ($pattern in $patterns) {
        if ($commandLine -like "*$pattern*") {
            $matchesProjectProcess = $true
            break
        }
    }

    if ($matchesProjectProcess) {
        if (-not $Quiet) {
            Write-Host "Stopping PID $($process.ProcessId): $commandLine"
        }
        Stop-Process -Id $process.ProcessId -Force
    }
}

if (-not $Quiet) {
    Write-Host "Done."
}
