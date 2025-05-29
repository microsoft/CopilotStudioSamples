# AI Response Generated Citation Swap

Sample solution showing how to swap the citation links when leveraging File Upload Knowledge and Generative Orchestration to point at the same documents hosted on a public website. This allow users to open and see the full document instead of just the chunk (and they can actually download it if they need). This is designed for publicly available documents who need to be indexed by Dataverse to produce the most accurate responses. 

## Benefits for this approach:
1.	Ability to scope specific documents
1.	Better indexing to search for content and summarize answers.
1.	Embedded [image understanding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-file-upload#annotated-image-support-preview) for PDF files.
1.	Support for [more](https://learn.microsoft.com/microsoft-copilot-studio/knowledge-add-file-upload#supported-document-types) file types.
1.	Support files up to 512 MB.
1.	Clickable citations that point to the source file.
1.	Can work unauthenticated.
1.  Allow users to view the entire document and download it if necessary.

## Downsides:
1.	No role-based access control – users of the agent have access to generated answers used with content from the uploaded files.
1.	Need to refresh the files to push updates from your website to Copilot Studio.
1.  Files need to be named exactly the same in your website and in Copilot Studio.
1.  Files need to all be in the same directory on your website (at least for this code sample to work).

## Instructions:
1.	In an agent with Generative Orchestration, upload your files to Knowledge (the exact same that are stored on your public website).
1.  Create a new topic, switch to the code editor view and copy-paste the content of the YAML file (it should now use the trigger "AI  Response Generated").
1.	Update the variable "externalWebsiteURL" to reflect your website URL, including the directory that contains all your documents (for example: http://www.mywebsite/upload/documents/copilot/). Save the topic.
1.  Ask a question about your documents, once the answer is generated this new topic will swap the citations links to point at the source documents on your website (instead of showing the popup containing the chunked content).

## Limitations:
 - Embedded images in documents are only supported in Switzerland and the United States.
 - Files that contain encrypted content, are password-protected, or contain confidential tags, aren't supported.
 - The maximum number of files that can be included as knowledge in an agent is 500 files.
