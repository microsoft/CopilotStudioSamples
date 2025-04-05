# Dataverse Indexer

Sample solution showing how to index the content of a SharePoint library into a Copilot Studio agent as knowledge source files, along with a workaround to get nice citations that point to the source files in SharePoint.

## Benefits for this approach:
1.	Faster latency to get response.
1.	Better indexing to search for content and summarize answers.
1.	Embedded [image understanding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-file-upload#annotated-image-support-preview) for PDF files.
1.	Support for [more](https://learn.microsoft.com/microsoft-copilot-studio/knowledge-add-file-upload#supported-document-types) file types.
1. Indexes SharePoint .aspx pages as files.
1. Support files and pages filters.
1.	Support files up to 512 MB.

7.	Clickable citations that point to the source file.
8.	Can work unauthenticated.

## Downsides:
1.	No role-based access control – users of the agent have access to generated answers used with content from the uploaded files.
1.	Need to refresh the files (re-run / schedule the flow) to push updates from SharePoint to Copilot Studio.

## Instructions:
1.	Import solution on your target environment (can be different from the one hosting your Copilot Studio agent).
1.	Update environment variables for the mandatory inputs.
1.	In your Copilot Studio agent, update the Conversation boosting topic with the provided YAML (make a backup of your current YAML for peace of mind, especially if you had customized the default behavior).
1.	Make sure the cloud flow is turned on
1.	Run the cloud flow.

 ## Tips for Further Manual Enhancements to the Flow
 1) **Error Handling and Alerting**
    - If you want to get notified if flow step failed or retry, you can add parallel branch to catch specific error and send email for notifications. Configure Run After for each block we want to monitor : https://learn.microsoft.com/en-us/training/modules/error-handling/2-configure-run-after


2) **Description Field in Add a new row for file data** 
     - In the step 'Upload files to copilot studio'where we are adding row data for the file, the 'Description' filed can store upto 2500 characters. So you can prebuilt the informaiton for each file and its description using other tools like AI Builder (This can only process 1MB of data as of today) that has metadata and short summary. This will enhance the agent results.

3) **Automated Triggers**
    - You can use SharePoint triggers 'When an item or file is modified', 'When a file is deleted' instead of manual trigger to keep files in sync. Reference : https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/sharepoint-connector-actions-triggers

## Limitations:
 - Embedded images are only supported in Switzerland and the United States.
 - Files that contain encrypted content, are password-protected, or contain confidential tags, aren't supported.
 - The maximum number of files that can be included as knowledge in a copilot is 500 files.
