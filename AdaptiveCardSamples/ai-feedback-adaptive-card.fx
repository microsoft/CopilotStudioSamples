{
  type: "AdaptiveCard",
  '$schema': "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5",
  body: [
    {
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: "Thank you for providing feedback!",
          wrap: true,
          size: "Medium",
          weight: "Bolder",
          color: "Accent",
          horizontalAlignment: "Left",
          isSubtle: false,
          fontType: "Default"
        }
      ],
      bleed: true,
      backgroundImage: {
        horizontalAlignment: "Center"
      }
    },
    {
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: "Your question:",
          wrap: true,
          size: "Medium",
          weight: "Bolder",
          isSubtle: true,
          color: "Default"
        },
        {
          type: "TextBlock",
          text: Global.UserQuery,
          wrap: true,
          size: "Small"
        }
      ],
      style: "accent",
      bleed: true
    },
    {
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: "AI-generated answer:",
          wrap: true,
          size: "Medium",
          weight: "Bolder",
          separator: true,
          color: "Default",
          isSubtle: true
        },
        {
          type: "TextBlock",
          text: Global.Answer.Text.MarkdownContent,
          wrap: true,
          size: "Small",
          fontType: "Default"
        }
      ],
      style: "accent",
      bleed: true
    },
    {
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: "What is wrong with the answer?",
          wrap: true,
          color: "Attention",
          weight: "Bolder",
          size: "Medium"
        },
        {
          type: "Input.Text",
          placeholder: "Please share your feedback and submit",
          errorMessage: "Please provide an answer and submit",
          isMultiline: true,
          id: "Feedback"
        }
      ],
      bleed: true,
      style: "warning"
    },
    {
      type: "ActionSet",
      actions: [
        {
          type: "Action.Submit",
          title: "Submit"
        }
      ]
    }
  ]
}
