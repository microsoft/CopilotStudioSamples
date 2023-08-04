// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace PVATestFramework.Console.Helpers.FileHandler
{
    public interface IFileHandler
    {
        FileAttributes GetFileAttributes(string filePath);
        IEnumerable<string> GetFilesFromDirectory(string directoryName, string extensionFilter);
        void CheckFilePath(string filePath);
        void WriteToFile(string filePath, string content);
        string GetFullPath(string path);
        void DeleteFile(string filePath);
    }
}
