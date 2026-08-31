param(
    [string]$filePath = $null
)

Add-Type -AssemblyName System.Windows.Forms

# --- Windows API for Global Hotkey Support ---
$Signature = @'
[DllImport("user32.dll")]
public static extern short GetAsyncKeyState(int vKey);
'@
$WinAPI = Add-Type -MemberDefinition $Signature -Name "Win32" -Namespace Win32Functions -PassThru

# --- Setup ---
$basePath = "C:\Path\To\MorgueScript"
$archivePath = "$basePath\archive"
$failedPath = "$basePath\failed-records.txt"
# Ensure the directories exist
if (!(Test-Path $basePath)) { New-Item -ItemType Directory -Path $basePath | Out-Null }
if (!(Test-Path $archivePath)) { New-Item -ItemType Directory -Path $archivePath | Out-Null }

# --- Morgue API Configuration ---
$apiBaseUrl = "http://<YOUR-VPS-IP>:3001"
$apiKey = "<YOUR_MORGUE_API_KEY>"
# ^^ Dedicated key for this script. Revoke independently by removing from
#    MORGUE_API_KEYS in the VPS .env and restarting morgue-api.
# Generate new keys with: node -e "console.log('pmc_morgue_' + require('crypto').randomBytes(16).toString('hex'))"

# --- Morgue Record Parser (matches src/utils/morgue.js logic) ---
function Get-MorgueMetadata {
    param([string]$text)

    $record = @{}

    # Normalize escape sequences to actual whitespace
    $text = $text -replace "\\r\\n", "`n"
    $text = $text -replace "\\r", "`r"
    $text = $text -replace "\\n", "`n"

    function Extract-Field-Robust {
        param([string]$label, [string]$inputText)
        $boundaries = "NAME:|SEX:|IDENTIFIED:|LOCATION:|TIME OF DEATH:|CAUSE OF DEATH:|SIGNATURE:|DNA PROFILE|PHYSICAL DESCRIPTION|FORENSIC DETAILS|AUTOPSY FINDINGS|-----------------|$"
        # Catch-all header terminator (\r?\n + 3+ letters/spaces + ':') mirrors the
        # JS parser, so fields stop cleanly even when the game adds new headers.
        $p = "(?msi)$label\s*:\s*(.*?)(?=\s*(?:$boundaries)|\r?\n[A-Z][A-Z\s]{2,}:)"
        if ($inputText -match $p) {
            return $Matches[1].Trim()
        }
        return "Unknown"
    }

    $record.name = Extract-Field-Robust "NAME" $text
    $record.sex = Extract-Field-Robust "SEX" $text
    $record.identified = Extract-Field-Robust "IDENTIFIED" $text
    $record.location = Extract-Field-Robust "LOCATION" $text
    $record.timeOfDeath = Extract-Field-Robust "TIME OF DEATH" $text
    $record.causeOfDeath = Extract-Field-Robust "CAUSE OF DEATH" $text

    # DNA Profile — supports BOTH the new "DNA PROFILE: DNA-<hex>" format and the
    # legacy "DNA Profile<hex>" format (preserves whichever the server uses).
    if ($text -match "(?i)DNA PROFILE\s*:?\s*\r?\n?\s*(DNA-[0-9A-F]{4,})") {
        $record.dnaProfile = $Matches[1].Trim()
    } elseif ($text -match "(?i)DNA PROFILE\s*:?\s*\r?\n?\s*([0-9A-F]{6,})") {
        $record.dnaProfile = $Matches[1].Trim()
    } else {
        $record.dnaProfile = "N/A"
    }

    # Estimated Age — the header terminator list now includes the generic
    # "\r?\n<3+ letters/spaces>:" boundary (same as the JS parser), so a value is
    # still captured when the game uses a header the explicit list doesn't know.
    if ($text -match "(?is)Estimated age\s*:\s*(.*?)(?=\r?\n[A-Z][A-Z\s]{2,}:|Tattoos description:|FORENSIC DETAILS|AUTOPSY FINDINGS|Visible injuries:|$)") {
        $record.estimatedAge = $Matches[1].Trim()
    } else {
        $record.estimatedAge = "Unknown"
    }
    if ($record.estimatedAge -eq "Unknown") {
        $ageIdx = $text.IndexOf("Estimated age", [System.StringComparison]::OrdinalIgnoreCase)
        $snippet = if ($ageIdx -ge 0) { ($text.Substring($ageIdx, [Math]::Min(140, $text.Length - $ageIdx)) -replace "\r?\n", " | ") } else { "(no 'Estimated age' line found)" }
        Write-Host "  [DEBUG] estimatedAge Unknown -> $snippet" -ForegroundColor DarkGray
    }

    # Physical Description (indexOf-based, mirrors src/utils/morgue.js — avoids
    # regex over/under-capture around the ':' and unknown headers)
    $physLabel = "PHYSICAL DESCRIPTION"
    $physIdx = $text.IndexOf($physLabel, [System.StringComparison]::OrdinalIgnoreCase)
    if ($physIdx -ge 0) {
        $cursor = $physIdx + $physLabel.Length
        if ($cursor -lt $text.Length -and $text[$cursor] -eq ":") { $cursor++ }
        while ($cursor -lt $text.Length -and [char]::IsWhiteSpace($text[$cursor])) { $cursor++ }
        $stops = @()
        foreach ($stopLabel in @("Estimated age", "Tattoos description", "FORENSIC DETAILS", "AUTOPSY FINDINGS", "VISIBLE INJURIES")) {
            $si = $text.IndexOf($stopLabel, $cursor, [System.StringComparison]::OrdinalIgnoreCase)
            if ($si -ge 0) { $stops += $si }
        }
        $stop = if ($stops.Count -gt 0) { ($stops | Measure-Object -Minimum).Minimum } else { $text.Length }
        $record.physicalDescription = $text.Substring($cursor, $stop - $cursor).Trim()
    } else {
        $record.physicalDescription = "None recorded."
    }

    # Tattoos
    $tattoos = Extract-Field-Robust "Tattoos description" $text
    $record.tattoos = if ($tattoos -eq "Unknown") { "None" } else { $tattoos }

    # Forensic Details
    if ($text -match "(?i)Blood alcohol concentration\s*\(BAC\)\s*([\d.]+%?)") {
        $record.bac = $Matches[1].Trim()
    } else { $record.bac = "0.00%" }

    if ($text -match "(?i)Traces of narcotics\s*(.*?)(?=\s*(?:Bullet|AUTOPSY FINDINGS|$))") {
        $record.narcotics = $Matches[1].Trim()
    } else { $record.narcotics = "N/A" }

    # Bullets (Multiple)
    $bullets = @()
    $bulletMatches = [regex]::Matches($text, "(?i)(?:Bullet|Pellet) recovered with striation marks\s*-\s*(.*?)\s*#(\d+)")
    foreach ($m in $bulletMatches) {
        $bullets += @{ type = $m.Groups[1].Value.Trim(); id = $m.Groups[2].Value.Trim() }
    }
    $record.bullets = $bullets

    # Autopsy Findings Table
    $findings = @()
    $findingsMatch = $text -match "(?si)AUTOPSY FINDINGS\s+TIME\s+WOUND TYPE\s+BODY PART\s+DIST\.?\s*(.*?)(?=\s*(?:----------------|\Z))"
    if (-not $findingsMatch) {
        Write-Host "  [DEBUG] No findings table (expected for some entries)" -ForegroundColor DarkGray
    } else {
        $tableBody = $Matches[1].Trim()
        $lineCount = ($tableBody -split "`n" | Measure-Object).Count
        Write-Host "  [DEBUG] Found $lineCount findings lines" -ForegroundColor DarkGray
        $rows = [regex]::Split($tableBody, "(?=\d{2}:\d{2}:\d{2})")
        foreach ($row in $rows) {
            if ($row -match "(\d{2}:\d{2}:\d{2})\s+(.*?)(?=\s*(?:\d{2}:\d{2}:\d{2}|-|$))") {
                $time = $Matches[1]
                $rest = [string]$Matches[2]
                $parts = @($rest -split "\t" | Where-Object { ![string]::IsNullOrWhiteSpace($_) })

                if ($parts.Count -ge 1) {
                    $findings += @{
                        time = $time
                        type = ([string]$parts[0]).Trim()
                        part = if ($parts.Count -ge 2) { ([string]$parts[1]).Trim() } else { "-" }
                        dist = if ($parts.Count -ge 3) { ([string]$parts[2]).Trim() } else { "-" }
                    }
                }
            }
        }
    }
    $record.findings = $findings

    return $record
}

# --- Normalize the game's "Weekday, DD Month YYYY HH:MM:SS" into ISO so the
# bot's date tie-break never depends on the display format (preferred over the
# raw string by parseDate via timeOfDeathISO). ---
function ConvertTo-IsoTimeOfDeath {
    param([string]$value)

    if ([string]::IsNullOrWhiteSpace($value)) { return "" }
    if ($value -match "(?i)(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?") {
        $monthMap = @{ january = 1; february = 2; march = 3; april = 4; may = 5; june = 6; july = 7; august = 8; september = 9; october = 10; november = 11; december = 12 }
        $month = $monthMap[$Matches[2].ToLower()]
        if ($month) {
            $day = [int]$Matches[1]
            $year = [int]$Matches[3]
            $hh = [int]$Matches[4]
            $mm = [int]$Matches[5]
            $ss = if ($Matches[6]) { [int]$Matches[6] } else { 0 }
            return "{0:D4}-{1:D2}-{2:D2}T{3:D2}:{4:D2}:{5:D2}" -f $year, $month, $day, $hh, $mm, $ss
        }
    }
    return ""
}

# --- Batch Upload to Morgue API ---
function Sync-MorgueRecords-ToApi {
    param([string]$filePath)

    if (!(Test-Path $filePath)) {
        Write-Host "[API] Session file not found. Skipping upload." -ForegroundColor Yellow
        return
    }

    $fileContent = Get-Content $filePath -Raw -ErrorAction Stop
    # Split on lines of 60+ dashes (entry separators) — must handle \r\n line endings
    $entries = $fileContent -split "(?:\r?\n)-{60,}(?:\r?\n)" | Where-Object { ![string]::IsNullOrWhiteSpace($_) }

    $records = @()
    $failCount = 0
    $totalCount = 0

    Write-Host "`n--- Parsing Morgue Records for Bulk Upload ---" -ForegroundColor Cyan

    foreach ($entry in $entries) {
        Write-Host "---" -ForegroundColor DarkGray

        $trimmedEntry = $entry.Trim()

        $caseMatch = $trimmedEntry -match "CASE\s+#(\d+)"
        if (!$caseMatch) { continue }

        $caseId = $Matches[1]
        $totalCount++

        $metadata = Get-MorgueMetadata -text $trimmedEntry

        $bulletsList = if ($metadata.bullets -and $metadata.bullets.Count -gt 0) { $metadata.bullets } else { @() }
        $findingsList = if ($metadata.findings -and $metadata.findings.Count -gt 0) { $metadata.findings } else { @() }
        $timeOfDeathIso = ConvertTo-IsoTimeOfDeath $metadata.timeOfDeath

        if ($metadata.timeOfDeath -and $metadata.timeOfDeath -ne "Unknown" -and !$timeOfDeathIso) {
            Write-Host "  [DEBUG] timeOfDeath unparseable: $($metadata.timeOfDeath)" -ForegroundColor DarkGray
        }

        $payload = @{
            caseId = $caseId
            name = $metadata.name
            sex = $metadata.sex
            identified = $metadata.identified
            location = $metadata.location
            timeOfDeath = $metadata.timeOfDeath
            timeOfDeathISO = $timeOfDeathIso
            causeOfDeath = $metadata.causeOfDeath
            dnaProfile = $metadata.dnaProfile
            estimatedAge = $metadata.estimatedAge
            physicalDescription = $metadata.physicalDescription
            tattoos = $metadata.tattoos
            bac = $metadata.bac
            narcotics = $metadata.narcotics
            bullets = $bulletsList
            findings = $findingsList
            lastUpdated = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            source = "PS-Logger-Local"
        }

        Write-Host "  Case #${caseId} ($($metadata.name))" -ForegroundColor Cyan
        $records += $payload
    }

    if ($records.Count -eq 0) {
        Write-Host "[API] No records to upload." -ForegroundColor Yellow
        return
    }

    # Upload all records in a single bulk request
    Write-Host "--- Uploading $($records.Count) records via bulk endpoint ---" -ForegroundColor Cyan
    try {
        $bulkPayload = @{ records = $records }
        $json = $bulkPayload | ConvertTo-Json -Depth 10
        $utf8Body = [System.Text.Encoding]::UTF8.GetBytes($json)
        $targetUrl = "${apiBaseUrl}/api/morgue/bulk"
        $response = Invoke-WebRequest -Uri $targetUrl -Method Post -Body $utf8Body -ContentType "application/json; charset=utf-8" -Headers @{"x-api-key" = $apiKey} -UseBasicParsing -ErrorAction Stop
        $result = $response.Content | ConvertFrom-Json
        Write-Host "--- Bulk Complete: $($result.ok) uploaded, $($result.failed) failed (out of $totalCount) ---" -ForegroundColor Cyan
    } catch {
        Write-Host "[FAIL] Bulk upload failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}



if (-not $filePath) {
    # --- Interactive Scan Mode (no -filePath param) ---
    # --- Auto-Archive Old Files (Older than 24h) ---
    $oldFiles = Get-ChildItem -Path $basePath -Filter "MORGUE RECORDS - *.txt" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) }
    if ($oldFiles) {
        Write-Host "[ARCHIVE] Moving $($oldFiles.Count) old session logs to archive..." -ForegroundColor Gray
        $oldFiles | Move-Item -Destination $archivePath -Force
    }

    $checkpointPath = "$basePath\highest_case.txt"
    $timestampFilename = Get-Date -Format "dd MMM HH_mm"
    $downloadPath = "$basePath\MORGUE RECORDS - $timestampFilename.txt"

    # Get previous highest case number for the "scan down to" logic
    $previousHighest = 0
    if (Test-Path $checkpointPath) {
        $rawCheckpoint = Get-Content $checkpointPath -Raw
        if ($rawCheckpoint -match "(\d+)") {
            $previousHighest = [int]$matches[1]
        }
    }

    $runCount = 0
    $duplicateStreak = 0
    $maxRuns = 500 
    $pattern = "CASE\s+#(\d+)"
    $VK_DELETE = 0x2E # Delete Key

    $currentHighest = $previousHighest

    Write-Host "--- Morgue Logger: QOL Update ---" -ForegroundColor Cyan
    Write-Host "Checkpoint: Highest Case #$previousHighest" -ForegroundColor Gray
    Write-Host "Target: $downloadPath"
    Write-Host "Logic: Stop if Case # <= $previousHighest."

    Write-Host "--------------------------------------"
    Write-Host "Starting in 5s..."
    Start-Sleep -Seconds 5

    while ($runCount -lt $maxRuns) {
        # 1. Global Hotkey Check
        if ($WinAPI::GetAsyncKeyState($VK_DELETE) -ne 0) {
            Write-Host "[EXIT] Delete key detected." -ForegroundColor Yellow
            break
        }

        try {
            $runCount++
            
            # Trigger copy and wait for clipboard to fully populate
            [System.Windows.Forms.SendKeys]::SendWait("^c")
            Start-Sleep -Milliseconds 600

            # Read clipboard before moving to next entry
            $clipboard = Get-Clipboard -Raw

            # If clipboard content is suspiciously small, wait longer and retry
            # Large entries (many autopsy findings) take longer to copy
            if ($clipboard -and $clipboard.Length -lt 50) {
                Start-Sleep -Milliseconds 400
                $clipboard = Get-Clipboard -Raw
            }

            # Move to next entry
            [System.Windows.Forms.SendKeys]::SendWait(" ")

            if (![string]::IsNullOrWhiteSpace($clipboard)) {
                $match = [regex]::Match($clipboard, $pattern, "IgnoreCase")

                if ($match.Success) {
                    $caseId = [int]$match.Groups[1].Value
                    $caseLabel = $match.Value 
                    
                    # Check against previous checkpoint (Scan DOWN to highest)
                    if ($caseId -le $previousHighest) {
                        Write-Host "[STOP] Reached previous checkpoint ($caseLabel <= #$previousHighest)." -ForegroundColor Red
                        break
                    }

                    # Check for duplicates in current session file
                    if (Test-Path $downloadPath) {
                        $fileContent = Get-Content $downloadPath -Raw
                        if ($fileContent -like "*$caseLabel*") {
                            $duplicateStreak++
                            Write-Host "[MATCH $duplicateStreak/3] $caseLabel is already logged in this session." -ForegroundColor Yellow
                            
                            if ($duplicateStreak -ge 3) {
                                Write-Host "[STOP] 3 consecutive duplicates found." -ForegroundColor Red
                                break
                            }
                            continue
                        }
                    }

                    # New record found
                    $duplicateStreak = 0
                    if ($caseId -gt $currentHighest) { $currentHighest = $caseId }
                    
                    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                    $entry = "[$timestamp] $caseLabel`n$clipboard`n------------------------------------------------------------"
                    
                    Add-Content -Path $downloadPath -Value $entry
                    Write-Host "[$runCount/$maxRuns] SAVED: $caseLabel" -ForegroundColor Green
                }
            }
        }
        catch {
            Write-Host "[ERROR] An error occurred during clipboard processing: $($_.Exception.Message)" -ForegroundColor Red
        }

        Start-Sleep -Milliseconds 450
    }

    # --- Phase 2: Upload collected records to API ---
    if (Test-Path $downloadPath) {
        Write-Host "`n=== Phase 2: Syncing to API ===" -ForegroundColor Cyan
        Sync-MorgueRecords-ToApi -filePath $downloadPath
    } else {
        Write-Host "`n[API] No session file to upload." -ForegroundColor Gray
    }

    # --- Wrap up and update checkpoint ---
    if ($currentHighest -gt $previousHighest) {
        Write-Host "`n[COMPLETED] Highest Case Number #$currentHighest" -ForegroundColor Cyan
        Set-Content -Path $checkpointPath -Value $currentHighest
    }
    else {
        Write-Host "`n[INFO] No new records were found above the current checkpoint (#$previousHighest)." -ForegroundColor Gray
    }

    Write-Host "Script deactivated."
} else {
    # --- Standalone sync mode (called with -filePath) ---
    Write-Host "`n=== Syncing Morgue Records to API from: $filePath ===" -ForegroundColor Cyan
    Sync-MorgueRecords-ToApi -filePath $filePath
}