#!/bin/bash

# Deploy script for SyncToAsyncService Azure Function

# Variables
RESOURCE_GROUP="rg-copilotstudio-connector"
LOCATION="eastus"
STORAGE_ACCOUNT="stcopilot$(openssl rand -hex 4)"
FUNCTION_APP="func-synctoasync-$(openssl rand -hex 4)"

# Login to Azure
az login

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_LRS

# Create function app
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name $FUNCTION_APP \
  --storage-account $STORAGE_ACCOUNT

# Build and deploy
npm run build
func azure functionapp publish $FUNCTION_APP

echo "Function deployed to: https://$FUNCTION_APP.azurewebsites.net/api/SyncToAsyncService"