import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["ui-serif", "Georgia", "serif"],
      },
      colors: {
        bone: "#efe7d7",
        ink: "#2a221a",
        moss: "#4f5b3a",
        rust: "#9c4a2a",
        ember: "#c97a3c",
      },
    },
  },
  plugins: [],
};

export default config;
