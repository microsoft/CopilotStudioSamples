$sampleFile='./Webhooktestdata.json'

# Kick off an Azure Automation Runbook
$SubscriptionId = "<<replace with your subscription>>"
$AutomationAccountName = "<AuatomationAccountName>"
$ResourceGroupName = "<ResourceGroupName>"
$RunbookName = "<<Replace with your runbook name>>"

az account set -s $SubscriptionId
az automation runbook start --name $RunbookName --resource-group $ResourceGroupName --automation-account-name $AutomationAccountName --parameters webhookData='@./Webhooktestdata.json'
 
