param(
    [string]$JavaHome = "",
    [int]$HealthIntervalSeconds = 30,
    [switch]$NoMonitor
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

function Get-JavaVersionText {
    param([string]$JavaExe)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        return (& $JavaExe -version 2>&1) -join "`n"
    } catch {
        return ""
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Test-Java8Home {
    param([string]$Candidate)

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    $javaExe = Join-Path $Candidate "bin\java.exe"
    if (-not (Test-Path $javaExe)) {
        return $false
    }

    $versionText = Get-JavaVersionText -JavaExe $javaExe
    return $versionText -match 'version "1\.8\.'
}

function Find-Java8Home {
    $candidates = @()

    if ($env:JAVA8_HOME) { $candidates += $env:JAVA8_HOME }
    if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }

    $candidateRoots = @(
        "$env:USERPROFILE\.jdks",
        "C:\Program Files\Java",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Amazon Corretto",
        "C:\Program Files\Microsoft"
    )

    foreach ($root in $candidateRoots) {
        if (Test-Path $root) {
            $candidates += Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '(8|1\.8|jdk8|java-8|corretto-8|temurin-8)' } |
                ForEach-Object { $_.FullName }
        }
    }

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Java8Home -Candidate $candidate) {
            return $candidate
        }
    }

    return $null
}

function Start-JarService {
    param(
        [hashtable]$Service
    )

    $stdout = Join-Path "logs" "$($Service.Name).log"
    $stderr = Join-Path "logs" "$($Service.Name).err.log"

    return Start-Process -FilePath "java" `
        -ArgumentList @("-jar", $Service.Jar) `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr
}

function Start-FrontendDashboard {
    $frontendDir = Join-Path $ProjectRoot "frontend"
    $frontendServer = Join-Path $frontendDir "server.js"

    if (-not (Test-Path $frontendServer)) {
        Write-Host "Warning: frontend server not found, ignored: $frontendServer"
        return $null
    }

    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "Warning: Node.js not found, frontend dashboard ignored."
        return $null
    }

    $stdout = Join-Path $ProjectRoot "logs\frontend.log"
    $stderr = Join-Path $ProjectRoot "logs\frontend.err.log"

    return Start-Process -FilePath "node" `
        -ArgumentList @("`"$frontendServer`"") `
        -WorkingDirectory $frontendDir `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr
}

function Test-HttpHealth {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 5
        return @{ Status = "ONLINE"; Detail = "HTTP $($response.StatusCode)" }
    } catch {
        return @{ Status = "OFFLINE"; Detail = $_.Exception.Message }
    }
}

function Test-TcpHealth {
    param(
        [string]$HostName,
        [int]$Port
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(5000, $false)) {
            return @{ Status = "OFFLINE"; Detail = "TCP timeout on $HostName`:$Port" }
        }
        $client.EndConnect($connect)
        return @{ Status = "ONLINE"; Detail = "TCP $HostName`:$Port open" }
    } catch {
        return @{ Status = "OFFLINE"; Detail = $_.Exception.Message }
    } finally {
        $client.Close()
    }
}

function Test-ProcessAlive {
    param([int]$ProcessId)

    try {
        Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
        return "RUNNING"
    } catch {
        return "STOPPED"
    }
}

function Get-ServiceHealthRows {
    param([array]$Checks)

    $rows = @()
    foreach ($check in $Checks) {
        if ($check.CheckType -eq "http") {
            $health = Test-HttpHealth -Url $check.Url
        } else {
            $health = Test-TcpHealth -HostName $check.Host -Port $check.Port
        }

        $rows += [pscustomobject]@{
            Service = $check.Name
            PID = $check.Pid
            Process = Test-ProcessAlive -ProcessId $check.Pid
            Health = $health.Status
            Detail = $health.Detail
        }
    }
    return $rows
}

function Show-HealthDashboard {
    param([array]$Checks)

    Clear-Host
    Write-Host "BPD Camunda Project - live health dashboard"
    Write-Host "Java: $env:JAVA_HOME"
    Write-Host "Last check: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host "Refresh: every $HealthIntervalSeconds seconds"
    Write-Host "Camunda: http://localhost:8080/camunda  login demo/demo"
    Write-Host "Dashboard: http://127.0.0.1:5174"
    Write-Host "Press Ctrl+C to stop dashboard and project services."
    Write-Host ""

    Get-ServiceHealthRows -Checks $Checks | Format-Table -AutoSize

    Write-Host ""
    Write-Host "Logs:"
    Write-Host "  Camunda: logs\camunda.log"
    Write-Host "  Services: logs\posting-service.log, logs\user-service.log, logs\zones-service.log"
    Write-Host "  Frontend: logs\frontend.log"
}

if (-not $JavaHome) {
    $JavaHome = Find-Java8Home
}

if (-not (Test-Java8Home -Candidate $JavaHome)) {
    throw @"
Java 8 JDK not found.

Install Java 8, then run:
  .\start.ps1 -JavaHome "C:\path\to\jdk8"

Expected examples:
  C:\Users\giovanni.altieri\.jdks\corretto-8.x.x
  C:\Program Files\Java\jdk1.8.0_xxx
  C:\Program Files\Eclipse Adoptium\jdk-8.x.x
"@
}

$env:JAVA_HOME = $JavaHome
$env:Path = "$JavaHome\bin;$env:Path"

New-Item -ItemType Directory -Force -Path "logs" | Out-Null

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "Stopping old project processes, if any..."
& "$ProjectRoot\stop.ps1" -Quiet

$startedProcesses = @()
$services = @(
    @{ Name = "posting-service"; Jar = "services\posting-service.jar"; CheckType = "tcp"; Host = "localhost"; Port = 8888 },
    @{ Name = "user-service"; Jar = "services\user-service.jar"; CheckType = "http"; Url = "http://localhost:9080/user/mariorossi" },
    @{ Name = "zones-service"; Jar = "services\zones-service.jar"; CheckType = "http"; Url = "http://localhost:9090/zones/60x80" }
)

Write-Host "Starting external services..."
foreach ($service in $services) {
    if (Test-Path $service.Jar) {
        $process = Start-JarService -Service $service
        $service.Pid = $process.Id
        $startedProcesses += $service
        Write-Host "Started: $($service.Name) (PID $($process.Id))"
    } else {
        Write-Host "Warning: $($service.Jar) not found, ignored."
    }
}

Write-Host "Compiling Camunda project..."
mvn clean package -DskipTests -q

$camundaJar = Get-ChildItem "target" -Filter "*.jar" |
    Where-Object { $_.Name -notlike "*.original" } |
    Select-Object -First 1

if (-not $camundaJar) {
    throw "JAR not found in target/."
}

Write-Host "Starting Camunda Engine..."
$camunda = Start-Process -FilePath "java" `
    -ArgumentList @("-jar", $camundaJar.FullName) `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput "logs\camunda.log" `
    -RedirectStandardError "logs\camunda.err.log"
Write-Host "Started: Camunda (PID $($camunda.Id))"

$camundaService = @{
    Name = "camunda"
    Pid = $camunda.Id
    CheckType = "http"
    Url = "http://localhost:8080/engine-rest/engine"
}

Write-Host "Waiting for Camunda to start on port 8080..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8080/engine-rest/engine" -Method Get -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "Camunda did not start. Last log lines:"
    if (Test-Path "logs\camunda.log") { Get-Content "logs\camunda.log" -Tail 80 }
    if (Test-Path "logs\camunda.err.log") { Get-Content "logs\camunda.err.log" -Tail 80 }
    throw "Camunda did not become ready on http://localhost:8080."
}

Write-Host "OK."
Write-Host "Camunda webapp: http://localhost:8080/camunda"
Write-Host "Login: demo / demo"

$frontendService = $null
Write-Host "Starting frontend dashboard..."
$frontend = Start-FrontendDashboard
if ($frontend) {
    $frontendService = @{
        Name = "frontend"
        Pid = $frontend.Id
        CheckType = "http"
        Url = "http://127.0.0.1:5174"
    }
    Write-Host "Started: frontend dashboard (PID $($frontend.Id))"
    Write-Host "Dashboard: http://127.0.0.1:5174"
}

if ($NoMonitor) {
    Write-Host "NoMonitor enabled: services are running in background."
    return
}

$checks = @($startedProcesses + $camundaService)
if ($frontendService) {
    $checks += $frontendService
}

try {
    while ($true) {
        Show-HealthDashboard -Checks $checks
        Start-Sleep -Seconds $HealthIntervalSeconds
    }
} finally {
    Write-Host ""
    Write-Host "Stopping project services..."
    & "$ProjectRoot\stop.ps1" -Quiet
    Write-Host "Stopped."
}
