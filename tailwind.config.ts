import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
        "1400": "1400px",
      },
    },
    extend: {
      colors: {
        paper: {
          50: "#FFFDF8",
          100: "#FFF9F1",
          200: "#F8EEDC",
          300: "#F1DFC3",
          400: "#EAD3B0",
        },
        gold: {
          400: "#C99A2E",
          500: "#B8860B",
          600: "#9E6F14",
          royal: "#C99A2E",
          dark: "#B8860B",
          50: "#FFFDF8",
          100: "#FFF9F1",
          200: "#F8EEDC",
          300: "#EAD3B0",
          700: "#8F640C",
          800: "#734F08",
          900: "#573B04",
        },
        walnut: {
          500: "#8C6239",
          700: "#6E5238",
          900: "#5C4033",
        },
        navy: {
          midnight: "#F8EEDC",
          950: "#F8EEDC",
          900: "#F1DFC3",
          800: "#FFF9F1",
          700: "#D4AC54",
        },
        cream: {
          bg: "#F8EEDC",
          section: "#F1DFC3",
          card: "#FFF9F1",
          border: "#D4AC54",
          hover: "#EAD3B0",
          text: "#5C4033",
          muted: "#8A6A4A",
        },
        ivory: {
          white: "#FFF9F1",
          paper: "#F8EEDC",
        },
        gray: {
          soft: "#F1DFC3",
        },
        royal: {
          blue: "#C99A2E",
        },
        emerald: {
          accent: "var(--emerald-accent)",
        },
        orange: {
          accent: "var(--orange-accent)",
        },
        ruby: {
          red: "var(--ruby-red)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          dark: "var(--surface-dark)",
          card: "var(--surface-card)",
        },
        border: "var(--border)",
        text: {
          main: "var(--text-main)",
          muted: "var(--text-muted)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        playfair: ["var(--font-playfair)", "serif"],
        manrope: ["var(--font-manrope)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        hero: ["var(--font-playfair)", "serif"],
        body: ["var(--font-manrope)", "sans-serif"],
        dashboard: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        button: "var(--radius-button)",
        input: "var(--radius-input)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        "hero-image": "var(--radius-hero-image)",
        pill: "var(--radius-pill)",
        avatar: "var(--radius-avatar)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        large: "var(--shadow-large)",
        "gold-glow": "var(--shadow-gold-glow)",
        "blue-glow": "var(--shadow-blue-glow)",
        glass: "var(--shadow-glass)",
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, #D4AF37 0%, #B88F28 100%)",
        "gradient-midnight": "linear-gradient(135deg, #0B1220 0%, #111827 100%)",
        "gradient-hero": "linear-gradient(180deg, #0B1220 0%, #111827 50%, #1F2937 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.5s ease-in-out forwards",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "gold-glow": "goldGlow 2.5s infinite ease-in-out",
        shimmer: "marqueeScroll 30s linear infinite",
        marquee: "marqueeScroll 30s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        goldGlow: {
          // Animate opacity, not box-shadow — see app/globals.css goldGlow.
          // Keeps the glow-ring pulse on the GPU compositor instead of
          // repainting a blurred shadow every frame.
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        marqueeScroll: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
