/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16241C",       // ledger ink — deep bottle-green-black background
        paper: "#F3EFE3",     // warm paper white
        gold: "#D9A441",      // coin gold — primary accent
        copper: "#B5622A",    // copper penny — secondary accent / hover
        mint: "#8FBF9F",      // mint receipt green — success/confirmation
        slate: "#3A4A3E",     // slate line — hairlines & borders
        "ink-light": "#1F2F25",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "grain": "radial-gradient(circle at 1px 1px, rgba(243,239,227,0.035) 1px, transparent 0)",
      },
      keyframes: {
        stamp: {
          "0%": { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          "60%": { opacity: "1", transform: "translateY(0) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        tickerIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        stamp: "stamp 0.4s ease-out",
        tickerIn: "tickerIn 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
