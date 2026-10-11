import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CANONICAL_PUBLIC_URL, getPublicAppUrl } from "@/lib/config/app-url";

describe("KNOWRA Canonical Published Application URL Configuration", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  afterEach(() => {
    if (originalAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }

    if (originalVercelUrl !== undefined) {
      process.env.NEXT_PUBLIC_VERCEL_URL = originalVercelUrl;
    } else {
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
    }
  });

  describe("1. Canonical Production URL Guarantees", () => {
    it("matches the verified production Vercel deployment URL", () => {
      expect(CANONICAL_PUBLIC_URL).toBe("https://knowra-vert.vercel.app");
    });

    it("is a secure HTTPS URL", () => {
      expect(CANONICAL_PUBLIC_URL.startsWith("https://")).toBe(true);
    });

    it("does not use localhost:3000 as the public published address", () => {
      expect(CANONICAL_PUBLIC_URL).not.toContain("localhost");
      expect(CANONICAL_PUBLIC_URL).not.toContain("3000");
    });

    it("has no trailing slash to ensure clean path composition", () => {
      expect(CANONICAL_PUBLIC_URL.endsWith("/")).toBe(false);
    });
  });

  describe("2. URL Resolution & Fallback Behavior", () => {
    it("returns canonical public URL when no environment variables are defined", () => {
      expect(getPublicAppUrl()).toBe("https://knowra-vert.vercel.app");
    });

    it("honors NEXT_PUBLIC_APP_URL override when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://knowra.custom.org";
      expect(getPublicAppUrl()).toBe("https://knowra.custom.org");
    });

    it("strips trailing slashes from NEXT_PUBLIC_APP_URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://knowra.custom.org///";
      expect(getPublicAppUrl()).toBe("https://knowra.custom.org");
    });

    it("resolves NEXT_PUBLIC_VERCEL_URL host into HTTPS URL", () => {
      process.env.NEXT_PUBLIC_VERCEL_URL = "knowra-git-main-deniolisbon-7343s-projects.vercel.app";
      expect(getPublicAppUrl()).toBe(
        "https://knowra-git-main-deniolisbon-7343s-projects.vercel.app"
      );
    });

    it("preserves protocol if NEXT_PUBLIC_VERCEL_URL already includes https://", () => {
      process.env.NEXT_PUBLIC_VERCEL_URL = "https://knowra-preview.vercel.app/";
      expect(getPublicAppUrl()).toBe("https://knowra-preview.vercel.app");
    });
  });

  describe("3. Metadata Base URL Compatibility", () => {
    it("constructs a valid URL object suitable for Next.js metadataBase", () => {
      const publicUrl = getPublicAppUrl();
      const urlObj = new URL(publicUrl);
      expect(urlObj.protocol).toBe("https:");
      expect(urlObj.hostname).toBe("knowra-vert.vercel.app");
      expect(urlObj.origin).toBe("https://knowra-vert.vercel.app");
    });
  });
});
