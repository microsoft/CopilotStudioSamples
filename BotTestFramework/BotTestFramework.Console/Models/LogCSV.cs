// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace BotTestFramework.Console.Models
{
    public class LogCSV 
    {
        public string SessionDate { get; set; }
        public string BotId { get; set; }
        public string ConversationId { get; set; }
        public string UserUtterance { get; set; }
        public string ExpectedResponse { get; set; }
        public string ReceivedResponse { get; set; }
        public string DYM_Option1 { get; set; }
        public string DYM_Option2 { get; set; }
        public string DYM_Option3 { get; set; }
        public string Result { get; set; }
        public string TestFile { get; set; }
    }
}
