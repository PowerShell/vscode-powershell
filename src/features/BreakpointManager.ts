// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { LanguageClient } from "vscode-languageclient/node";
import { Range, NotificationType, RequestType } from "vscode-languageserver-protocol";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { Logger } from "../logging";

export const BreakpointChangedNotificationType = new NotificationType<IPsesBreakpointChangedEventArgs>("powerShell/breakpointsChanged");
export const SetBreakpointRequestType = new RequestType<IPsesBreakpoint, string, void>("powerShell/setBreakpoint");
export const BreakpointRemovedNotificationType = new NotificationType<IPsesBreakpoint>("powerShell/breakpointRemoved");
export const BreakpointEnabledChanged = new NotificationType<IPsesBreakpoint>("powerShell/breakpointEnabledChanged");

interface IPsesBreakpoint {
    id: string,
    enabled: boolean,
    condition?: string,
    hitCondition?: string,
    logMessage?: string,
    location?: IPsesLocation,
    functionName?: string,
}

interface IPsesLocation {
    uri: string,
    range: Range,
}

interface IPsesBreakpointChangedEventArgs {
    added: IPsesBreakpoint[],
    removed: IPsesBreakpoint[],
    changed: IPsesBreakpoint[],
}

export class BreakpointManager extends LanguageClientConsumer{
    private eventRegistration: vscode.Disposable | undefined;

    private notificationRegistration: vscode.Disposable | undefined;

    private requestRegistration: vscode.Disposable | undefined;

    private logger: Logger;

    constructor(logger: Logger) {
        super();

        this.logger = logger;
    }

    public override setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;

        this.requestRegistration = this.languageClient.onRequest(
            SetBreakpointRequestType,
            bp => {
                const clientBp: vscode.Breakpoint | undefined = this.toVSCodeBreakpoint(bp);
                if (clientBp === undefined) {
                    return -1;
                }

                vscode.debug.addBreakpoints([clientBp]);
                return clientBp.id;
            });

        this.notificationRegistration = this.languageClient.onNotification(
            BreakpointChangedNotificationType.method,
            (eventArgs) => {
                this.handleServerBreakpointChanged(this.toVSCodeBreakpointsChanged(eventArgs));
            });

        this.eventRegistration = vscode.debug.onDidChangeBreakpoints(
            (eventArgs) => {
                this.handleClientBreakpointChanged(eventArgs)
                    .catch((reason) => {
                        this.logger.writeError(`Error occurred while handling client breakpoint changed: ${reason}`);
                    });
            },
            this);
    }

    private handleServerBreakpointChanged(eventArgs: vscode.BreakpointsChangeEvent): void {
        vscode.debug.removeBreakpoints(eventArgs.removed);
    }

    private async handleClientBreakpointChanged(eventArgs: vscode.BreakpointsChangeEvent): Promise<void> {
        if (this.languageClient === undefined) {
            return;
        }

        await this.languageClient.sendNotification(
            BreakpointChangedNotificationType,
            this.toPsesBreakpointsChanged(eventArgs));
    }

    private toVSCodeBreakpointsChanged(eventArgs: IPsesBreakpointChangedEventArgs): vscode.BreakpointsChangeEvent {
        const map: Map<string, vscode.Breakpoint> = new Map<string, vscode.Breakpoint>(
            vscode.debug.breakpoints.map(bp => [bp.id, bp]));

        const isBreakpoint = (bp: vscode.Breakpoint | undefined): bp is vscode.Breakpoint => bp !== undefined;
        return {
            added: eventArgs.added.map((bp) => this.toVSCodeBreakpoint(bp, map)).filter(isBreakpoint),
            removed: eventArgs.removed.map((bp) => this.toVSCodeBreakpoint(bp, map)).filter(isBreakpoint),
            changed: eventArgs.changed.map((bp) => this.toVSCodeBreakpoint(bp, map)).filter(isBreakpoint),
        };
    }

    private toPsesBreakpointsChanged(eventArgs: vscode.BreakpointsChangeEvent): IPsesBreakpointChangedEventArgs {
        return {
            added: eventArgs.added.map((bp) => this.toPsesBreakpoint(bp)),
            removed: eventArgs.removed.map((bp) => this.toPsesBreakpoint(bp)),
            changed: eventArgs.changed.map((bp) => this.toPsesBreakpoint(bp)),
        };
    }

    private toVSCodeBreakpoint(breakpoint: IPsesBreakpoint, map?: Map<string, vscode.Breakpoint>): vscode.Breakpoint | undefined {
        const existing: vscode.Breakpoint | undefined = map?.get(breakpoint.id);
        if (existing !== undefined) {
            return existing;
        }

        if (breakpoint.location !== undefined) {
            const bp = new vscode.SourceBreakpoint(
                new vscode.Location(
                    vscode.Uri.parse(breakpoint.location.uri),
                    new vscode.Range(
                        breakpoint.location.range.start.line,
                        breakpoint.location.range.start.character,
                        breakpoint.location.range.end.line,
                        breakpoint.location.range.end.character)),
                breakpoint.enabled,
                breakpoint.condition,
                breakpoint.hitCondition,
                breakpoint.logMessage);

            return bp;
        }

        if (breakpoint.functionName !== undefined) {
            const fbp = new vscode.FunctionBreakpoint(
                breakpoint.functionName,
                breakpoint.enabled,
                breakpoint.condition,
                breakpoint.hitCondition,
                breakpoint.logMessage);

            return fbp;
        }

        this.logger.writeError(`Unable to translate PSES breakpoint: ${JSON.stringify(breakpoint)}`);
        return undefined;
    }

    private toPsesBreakpoint(breakpoint: vscode.Breakpoint): IPsesBreakpoint {
        let psesLocation: IPsesLocation | undefined = undefined;
        if (breakpoint instanceof vscode.SourceBreakpoint) {
            psesLocation = {
                uri: breakpoint.location.uri.toString(),
                range: {
                    start: {
                        character: breakpoint.location.range.start.character,
                        line: breakpoint.location.range.start.line,
                    },
                    end: {
                        character: breakpoint.location.range.end.character,
                        line: breakpoint.location.range.end.line,
                    },
                },
            };
        }

        let functionName: string | undefined = undefined;
        if (breakpoint instanceof vscode.FunctionBreakpoint) {
            functionName = breakpoint.functionName;
        }

        return {
            id: breakpoint.id,
            enabled: breakpoint.enabled,
            condition: breakpoint.condition,
            hitCondition: breakpoint.hitCondition,
            logMessage: breakpoint.logMessage,
            location: psesLocation,
            functionName,
        };
    }

    dispose(): void {
        this.eventRegistration?.dispose();
        this.notificationRegistration?.dispose();
        this.requestRegistration?.dispose();
    }
}
