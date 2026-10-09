import React from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
  color?: string;
  theme?: "dark" | "light" | "auto";
}

/**
 * Approved KNOWRA Monolithic Gateway K Symbol (Candidate 03)
 * Exact vector reconstruction on 128x128 grid:
 * - Monolithic vertical stem with 45° gateway facet
 * - Geometric diagonal arms with 45° stepped gateway notch
 */
export function KnowraSymbol({
  className = "w-7 h-7",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Monolithic Vertical Stem */}
      <path
        d="M 0 0 L 38 0 L 38 50 L 52 64 L 38 78 L 38 128 L 0 128 Z"
        fill={color}
      />
      {/* Geometric Diagonal Arms with 45° Stepped Gateway Notch */}
      <path
        d="M 89 0 L 128 0 L 72 64 L 128 128 L 89 128 L 45 84 L 48 78 L 62 64 L 48 50 L 45 44 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Approved KNOWRA Wordmark Vector Path
 */
export function KnowraWordmark({
  className = "h-5 w-auto",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 380 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KNOWRA"
    >
      <g fill={color}>
        {/* K */}
        <path d="M 10 10 L 22 10 L 22 30 L 38 10 L 53 10 L 32 34 L 54 54 L 39 54 L 22 38 L 22 54 L 10 54 Z" />
        {/* N */}
        <path d="M 66 10 L 78 10 L 100 42 L 100 10 L 111 10 L 111 54 L 99 54 L 77 22 L 77 54 L 66 54 Z" />
        {/* O */}
        <path
          fillRule="evenodd"
          d="M 148 10 C 135 10 125 20 125 32 C 125 44 135 54 148 54 C 161 54 171 44 171 32 C 171 20 161 10 148 10 Z M 148 21 C 154 21 159 26 159 32 C 159 38 154 43 148 43 C 142 43 137 38 137 32 C 137 26 142 21 148 21 Z"
        />
        {/* W */}
        <path d="M 183 10 L 195 10 L 205 44 L 215 10 L 226 10 L 236 44 L 246 10 L 258 10 L 243 54 L 230 54 L 220 22 L 211 54 L 198 54 Z" />
        {/* R */}
        <path
          fillRule="evenodd"
          d="M 271 10 L 293 10 C 302 10 308 15 308 23 C 308 29 304 34 298 35 L 309 54 L 296 54 L 286 36 L 283 36 L 283 54 L 271 54 Z M 283 20 L 292 20 C 295 20 298 21 298 24 C 298 27 295 28 292 28 L 283 28 Z"
        />
        {/* A */}
        <path
          fillRule="evenodd"
          d="M 333 10 L 344 10 L 362 54 L 349 54 L 344 41 L 323 41 L 318 54 L 305 54 Z M 326 32 L 341 32 L 334 16 Z"
        />
      </g>
    </svg>
  );
}

/**
 * Full Horizontal Logo Lockup (Symbol + Wordmark)
 */
export function KnowraHorizontalLogo({
  className = "h-7 w-auto",
  theme = "dark",
}: LogoProps) {
  const markColor = theme === "light" ? "#07090E" : "#F4F1EA";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <KnowraSymbol className="w-6 h-6 shrink-0" color={markColor} />
      <KnowraWordmark className="h-4.5 w-auto" color={markColor} />
    </div>
  );
}
