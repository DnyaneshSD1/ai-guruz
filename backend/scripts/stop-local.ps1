<#
Stops everything start-local.ps1 started.  -KeepMongo leaves the database running.
#>
param([switch]$KeepMongo)

$pids = Join-Path (Split-Path -Parent $PSScriptRoot) '.local\pids'
if (-not (Test-Path $pids)) { Write-Host 'Nothing to stop.'; return }

foreach ($file in Get-ChildItem $pids -Filter *.pid) {
    if ($KeepMongo -and $file.BaseName -eq 'mongodb') { continue }
    $id = [int](Get-Content $file.FullName)
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($process -and ($process.ProcessName -in 'java', 'mongod')) {
        Stop-Process -Id $id -Force
        Write-Host "Stopped $($file.BaseName) (pid $id)"
    }
    Remove-Item $file.FullName
}
