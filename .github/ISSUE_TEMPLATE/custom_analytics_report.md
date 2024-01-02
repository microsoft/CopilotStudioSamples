name: Custom Analytics
description: Provide feedback for the Custom Analytics report.
labels: ["Custom Analytics"]
assignees:
  - iMicknl
  - HenryJammes

body:
  - type: textarea
    validations:
      required: true
    attributes:
      label: Feedback
      description: >-
        Describe the issue you are experiencing here or your feature request to communicate to the
        maintainers. Tell us what you were trying to do and what happened.

        Provide a clear and concise description of what the problem is. What did you expect to happen?

  - type: markdown
    attributes:
      value: |
        ## Environment

  - type: input
    id: version
    validations:
      required: false
    attributes:
      label: When (d/m/y) did you download the template
      description: >
        Since the templates are not versioned, it would be good to know when you downloaded the template.

  - type: input
    id: powerbi_version
    validations:
      required: false
    attributes:
      label: Your version of Power BI Desktop
      description: >
        Can be found in Power BI Desktop, Help -> About -> Version.

  - type: textarea
    id: additional-information
    attributes:
      label: Additional information
      description: If you have any additional information for us, use the field below. Please note, you can attach screenshots or screen recordings here, by dragging and dropping files in the field below.

  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!