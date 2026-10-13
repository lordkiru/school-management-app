// Hosting platform domains (vercel.app, onrender.com, etc.) are not real school subdomains,
// so on those we report no subdomain and the server falls back to its global lookup.
const HOSTING_DOMAINS = ['vercel.app', 'onrender.com', 'netlify.app', 'railway.app', 'localhost'];

// "www" and "app" are the app's own domain prefixes (e.g. app.lemidaitsolutions.com is the main
// app, not a school), never a real tenant subdomain. Without this, every login there 404s on a
// nonexistent "app" tenant before the password is ever checked.
const RESERVED_SUBDOMAINS = ['www', 'app'];

// Tenant subdomain for tenant-scoped auth requests (login, forgot-password).
// e.g. "greenfield.yourdomain.com" -> "greenfield". Returns '' when there isn't one.
// `hostname` is a parameter only so this can be tested without a browser.
export function getTenantSubdomain(hostname = window.location.hostname) {
  const parts = hostname.split('.');
  const isHostingDomain = HOSTING_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
  return (!isHostingDomain && parts.length >= 3 && !RESERVED_SUBDOMAINS.includes(parts[0])) ? parts[0] : '';
}
