import { Logger, LogLevel } from "../src/logging";

export class MockLogger extends Logger {
    // Note - This is not a true mock as the constructor is inherited and causes errors due to trying load
    // the "PowerShell Extension Logs" multiple times.  Ideally logging should be via an interface and then
    // we can mock correctly.

    public dispose() { return undefined; }

    public getLogFilePath(baseName: string): string { return "mock"; }

    public writeAtLevel(logLevel: LogLevel, message: string, ...additionalMessages: string[]) { return undefined; }

    public write(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeDiagnostic(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeVerbose(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeWarning(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeAndShowWarning(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeError(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeAndShowError(message: string, ...additionalMessages: string[]) { return undefined; }

    public startNewLog(minimumLogLevel: string = "Normal") { return undefined; }
}
