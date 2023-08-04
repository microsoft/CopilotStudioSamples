// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using PVATestFramework.Console.Helpers;
using PVATestFramework.Console.Helpers.DirectLine;
using PVATestFramework.Console.Helpers.Extensions;
using PVATestFramework.Console.Helpers.FileHandler;
using PVATestFramework.Console.Models;
using PVATestFramework.Console.Models.Activities;
using PVATestFramework.Console.Models.DirectLine;
using CsvHelper;
using CsvHelper.Configuration;
using Newtonsoft.Json;
using Serilog;
using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Activity = Microsoft.Bot.Connector.DirectLine.Activity;
using LoggerExtensions = PVATestFramework.Console.Helpers.Extensions.LoggerExtensions;

namespace PVATestFramework.Console
{
    public class Runner
	{
        private readonly ILogger logger;
        private readonly IFileHandler fileHandler;
        private readonly DirectLineClientBase directLineClient;

        public Runner(ILogger logger, IFileHandler fileHandler)
        {
            this.logger = logger;
            this.fileHandler = fileHandler;
        }
        public Runner(ILogger logger, DirectLineClientBase directLineClient, IFileHandler fileHandler)
        {
            this.logger = logger;
            this.directLineClient = directLineClient;
            this.fileHandler = fileHandler;
        }

        /// <summary>
        /// Run a chat transcript test from a directory or file
        /// </summary>
        /// <param name="options"></param>
        /// <param name="path"></param>
        /// <param name="verbose"></param>
        /// <param name="cancellationToken"></param>
        /// <returns>boolean depending if the execution was successful or not</returns>
		public async Task<bool> RunTranscriptTestAsync(DirectLineOptions options, string path, bool verbose = false, CancellationToken cancellationToken = default)
		{
            logger.Information("The test has started...");

            try
			{
				var totalTests = 0;
                var failedTests = 0;
                var fileAttributes = fileHandler.GetFileAttributes(path);
                var fileList = new List<string>();

                if (fileAttributes.HasFlag(FileAttributes.Directory))
                {
                    // The path is a directory
                    fileList = fileHandler.GetFilesFromDirectory(path, "*.json").ToList();
                }
                else
                {
                    // The path is just a file
                    fileList.Add(path);
                }

                logger.Information($"Using Direct Line endpoint: {options.RegionalEndpoint}");

                foreach (var file in fileList)
				{
					logger.Information($"Testing with file: {file}");

                    var activityList = await GetActivitiesFromTranscriptFile(file);

                    if (activityList.list_of_conversations.Count > 0)
                    {
                        // The file has multiple conversations
                        foreach (var actlist in activityList.list_of_conversations)
                        {
                            totalTests++;
                            var result = await ExecuteTranscriptAsync(options, actlist, file, verbose, cancellationToken).ConfigureAwait(false);
                            if (!result) failedTests++;
                        }
                    }
                    else
                    {
                        // The file has a single conversation
                        totalTests++;
                        var result = await ExecuteTranscriptAsync(options, activityList, file, verbose, cancellationToken).ConfigureAwait(false);
                        if (!result) failedTests++;
                    }
                }
             
                logger.Information($"Test results:     {totalTests - failedTests} passed, {totalTests} total");                

                return failedTests == 0;
			}
			catch (JsonReaderException ex)
			{
				logger.ForegroundColor($"An error occurred while running the test. Details: The json file used as an input is not valid.", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
				return false;
			}
			catch (Exception ex)
			{
                logger.ForegroundColor($"An error occurred while running the test. Details: {ex.Message}", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
                return false;
			}
		}

        /// <summary>
        /// Run a scale test, sending N conversations to the bot
        /// </summary>
        /// <param name="options"></param>
        /// <param name="totalAttempts"></param>
        /// <param name="path"></param>
        /// <param name="verbose"></param>
        /// <returns>boolean depending if the execution was successful or not</returns>
		public async Task<bool> RunScaleTestAsync(DirectLineOptions options, int totalAttempts, string path, bool verbose)
		{
            logger.Information($"Running a Scale test (sending chat transcript {totalAttempts} times).");

            try
			{
                var succeededAttempts = 0;
                for (int i = 0; i < totalAttempts; i++)
				{
					if (verbose) 
					{ 
						logger.Information($"Attempt {i+1}..."); 
					}
					try
                    {
                        var result = await RunTranscriptTestAsync(options, path, verbose);
                        if (result)
                        {
                            succeededAttempts++;
                        }
                    }
                    catch
                    {
                        logger.ForegroundColor($"The chat transcript failed.", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                    }
                }

				if (succeededAttempts == totalAttempts)
				{
                    logger.ForegroundColor($"The chat transcript was sent to the bot successfully in {succeededAttempts} attempts.", LoggerExtensions.LogLevel.Information, LoggerExtensions.Green);
                    logger.ForegroundColor($"Scale test ended succesfully.", LoggerExtensions.LogLevel.Information, LoggerExtensions.Green);
                    return true;
                }
				else
				{
                    logger.ForegroundColor($"The chat transcript was sent to the bot successfully in {succeededAttempts} attempts from {totalAttempts}.", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                    logger.ForegroundColor($"Scale test ended with errors.", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                    return false;
                }
			}
			catch (Exception ex)
			{
                logger.ForegroundColor($"An error occurred while running the test. Details: {ex.Message}", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
                return false;
			}
        }

        /// <summary>
        /// Convert a .chat file into a .json file
        /// </summary>
        /// <param name="path"></param>
        /// <param name="outputFile"></param>
        /// <returns>boolean depending if the conversion was successful or not</returns>
        public bool ConvertChatFileToJSON(string path, string outputFile)
        {
			try
			{
                logger.Information($"The conversion process has started...");

                var line = string.Empty;
				var activityListContainer = new List<List<Models.Activities.Activity>>();
                var activityList = new List<Models.Activities.Activity>();
                string filepath = fileHandler.GetFullPath(outputFile);

				if (!filepath.EndsWith(".json"))
				{
                    throw new ArgumentException("The output file should have a .json extension.");
				}
				if (!path.EndsWith(".chat"))
				{
                    throw new ArgumentException("The input file should have a .chat extension.");
				}

				using (StreamReader sr = new StreamReader(path))
				{
                    fileHandler.DeleteFile(filepath);

					while (null != (line = sr.ReadLine()))
					{
                        var activity = new Models.Activities.Activity();
                        if (string.IsNullOrWhiteSpace(line.Trim()))
                        {
                            continue;
                        }
                        else if (line.Trim().Equals("<EOC>", StringComparison.InvariantCultureIgnoreCase))
						{
                            activityListContainer.Add(activityList);
							activityList = new List<Models.Activities.Activity>();
                            continue;
                        }
                        else if (line.StartsWith("user:"))
						{
                            var userReg = new Regex(Regex.Escape("user:"));
                            var userText = userReg.Replace(line, string.Empty, 1).Trim();
                            if (string.IsNullOrEmpty(userText))
                            {
                                throw new ArgumentException("The user message is null or empty.");
                            }
                            else
                            {
                                activity = new Models.Activities.Activity
                                {
                                    Type = Helpers.ActivityTypes.Message,
                                    Text = userText,
                                    From = new From(string.Empty, 1),
                                    Timestamp = ToUnixTimeSeconds(DateTime.UtcNow)
                                };
                            }                            
						}
                        else if (line.StartsWith("bot:"))
						{
                            var botReg = new Regex(Regex.Escape("bot:"));
                            var botText = botReg.Replace(line, string.Empty, 1).Trim();
                            if (string.IsNullOrEmpty(botText))
                            {
                                throw new ArgumentException("The bot message is null or empty.");
                            }
                            else
                            {
                                activity = new Models.Activities.Activity
                                {
                                    Type = Helpers.ActivityTypes.Message,
                                    Text = botText,
                                    From = new From(string.Empty, 0),
                                    Timestamp = ToUnixTimeSeconds(DateTime.UtcNow)
                                };
                            }                            
						}
                        else if (line.StartsWith("suggested:"))
                        {
                            var suggestionRegex = new Regex(Regex.Escape("suggested:"));
                            var suggestionText = suggestionRegex.Replace(line, string.Empty, 1).Trim();

                            if (string.IsNullOrEmpty(suggestionText))
                            {
                                throw new ArgumentException("The suggested message is null or empty.");
                            }

                            var suggestionList = suggestionText.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList();
                            var intentCandidates = new List<IntentCandidate>();

                            foreach (var suggestion in suggestionList)
                            {
                                intentCandidates.Add(new IntentCandidate
                                {
                                    IntentScore = new IntentScore()
                                    {
                                        Title = suggestion
                                    }
                                });
                            }
                            activity = new Models.Activities.Activity
                            {
                                ValueType = "IntentCandidates",
                                Type = Helpers.ActivityTypes.Trace,
                                From = new From(string.Empty, 0),
                                Timestamp = ToUnixTimeSeconds(DateTime.UtcNow),
                                Value = new Value()
                                {
                                    IntentCandidates = intentCandidates
                                }
                            };
                        }
                        else
                        {
                            throw new Exception("The input file format is not valid.");
                        }

                        activityList.Add(activity);
					}
                    activityListContainer.Add(activityList);

                    var activities = new List<string>();
                    foreach (var list in activityListContainer)
                    {
                        activities.Add($"{{\"Activities\":{string.Join(',', JsonConvert.SerializeObject(list))}}}");
                    }
                    fileHandler.WriteToFile(filepath, $"{{\"list_of_conversations\":[{string.Join(",", activities)}]}}");
                }

                logger.Information($"The conversion process ended.");
                return true;
			}
			catch (Exception ex)
			{
                logger.ForegroundColor($"An error occurred while converting the .chat transcript. Details: {ex.Message}", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
                return false;
            }
        }

        /// <summary>
        /// Execute the conversation on the transcript
        /// </summary>
        /// <param name="options"></param>
        /// <param name="activityList"></param>
        /// <param name="path"></param>
        /// <param name="verbose"></param>
        /// <param name="cancellationToken"></param>
        /// <returns>boolean depending if the conversion was successful or not</returns>
        /// <exception cref="InvalidOperationException"></exception>
        private async Task<bool> ExecuteTranscriptAsync(DirectLineOptions options, ActivityList activityList, string path, bool verbose = false, CancellationToken cancellationToken = default)
		{
            var logRecords = new List<LogCSV>();
            var activities = new List<Activity>();
            var timer = new Stopwatch();
            var testFailed = false;
            var userUtterance = string.Empty;

            timer.Start();
            path = fileHandler.GetFullPath(path);

            try
            {
                using (directLineClient)
                {
                    foreach (var activity in activityList.Activities)
                    {
                        switch (activity.From.Role)
                        {
                            case RoleTypes.User:
                                var sendActivity = new Activity
                                {
                                    Type = activity.Type,
                                    Text = activity.Text
                                };

                                userUtterance = sendActivity.Text;
                                if (verbose)
                                {
                                    logger.Information($"User sends: {sendActivity.Text}");
                                }

                                await directLineClient.SendActivityAsync(sendActivity, cancellationToken).ConfigureAwait(false);
                                break;

                            case RoleTypes.Bot:
                                if (IgnoreActivity(activity))
                                {
                                    break;
                                }

                                var receivedActivity = new Activity();
                                var receivedOptions = new List<string>();
                                var expectedOptions = new List<string>();

                                if (activities.Count == 0)
                                {
                                    activities = await directLineClient.ReceiveActivitiesAsync(cancellationToken).ConfigureAwait(false);

                                    // Get the first activity from the bot response
                                    receivedActivity = activities.FirstOrDefault();
                                    activities.Remove(receivedActivity);

                                    if (verbose)
                                    {
                                        logger.Information($"Bot sends: {receivedActivity.Text}");
                                    }
                                    if (receivedActivity.SuggestedActions != null)
                                    {
                                        // Get the suggested topics from the activity if any
                                        receivedOptions = receivedActivity.SuggestedActions?.Actions?.Where(o => !o.Title.Equals(BotDefaultMessages.NoneOfThese, StringComparison.InvariantCultureIgnoreCase)).Select(a => a.Title).ToList();

                                        if (verbose)
                                        {
                                            logger.Information($"\t{string.Join(" | ", receivedOptions)}");
                                        }
                                    }
                                }
                                else
                                {
                                    // Get the first activity from the list
                                    receivedActivity = activities.FirstOrDefault();
                                    activities.Remove(receivedActivity);

                                    if (verbose)
                                    {
                                        logger.Information($"Bot sends: {receivedActivity.Text}");
                                    }
                                }

                                var csvRecord = new LogCSV()
                                {
                                    BotId = receivedActivity.From.Id,
                                    ConversationId = receivedActivity.Conversation.Id,
                                    SessionDate = DateTime.Now.ToString(),
                                    UserUtterance = userUtterance,
                                    ExpectedResponse = activity.Text,
                                    ReceivedResponse = receivedActivity.Text,
                                    TestFile = path
                                };

                                if (receivedActivity.Text != null && receivedActivity.Text.Equals(BotDefaultMessages.DYM, StringComparison.InvariantCultureIgnoreCase))
                                {
                                    expectedOptions = activity.Value?.IntentCandidates != null ? activity.Value?.IntentCandidates?.Select(o => o.IntentScore.Title).ToList() : new List<string>() { "No suggested topics found" };

                                    for (int i = 0; i < receivedOptions.Count; i++)
                                    {
                                        if (i == 0) csvRecord.DYM_Option1 = receivedOptions[i];
                                        if (i == 1) csvRecord.DYM_Option2 = receivedOptions[i];
                                        if (i == 2) csvRecord.DYM_Option3 = receivedOptions[i];
                                    }

                                    if (expectedOptions.Count != receivedOptions.Count)
                                    {
                                        testFailed = true;
                                    }
                                    else
                                    {
                                        foreach (var suggestion in receivedOptions)
                                        {
                                            if (!expectedOptions.Any(option => option.Equals(suggestion, StringComparison.InvariantCultureIgnoreCase)))
                                            {
                                                testFailed = true;
                                                break;
                                            }
                                        }
                                    }

                                    if (testFailed)
                                    {
                                        logger.ForegroundColor($"Test script failed", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                        logger.ForegroundColor($"Expected:\t{string.Join(" | ", expectedOptions)}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                        logger.ForegroundColor($"Received:\t{string.Join(" | ", receivedOptions)}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                    }
                                }
                                else
                                {
                                    if (!AssertActivity(activity, receivedActivity))
                                    {
                                        logger.ForegroundColor($"Test script failed", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);

                                        if (!string.IsNullOrEmpty(activity.Text))
                                        {
                                            logger.ForegroundColor($"Expected: {activity.Text}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                            logger.ForegroundColor($"Received: {receivedActivity.Text}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                            logger.ForegroundColor($"Line number: {activity.LineNumber}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                        }

                                        if (activity.Attachments != null && activity.Attachments.Count > 0)
                                        {
                                            var expectedAttachments = activity.Attachments.Select(a => JsonConvert.SerializeObject(a.Content)).ToList();
                                            var receivedAttachments = receivedActivity.Attachments.Select(a => JsonConvert.SerializeObject(a.Content)).ToList();

                                            logger.ForegroundColor($"Expected: {string.Join(Environment.NewLine, expectedAttachments)}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                            logger.ForegroundColor($"Received: {string.Join(Environment.NewLine, receivedAttachments)}", LoggerExtensions.LogLevel.Error, LoggerExtensions.Yellow);
                                        }

                                        testFailed = true;
                                    }
                                }

                                userUtterance = string.Empty;
                                csvRecord.Result = testFailed ? "Failed" : "Passed";
                                logRecords.Add(csvRecord);
                                break;

                            default:
                                throw new InvalidOperationException($"Invalid script role {activity.From.Role}.");
                        }

                        if (testFailed) break;
                    }
                }

                timer.Stop();

                if (!testFailed)
                {
                    logger.ForegroundColor($"Test script passed", LoggerExtensions.LogLevel.Information, LoggerExtensions.Green);
                }

                logger.Information($"Time: {timer.Elapsed.TotalSeconds.ToString("0.00")} seconds");

                return !testFailed;
            }
            catch (Exception ex)
            {
                logger.ForegroundColor($"An error occurred while validating the chat transcript file. Details: {ex.Message}", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
                return false;
            }
            finally
            {
                WriteCSVLog(logRecords);
            }
        }

		/// <summary>
		/// Receives an activityList from a transcript file
		/// </summary>
		/// <param name="fileName"></param>
		/// <returns>an activityList</returns>
		private async Task<ActivityList> GetActivitiesFromTranscriptFile(string fileName)
		{
			using var reader = new StreamReader(fileName);
			var transcript = await reader.ReadToEndAsync().ConfigureAwait(false);
			var activityList = JsonConvert.DeserializeObject<ActivityList>(transcript);

            if (activityList.Activities.Count == 0 && activityList.list_of_conversations.Count == 0)
            {
                throw new JsonReaderException();
            }
            else if (activityList.list_of_conversations.Count > 0)
			{
                foreach (var activities in activityList.list_of_conversations)
                {
                    AddTextLineNumber(activities, fileName);
                }
            }
            else
			{
                AddTextLineNumber(activityList, fileName);
            }

			return activityList;
		}

        /// <summary>
        /// Gets the line number for the activity text
        /// </summary>
        /// <param name="activityList"></param>
        /// <param name="fileName"></param>
		private void AddTextLineNumber(ActivityList activityList, string fileName)
		{
            var lineNumber = 0;
            var lines = File.ReadLines(fileName).ToList();

            foreach (var activity in activityList.Activities.Where(a => a.IsMessageActivityWithText()))
            {
                // Added line number for Text messages
                lineNumber = lines.FindIndex(lineNumber, line => line.Contains(activity.Text)) + 1;
                activity.LineNumber = lineNumber;
            }
        }

        /// <summary>
        /// Write CSV log
        /// </summary>
        /// <param name="records"></param>
        private void WriteCSVLog(List<LogCSV> records)
        {
            var csvLogPath = Path.Combine(Environment.CurrentDirectory, "logFile.csv");
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                // Don't write the header again.
                HasHeaderRecord = false,
                // Use the system list separator
                Delimiter = CultureInfo.CurrentCulture.TextInfo.ListSeparator
            };

            if (!File.Exists(csvLogPath))
			{
                using (var streamWriter = new StreamWriter(csvLogPath))
                {
                    using (var csvWriter = new CsvWriter(streamWriter, config))
                    {
                        csvWriter.WriteHeader<LogCSV>();
						csvWriter.NextRecord();
                    }
                }
            }

			using (var stream = File.Open(csvLogPath, FileMode.Append))
			{
				using (var streamWriter = new StreamWriter(stream))
				{
					using (var csvWriter = new CsvWriter(streamWriter, config))
					{						
						csvWriter.WriteRecords(records);
					}
				}
			}
        }

        /// <summary>
        /// Check if adaptive cards structure are equal
        /// </summary>
        /// <param name="expectedActivity"></param>
        /// <param name="receivedActivity"></param>
        /// <returns>boolean</returns>
		private bool AssertActivity(Models.Activities.Activity expectedActivity, Activity receivedActivity)
		{
            bool result = true;
            if (!string.IsNullOrEmpty(expectedActivity.Text) && !string.IsNullOrEmpty(receivedActivity.Text))
            {
                // Replace unwanted characters
                receivedActivity.Text = receivedActivity.Text.Replace((char)0xA0, ' ');

                string pattern = ExtractRegex(expectedActivity.Text);
                if (!string.IsNullOrEmpty(pattern))
                {
                    // If the line contains a regex pattern it will check if matches
                    return Regex.IsMatch(receivedActivity.Text, pattern);
                }
                else if (!expectedActivity.Text.Equals(receivedActivity.Text, StringComparison.InvariantCultureIgnoreCase))
                {
                    // This is a simple text to compare
                    return false;
                }
            }
            else if (expectedActivity.Attachments != null && expectedActivity.Attachments.Count == receivedActivity.Attachments.Count)
            {
                // This is an adaptive card, so the structure comparison will be executed
                var expectedAttachments = expectedActivity.Attachments.Select(a => JsonConvert.SerializeObject(a.Content)).ToList();
                var receivedAttachments = receivedActivity.Attachments.Select(a => JsonConvert.SerializeObject(a.Content)).ToList();
                var settings = new AdaptiveCardTranslatorSettings();

                for (int i = 0; i < expectedActivity.Attachments.Count; i++)
                {
                    var expectedCard = AdaptiveCard.GetCardWithoutValues(expectedAttachments[i].ToJObject(true), settings);
                    var receivedCard = AdaptiveCard.GetCardWithoutValues(receivedAttachments[i].ToJObject(true), settings);
                    if (!expectedCard.Equals(receivedCard, StringComparison.InvariantCultureIgnoreCase))
                    {
                        return false;
                    }
                }
            }
            else
            {
                return false;
            }

            return result;
        }

		/// <summary>
		/// validate if the activity should be ignored
		/// </summary>
		/// <param name="activity"></param>
		/// <returns>boolean</returns>
		private bool IgnoreActivity(Models.Activities.Activity activity)
		{
            // Ignore trace activities unless it is an IntentCandidates type one. Also, ignore the DYM message as it is sent in the previous activity
            return (activity.Type == Helpers.ActivityTypes.Trace
                && !activity.ValueType.Equals("IntentCandidates", StringComparison.InvariantCultureIgnoreCase))
                || (activity.Type == Helpers.ActivityTypes.Message
                && activity.Text != null
                && activity.Text.Equals(BotDefaultMessages.DYM, StringComparison.InvariantCultureIgnoreCase));
		}

        /// <summary>
        /// Extract the regex pattern
        /// </summary>
        /// <param name="input"></param>
        /// <returns>path</returns>
        private string ExtractRegex(string input)
        {
            if (input == null)
            {
                return null;
            }
            string regexPattern = "<\\((.*?)\\)>"; // The regex pattern to search for
            Regex regex = new Regex(regexPattern);
            Match match = regex.Match(input);
            if (match.Success)
            {
                return match.Groups[1].Value; // Extract the REGEX
            }
            else
            {
                return null;
            }
        }

        /// <summary>
        /// Convert a datetime to Unix time format
        /// </summary>
        /// <param name="date"></param>
        /// <returns>path</returns>
        private int ToUnixTimeSeconds(DateTime date)
        {
            DateTime point = new DateTime(1970, 1, 1);
            TimeSpan time = date.Subtract(point);

            return (int)time.TotalSeconds;
        }
    }
}
