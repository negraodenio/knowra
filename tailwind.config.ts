import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "#C95C3F",
          hover: "#D96B4D",
          muted: "rgba(201, 92, 63, 0.15)",
        },
        graphite: {
          dark: "#0C0C0D",
          card: "#161617",
          border: "#262628",
        },
        ivory: {
          DEFAULT: "#F4F4F0",
        },
        stone: {
          gray: "#A3A3A3",
        },
      },
    },
  },
  plugins: [],
};
export default config;
