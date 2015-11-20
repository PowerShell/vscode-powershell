import { RequestType, NotificationType, ResponseError } from 'vscode-jsonrpc';

export namespace ShowOnlineHelpRequest {
	export const type: RequestType<string, void, void> = { get method() { return 'showonlinehelp'; } };
}