/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as vscode from "vscode";
import { v4 as uuidv4 } from 'uuid';
import { LanguageClient } from "vscode-languageclient";
import { IFeature } from "../feature";
import { Logger } from "../logging";
import { SessionManager } from "../session";

export interface IExternalPowerShellDetails {
    exePath: string;
    version: string;
    displayName: string;
    architecture: string;
}

export class ExternalApiFeature implements IFeature {
    private commands: vscode.Disposable[];
    private languageClient: LanguageClient;
    private static readonly registeredExternalExtension: Map<string, IExternalExtension> = new Map<string, IExternalExtension>();

    constructor(private sessionManager: SessionManager, private log: Logger) {
        this.commands = [
            /*
            DESCRIPTION:
                Registers your extension to allow usage of the external API. The returns
                a session UUID that will need to be passed in to subsequent API calls.

            USAGE:
                vscode.commands.executeCommand(
                    "PowerShell.RegisterExternalExtension",
                    "ms-vscode.PesterTestExplorer" // the name of the extension using us
                    "v1"); // API Version.

            RETURNS:
                string session uuid
            */
            vscode.commands.registerCommand("PowerShell.RegisterExternalExtension", (id: string, apiVersion: string = 'v1'): string =>
                this.registerExternalExtension(id, apiVersion)),

            /*
            DESCRIPTION:
                Unregisters a session that an extension has. This returns
                true if it succeeds or throws if it fails.

            USAGE:
                vscode.commands.executeCommand(
                    "PowerShell.UnregisterExternalExtension",
                    "uuid"); // the uuid from above for tracking purposes

            RETURNS:
                true if it worked, otherwise throws an error.
            */
            vscode.commands.registerCommand("PowerShell.UnregisterExternalExtension", (uuid: string = ""): boolean =>
                this.unregisterExternalExtension(uuid)),

            /*
            DESCRIPTION:
                This will fetch the version details of the PowerShell used to start
                PowerShell Editor Services in the PowerShell extension.

            USAGE:
                vscode.commands.executeCommand(
                    "PowerShell.GetPowerShellVersionDetails",
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
            vscode.commands.registerCommand("PowerShell.GetPowerShellVersionDetails", (uuid: string = ""): Promise<IExternalPowerShellDetails> =>
                this.getPowerShellVersionDetails(uuid)),
        ]
    }

    private registerExternalExtension(id: string, apiVersion: string = 'v1'): string {
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

        // If we're in development mode, we allow these to be used for testing purposes.
        if (!this.sessionManager.InDevelopmentMode && (id === "ms-vscode.PowerShell" || id === "ms-vscode.PowerShell-Preview")) {
            throw new Error("You can't use the PowerShell extension's id in this registration.");
        }

        const uuid = uuidv4();
        ExternalApiFeature.registeredExternalExtension.set(uuid, {
            id,
            apiVersion
        });
        return uuid;
    }

    private unregisterExternalExtension(uuid: string = ""): boolean {
        this.log.writeDiagnostic(`Unregistering extension with session UUID: ${uuid}`);
        if (!ExternalApiFeature.registeredExternalExtension.delete(uuid)) {
            throw new Error(`No extension registered with session UUID: ${uuid}`);
        }
        return true;
    }

    private async getPowerShellVersionDetails(uuid: string = ""): Promise<IExternalPowerShellDetails> {
        if (!ExternalApiFeature.registeredExternalExtension.has(uuid)) {
            throw new Error(
                "UUID provided was invalid, make sure you execute the 'PowerShell.GetPowerShellVersionDetails' command and pass in the UUID that it returns to subsequent command executions.");
        }

        // TODO: When we have more than one API version, make sure to include a check here.
        const extension = ExternalApiFeature.registeredExternalExtension.get(uuid);
        this.log.writeDiagnostic(`Extension '${extension.id}' used command 'PowerShell.GetPowerShellVersionDetails'.`);

        await this.sessionManager.waitUntilStarted();
        const versionDetails = this.sessionManager.getPowerShellVersionDetails();

        return {
            exePath: this.sessionManager.PowerShellExeDetails.exePath,
            version: versionDetails.version,
            displayName: this.sessionManager.PowerShellExeDetails.displayName, // comes from the Session Menu
            architecture: versionDetails.architecture
        };
    }

    public dispose() {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    public setLanguageClient(languageclient: LanguageClient) {
        this.languageClient = languageclient;
    }
}

interface IExternalExtension {
    readonly id: string;
    readonly apiVersion: string;
}
