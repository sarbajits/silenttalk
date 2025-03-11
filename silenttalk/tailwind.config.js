import forms from '@tailwindcss/forms'
import scrollbar from 'tailwind-scrollbar'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#ffffff',
          dark: '#1a1b1e',
        },
        secondary: {
          light: '#f8f9fa',
          dark: '#141517',
        },
        accent: '#6366f1',
        hover: {
          light: '#f1f3f5',
          dark: '#2c2e33',
        },
        border: {
          light: '#e9ecef',
          dark: '#373a40',
        },
        message: {
          sent: {
            light: '#e0e7ff',
            dark: '#4338ca',
          },
          received: {
            light: '#ffffff',
            dark: '#25262b',
          },
        },
        online: '#10b981',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-out': 'slideOut 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [forms, scrollbar],
  variants: {
    scrollbar: ['rounded', 'dark']
  }
} 