<#
Start all project services.

Behavior:
- Starts the jars in `services/` if present: user-service.jar, zones-service.jar, posting-service.jar
- Starts the backend via `mvn -DskipTests spring-boot:run` if `mvn` is available (or via Scoop path),
  otherwise tries to run `target/public-billposting-0.0.1-SNAPSHOT.jar` if present.
- Records running PIDs in `.run/processes.json` for later shutdown by `stop-all.ps1`.

Usage (PowerShell):
  .\start-all.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

if (-not (Test-Path .run)) { New-Item -Path .run -ItemType Directory | Out-Null }

$processes = @()

function Start-JarProcess {
    param(
        [string]$Name,
        [string]$JarRelativePath
    )
    $jar = Join-Path $root $JarRelativePath
    if (Test-Path $jar) {
        Write-Host "Starting $Name -> $jar"
        $proc = Start-Process -FilePath "java" -ArgumentList "-jar", $jar -PassThru -WindowStyle Hidden
        $processes += [pscustomobject]@{ name = $Name; pid = $proc.Id; cmd = "java -jar $JarRelativePath" }
        Start-Sleep -Milliseconds 200
    }
    else { Write-Host "Jar not found: $JarRelativePath" -ForegroundColor Yellow }
}

# Start external services if present
Start-JarProcess -Name 'user-service' -JarRelativePath 'services\user-service.jar'
Start-JarProcess -Name 'zones-service' -JarRelativePath 'services\zones-service.jar'
Start-JarProcess -Name 'posting-service' -JarRelativePath 'services\posting-service.jar'

# Start backend: prefer mvn spring-boot:run when available
$mvnCmd = $null
try {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) { $mvnCmd = $mvn.Path }
} catch { }

if (-not $mvnCmd) {
    $scoopMvn = Join-Path $env:USERPROFILE "scoop\apps\maven\current\bin\mvn.cmd"
    if (Test-Path $scoopMvn) { $mvnCmd = $scoopMvn }
}

if ($mvnCmd) {
    Write-Host "Starting backend via mvn: $mvnCmd -DskipTests spring-boot:run"
    $proc = Start-Process -FilePath $mvnCmd -ArgumentList '-DskipTests', 'spring-boot:run' -WorkingDirectory $root -PassThru -WindowStyle Hidden
    $processes += [pscustomobject]@{ name = 'backend-mvn'; pid = $proc.Id; cmd = "$mvnCmd -DskipTests spring-boot:run" }
}
else {
    $jarPath = Join-Path $root 'target\public-billposting-0.0.1-SNAPSHOT.jar'
    if (Test-Path $jarPath) {
        Write-Host "Starting backend via jar: $jarPath"
        $proc = Start-Process -FilePath 'java' -ArgumentList '-jar', $jarPath -PassThru -WindowStyle Hidden
        $processes += [pscustomobject]@{ name = 'backend-jar'; pid = $proc.Id; cmd = "java -jar target\public-billposting-0.0.1-SNAPSHOT.jar" }
    }
    else {
        Write-Host 'No mvn found and backend jar not present; backend not started' -ForegroundColor Yellow
    }
}

# Persist process list
$outFile = Join-Path $root '.run\processes.json'
$processes | ConvertTo-Json -Depth 3 | Set-Content -Path $outFile -Encoding UTF8

Write-Host "Started processes:"
$processes | Format-Table -AutoSize
Write-Host "Process information saved to .run\processes.json"

Pop-Location
