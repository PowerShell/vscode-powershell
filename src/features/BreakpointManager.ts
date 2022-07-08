// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { LanguageClient } from "vscode-languageclient/node";
import { Range, NotificationType, RequestType } from "vscode-languageserver-protocol";
import { LanguageClientConsumer } from "../languageClientConsumer";

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
    private eventRegistration: vscode.Disposable;

    private notificationRegistration: vscode.Disposable;

    private requestRegistration: vscode.Disposable;

    public setLanguageClient(languageClient: LanguageClient): void {
        this.languageClient = languageClient;
        if (this.languageClient === undefined) {
            return;
        }

        this.requestRegistration = this.languageClient.onRequest(
            SetBreakpointRequestType,
            bp => {
                const clientBp: vscode.Breakpoint = this.toVSCodeBreakpoint(bp);
                vscode.debug.addBreakpoints([clientBp]);
                return clientBp.id;
            });

        this.notificationRegistration = this.languageClient.onNotification(
            BreakpointChangedNotificationType.method,
            (eventArgs) => this.handleServerBreakpointChanged(this.toVSCodeBreakpointsChanged(eventArgs)));

        this.eventRegistration = vscode.debug.onDidChangeBreakpoints(
            (eventArgs) => this.handleClientBreakpointChanged(eventArgs),
            this)
    }

    private handleServerBreakpointChanged(eventArgs: vscode.BreakpointsChangeEvent): void {
        vscode.debug.removeBreakpoints(eventArgs.removed);
    }

    private handleClientBreakpointChanged(eventArgs: vscode.BreakpointsChangeEvent): void {
        this.languageClient.sendNotification(
            BreakpointChangedNotificationType,
            this.toPsesBreakpointsChanged(eventArgs));
    }

    private toVSCodeBreakpointsChanged(eventArgs: IPsesBreakpointChangedEventArgs): vscode.BreakpointsChangeEvent {
        const map: Map<string, vscode.Breakpoint> = new Map<string, vscode.Breakpoint>(
            vscode.debug.breakpoints.map(bp => [bp.id, bp]));

        return {
            added: eventArgs.added.map((bp) => this.toVSCodeBreakpoint(bp, map)),
            removed: eventArgs.removed.map((bp) => this.toVSCodeBreakpoint(bp, map)),
            changed: eventArgs.changed.map((bp) => this.toVSCodeBreakpoint(bp, map)),
        };
    }

    private toPsesBreakpointsChanged(eventArgs: vscode.BreakpointsChangeEvent): IPsesBreakpointChangedEventArgs {
        return {
            added: eventArgs.added.map((bp) => this.toPsesBreakpoint(bp)),
            removed: eventArgs.removed.map((bp) => this.toPsesBreakpoint(bp)),
            changed: eventArgs.changed.map((bp) => this.toPsesBreakpoint(bp)),
        };
    }

    private toVSCodeBreakpoint(breakpoint: IPsesBreakpoint, map?: Map<string, vscode.Breakpoint>): vscode.Breakpoint {
        const existing: vscode.Breakpoint = map?.get(breakpoint.id);
        if (existing) {
            return existing;
        }

        if (breakpoint.location !== null && breakpoint.location !== undefined) {
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

        if (breakpoint.functionName !== null && breakpoint.functionName !== undefined) {
            const fbp = new vscode.FunctionBreakpoint(
                breakpoint.functionName,
                breakpoint.enabled,
                breakpoint.condition,
                breakpoint.hitCondition,
                breakpoint.logMessage);

            return fbp;
        }

        return undefined;
    }

    private toPsesBreakpoint(breakpoint: vscode.Breakpoint): IPsesBreakpoint {
        const location = (breakpoint as vscode.SourceBreakpoint).location;
        let psesLocation: IPsesLocation;
        if (location !== null && location !== undefined) {
            psesLocation = {
                uri: location.uri.toString(),
                range: {
                    start: {
                        character: location.range.start.character,
                        line: location.range.start.line,
                    },
                    end: {
                        character: location.range.end.character,
                        line: location.range.end.line,
                    },
                },
            };
        }

        const functionName = (breakpoint as vscode.FunctionBreakpoint).functionName;
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
