<#
.SYNOPSIS
    Bulk-assign Power Platform billing policies to environments, per-row from a CSV.

.DESCRIPTION
    For each row in the CSV:
      1. Resolve EnvironmentID from EnvironmentName (if EnvironmentID is blank)
      2. Resolve BillingPolicyID from BillingPolicyName (cached after first lookup)
      3. Link the environment to its billing policy
      4. Write Status (Succeeded / Failed: <reason>) back to the CSV

.PREREQUISITES
    - Azure CLI (az) installed and logged in (az login)
    - Signed-in user: Power Platform Admin, Global Admin, or Dynamics 365 Admin
    - CSV columns: EnvironmentName, EnvironmentID, BillingPolicyName, Status
    - Only Production and Sandbox environments are eligible

.PARAMETER InputFile
    Path to CSV file (will be updated in-place with EnvironmentID and Status).

.PARAMETER DryRun
    Preview what would happen without making changes.

.EXAMPLE
    .\bulk-assign-billing-policy.ps1 -InputFile ".\environments.csv"
    .\bulk-assign-billing-policy.ps1 -InputFile ".\environments.csv" -DryRun
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$InputFile,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ppApi   = "https://api.powerplatform.com"
$bapApi  = "https://api.bap.microsoft.com"
$apiVer  = "2022-03-01-preview"
$bapVer  = "2023-06-01"

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: Verify az login
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[1/6] Checking Azure CLI login..." -ForegroundColor Cyan
try {
    $account = az account show --query "{name:name, user:user.name}" -o json 2>&1 | ConvertFrom-Json
    Write-Host "  Logged in as: $($account.user)" -ForegroundColor Green
}
catch {
    Write-Error "Not logged in. Run 'az login' first."
    exit 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Load and validate CSV
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[2/6] Loading CSV '$InputFile'..." -ForegroundColor Cyan

if (-not (Test-Path $InputFile)) {
    Write-Error "File not found: $InputFile"
    exit 1
}

$rows = Import-Csv -Path $InputFile
$requiredCols = @("EnvironmentName", "EnvironmentID", "BillingPolicyName", "Status")
$actualCols = $rows[0].PSObject.Properties.Name

foreach ($col in $requiredCols) {
    if ($col -notin $actualCols) {
        Write-Error "Missing required column '$col'. Found: $($actualCols -join ', ')"
        exit 1
    }
}

Write-Host "  Loaded $($rows.Count) rows" -ForegroundColor Green
Write-Host "  Columns: $($actualCols -join ', ')" -ForegroundColor Gray

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: Resolve all billing policies (cached lookup)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[3/6] Resolving billing policies..." -ForegroundColor Cyan

$policiesJson = az rest --method get `
    --url "$ppApi/licensing/billingPolicies?api-version=$apiVer" `
    --resource $ppApi 2>&1
$allPolicies = ($policiesJson | ConvertFrom-Json).value

# Build name -> id lookup
$policyLookup = @{}
foreach ($p in $allPolicies) {
    $policyLookup[$p.name] = @{ id = $p.id; status = $p.status }
    Write-Host "  Found: $($p.name) -> $($p.id) ($($p.status))" -ForegroundColor Green
}

# Validate all BillingPolicyName values in CSV exist
$uniquePolicyNames = $rows | Select-Object -ExpandProperty BillingPolicyName -Unique
foreach ($name in $uniquePolicyNames) {
    if (-not $policyLookup.ContainsKey($name)) {
        Write-Error "Billing policy '$name' not found. Available: $($policyLookup.Keys -join ', ')"
        exit 1
    }
    if ($policyLookup[$name].status -ne "Enabled") {
        Write-Warning "Billing policy '$name' status is '$($policyLookup[$name].status)'"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: Validate environment IDs and resolve missing ones
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[4/6] Validating environments..." -ForegroundColor Cyan

$needsResolution = @($rows | Where-Object { -not $_.EnvironmentID -or $_.EnvironmentID.Trim() -eq "" })
$hasId = @($rows | Where-Object { $_.EnvironmentID -and $_.EnvironmentID.Trim() -ne "" })

Write-Host "  Rows with EnvironmentID:    $($hasId.Count)" -ForegroundColor Green
Write-Host "  Rows needing name lookup:   $($needsResolution.Count)" -ForegroundColor $(if ($needsResolution.Count -gt 0) { "Yellow" } else { "Green" })

# If any rows need name resolution, fetch ALL environments once (with pagination)
if ($needsResolution.Count -gt 0) {
    Write-Host "  Fetching all environments from tenant (this may take a moment for large tenants)..." -ForegroundColor Gray

    # Use Invoke-RestMethod for pagination (az rest has issues with paginated URLs containing special chars)
    $bapToken = (az account get-access-token --resource $bapApi --query accessToken -o tsv 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to get BAP API token: $bapToken"
        exit 1
    }
    $bapHeaders = @{ Authorization = "Bearer $bapToken" }

    $envLookup = @{}
    $url = "$bapApi/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=$bapVer"
    $pageNum = 0

    while ($url) {
        $pageNum++
        try {
            $pageData = Invoke-RestMethod -Uri $url -Headers $bapHeaders -ErrorAction Stop
            foreach ($env in $pageData.value) {
                $dName = $env.properties.displayName
                if ($dName -and -not $envLookup.ContainsKey($dName)) {
                    $envLookup[$dName] = @{
                        id  = $env.name
                        sku = $env.properties.environmentSku
                    }
                }
            }
            Write-Host "    Page $pageNum`: $($pageData.value.Count) environments (lookup cache: $($envLookup.Count))" -ForegroundColor Gray
            $url = $pageData.nextLink
        }
        catch {
            Write-Warning "  Error fetching page $pageNum`: $_"
            break
        }
    }

    Write-Host "  Total environments cached: $($envLookup.Count)" -ForegroundColor Green

    # Resolve blank EnvironmentIDs from the cache
    foreach ($row in $needsResolution) {
        $envName = $row.EnvironmentName.Trim()
        if ($envLookup.ContainsKey($envName)) {
            $row.EnvironmentID = $envLookup[$envName].id
            $sku = $envLookup[$envName].sku
            Write-Host "  [$envName] Resolved -> $($row.EnvironmentID) ($sku)" -ForegroundColor Green
            if ($sku -notin @("Production", "Sandbox")) {
                $row.Status = "Failed: EnvironmentType $sku not supported (only Production/Sandbox)"
                Write-Warning "    $envName is $sku - will be skipped"
            }
        }
        else {
            $row.Status = "Failed: Environment '$envName' not found in tenant"
            Write-Warning "  [$envName] Not found in tenant"
        }
    }
}

# Validate rows that already have an EnvironmentID (direct lookup, skip validation for large sets)
if ($hasId.Count -gt 0) {
    if ($hasId.Count -le 20) {
        # For small sets, validate each ID individually
        foreach ($row in $hasId) {
            $envName = $row.EnvironmentName.Trim()
            $envId = $row.EnvironmentID.Trim()
            Write-Host "  [$envName] Validating ID $envId..." -ForegroundColor Gray -NoNewline
            try {
                $envJson = az rest --method get `
                    --url "$bapApi/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments/$envId`?api-version=$bapVer" `
                    --resource $bapApi `
                    --query "{displayName:properties.displayName, sku:properties.environmentSku}" -o json 2>&1

                if ($LASTEXITCODE -ne 0) {
                    $row.Status = "Failed: Environment ID not found"
                    Write-Host " NOT FOUND" -ForegroundColor Red
                }
                else {
                    $envInfo = $envJson | ConvertFrom-Json
                    $sku = $envInfo.sku
                    Write-Host " OK ($($envInfo.displayName), $sku)" -ForegroundColor Green
                    if ($sku -notin @("Production", "Sandbox")) {
                        $row.Status = "Failed: EnvironmentType $sku not supported (only Production/Sandbox)"
                        Write-Warning "    $envName is $sku - will be skipped"
                    }
                }
            }
            catch {
                $row.Status = "Failed: Error validating environment"
                Write-Host " ERROR" -ForegroundColor Red
            }
        }
    }
    else {
        # For large sets (>20), skip per-ID validation to avoid API rate limits
        # The linking API will return errors for invalid IDs anyway
        Write-Host "  Skipping individual ID validation for $($hasId.Count) rows (will catch errors during linking)" -ForegroundColor Yellow
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5: Link environments to billing policies (per-row)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[5/6] Linking environments to billing policies..." -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "`n  ** DRY RUN - no changes will be made **`n" -ForegroundColor Yellow
}

$successCount = 0
$failCount = 0
$skipCount = 0

for ($i = 0; $i -lt $rows.Count; $i++) {
    $row = $rows[$i]
    $rowNum = $i + 1
    $envName = $row.EnvironmentName
    $envId = $row.EnvironmentID
    $policyName = $row.BillingPolicyName

    # Skip rows already marked as failed during resolution
    if ($row.Status -like "Failed:*") {
        Write-Host "  Row $rowNum [$envName]: SKIP - $($row.Status)" -ForegroundColor Yellow
        $skipCount++
        continue
    }

    # Validate environment ID
    if (-not $envId -or $envId.Trim() -eq "") {
        $row.Status = "Failed: No EnvironmentID"
        Write-Warning "  Row $rowNum [$envName]: No EnvironmentID"
        $failCount++
        continue
    }

    $policyId = $policyLookup[$policyName].id

    if ($DryRun) {
        Write-Host "  Row $rowNum [$envName]: Would link $envId -> $policyName ($policyId)" -ForegroundColor Gray
        continue
    }

    # Make the API call
    Write-Host "  Row $rowNum [$envName]: Linking to $policyName..." -ForegroundColor Cyan -NoNewline

    $body = '{\"environmentIds\": [\"' + $envId + '\"]}'

    try {
        $result = az rest --method post `
            --url "$ppApi/licensing/billingPolicies/$policyId/environments/add?api-version=$apiVer" `
            --resource $ppApi `
            --body $body 2>&1

        if ($LASTEXITCODE -ne 0) {
            $errorMsg = ($result | Out-String).Trim()
            $row.Status = "Failed: $errorMsg"
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "    Error: $errorMsg" -ForegroundColor Red
            $failCount++
        }
        else {
            $row.Status = "Succeeded"
            Write-Host " OK" -ForegroundColor Green
            $successCount++
        }
    }
    catch {
        $row.Status = "Failed: $($_.Exception.Message)"
        Write-Host " ERROR" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
}

if ($DryRun) {
    Write-Host "`n  Dry run complete. Remove -DryRun to execute." -ForegroundColor Yellow
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6: Write updated CSV back
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[6/6] Writing results back to CSV..." -ForegroundColor Cyan

$rows | Export-Csv -Path $InputFile -NoTypeInformation -Encoding UTF8
Write-Host "  Updated: $InputFile" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Total rows:   $($rows.Count)"
Write-Host "  Succeeded:    $successCount" -ForegroundColor Green
Write-Host "  Failed:       $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "  Skipped:      $skipCount" -ForegroundColor $(if ($skipCount -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

# Show final table
$rows | Format-Table EnvironmentName, EnvironmentID, BillingPolicyName, Status -AutoSize
