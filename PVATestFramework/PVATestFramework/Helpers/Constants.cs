// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace PVATestFramework.Console.Helpers
{
    public static class ActivityTypes
    {
        public const string Message = "message";
        public const string Trace = "trace";
    }

    public static class RoleTypes
    {
        public const int User = 1;
        public const int Bot = 0;
    }

    public static class Constants
    {
        public const string DataverseTokenUri = "https://login.microsoftonline.com/{TenantId}/oauth2/v2.0/token";
        public const string DLDefaultUri = "https://directline.botframework.com";
        public const string DefaultApiVersion = "api-version=2022-03-01-preview";
        public const string RegionalChannelPath = "powervirtualagents/regionalchannelsettings";
        public const string InvalidBotUri = "BAD_BOT_URI";
        public const string DataverseBotUri = "/api/data/v9.2/bots";
        public const string CSVFileName = "logFile.csv";
        public const int MaxTries = 3;
    }

    public static class BotDefaultMessages
    {
        public static string DYM = "To clarify, did you mean:";
        public static string NoneOfThese = "None of these";
    }

    public enum Interval
    {
        LastNTranscripts = 0,
        LastNDays = 1,
        LastNWeeks = 2
    }
}
