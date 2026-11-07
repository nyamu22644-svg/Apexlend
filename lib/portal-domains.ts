export type Portal = 'customer' | 'staff';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Canonical public URLs for the two operational portals. */
export function getPortalUrl(portal: Portal): string | null {
  const value = portal === 'customer'
    ? process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL
    : process.env.NEXT_PUBLIC_STAFF_PORTAL_URL;
  if (!value) return null;

  try {
    return trimTrailingSlash(new URL(value).toString());
  } catch {
    return null;
  }
}

export function getPortalForCurrentHost(): Portal | null {
  if (typeof window === 'undefined') return null;
  const customerUrl = getPortalUrl('customer');
  const staffUrl = getPortalUrl('staff');

  try {
    const customerHost = customerUrl ? new URL(customerUrl).host : null;
    const staffHost = staffUrl ? new URL(staffUrl).host : null;

    // If both URLs intentionally point at localhost during development, keep
    // the QA switcher instead of treating localhost as a production portal.
    if (customerHost && customerHost === staffHost) return null;
    if (customerHost === window.location.host) return 'customer';
    if (staffHost === window.location.host) return 'staff';
  } catch {
    // A malformed deployment URL must never prevent the portal from loading.
  }
  return null;
}

export function isProductionPortalHost() {
  return getPortalForCurrentHost() !== null;
}

/** Navigate to the isolated portal. Local development keeps the in-app switcher. */
export function goToPortal(portal: Portal, localFallback: () => void) {
  const destination = getPortalUrl(portal);
  if (!destination || typeof window === 'undefined') return localFallback();
  if (new URL(destination).origin === window.location.origin) return localFallback();
  window.location.assign(destination);
}
