param(
  [string]$ContainerName,
  [string]$DbName,
  [string]$DbUser = 'aiworld',
  [string]$OutputDir
)

$ErrorActionPreference = 'Stop'

if (-not $ContainerName) {
  $ContainerName = 'aiworld-production-postgres-1'
}

if (-not $DbName) {
  $DbName = 'aiworld'
}

if (-not $OutputDir) {
  $OutputDir = '/opt/aiworld/backups/production'
}

$runningContainer = docker ps --format '{{.Names}}' | Where-Object { $_ -eq $ContainerName }
if (-not $runningContainer) {
  throw "Postgres container '$ContainerName' is not running."
}

if (-not (Test-Path -Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outputFile = Join-Path $OutputDir "${DbName}_${timestamp}.dump"

Write-Host "Creating backup: $outputFile"
docker exec $ContainerName sh -lc "pg_dump -U $DbUser -d $DbName -Fc" > $outputFile
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $outputFile) {
    Remove-Item $outputFile -Force
  }
  throw 'Backup failed.'
}

$hash = Get-FileHash -Path $outputFile -Algorithm SHA256
Write-Host "Backup completed"
Write-Host 'Stack: production'
Write-Host "File: $outputFile"
Write-Host "SHA256: $($hash.Hash)"
