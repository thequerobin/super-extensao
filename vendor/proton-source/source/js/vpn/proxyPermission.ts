// Match the host permissions declared by the Super Extensão manifest.
// Requesting undeclared FTP/WebSocket origins prevents the login flow in Chromium.
export const proxyPermission: chrome.permissions.Permissions & browser.permissions.Permissions = {
	permissions: ['proxy'],
	origins: ['http://*/*', 'https://*/*'],
};
