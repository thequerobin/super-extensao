// Removed: the legacy HTTP token nudge retried outside session guards.
// VPN credentials are supplied only to the verified current proxy challenge.
export const transmitCredentialsToProxy = (_host: string, _username: string | undefined, _password: string | undefined): void => {};
