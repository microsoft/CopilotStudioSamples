# A2A Agent Framework Sample

This repository contains a sample implementation of an AI agent using the A2A Agent Framework. It demonstrates how to host a simple "botanical" agent.

## Prerequisites

- [.NET SDK 10.0](https://dotnet.microsoft.com/download/dotnet/10.0) or later.

## Configuration

Before running the application, you need to configure your Azure OpenAI settings. You can do this by setting the following environment variables or adding them to your `appsettings.json` (or `appsettings.Development.json`):

- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL.
- `AZURE_OPENAI_DEPLOYMENT_NAME`: The name of your deployment.
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key.

## How to Run

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd A2A-Agent-Framework
    ```

2.  **Restore dependencies:**
    ```bash
    dotnet restore
    ```

3.  **Build the project:**
    ```bash
    dotnet build
    ```

4.  **Run the application:**
    ```bash
    dotnet run
    ```

The application will start and the agent will be available at the configured endpoint.
