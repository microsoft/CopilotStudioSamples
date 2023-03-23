// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.IO;

namespace BotTestFramework.Console.Helpers.FileHandler
{
    public class FileHandler : IFileHandler
    {
        public void CheckFilePath(string filePath)
        {
            var directoryName = Path.GetDirectoryName(filePath);
            if (!Directory.Exists(directoryName))
            {
                Directory.CreateDirectory(directoryName);
            }
        }

        public void WriteToFile(string filePath, string content)
        {
            File.WriteAllText(filePath, content);
        }

        public FileAttributes GetFileAttributes(string filePath) 
        {
            return File.GetAttributes(filePath);
        }

        public IEnumerable<string> GetFilesFromDirectory(string directoryName, string extensionFilter) 
        {
            return Directory.EnumerateFiles(directoryName, extensionFilter);
        }

        public string GetFullPath(string filePath)
        {
            if (!Path.IsPathFullyQualified(filePath))
            {
                return Path.GetFullPath(filePath);
            }
            return filePath;
        }

        public void DeleteFile(string filePath)
        {
            File.Delete(filePath);
        }
    }
}
