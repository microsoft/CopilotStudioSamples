# ResumeJobFinderAgent

A Copilot Studio agent that helps users find relevant job opportunities based on their resume content.

## Overview

The ResumeJobFinderAgent analyzes a user's resume and matches their skills, experience, and qualifications to relevant job listings. It provides personalized job recommendations and insights to help users in their job search.

## Features

- Resume parsing and skill extraction
- Job matching based on skills, experience, and preferences
- Personalized job recommendations
- Interview preparation tips based on matched roles

## Sample Data

The `ResumeJobMatchDemoFiles` folder contains sample data you can use with the agent, including:

- **Contoso_AI_Jobs.xlsx** - Sample job listings data
- **Contoso_AI_Jobs.pdf** - PDF version of the job listings
- **Sample Resumes** - Multiple sample resumes (Jordan Williams, Kevin Baxter, Maya Chen, Priya Kapoor) to test the agent's matching capabilities

## Getting Started

### 1. Import the Solution

Import the `ResumeJobFinderAgent_1_0_0_1.zip` solution file into your Power Platform environment.

### 2. Upload Job Listings Data to Dataverse

To populate the **Job Listings** Dataverse table included in the solution:

1. Open your Power Platform environment and navigate to **Tables**.
2. Locate the **Job Listings** table that was created as part of the imported solution.
3. Click **Import data** from the command bar.
4. Select **Upload from file** and choose the `ResumeJobMatchDemoFiles/Contoso_AI_Jobs.xlsx` file.
5. Map the columns from the spreadsheet to the corresponding columns in the Job Listings table.
6. Complete the import and verify the data appears in the table.

### 3. Index and Enable Search on the Data

**Important:** The job listings data must be indexed and made searchable for the solution to work. Without this step, the agent will not be able to query and match job listings against resumes.

1. In the Power Platform admin center, navigate to your environment's **Settings** > **Product** > **Features**.
2. Ensure **Dataverse Search** is enabled for your environment.
3. Go to **Settings** > **Product** > **Search** and add the **Job Listings** table to the search index.
4. Open the **Quick View** for the Job Listings table to manage the indexed columns.
5. Add the relevant columns to be indexed (e.g., job title, description, required skills, location).
6. Click **Save and Publish** to apply the changes.
7. Wait for the indexing process to complete before testing the agent.

Once the data is uploaded and indexed, the ResumeJobFinderAgent will be able to search and match job listings against uploaded resumes.
