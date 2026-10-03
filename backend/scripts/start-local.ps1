<#
Starts the whole backend on this machine with no cloud services and no Docker:
MongoDB (portable copy under .local/, downloaded on first run if mongod is not installed) + the 8 services.

  .\scripts\start-local.ps1                      # Ollama for AI (falls back to offline heuristics if Ollama is down)
  .\scripts\start-local.ps1 -AiProvider mock     # no model at all
  .\scripts\start-local.ps1 -AiProvider claude   # needs ANTHROPIC_API_KEY in the environment
  .\scripts\start-local.ps1 -Build               # rebuild the jars first
  .\scripts\start-local.ps1 -Only auth-service,gateway

Logs: .local/logs/<service>.log   Stop: .\scripts\stop-local.ps1
#>
param(
    [ValidateSet('ollama', 'claude', 'mock')] [string]$AiProvider = 'ollama',
    [switch]$Build,
    [string[]]$Only,
    [string]$HeapMb = '192',
    [string]$MongoVersion = '8.0.13'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$local = Join-Path $root '.local'
$logs = Join-Path $local 'logs'
$pids = Join-Path $local 'pids'
New-Item -ItemType Directory -Force $logs, $pids, (Join-Path $local 'data') | Out-Null

function Test-Port([int]$port) {
    $client = New-Object Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Dispose() }
}

# --- MongoDB ---------------------------------------------------------------
if (-not (Test-Port 27017)) {
    $mongod = (Get-Command mongod -ErrorAction SilentlyContinue).Source
    if (-not $mongod) { $mongod = Join-Path $local 'mongodb\bin\mongod.exe' }
    if (-not (Test-Path $mongod)) {
        Write-Host "Downloading portable MongoDB $MongoVersion (one time, about 600 MB)..."
        $ProgressPreference = 'SilentlyContinue'
        $zip = Join-Path $local 'mongodb.zip'
        Invoke-WebRequest -UseBasicParsing "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-$MongoVersion.zip" -OutFile $zip
        Expand-Archive $zip -DestinationPath (Join-Path $local 'mongo-extract') -Force
        Move-Item (Get-ChildItem (Join-Path $local 'mongo-extract') -Directory | Select-Object -First 1).FullName (Join-Path $local 'mongodb')
        Remove-Item $zip, (Join-Path $local 'mongo-extract') -Recurse -Force
    }
    Write-Host 'Starting MongoDB on 27017...'
    $p = Start-Process $mongod -ArgumentList '--dbpath', "`"$(Join-Path $local 'data')`"", '--bind_ip', '127.0.0.1', '--port', '27017', '--wiredTigerCacheSizeGB', '0.25' `
        -RedirectStandardOutput (Join-Path $logs 'mongodb.log') -RedirectStandardError (Join-Path $logs 'mongodb.err.log') -WindowStyle Hidden -PassThru
    $p.Id | Set-Content (Join-Path $pids 'mongodb.pid')
    for ($i = 0; $i -lt 30 -and -not (Test-Port 27017); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Port 27017)) { throw "MongoDB did not start. See $logs\mongodb.log" }
} else {
    Write-Host 'MongoDB already listening on 27017.'
}

# --- Build -----------------------------------------------------------------
$services = [ordered]@{
    'auth-service' = 8101; 'analytics-service' = 8107; 'document-service' = 8102; 'analysis-service' = 8103
    'curriculum-service' = 8104; 'learning-service' = 8106; 'assessment-service' = 8105; 'gateway' = 8080
}
$missing = $services.Keys | Where-Object { -not (Test-Path (Join-Path $root "services\$_\target\$_.jar")) }
if ($Build -or $missing) {
    Write-Host 'Building (mvn package)...'
    Push-Location $root
    try { & mvn -q -B package -DskipTests; if ($LASTEXITCODE -ne 0) { throw 'Build failed' } } finally { Pop-Location }
}

# --- Services --------------------------------------------------------------
$env:AI_PROVIDER = $AiProvider
$env:SEED_DEMO = 'true'
$env:STORAGE_LOCAL_DIR = Join-Path $local 'storage'
Remove-Item Env:PORT -ErrorAction SilentlyContinue

foreach ($name in $services.Keys) {
    if ($Only -and ($Only -notcontains $name)) { continue }
    $port = $services[$name]
    if (Test-Port $port) { Write-Host "$name already running on $port."; continue }
    $jar = Join-Path $root "services\$name\target\$name.jar"
    $p = Start-Process java -ArgumentList "-Xmx${HeapMb}m", '-Xss512k', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-jar', "`"$jar`"" `
        -WorkingDirectory $root -RedirectStandardOutput (Join-Path $logs "$name.log") -RedirectStandardError (Join-Path $logs "$name.err.log") -WindowStyle Hidden -PassThru
    $p.Id | Set-Content (Join-Path $pids "$name.pid")
    Write-Host "Starting $name on $port (pid $($p.Id))..."
    for ($i = 0; $i -lt 180 -and -not (Test-Port $port); $i++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Port $port)) { Write-Warning "$name is not listening yet. See $logs\$name.log" }
}

Write-Host ''
Write-Host 'Backend is up:  http://localhost:8080  (API gateway)'
Write-Host "AI provider:    $AiProvider"
Write-Host 'Demo accounts:  admin|teacher|librarian|researcher|student@demo.aiguruz.com  /  Demo@1234'
