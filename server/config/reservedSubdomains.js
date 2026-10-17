// Subdomains that belong to Lemida (or that people expect to be Lemida's) and so can never be a school's
// address. The one list for the whole server: super-admin school creation, self-service signup, a school
// renaming itself, the CLI scripts and the Tenant model all use it.
const RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin', 'content', 'exam', 'mail', 'ftp', 'cpanel',
  'webmail', 'support', 'help', 'status', 'blog', 'docs', 'staging', 'dev', 'test',
];

// Lemida's own internal tenants. They were created before this list existed (the super admin's platform
// tenant uses "admin") and keep their address; they are not schools and are never renamed.
const SYSTEM_TENANT_IDS = ['tenant_super_admin_platform'];

const reserved = new Set(RESERVED_SUBDOMAINS);

// Case-insensitive, ignores surrounding spaces. Anything that is not text is not a reserved name.
function isReservedSubdomain(value) {
  return typeof value === 'string' && reserved.has(value.trim().toLowerCase());
}

function reservedSubdomainMessage(value) {
  return `"${String(value).trim().toLowerCase()}" is reserved for Lemida and cannot be used as a school address. Please choose a different subdomain.`;
}

module.exports = { RESERVED_SUBDOMAINS, SYSTEM_TENANT_IDS, isReservedSubdomain, reservedSubdomainMessage };
