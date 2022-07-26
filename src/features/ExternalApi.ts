// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { v4 as uuidv4 } from 'uuid';
import { LanguageClientConsumer } from "../languageClientConsumer";
import { Logger } from "../logging";
import { SessionManager } from "../session";

export interface IExternalPowerShellDetails {
    exePath: string;
    version: string;
    displayName: string;
    architecture: string;
}

export interface IPowerShellExtensionClient {
    registerExternalExtension(id: string, apiVersion?: string): string;
    unregisterExternalExtension(uuid: string): boolean;
    getPowerShellVersionDetails(uuid: string): Promise<IExternalPowerShellDetails>;
    waitUntilStarted(uuid: string): Promise<void>;
    getStorageUri(): vscode.Uri;
}

/*
In order to use this in a Visual Studio Code extension, you can do the following:

const powershellExtension = vscode.extensions.getExtension<IPowerShellExtensionClient>("ms-vscode.PowerShell-Preview");
const powerShellExtensionClient = powershellExtension!.exports as IPowerShellExtensionClient;

NOTE: At some point, we should release a helper npm package that wraps the API and does:
* Discovery of what extension they have installed: PowerShell or PowerShell Preview
* Manages session id for you

*/
export class ExternalApiFeature extends LanguageClientConsumer implements IPowerShellExtensionClient {
    private static readonly registeredExternalExtension: Map<string, IExternalExtension> = new Map<string, IExternalExtension>();

    constructor(
        private extensionContext: vscode.ExtensionContext,
        private sessionManager: SessionManager,
        private log: Logger) {
        super();
    }

    /*
    DESCRIPTION:
        Registers your extension to allow usage of the external API. The returns
        a session UUID that will need to be passed in to subsequent API calls.

    USAGE:
        powerShellExtensionClient.registerExternalExtension(
            "ms-vscode.PesterTestExplorer" // the name of the extension using us
            "v1"); // API Version.

    RETURNS:
        string session uuid
    */
    public registerExternalExtension(id: string, apiVersion: string = 'v1'): string {
        this.log.writeDiagnostic(`Registering extension '${id}' for use with API version '${apiVersion}'.`);

        for (const [_, externalExtension] of ExternalApiFeature.registeredExternalExtension) {
            if (externalExtension.id === id) {
                const message = `The extension '${id}' is already registered.`;
                this.log.writeWarning(message);
                throw new Error(message);
            }
        }

        if (!vscode.extensions.all.some(ext => ext.id === id)) {
            throw new Error(`No extension installed with id '${id}'. You must use a valid extension id.`);
        }

        // These are only allowed to be used in our unit tests.
        if ((id === "ms-vscode.powershell" || id === "ms-vscode.powershell-preview")
            && !(this.extensionContext.extensionMode === vscode.ExtensionMode.Test)) {
            throw new Error("You can't use the PowerShell extension's id in this registration.");
        }

        const uuid = uuidv4();
        ExternalApiFeature.registeredExternalExtension.set(uuid, {
            id,
            apiVersion
        });
        return uuid;
    }

    /*
    DESCRIPTION:
        Unregisters a session that an extension has. This returns
        true if it succeeds or throws if it fails.

    USAGE:
        powerShellExtensionClient.unregisterExternalExtension(
            "uuid"); // the uuid from above for tracking purposes

    RETURNS:
        true if it worked, otherwise throws an error.
    */
    public unregisterExternalExtension(uuid: string = ""): boolean {
        this.log.writeDiagnostic(`Unregistering extension with session UUID: ${uuid}`);
        if (!ExternalApiFeature.registeredExternalExtension.delete(uuid)) {
            throw new Error(`No extension registered with session UUID: ${uuid}`);
        }
        return true;
    }

    private getRegisteredExtension(uuid: string = ""): IExternalExtension {
        if (!ExternalApiFeature.registeredExternalExtension.has(uuid)) {
            throw new Error(
                "UUID provided was invalid, make sure you ran the 'powershellExtensionClient.registerExternalExtension(extensionId)' method and pass in the UUID that it returns to subsequent methods.");
        }

        // TODO: When we have more than one API version, make sure to include a check here.
        return ExternalApiFeature.registeredExternalExtension.get(uuid);
    }

    /*
    DESCRIPTION:
        This will fetch the version details of the PowerShell used to start
        PowerShell Editor Services in the PowerShell extension.

    USAGE:
        powerShellExtensionClient.getPowerShellVersionDetails(
            "uuid"); // the uuid from above for tracking purposes

    RETURNS:
        An IPowerShellVersionDetails which consists of:
        {
            version: string;
            displayVersion: string;
            edition: string;
            architecture: string;
        }
    */
    public async getPowerShellVersionDetails(uuid: string = ""): Promise<IExternalPowerShellDetails> {
        const extension = this.getRegisteredExtension(uuid);
        this.log.writeDiagnostic(`Extension '${extension.id}' called 'getPowerShellVersionDetails'`);

        await this.sessionManager.waitUntilStarted();
        const versionDetails = this.sessionManager.getPowerShellVersionDetails();

        return {
            exePath: this.sessionManager.PowerShellExeDetails.exePath,
            version: versionDetails.version,
            displayName: this.sessionManager.PowerShellExeDetails.displayName, // comes from the Session Menu
            architecture: versionDetails.architecture
        };
    }
    /*
    DESCRIPTION:
        This will wait until the extension's PowerShell session is started.

    USAGE:
        powerShellExtensionClient.waitUntilStarted(
            "uuid"); // the uuid from above for tracking purposes

    RETURNS:
        A void promise that resolves only once the extension is started.

        If the extension is not started by some mechanism
        then this will wait indefinitely.
    */
    public async waitUntilStarted(uuid: string = ""): Promise<void> {
        const extension = this.getRegisteredExtension(uuid);
        this.log.writeDiagnostic(`Extension '${extension.id}' called 'waitUntilStarted'`);
        return this.sessionManager.waitUntilStarted();
    }

    public getStorageUri(): vscode.Uri {
        return this.extensionContext.globalStorageUri;
    }

    public dispose() {
        // Nothing to dispose.
    }
}

interface IExternalExtension {
    readonly id: string;
    readonly apiVersion: string;
}
