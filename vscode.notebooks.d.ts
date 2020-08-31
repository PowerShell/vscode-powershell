/*
This file contains types introduced in a newer version of vscode than 1.45 that are used by the Notebook Mode feature.

We are locked on to 1.45 because that is what SAWs support.

Once SAWs support a newer version of vscode we can remove this. My hope is that this will be the only addition to this file.
*/

declare module 'vscode' {
  /**
	 * Accessibility information which controls screen reader behavior.
	 */
	export interface AccessibilityInformation {
		/**
		 * Label to be read out by a screen reader once the item has focus.
		 */
		label: string;

		/**
		 * Role of the widget which defines how a screen reader interacts with it.
		 * The role should be set in special cases when for example a tree-like element behaves like a checkbox.
		 * If role is not specified VS Code will pick the appropriate role automatically.
		 * More about aria roles can be found here https://w3c.github.io/aria/#widget_roles
		 */
		role?: string;
	}
}
