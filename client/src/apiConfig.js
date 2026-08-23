// Central API URL configuration.
// Fails loudly at startup if VITE_API_URL is missing, instead of silently
// producing "undefined/..." request URLs that break every API call.
const configuredUrl = import.meta.env.VITE_API_URL;

if (!configuredUrl) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ VITE_API_URL is not set. Create client/.env (see client/.env.example) ' +
      'and restart the dev server. All API requests will fail until this is fixed.'
  );
}

export const API_URL = configuredUrl || '';