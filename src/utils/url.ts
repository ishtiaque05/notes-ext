/**
 * URL and Domain utilities for Notes Collector extension
 */

/**
 * Checks if a URL is disabled based on its domain or parent domains
 * @param url The URL to check
 * @param disabledDomains Array of disabled hostnames
 * @returns true if the URL or any of its parent domains are in the disabled list
 */
export function isUrlDisabled(url: string, disabledDomains: string[]): boolean {
    if (!url || !disabledDomains || disabledDomains.length === 0) return false;

    try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'about:' || urlObj.protocol === 'chrome:' || urlObj.protocol === 'moz-extension:') {
            return true;
        }

        const hostname = urlObj.hostname;
        const parts = hostname.split('.');

        // Check the exact hostname and all parent domains (except the TLD)
        // For gist.github.com, check: gist.github.com, github.com
        for (let i = 0; i <= parts.length - 2; i++) {
            const domainToCheck = parts.slice(i).join('.');
            if (disabledDomains.includes(domainToCheck)) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Extracts the hostname from a URL string
 * @param url The URL string
 * @returns The hostname or an empty string if invalid
 */
export function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}
