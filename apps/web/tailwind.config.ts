import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12181F",       // near-black background, slightly blue
        paper: "#F6F4EF",     // warm off-white for cards/panels
        signal: "#E8B34B",    // amber accent — used sparingly for the one CTA/highlight
        line: "#2A323C",      // hairline borders on dark surfaces
        muted: "#8A94A3",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
