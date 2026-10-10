import React from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
  color?: string;
  theme?: "dark" | "light" | "auto";
}

/**
 * Official Standalone K Symbol
 * viewBox 0 0 64 64
 */
export function KnowraSymbol({
  className = "h-6 w-6",
  color = "#F4F4F0",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M14,4 H36 L56,26 L42,28 L28,14 H28 V48 L14,64 Z" fill={color} />
      <path d="M28,28 H42 L58,56 H36 L14,28 H28 Z" fill={color} opacity="0.9" />
    </svg>
  );
}

/**
 * Official Horizontal Lockup "K KNOWRA"
 * viewBox 0 0 350 48
 */
export function KnowraHorizontalLogo({
  className = "h-8 w-auto text-[#F4F4F0]",
}: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 350 48"
      fill="none"
      className={className}
      aria-label="KNOWRA"
    >
      {/* SÍMBOLO MONOLITHIC GATEWAY K */}
      <path d="M16,4 H34 L54,22 L40,24 L28,12 H28 V36 L16,48 Z" fill="currentColor" />
      <path d="M28,24 H40 L56,48 H36 L16,24 H28 Z" fill="currentColor" opacity="0.9" />
      {/* WORDMARK "KNOWRA" */}
      <g fill="currentColor">
        <text
          x="75"
          y="34"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="31"
          letterSpacing="0.05em"
        >
          KNOWRA
        </text>
      </g>
    </svg>
  );
}

export function KnowraWordmark({
  className = "h-5 w-auto",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span className={`font-black tracking-wider text-[#F4F4F0] ${className}`}>
      KNOWRA
    </span>
  );
}
