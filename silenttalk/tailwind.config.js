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
          dark: '#212121',
        },
        secondary: {
          light: '#f4f4f5',
          dark: '#181818',
        },
        accent: '#2481cc',
        hover: {
          light: '#f3f4f6',
          dark: '#2d2d2d',
        },
        border: {
          light: '#e5e7eb',
          dark: '#404040',
        },
        message: {
          sent: {
            light: '#effdde',
            dark: '#2b5278',
          },
          received: {
            light: '#ffffff',
            dark: '#182533',
          },
        },
        online: '#42be65',
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