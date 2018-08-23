/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILogger } from "../src/logging";

export class MockLogger implements ILogger {
    public write(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeDiagnostic(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeVerbose(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeWarning(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeAndShowWarning(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeError(message: string, ...additionalMessages: string[]) { return undefined; }

    public writeAndShowError(message: string, ...additionalMessages: string[]) { return undefined; }
}
