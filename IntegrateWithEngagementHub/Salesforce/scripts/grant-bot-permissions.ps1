# Grant Apex class access to the Einstein Bot (Chatbot) permission set
# This allows Einstein Bot dialogs to call the DirectLine Apex classes

$ErrorActionPreference = "Stop"

Write-Host "Querying Chatbot permission set..."

# Get the Chatbot permission set ID
try {
    $permsetQuery = sf data query --query "SELECT Id FROM PermissionSet WHERE Name = 'sfdc_chatbot_service_permset' LIMIT 1" --json 2>$null | ConvertFrom-Json
    $permsetId = $permsetQuery.result.records[0].Id
} catch {
    $permsetId = $null
}

if ([string]::IsNullOrEmpty($permsetId)) {
    Write-Host "WARNING: Chatbot permission set (sfdc_chatbot_service_permset) not found." -ForegroundColor Yellow
    Write-Host "This permission set is created when Einstein Bots is enabled."
    Write-Host "You may need to manually grant Apex class access after enabling Einstein Bots."
    exit 0
}

Write-Host "Found Chatbot permission set: $permsetId"

# Get Apex class IDs
$apexClasses = @("DL_GetConversation", "DL_PostActivity", "DL_GetActivity")

foreach ($className in $apexClasses) {
    Write-Host ""
    Write-Host "Processing $className..."

    # Query the Apex class ID
    try {
        $classQuery = sf data query --query "SELECT Id FROM ApexClass WHERE Name = '$className' LIMIT 1" --json 2>$null | ConvertFrom-Json
        $classId = $classQuery.result.records[0].Id
    } catch {
        $classId = $null
    }

    if ([string]::IsNullOrEmpty($classId)) {
        Write-Host "  WARNING: Apex class $className not found. Was it deployed?" -ForegroundColor Yellow
        continue
    }

    Write-Host "  Found Apex class: $classId"

    # Check if access already exists
    try {
        $existingQuery = sf data query --query "SELECT Id FROM SetupEntityAccess WHERE ParentId = '$permsetId' AND SetupEntityId = '$classId'" --json 2>$null | ConvertFrom-Json
        $existingId = $existingQuery.result.records[0].Id
    } catch {
        $existingId = $null
    }

    if (-not [string]::IsNullOrEmpty($existingId)) {
        Write-Host "  Access already granted."
        continue
    }

    # Create SetupEntityAccess record
    Write-Host "  Granting access..."
    try {
        $null = sf data create record --sobject SetupEntityAccess --values "ParentId='$permsetId' SetupEntityId='$classId' SetupEntityType='ApexClass'" 2>$null
        Write-Host "  Access granted successfully." -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Failed to grant access. You may need to do this manually in Setup." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Permission grant process complete."
