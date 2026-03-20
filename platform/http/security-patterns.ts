// Shared security patterns used by both security filter and HTTP logging
export const BLOCKED_PATTERNS = [
  // WordPress scanning attempts
  /\/wp-includes\/wlwmanifest\.xml$/,
  /\/xmlrpc\.php(\?rsd)?$/,
  /\/wp-admin\//,
  /\/wp-content\//,
  /\/wp-json\//,
  /\/wordpress\//,
  /\/wp\d*\//,
  /\/blog\/wp-/,
  /\/web\/wp-/,
  /\/website\/wp-/,
  /\/news\/wp-/,
  /\/shop\/wp-/,
  /\/test\/wp-/,
  /\/media\/wp-/,
  /\/site\/wp-/,
  /\/cms\/wp-/,
  /\/sito\/wp-/,

  // Common attack vectors
  /\/\.env$/,
  /\/\.git\//,
  /\/phpmyadmin\//,
  /\/phpMyAdmin\//,
  /\/mysql\//,
  /\/sql\//,

  // Common scanner files
  /\/robots\.txt$/,
  /\/sitemap\.xml$/,

  // Development/metadata endpoints
  /\/developmentserver\/metadatauploader/,

  // Suspicious PHP files
  /\/[^/]*\.php$/,
  /\/bby\.php$/,
  /\/shell\.php$/,
  /\/upload\.php$/,
  /\/backdoor\.php$/,

  // Year-based WordPress paths (common in scans)
  /\/20\d{2}\/wp-/,

  // Common CMS paths
  /\/drupal\//,
  /\/joomla\//,
  /\/magento\//,
  /\/prestashop\//,
];

// User agents commonly used by scanners/bots to block
export const BLOCKED_USER_AGENTS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scanner/i,
  /python/i,
  /java/i,
  /perl/i,
  /masscan/i,
  /nmap/i,
  /zmap/i,
  /sqlmap/i,
  /nikto/i,
  /dirb/i,
  /gobuster/i,
  /dirbuster/i,
];

export function isBlockedUrl(url: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(url));
}

export function isBlockedUserAgent(userAgent: string): boolean {
  return BLOCKED_USER_AGENTS.some(pattern => pattern.test(userAgent));
}
