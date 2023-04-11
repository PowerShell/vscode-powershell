// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import structuredClone from "@ungap/structured-clone"; //Polyfill for structuredClone which will be present in Node 17.
import * as assert from "assert";
import Sinon from "sinon";
import { DebugAdapterNamedPipeServer, DebugConfiguration, DebugSession, Extension, ExtensionContext, Range, SourceBreakpoint, TextDocument, TextEditor, Uri, commands, debug, extensions, window, workspace } from "vscode";
import { Disposable } from "vscode-languageserver-protocol";
import { DebugConfig, DebugSessionFeature, defaultDebugConfigurations } from "../../src/features/DebugSession";
import { IPowerShellExtensionClient } from "../../src/features/ExternalApi";
import * as platform from "../../src/platform";
import { IPlatformDetails } from "../../src/platform";
import { IEditorServicesSessionDetails, IPowerShellVersionDetails, SessionManager, SessionStatus } from "../../src/session";
import * as utils from "../../src/utils";
import { BuildBinaryModuleMock, WaitEvent, ensureEditorServicesIsConnected, stubInterface, testLogger } from "../utils";

const TEST_NUMBER = 7357; //7357 = TEST. Get it? :)

let defaultDebugConfig: DebugConfiguration;
beforeEach(() => {
    // This prevents state from creeping into the template between test runs
    defaultDebugConfig = structuredClone(defaultDebugConfigurations[DebugConfig.LaunchCurrentFile]);
});

describe("DebugSessionFeature", () => {
    // These constructor stubs are required for all tests so we don't interfere with the E2E vscode instance
    let registerProviderStub: Sinon.SinonStub;
    let registerFactoryStub: Sinon.SinonStub;

    /**
     * Convenience function for creating a DebugSessionFeature with stubbed dependencies. We want the actual methods and Sinon.stubInstance is awkward because it stubs all methods and the constructor, and we just want to stub the constructor basically.
     */
    function createDebugSessionFeatureStub({
        context = stubInterface<ExtensionContext>({
            subscriptions: Array<Disposable>() //Needed for constructor
        }),
        sessionManager = Sinon.createStubInstance(SessionManager),
        logger = testLogger
    }): DebugSessionFeature {
        return new DebugSessionFeature(context, sessionManager, logger);
    }

    /** Representation of an untitled powershell document window in the Editor */
    const untitledEditor = stubInterface<TextEditor>({
        document: stubInterface<TextDocument>({
            uri: Uri.parse("file:///fakeUntitled.ps1"),
            languageId: "powershell",
            isUntitled: true
        })
    });

    beforeEach(() => {
        registerProviderStub = Sinon.stub(debug, "registerDebugConfigurationProvider").returns(Disposable.create(() => {"Stubbed";}));
        registerFactoryStub = Sinon.stub(debug, "registerDebugAdapterDescriptorFactory").returns(Disposable.create(() => {"Stubbed";}));
    });

    afterEach(() => {
        Sinon.restore();
    });
    describe("Constructor", () => {
        it("Registers debug configuration provider and factory", () => {
            const context = stubInterface<ExtensionContext>({
                subscriptions: Array<Disposable>()
            });

            createDebugSessionFeatureStub({context: context});

            assert.ok(registerFactoryStub.calledOnce, "Debug adapter factory method called");
            assert.ok(registerProviderStub.calledOnce, "Debug config provider method called");
            assert.equal(context.subscriptions.length, 2, "DebugSessionFeature disposables populated");
            // TODO: Validate the registration content, such as the language name
        });
    });

    describe("resolveDebugConfiguration", () => {
        it("Defaults to LaunchCurrentFile if no request type was specified", async () => {
            const noRequestConfig: DebugConfiguration = defaultDebugConfig;
            noRequestConfig.request = "";
            // Need to have an editor window "open" for this not to error out
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfiguration(undefined, noRequestConfig);

            assert.equal(actual!.current_document, true);
            assert.equal(actual!.request, defaultDebugConfigurations[DebugConfig.LaunchCurrentFile].request);
        });

        it("Errors if current file config was specified but no file is open in the editor", async () => {
            Sinon.stub(window, "activeTextEditor").value(undefined);
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfiguration(undefined, defaultDebugConfig);

            assert.equal(actual!, undefined);
            assert.match(logger.writeAndShowError.firstCall.args[0], /you must first open a PowerShell script file/);
        });

        it("Detects an untitled document", async () => {
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfiguration(undefined, defaultDebugConfig);

            assert.equal(actual!.untitled_document, true);
            assert.equal(actual!.script, "file:///fakeUntitled.ps1");
        });
    });

    describe("resolveDebugConfigurationWithSubstitutedVariables", () => {
        it("Sets internalConsoleOptions to neverOpen", async () => {
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, defaultDebugConfig);

            assert.equal(actual!.internalConsoleOptions, "neverOpen");
        });
        it("Rejects invalid request type", async () => {
            const invalidRequestConfig: DebugConfiguration = defaultDebugConfig;
            invalidRequestConfig.request = "notAttachOrLaunch";
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, invalidRequestConfig);

            assert.equal(actual, null);
            assert.match(logger.writeAndShowError.firstCall.args[0], /request type was invalid/);
        });

        it("Uses createTemporaryIntegratedConsole config setting if not explicitly specified", async () => {
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);
            assert.equal(defaultDebugConfig.createTemporaryIntegratedConsole, undefined, "Default config should have no temp integrated console setting");

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, defaultDebugConfig);

            assert.notEqual(actual!.createTemporaryIntegratedConsole, undefined, "createTemporaryIntegratedConsole should have received a value from the settings and no longer be undefined");
        });

        it("LaunchCurrentFile: Rejects non-Powershell language active editor", async () => {
            const nonPSEditor = stubInterface<TextEditor>({
                document: stubInterface<TextDocument>({
                    uri: Uri.parse("file:///fakeUntitled.ps1"),
                    languageId: "NotPowerShell",
                    isUntitled: true
                })
            });
            const currentDocConfig: DebugConfiguration = defaultDebugConfig;
            currentDocConfig.current_document = true;
            Sinon.stub(window, "activeTextEditor").value(nonPSEditor);
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, currentDocConfig);

            assert.equal(actual, undefined, "Debug session should end");
            assert.match(logger.writeAndShowError.firstCall.args[0], /debugging this language mode/);
        });

        it("LaunchScript: Rejects scripts without a powershell script extension", async () => {
            const currentDocConfig: DebugConfiguration = defaultDebugConfig;
            currentDocConfig.current_document = true;
            currentDocConfig.script = "file:///notPowerShell.txt";
            // This check is currently dependent on the languageID check which is why this is needed still
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);
            Sinon.stub(utils, "checkIfFileExists").resolves(true);
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, currentDocConfig);

            assert.equal(actual, undefined);
            assert.match(logger.writeAndShowError.firstCall.args[0], /debugging this file type/);
        });

        it("Prevents debugging untitled files in a temp console", async () => {
            const currentDocConfig: DebugConfiguration = defaultDebugConfig;
            currentDocConfig.untitled_document = true;
            currentDocConfig.createTemporaryIntegratedConsole = true;
            Sinon.stub(window, "activeTextEditor").value(untitledEditor);
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, currentDocConfig);

            assert.equal(actual, undefined);
            assert.match(logger.writeAndShowError.firstCall.args[0], /debugging untitled/);
        });

        it("Attach: Exits if session version details cannot be retrieved", async () =>  {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            const logger = Sinon.stub(testLogger);
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            sessionManager.getPowerShellVersionDetails.returns(undefined);

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual, undefined);
            assert.match(logger.writeAndShowError.firstCall.args[0], /session version details were not found/);
            assert.ok(sessionManager.getPowerShellVersionDetails.calledOnce);
        });

        it("Attach: Prevents attach on non-windows if not PS7.0 or higher", async() => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            const logger = Sinon.stub(testLogger);
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            Sinon.stub(platform, "getPlatformDetails").returns(
                stubInterface<IPlatformDetails>({
                    operatingSystem: platform.OperatingSystem.MacOS
                })
            );
            sessionManager.getPowerShellVersionDetails.returns(
                stubInterface<IPowerShellVersionDetails>({
                    version: "6.2.3"
                })
            );

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual, undefined);
            assert.match(logger.writeAndShowError.firstCall.args[0], /requires PowerShell 7/);
            assert.ok(sessionManager.getPowerShellVersionDetails.calledOnce);
        });

        it("Attach: Prompts for PS Process if not specified", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            // This effectively skips this check
            attachConfig.runspaceId = TEST_NUMBER;
            attachConfig.runspaceName = "TEST";
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            sessionManager.getPowerShellVersionDetails.returns(
                stubInterface<IPowerShellVersionDetails>({
                    version: "7.2.3"
                })
            );
            const executeCommandStub = Sinon.stub(commands, "executeCommand").resolves(7357);

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual!.processId, TEST_NUMBER);
            assert.ok(executeCommandStub.calledOnceWith("PowerShell.PickPSHostProcess"));
        });

        it("Attach: Exits if process was not selected from the picker", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            // This effectively skips this check
            attachConfig.runspaceId = TEST_NUMBER;
            attachConfig.runspaceName = "TEST";
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            sessionManager.getPowerShellVersionDetails.returns(
                stubInterface<IPowerShellVersionDetails>({
                    version: "7.2.3"
                })
            );
            const executeCommandStub = Sinon.stub(commands, "executeCommand").resolves(undefined);

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual, undefined);
            assert.ok(executeCommandStub.calledOnceWith("PowerShell.PickPSHostProcess"));
        });

        it("Attach: Prompts for Runspace if not specified", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            // This effectively skips this check
            attachConfig.processId = TEST_NUMBER;
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            sessionManager.getPowerShellVersionDetails.returns(
                stubInterface<IPowerShellVersionDetails>({
                    version: "7.2.3"
                })
            );
            const executeCommandStub = Sinon.stub(commands, "executeCommand").resolves(TEST_NUMBER);

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual!.runspaceId, TEST_NUMBER);
            assert.ok(executeCommandStub.calledOnceWith("PowerShell.PickRunspace", TEST_NUMBER));
        });

        it("Attach: Exits if runspace was not selected from the picker", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.request = "attach";
            // This effectively skips this check
            attachConfig.processId = TEST_NUMBER;
            const sessionManager = Sinon.createStubInstance(SessionManager, {});
            sessionManager.getPowerShellVersionDetails.returns(
                stubInterface<IPowerShellVersionDetails>({
                    version: "7.2.3"
                })
            );
            const executeCommandStub = Sinon.stub(commands, "executeCommand").resolves(undefined);

            const actual = await createDebugSessionFeatureStub({
                sessionManager: sessionManager
            }).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);
            assert.equal(actual, undefined);
            assert.ok(executeCommandStub.calledOnceWith("PowerShell.PickRunspace", TEST_NUMBER));
        });

        it("Starts dotnet attach debug session with default config", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.script = "test.ps1"; // This bypasses the ${file} logic
            attachConfig.createTemporaryIntegratedConsole = true;
            attachConfig.attachDotnetDebugger = true;
            Sinon.stub(extensions, "getExtension").returns(
                stubInterface<Extension<IPowerShellExtensionClient>>()
            );

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            const dotnetAttachConfig = actual!.dotnetAttachConfig;
            assert.equal(dotnetAttachConfig.name, "Dotnet Debugger: Temporary Extension Terminal");
            assert.equal(dotnetAttachConfig.request, "attach");
            assert.equal(dotnetAttachConfig.type, "coreclr");
            assert.equal(dotnetAttachConfig.processId, undefined);
            assert.equal(dotnetAttachConfig.logging.moduleLoad, false);
        });

        it("Prevents dotnet attach session if terminal is not temporary", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.script = "test.ps1"; // This bypasses the ${file} logic
            attachConfig.attachDotnetDebugger = true;
            const logger = Sinon.stub(testLogger);

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual!, null);
            assert.match(logger.writeAndShowError.firstCall.args[0], /dotnet debugging without using a temporary console/);
        });

        it("Errors if dotnetDebuggerConfigName was provided but the config was not found", async () => {
            const attachConfig: DebugConfiguration = defaultDebugConfig;
            attachConfig.script = "test.ps1"; // This bypasses the ${file} logic
            attachConfig.createTemporaryIntegratedConsole = true;
            attachConfig.attachDotnetDebugger = true;
            attachConfig.dotnetDebuggerConfigName = "not a real config";
            const logger = Sinon.stub(testLogger);
            Sinon.stub(extensions, "getExtension").returns(
                stubInterface<Extension<IPowerShellExtensionClient>>()
            );

            const actual = await createDebugSessionFeatureStub({}).resolveDebugConfigurationWithSubstitutedVariables(undefined, attachConfig);

            assert.equal(actual!, null);
            assert.match(logger.writeAndShowError.firstCall.args[0], /matching launch config was not found/);
        });
    });

    describe("createDebugAdapterDescriptor", () => {
        it("Creates a named pipe server for the debug adapter", async () => {
            const debugSessionFeature = createDebugSessionFeatureStub({
                sessionManager: Sinon.createStubInstance(SessionManager, {
                    getSessionStatus: SessionStatus.Running,
                    getSessionDetails: stubInterface<IEditorServicesSessionDetails>({
                        debugServicePipeName: "testPipeName"
                    })
                }),
            });
            const debugSession = stubInterface<DebugSession>({
                configuration: stubInterface<DebugConfiguration>({
                    createTemporaryIntegratedConsole: false
                })
            });

            const debugAdapterDescriptor = await debugSessionFeature.createDebugAdapterDescriptor(debugSession, undefined);

            // Confirm debugAdapterDescriptor is of type debugadapternamedpipeserver
            assert.ok(debugAdapterDescriptor instanceof DebugAdapterNamedPipeServer);
            assert.equal(debugAdapterDescriptor.path, "testPipeName");
        });
    });
});

describe("DebugSessionFeature E2E", function slowTests() {
    this.slow(20000); // Will warn if test takes longer than 10s and show red if longer than 20s

    if (process.platform == "darwin") {
        this.timeout(60000); // The MacOS test runner is sloooow in Azure Devops
    }
    before(async () => {
        // Registers and warms up the debug adapter and the PowerShell Extension Terminal
        await ensureEditorServicesIsConnected();
    });

    it("Starts and stops a debugging session", async () => {
        // Inspect the debug session via the started events to ensure it is correct
        let startDebugSession: DebugSession;
        let stopDebugSession: DebugSession;
        const interactiveSessionConfig = defaultDebugConfigurations[DebugConfig.InteractiveSession];
        // Asserts dont seem to fire in this event or the event doesnt resolve in the test code flow, so we need to "extract" the values for later use by the asserts

        const startDebugEvent = debug.onDidStartDebugSession((newDebugSession) => {
            startDebugEvent.dispose();
            startDebugSession = newDebugSession;
            const stopDebugEvent = debug.onDidTerminateDebugSession((terminatedDebugSession) => {
                stopDebugEvent.dispose();
                stopDebugSession = terminatedDebugSession;
            });
        });

        const debugSessionStarted = await debug.startDebugging(undefined, interactiveSessionConfig);
        assert.ok(debugSessionStarted, "Debug session should start");
        assert.equal(startDebugSession!.name, interactiveSessionConfig.name, "Debug session name should match when started");
        // debugSession var should be populated from the event before startDebugging completes
        await debug.stopDebugging(startDebugSession!);

        assert.equal(stopDebugSession!.name, interactiveSessionConfig.name, "Debug session name should match when stopped");
        assert.equal(stopDebugSession!.configuration.internalConsoleOptions, "neverOpen", "Debug session should always have neverOpen internalConsoleOptions");
        assert.ok(stopDebugSession!, "Debug session should stop");
    });

    describe("Binary Modules", () => {
        before(async () => {
            BuildBinaryModuleMock();
            await ensureEditorServicesIsConnected();
        });
        afterEach(async () => {
            // Cleanup E2E testing state
            await debug.stopDebugging(undefined);
        });

        it("Debugs a binary module script", async () => {
            const launchScriptConfig = structuredClone(defaultDebugConfigurations[DebugConfig.LaunchScript]);
            launchScriptConfig.script = "../examples/BinaryModule/BinaryModuleTest.ps1";
            launchScriptConfig.attachDotnetDebugger = true;
            launchScriptConfig.createTemporaryIntegratedConsole = true;
            const startDebugging = Sinon.spy(debug, "startDebugging");

            const debugStarted = await debug.startDebugging(undefined, launchScriptConfig);
            assert.ok(debugStarted);
            const debugStopped = await debug.stopDebugging(undefined);
            assert.ok(debugStopped);

            assert.ok(startDebugging.calledTwice);
            assert.ok(startDebugging.calledWith(undefined, launchScriptConfig));
            // The C# child process
            assert.ok(startDebugging.calledWithMatch(
                undefined,
                Sinon.match.has("type", "coreclr"), // The new child debugger
                Sinon.match.has("type", "PowerShell") // The parent session
            ), "The C# debugger child process is created with the PowerShell debugger as the parent");
        });

        it("Stops at a binary module breakpoint", async () => {
            const launchScriptConfig = structuredClone(defaultDebugConfigurations[DebugConfig.LaunchCurrentFile]);
            launchScriptConfig.attachDotnetDebugger = true;
            launchScriptConfig.createTemporaryIntegratedConsole = true;
            const testScriptPath = Uri.joinPath(workspace.workspaceFolders![0].uri, "mocks/BinaryModule/BinaryModuleTest.ps1");
            const cmdletSourcePath = Uri.joinPath(workspace.workspaceFolders![0].uri, "mocks/BinaryModule/TestSampleCmdletCommand.cs");
            const testScriptDocument = await workspace.openTextDocument(testScriptPath);
            await window.showTextDocument(testScriptDocument);

            // We cant see when a breakpoint is hit because the code we would spy on is in the C# extension or is vscode private, but we can see if the debug session changes which should only happen when the debug session context switches to C#, so that's good enough.

            //We wire this up before starting the debug session so the event is registered
            const dotnetDebugSessionActive = WaitEvent(debug.onDidChangeActiveDebugSession, (session) => {
                console.log(`Debug Session Changed: ${session?.name}`);
                return !!session?.name.match(/Dotnet Debugger/);
            });

            // Break at beginProcessing of the cmdlet
            debug.addBreakpoints([
                new SourceBreakpoint({
                    uri: cmdletSourcePath,
                    range: new Range(26, 0, 26, 0) //BeginProcessing
                }, true, undefined, undefined, "TEST-BinaryModuleBreakpoint")
            ]);

            const debugStarted = await debug.startDebugging(undefined, launchScriptConfig);
            console.log(debug.breakpoints);
            const dotnetDebugSession = await dotnetDebugSessionActive;
            console.log(debug.activeDebugSession);
            console.log(debug.breakpoints);
            const debugStopped = await debug.stopDebugging(undefined);

            assert.ok(debugStarted);
            assert.ok(dotnetDebugSession);
            assert.ok(debugStopped);
        });
    });
});
