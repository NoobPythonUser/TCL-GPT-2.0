import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        tcl: {
          bg: "#050505",
          panel: "#0d0d0f",
          neon: "#39ff14",
          electric: "#00b7ff"
        }
      },
      boxShadow: {
        neon: "0 0 24px rgba(57, 255, 20, 0.25)",
        electric: "0 0 24px rgba(0, 183, 255, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
