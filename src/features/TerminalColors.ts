/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { Disposable, LanguageClient } from "vscode-languageclient";
import { IFeature } from "../feature";
import Settings = require("../settings");

function setTerminalColors(workspace, colorCustomizations, backgroundColor, foregroundColor) {
    let colors = JSON.parse(JSON.stringify(colorCustomizations));
    colors = Object.assign(
        colors, {"terminal.background": backgroundColor, "terminal.foreground": foregroundColor},
    );

    return workspace.update(
        "workbench.colorCustomizations",
        colors,
        true,
    );
}

export class TerminalColorsFeature implements IFeature {
    private settings: Settings.ISettings;
    private disposable: Disposable;
    constructor() {
        this.settings = Settings.load();
        const workspace = vscode.workspace.getConfiguration();
        const colorCustomizations = vscode.workspace.getConfiguration("workbench.colorCustomizations");

        switch (this.settings.terminalColorTheme) {
            case "Core": {
                setTerminalColors(workspace, colorCustomizations, "#141A25", "#F5F5F5");
                return;
            }
            case "Desktop": {
                setTerminalColors(workspace, colorCustomizations, "#012456", "#F5F5F5");
                return;
            }
            case "None": {
                setTerminalColors(workspace, colorCustomizations, undefined, undefined);
                return;
            }
        }
    }

    public setLanguageClient(languageclient: LanguageClient) {
        // Eliminate tslint warning
    }

    public dispose() {
        this.disposable.dispose();
    }
}
