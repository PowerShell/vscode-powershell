/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of VS Code.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {
declare module 'vscode' {

	//#region auth provider: https://github.com/microsoft/vscode/issues/88309

	/**
	 * An [event](#Event) which fires when an [AuthenticationProvider](#AuthenticationProvider) is added or removed.
	 */
	export interface AuthenticationProvidersChangeEvent {
		/**
		 * The ids of the [authenticationProvider](#AuthenticationProvider)s that have been added.
		 */
		readonly added: ReadonlyArray<AuthenticationProviderInformation>;

		/**
		 * The ids of the [authenticationProvider](#AuthenticationProvider)s that have been removed.
		 */
		readonly removed: ReadonlyArray<AuthenticationProviderInformation>;
	}

	/**
	* An [event](#Event) which fires when an [AuthenticationSession](#AuthenticationSession) is added, removed, or changed.
	*/
	export interface AuthenticationProviderAuthenticationSessionsChangeEvent {
		/**
		 * The ids of the [AuthenticationSession](#AuthenticationSession)s that have been added.
		*/
		readonly added: ReadonlyArray<string>;

		/**
		 * The ids of the [AuthenticationSession](#AuthenticationSession)s that have been removed.
		 */
		readonly removed: ReadonlyArray<string>;

		/**
		 * The ids of the [AuthenticationSession](#AuthenticationSession)s that have been changed.
		 */
		readonly changed: ReadonlyArray<string>;
	}

	/**
	 * A provider for performing authentication to a service.
	 */
	export interface AuthenticationProvider {
		/**
		 * An [event](#Event) which fires when the array of sessions has changed, or data
		 * within a session has changed.
		 */
		readonly onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;

		/**
		 * Returns an array of current sessions.
		 */
		// eslint-disable-next-line vscode-dts-provider-naming
		getSessions(): Thenable<ReadonlyArray<AuthenticationSession>>;

		/**
		 * Prompts a user to login.
		 */
		// eslint-disable-next-line vscode-dts-provider-naming
		login(scopes: string[]): Thenable<AuthenticationSession>;

		/**
		 * Removes the session corresponding to session id.
		 * @param sessionId The session id to log out of
		 */
		// eslint-disable-next-line vscode-dts-provider-naming
		logout(sessionId: string): Thenable<void>;
	}

	/**
	 * Options for creating an [AuthenticationProvider](#AuthentcationProvider).
	 */
	export interface AuthenticationProviderOptions {
		/**
		 * Whether it is possible to be signed into multiple accounts at once with this provider.
		 * If not specified, will default to false.
		*/
		readonly supportsMultipleAccounts?: boolean;
	}

	export namespace authentication {
		/**
		 * Register an authentication provider.
		 *
		 * There can only be one provider per id and an error is being thrown when an id
		 * has already been used by another provider. Ids are case-sensitive.
		 *
		 * @param id The unique identifier of the provider.
		 * @param label The human-readable name of the provider.
		 * @param provider The authentication provider provider.
		 * @params options Additional options for the provider.
		 * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
		 */
		export function registerAuthenticationProvider(id: string, label: string, provider: AuthenticationProvider, options?: AuthenticationProviderOptions): Disposable;

		/**
		 * @deprecated - getSession should now trigger extension activation.
		 * Fires with the provider id that was registered or unregistered.
		 */
		export const onDidChangeAuthenticationProviders: Event<AuthenticationProvidersChangeEvent>;

		/**
		 * An array of the information of authentication providers that are currently registered.
		 */
		export const providers: ReadonlyArray<AuthenticationProviderInformation>;

		/**
		* Logout of a specific session.
		* @param providerId The id of the provider to use
		* @param sessionId The session id to remove
		* provider
		*/
		export function logout(providerId: string, sessionId: string): Thenable<void>;
	}

	//#endregion
}
