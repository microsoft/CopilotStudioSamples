---
title: Cooking agent source
nav_exclude: true
search_exclude: false
---
# Cooking agent source

This folder contains the portable Copilot Studio agent authoring files for the [MCP and A2A client sample](../../).

`settings.mcs.yml` defines the agent's instructions and Pizza Recipes, Pasta Recipes, and Bread Baking A2A skills. `capabilities/knowledge/` defines its public recipe website knowledge sources. `agent.sync.yaml` is a workspace layout marker, not a connection file.

To run the sample, follow the [solution import instructions](../../#import-the-included-agent). The importable ZIP is in `../../solution/`, and its unpacked Power Platform source is in `../../src/`. This folder provides the equivalent CLI authoring format for development.
