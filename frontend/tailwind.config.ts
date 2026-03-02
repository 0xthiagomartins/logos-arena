import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        matrix: {
          black: "#0a0a0a",
          dark: "#0d1117",
          green: "#00ff41",
          dim: "#00cc34",
          muted: "#003b00",
        },
      },
    },
  },
  plugins: [],
};

export default config;
