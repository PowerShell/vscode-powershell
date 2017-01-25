/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
    StatusBarItem,
    StatusBarAlignment,
    Disposable,
    window} from "vscode";

export function setAnimatedStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable {
    let animatedStatusBarItem: AnimatedStatuBarItem = new AnimatedStatuBarItem(text);
    animatedStatusBarItem.show(hideWhenDone);
    return animatedStatusBarItem;
}

class AnimatedStatuBarItem implements StatusBarItem {
    private readonly animationRate: number;
    private statusBarItem: StatusBarItem;
    private maxCount: number;
    private counter: number;
    private baseText: string;
    private timerInterval: number;
    private elapsedTime: number;
    private intervalId: NodeJS.Timer;
    private suffixStates: string[];

    get alignment(): StatusBarAlignment {
        return this.statusBarItem.alignment;
    }

    get priority(): number {
        return this.statusBarItem.priority;
    }

    get text(): string {
        return this.statusBarItem.text;
    }

    set text(value: string) {
        this.statusBarItem.text = value;
    }

    get tooltip(): string {
        return this.statusBarItem.tooltip;
    }

    set tooltip(value: string) {
        this.statusBarItem.tooltip = value;
    }

    get color(): string {
        return this.statusBarItem.color;
    }

    set color(value: string) {
        this.statusBarItem.color = value;
    }

    get command(): string {
        return this.statusBarItem.command;
    }

    set command(value: string) {
        this.statusBarItem.command = value;
    }

    constructor(baseText: string, alignment?: StatusBarAlignment, priority?: number) {
        this.animationRate = 1;
        this.statusBarItem = window.createStatusBarItem(alignment, priority);
        this.baseText = baseText;
        this.counter = 0;
        this.suffixStates = ["  ", ".  ", ".. ", "..."];
        this.maxCount = this.suffixStates.length;
        this.timerInterval = ((1/this.maxCount) * 1000) / this.animationRate;
        this.elapsedTime = 0;
    }

    show(hideWhenDone?: Thenable<any>): void {
        this.statusBarItem.show();
        this._start();
        if (hideWhenDone !== undefined) {
            hideWhenDone.then(() => this.hide());
        }
    }

    hide(): void {
        this._stop();
        this.statusBarItem.hide();
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }

    _updateCounter(): void {
        this.counter = (this.counter + 1) % this.maxCount;
        this.elapsedTime = this.elapsedTime + this.timerInterval;
    }

    _updateText(): void {
        this.text = this.baseText + this.suffixStates[this.counter];
    }

    _update(): void {
        this._updateCounter();
        this._updateText();
    }

    _reset(): void {
        this.counter = 0;
        this._updateText();
    }

    _start(): void {
        this._reset();
        this.intervalId = setInterval(() => this._update(), this.timerInterval);
    }

    _stop(): void {
        clearInterval(this.intervalId);
    }
}