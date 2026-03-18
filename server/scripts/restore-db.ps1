param(
  [string]$BackupFile,
  [string]$ContainerName,
  [string]$DbName,
  [string]$DbUser = 'aiworld',
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $ContainerName) {
  $ContainerName = 'aiworld-production-postgres-1'
}

if (-not $DbName) {
  $DbName = 'aiworld'
}

$backupDir = '/opt/aiworld/backups/production'

if (-not $BackupFile) {
  $latestBackup = Get-ChildItem -Path $backupDir -Filter '*.dump' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latestBackup) {
    throw "No backup file found in $backupDir/*.dump. Pass -BackupFile explicitly."
  }

  $BackupFile = $latestBackup.FullName
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$runningContainer = docker ps --format '{{.Names}}' | Where-Object { $_ -eq $ContainerName }
if (-not $runningContainer) {
  throw "Postgres container '$ContainerName' is not running."
}

if ($DryRun) {
  $checksumFile = "$BackupFile.sha256"
  if (Test-Path $checksumFile) {
    $expectedHash = (Get-Content $checksumFile).Split(' ')[0].Trim()
    $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expectedHash.ToLowerInvariant() -ne $actualHash) {
      throw "Checksum mismatch for $BackupFile"
    }
  }

  Get-Content -Path $BackupFile -AsByteStream -Raw | docker exec -i $ContainerName sh -lc "pg_restore --list > /dev/null"
  if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed.' }

  Write-Host "Dry run completed."
  Write-Host 'Stack: production'
  Write-Host "Target database: $DbName"
  Write-Host "Backup file: $BackupFile"
  exit 0
}

if (-not $Force) {
  $confirm = Read-Host "This will REPLACE database '$DbName'. Type YES to continue"
  if ($confirm -ne 'YES') {
    throw 'Restore aborted by user.'
  }
}

Write-Host "Restoring from: $BackupFile"

$terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();"
docker exec $ContainerName sh -lc "psql -U $DbUser -d postgres -c \"$terminateSql\"" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to terminate existing DB connections.' }

docker exec $ContainerName sh -lc "dropdb -U $DbUser --if-exists $DbName"
if ($LASTEXITCODE -ne 0) { throw 'Failed to drop existing database.' }

docker exec $ContainerName sh -lc "createdb -U $DbUser $DbName"
if ($LASTEXITCODE -ne 0) { throw 'Failed to create database.' }

Get-Content -Path $BackupFile -AsByteStream -Raw | docker exec -i $ContainerName sh -lc "pg_restore -U $DbUser -d $DbName --no-owner --no-privileges"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed.' }

$verify = docker exec $ContainerName sh -lc "psql -U $DbUser -d $DbName -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\""
if ($LASTEXITCODE -ne 0) { throw 'Restore verification failed.' }

Write-Host 'Stack: production'
Write-Host "Restore completed. public schema table count: $($verify.Trim())"
