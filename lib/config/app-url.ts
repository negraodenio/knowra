/**
 * Canonical published application URL configuration (§Publication URL)
 *
 * Canonical public production URL: https://knowra-vert.vercel.app
 * Allows override via NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_VERCEL_URL.
 */
export const CANONICAL_PUBLIC_URL = "https://knowra-vert.vercel.app";

export function getPublicAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const url = process.env.NEXT_PUBLIC_VERCEL_URL;
    return (url.startsWith("http") ? url : `https://${url}`).replace(/\/+$/, "");
  }
  return CANONICAL_PUBLIC_URL;
}
