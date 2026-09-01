import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        pine: "#126553",
        mint: "#dff4ec",
        amber: "#f1b33b",
        coral: "#e56b4f",
        sky: "#4b91c8",
      },
      boxShadow: {
        panel: "0 8px 28px rgba(23, 33, 31, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
