---
title: Resume Job Finder
parent: Solutions
grand_parent: Authoring
nav_order: 6
---
# Resume Job Finder Agent

A Copilot Studio agent that analyzes uploaded resumes and matches them against job listings stored in Dataverse.

## Overview

Users upload a resume (PDF or DOCX) and the agent parses it, extracts skills and experience, then searches a Job Listings table in Dataverse to recommend the best-fitting open positions — ranked by relevance, experience level, and proximity.

## Features

- **Resume parsing** — Uses file analysis to extract skills, experience, and location from uploaded resumes
- **Job matching** — Searches Dataverse job postings by title, experience level, city, state, employment type, and status
- **Ranked results** — Returns matches with fit percentage, prioritized by experience and proximity
- **Multi-resume support** — Can review multiple resumes in a single conversation

## Actions

| Action | Purpose | Searched Columns |
|--------|---------|-----------------|
| Find Job Openings | Search job postings by multiple criteria | `cref7_jobtitle`, `cref7_experiencelevel`, `cref7_city`, `cref7_state`, `cref7_employmenttype`, `cref7_jobstatus`, `cref7_dateposted` |

## Demo Data

Sample files are provided in `assets/demo-data/`:

| File | Description |
|------|-------------|
| `Contoso_AI_Jobs.xlsx` | Job listings to import into the Job Listings table |
| `Contoso_AI_Jobs.pdf` | PDF version of the job listings |
| `*_Resume.pdf` (x4) | Sample resumes to test matching |

## Prerequisites

- Power Platform environment with Dataverse
- Dataverse search enabled on the environment

## Setup

1. Import `solution/ResumeJobFinderAgent_1_0_0_1.zip` into your Power Platform environment
2. Navigate to the **Job Listings** (`cref7_jobposting`) table and import data from `assets/demo-data/Contoso_AI_Jobs.xlsx`
3. In the Power Platform admin center, enable **Dataverse Search** and add the Job Listings table to the search index
4. Add relevant columns to the index (job title, department, city, state, experience level, employment type)
5. Publish the agent and test by uploading one of the sample resumes

## Configuration

- **Generative actions**: Enabled
- **File analysis**: Enabled (required for resume parsing)
- **Semantic search**: Enabled
- **Web browsing**: Enabled

## Project Structure

```
resume-job-finder/
├── README.md
├── assets/
│   └── demo-data/           # Sample resumes and job listings
├── solution/                 # Importable solution zip
│   └── ResumeJobFinderAgent_1_0_0_1.zip
└── sourcecode/               # Exploded solution source
    ├── solution.xml
    ├── customizations.xml
    ├── bots/                 # Bot configuration
    └── botcomponents/        # Topics, actions, and agent definitions
```

## Publisher

Microsoft CAT (Customer Advisory Team)
