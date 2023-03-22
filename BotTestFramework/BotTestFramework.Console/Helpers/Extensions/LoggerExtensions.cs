using Serilog;

namespace BotTestFramework.Console.Helpers.Extensions
{
    public static class LoggerExtensions
    {
        public const string Red = "\u001b[31m";
        public const string Green = "\u001b[32m";
        public const string Yellow = "\u001b[33m";
        public const string White = "\u001b[37m";

        public enum LogLevel
        {
            Information = 0,
            Warning = 1,
            Error = 2,
            Fatal = 3
        }

        public static void ForegroundColor(this ILogger logger, string messageTemplate, LogLevel logLevel = 0, params object[] args)
        {
            // Get the color they chose
            string CurrentColor = (string)args[args.GetLength(0) - 1];

            // Get rid of the color parameter now as it will break the Serilog parser
            args[args.GetLength(0) - 1] = "";

            // Prepend our color code to every argument (tested with strings and numbers)
            for (int i = 0; i < args.GetLength(0); i++)
            {
                args[i] = CurrentColor + args[i];
            }

            // Find all the arguments looking for the close bracket
            List<int> indexes = messageTemplate.AllIndexesOf("}");
            int iterations = 0;
            // rebuild messageTemplate with our color-coded arguments
            // Note: we have to increase the index on each iteration based on the previous insertion of
            // a color code
            foreach (var i in indexes)
            {
                messageTemplate = messageTemplate.Insert(i + 1 + (iterations++ * CurrentColor.Length), CurrentColor);
            }

            // Prefix the entire message template with color code
            string bkg = CurrentColor + messageTemplate;

            // Log it with a context
            switch (logLevel)
            {
                case LogLevel.Information:
                    logger.ForContext("IsImportant", true).Information(bkg, args);
                    break;
                case LogLevel.Warning:
                    logger.ForContext("IsImportant", true).Warning(bkg, args);
                    break;
                case LogLevel.Error:
                    logger.ForContext("IsImportant", true).Error(bkg, args);
                    break;
                case LogLevel.Fatal:
                    logger.ForContext("IsImportant", true).Fatal(bkg, args);
                    break;
            }
        }

        private static List<int> AllIndexesOf(this string str, string value)
        {
            if (String.IsNullOrEmpty(value))
            {
                throw new ArgumentException("The string to find may not be empty", "value");
            }

            List<int> indexes = new List<int>();
            for (int index = 0; ; index += value.Length)
            {
                index = str.IndexOf(value, index);
                if (index == -1)
                {
                    return indexes;
                }

                indexes.Add(index);
            }
        }
    }
}
