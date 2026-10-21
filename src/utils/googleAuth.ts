// Google Identity Services (GIS) Utility & JWT Decoder

export interface GoogleJwtPayload {
  iss?: string;
  sub?: string;
  azp?: string;
  aud?: string;
  email: string;
  email_verified?: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat?: number;
  exp?: number;
}

/**
 * Safely parse a JWT string without external libraries
 */
export function parseGoogleJwt(token: string): GoogleJwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to parse Google JWT token:', err);
    return null;
  }
}

/**
 * Check if the Google Identity Services SDK is loaded on window
 */
export function isGoogleGsiAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).google?.accounts?.id;
}
