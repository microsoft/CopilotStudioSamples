# Integrate Copilot Studio with Azure AI Foundry (Code Interpreter and Chat API)

This solution showcases the potential of integrating Azure OpenAI Assistants API (code interpreter) and Chat API within Copilot Studio with custom Python Code.
The code is containerized with Docker and deployed on an Azure Container App.

To invoke the endpoint, you can incorporate an HTTP call into your custom flow within a Copilot Studio Action and route it either to /chat (for the chat API) or to /code (for the code interpreter API).

## Prerequisites
1. Azure subscription
2. Azure OpenAI instance with a GPT-4o deployment
3. Azure CLI

## How to deploy

1. Clone the repository
2. Add your Azure OpenAI keys and endpoint to the file
3. Build the Docker Image
`docker build -t yourapp .`
4. Push your image into your Azure Container Registry
`az login`
`az acr login --name yourContainerRegistry`
5. Tag and push the docker image to your registry
`docker tag yourapp mycontainerregistry.azurecr.io/flask-app:v1`
`docker push mycontainerregistry.azurecr.io/yourapp:v1`
6. Create your Azure Container App (ACA) from the Azure Portal and link it to the image you pushed in the previous step. To create your ACA, you can follow [this tutorial](https://learn.microsoft.com/en-us/azure/container-apps/quickstart-portal)