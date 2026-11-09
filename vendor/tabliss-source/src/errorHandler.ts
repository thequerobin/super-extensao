import { init, captureException, setTag } from "@sentry/browser";

export function register() {
  init({
    autoSessionTracking: false, // Wtf sentry
    dsn: "", // Super Extensão: no remote error reporting.
    enabled: false, // Super Extensão: no remote error reporting.
    release: VERSION,
  });
  setTag("target", BUILD_TARGET);
}

export function capture(error: Error) {
  if (error.stack) {
    // Replace firefox extension URLs
    error.stack = error.stack.replace(
      /moz-extension:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      "resource://tabliss-extension",
    );

    // Replace chrome extension URLs
    error.stack = error.stack.replace(
      /chrome-extension:\/\/hipekcciheckooncpjeljhnekcoolahp/g,
      "resource://tabliss-extension",
    );
  }

  captureException(error);
}
