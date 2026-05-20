---
title: PDF Page-Specific Citations for SharePoint as a Knowledge Source
parent: Snippets
grand_parent: Authoring
nav_order: 2
---
# PDF Page-Specific Citations for SharePoint as a Knowledge Source

Sample topic that enhances the default citation behaviour for PDFs when using [**SharePoint as a knowledge source**](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-sharepoint) in Copilot Studio. When a generative answer cites a PDF stored in SharePoint and page markers are provided in the citations table, this topic rewrites the citation URL to include the specific page number (`#page=N`), so users are taken directly to the relevant page rather than just the document.

An optional variable is included to control whether Office files (Word, Excel, PowerPoint) are forced to open in the browser or in the desktop app. This gives makers flexibility to match their organisation's preferred file-opening behaviour.

## Features

- **Page-specific PDF citations** — appends `#page=N` to PDF links using page markers **when** they are returned by the SharePoint knowledge source.
- **Optional Office web-open control** — a configurable variable that, when enabled, appends web=1 parameter to Office file links to open in the browser instead of the desktop app. 
- Works with SharePoint knowledge sources and Generative Orchestration. When page markers are returned by SharePoint for PDFs in the System.Citations table variable in Copilot Studio, the format for a page marker is different to the format used for [Unstructured data as a knowledge source](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-unstructured-data), for example uploaded files. For uploaded file scenarios, refer to [citation-swap](../citation-swap/).

## Prerequisites

- A Copilot Studio agent with **Generative Orchestration** enabled.
- One or more **SharePoint** knowledge sources configured that contain PDF documents.

## Instructions

1. In your agent, ensure you have a SharePoint knowledge source configured, and that it contains PDFs.
2. Create a new topic, switch to the **Code editor** view, and paste the contents of the YAML file below.
3. Review the optional `openInBrowser` variable — set it to `true` if you want Office files to open in the browser instead of Office desktop apps.
4. Save the topic and test by asking a question that will cite a PDF document.

## Files

| File | Description |
|------|-------------|
| [sharepoint-pdf-citations.yml](./sharepoint-pdf-citations.yml) | Topic YAML for page-specific citations for PDFs when using SharePoint as a knowledge source — paste this into the Code editor for a new topic |

## Limitations

- Page-specific linking only works for **PDF** files. Other file types will link to the document without a page anchor.
- The page metadata (`<page_#>`) must be present in the citation text returned by the knowledge source; if it is missing, the link falls back to the document root. Page markers are sometimes not returned in citations for PDF files. This sample lets you use the page marker data when it is available.
- Currently handles only the first page a chunk was returned from to ground the generative answers response. If several pages were used to ground the response, the citation emitted will point to the first page a chunk came from for the relevant PDF document.
