/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export class CustomViewsFeature implements IFeature {

    private commands: vscode.Disposable[] = [];
    private languageClient: LanguageClient;
    private contentProvider: PowerShellContentProvider;

    constructor() {
        this.contentProvider = new PowerShellContentProvider();
        this.commands.push(
            vscode.workspace.registerTextDocumentContentProvider(
                "powershell",
                this.contentProvider));
    }

    public setLanguageClient(languageClient: LanguageClient) {

        languageClient.onRequest(
            NewCustomViewRequest.type,
            args => {
                this.contentProvider.createView(
                    args.id,
                    args.title,
                    args.viewType);
            });

        languageClient.onRequest(
            ShowCustomViewRequest.type,
            args => {
                this.contentProvider.showView(
                    args.id,
                    args.viewColumn);
            });

        languageClient.onRequest(
            CloseCustomViewRequest.type,
            args => {
                this.contentProvider.closeView(args.id);
            });

        languageClient.onRequest(
            SetHtmlContentViewRequest.type,
            args => {
                this.contentProvider.setHtmlContentView(
                    args.id,
                    args.htmlBodyContent);
            });

        languageClient.onRequest(
            AppendHtmlOutputViewRequest.type,
            args => {
                this.contentProvider.appendHtmlOutputView(
                    args.id,
                    args.appendedHtmlBodyContent);
            });

        this.languageClient = languageClient;
    }

    public dispose() {
        this.commands.forEach(d => d.dispose());
    }
}

class PowerShellContentProvider implements vscode.TextDocumentContentProvider {

    private count: number = 1;
    private viewIndex: { [id: string]: CustomView } = {};
    private didChangeEvent: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.viewIndex[uri.toString()].getContent();
    }

    public createView(id: string, title: string, viewType: CustomViewType) {
        let view = undefined;
        switch (viewType) {
            case CustomViewType.HtmlContent:
                view = new HtmlContentView(id, title);
        };

        this.viewIndex[this.getUri(view.id)] = view;
    }

    public showView(id: string, viewColumn: vscode.ViewColumn) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        vscode.commands.executeCommand(
            "vscode.previewHtml",
            uriString,
            viewColumn,
            view.title);
    }

    public closeView(id: string) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        vscode.workspace.textDocuments.some(
            doc => {
                if (doc.uri.toString() === uriString) {
                    vscode.window
                        .showTextDocument(doc)
                        .then(editor => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))

                    return true;
                }

                return false;
            }
        )
    }

    public setHtmlContentView(id: string, content: string) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (<HtmlContentView>view).setContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    public appendHtmlOutputView(id: string, content: string) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (<HtmlContentView>view).appendContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    private getUri(id: string) {
        return `powershell://views/${id}`;
    }

    public onDidChange: vscode.Event<vscode.Uri> = this.didChangeEvent.event;
}

abstract class CustomView {

    constructor(
        public id: string,
        public title: string,
        public viewType: CustomViewType)
    {
    }

    abstract getContent(): string;
}

class HtmlContentView extends CustomView {

    private htmlContent: string = "";

    constructor(
        id: string,
        title: string)
    {
        super(id, title, CustomViewType.HtmlContent);
    }

    setContent(htmlContent: string) {
        this.htmlContent = htmlContent;
    }

    appendContent(content: string) {
        this.htmlContent += content;
    }

    getContent(): string {
        // Return an HTML page which disables JavaScript in content by default
        return `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src *; style-src 'self'; script-src 'none';"></head><body>${this.htmlContent}</body></html>`;
    }
}

enum CustomViewType {
    HtmlContent = 1,
}

namespace NewCustomViewRequest {
    export const type =
        new RequestType<NewCustomViewRequestArguments, void, void, void>(
            'powerShell/newCustomView');
}

interface NewCustomViewRequestArguments {
    id: string;
    title: string;
    viewType: CustomViewType;
}

namespace ShowCustomViewRequest {
    export const type =
        new RequestType<ShowCustomViewRequestArguments, void, void, void>(
            'powerShell/showCustomView');
}

interface ShowCustomViewRequestArguments {
    id: string;
    viewColumn: vscode.ViewColumn;
}

namespace CloseCustomViewRequest {
    export const type =
        new RequestType<CloseCustomViewRequestArguments, void, void, void>(
            'powerShell/closeCustomView');
}

interface CloseCustomViewRequestArguments {
    id: string;
}

namespace SetHtmlContentViewRequest {
    export const type =
        new RequestType<SetHtmlContentViewRequestArguments, void, void, void>(
            'powerShell/setHtmlViewContent');
}

interface SetHtmlContentViewRequestArguments {
    id: string;
    htmlBodyContent: string;
}

namespace AppendHtmlOutputViewRequest {
    export const type =
        new RequestType<AppendHtmlOutputViewRequestArguments, void, void, void>(
            'powerShell/appendHtmlViewContent');
}

interface AppendHtmlOutputViewRequestArguments {
    id: string;
    appendedHtmlBodyContent: string;
}
