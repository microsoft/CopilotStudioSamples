$folder = ${env:INPUT}

foreach ($file in Get-ChildItem $folder)
{
    if ($file.Extension -eq ".json")
    {
        $testFile = Join-Path $folder $file.Name
        .\BotTestFramework.Console.exe test --tokenEndpoint $tokenEndpoint --path $testFile --verbose
        if ($LastExitCode -ne 0)
        {
            Exit $LastExitCode
        }
    }
}
