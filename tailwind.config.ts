import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@caistech/property-launch-kit/dist/components/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#22c55e",
        accent: "#4ade80",
        navy: "#1A2744",
        "f2k-blue": "#2B5797",
        gold: "#22c55e",
        "gold-light": "#4ade80",
        ember: "#B8420F",
        brass: "#C8A84E",
        "deep-blue": "#1A2744",
        "off-white": "#FAF7F2",
        "warm-grey": "#E8E2D8",
        forest: "#1B4332",
        blood: "#8B1A1A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
        archivo: ["var(--font-archivo)", "Helvetica Neue", "sans-serif"],
        "ibm-mono": ["var(--font-ibm-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
