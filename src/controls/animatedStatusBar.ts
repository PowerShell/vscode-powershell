// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    Disposable,
    StatusBarAlignment,
    StatusBarItem,
    ThemeColor,
    window,
    Command,
    AccessibilityInformation} from "vscode";

export function showAnimatedStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable {
    const animatedStatusBarItem: AnimatedStatusBarItem = new AnimatedStatusBarItem(text);
    animatedStatusBarItem.show(hideWhenDone);
    return animatedStatusBarItem;
}

class AnimatedStatusBarItem implements StatusBarItem {
    private readonly animationRate: number;
    private statusBarItem: StatusBarItem;
    private maxCount: number;
    private counter: number;
    private baseText: string;
    private timerInterval: number;
    private elapsedTime: number;
    private intervalId: NodeJS.Timer;
    private suffixStates: string[];

    public get id(): string {
        return this.statusBarItem.id;
    }

    public get name(): string {
        return this.statusBarItem.name;
    }

    public get accessibilityInformation(): AccessibilityInformation {
        return this.statusBarItem.accessibilityInformation;
    }

    public get alignment(): StatusBarAlignment {
        return this.statusBarItem.alignment;
    }

    public get priority(): number {
        return this.statusBarItem.priority;
    }

    public get text(): string {
        return this.statusBarItem.text;
    }

    public set text(value: string) {
        this.statusBarItem.text = value;
    }

    public get tooltip(): string {
        return this.statusBarItem.tooltip.toString();
    }

    public set tooltip(value: string) {
        this.statusBarItem.tooltip = value;
    }

    public get color(): string | ThemeColor {
        return this.statusBarItem.color;
    }

    public set color(value: string | ThemeColor) {
        this.statusBarItem.color = value;
    }

    public get backgroundColor(): string | ThemeColor {
        return this.statusBarItem.backgroundColor;
    }

    public set backgroundColor(value: string | ThemeColor) {
        this.statusBarItem.backgroundColor = value;
    }

    public get command(): string | Command {
        return this.statusBarItem.command;
    }

    public set command(value: string | Command) {
        this.statusBarItem.command = value;
    }

    constructor(baseText: string, alignment?: StatusBarAlignment, priority?: number) {
        this.animationRate = 1;
        this.statusBarItem = window.createStatusBarItem(alignment, priority);
        this.baseText = baseText;
        this.counter = 0;
        this.suffixStates = ["  ", ".  ", ".. ", "..."];
        this.maxCount = this.suffixStates.length;
        this.timerInterval = ((1 / this.maxCount) * 1000) / this.animationRate;
        this.elapsedTime = 0;
    }

    public show(hideWhenDone?: Thenable<any>): void {
        this.statusBarItem.show();
        this.start();
        if (hideWhenDone !== undefined) {
            hideWhenDone.then(() => this.hide());
        }
    }

    public hide(): void {
        this.stop();
        this.statusBarItem.hide();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }

    private updateCounter(): void {
        this.counter = (this.counter + 1) % this.maxCount;
        this.elapsedTime = this.elapsedTime + this.timerInterval;
    }

    private updateText(): void {
        this.text = this.baseText + this.suffixStates[this.counter];
    }

    private update(): void {
        this.updateCounter();
        this.updateText();
    }

    private reset(): void {
        this.counter = 0;
        this.updateText();
    }

    private  start(): void {
        this.reset();
        this.intervalId = setInterval(() => this.update(), this.timerInterval);
    }

    private stop(): void {
        clearInterval(this.intervalId);
    }
}
