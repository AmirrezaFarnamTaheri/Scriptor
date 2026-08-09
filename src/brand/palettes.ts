import type { AppTheme } from '../hooks/useAppTheme'

export interface ColorPaletteScheme {
  id: AppTheme
  name: string
  category: 'light' | 'dark' | 'contrast'
  description: string
  author: string
  colors: {
    bg: string
    surface: string
    primary: string
    amber: string
    ink: string
    border: string
  }
}

export const COLOR_PALETTE_SCHEMES: ColorPaletteScheme[] = [
  {
    id: 'light',
    name: 'Light Modern',
    category: 'light',
    description: 'Clean slate and teal modern light aesthetic for bright environments.',
    author: 'Scriptor Team',
    colors: {
      bg: '#f5f7fb',
      surface: '#ffffff',
      primary: '#0f766e',
      amber: '#f97316',
      ink: '#1e293b',
      border: 'rgba(148, 163, 184, 0.2)',
    },
  },
  {
    id: 'dark',
    name: 'Dark Midnight',
    category: 'dark',
    description: 'Deep midnight blue with vibrant teal accents for low-light focus.',
    author: 'Scriptor Team',
    colors: {
      bg: '#030712',
      surface: '#0b0f19',
      primary: '#2dd4bf',
      amber: '#f97316',
      ink: '#f3f4f6',
      border: 'rgba(156, 163, 175, 0.12)',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    category: 'dark',
    description: 'Soothing warm pastel palette with lavender and teal accents.',
    author: 'Catppuccin Org',
    colors: {
      bg: '#1e1e2e',
      surface: '#25253a',
      primary: '#cba6f7',
      amber: '#fab387',
      ink: '#cdd6f4',
      border: 'rgba(147, 153, 178, 0.2)',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'dark',
    description: 'Dark theme with high-saturation purple, pink, and cyan highlights.',
    author: 'Zeno Rocha',
    colors: {
      bg: '#282a36',
      surface: '#343746',
      primary: '#ff79c6',
      amber: '#ffb86c',
      ink: '#f8f8f2',
      border: 'rgba(98, 114, 164, 0.3)',
    },
  },
  {
    id: 'nord',
    name: 'Nord Frost',
    category: 'dark',
    description: 'Arctic cold ice-blue and slate palette inspired by northern aurora.',
    author: 'Arctic Ice Studio',
    colors: {
      bg: '#2e3440',
      surface: '#3b4252',
      primary: '#88c0d0',
      amber: '#d08770',
      ink: '#eceff4',
      border: 'rgba(76, 86, 106, 0.35)',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'dark',
    description: 'Electric neon night aesthetic with rich indigo, magenta and cyan.',
    author: 'folke',
    colors: {
      bg: '#1a1b26',
      surface: '#24283b',
      primary: '#7aa2f7',
      amber: '#e0af68',
      ink: '#c0caf5',
      border: 'rgba(65, 72, 104, 0.35)',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    category: 'dark',
    description: 'Precision color palette designed for maximum visual comfort.',
    author: 'Ethan Schoonover',
    colors: {
      bg: '#002b36',
      surface: '#073642',
      primary: '#2aa198',
      amber: '#cb4b16',
      ink: '#839496',
      border: 'rgba(88, 110, 117, 0.3)',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    category: 'dark',
    description: 'Retro warm dark palette with terracotta red, yellow, and cream.',
    author: 'morhetz',
    colors: {
      bg: '#282828',
      surface: '#3c3836',
      primary: '#fe8019',
      amber: '#fabd2f',
      ink: '#ebdbb2',
      border: 'rgba(102, 92, 84, 0.4)',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    category: 'dark',
    description: 'Deep botanical jade and mint theme for organic focus.',
    author: 'Scriptor Team',
    colors: {
      bg: '#06201b',
      surface: '#0d2d26',
      primary: '#10b981',
      amber: '#f59e0b',
      ink: '#ecfdf5',
      border: 'rgba(16, 185, 129, 0.2)',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    category: 'dark',
    description: 'High-voltage contrast with neon cyan, hot pink and bright yellow.',
    author: 'Scriptor Team',
    colors: {
      bg: '#0f051d',
      surface: '#1b0a33',
      primary: '#00f0ff',
      amber: '#ff0055',
      ink: '#f0f3fe',
      border: 'rgba(0, 240, 255, 0.25)',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    category: 'dark',
    description: 'Vibrant magenta, yellow, and green on deep charcoal.',
    author: 'Monokai',
    colors: {
      bg: '#2d2a2e',
      surface: '#3a373b',
      primary: '#ff6188',
      amber: '#ffd866',
      ink: '#fcfcfa',
      border: 'rgba(147, 146, 147, 0.3)',
    },
  },
  {
    id: 'sepia-paper',
    name: 'Sepia Paper',
    category: 'light',
    description: 'Warm vintage book paper and espresso brown for long reading sessions.',
    author: 'Scriptor Team',
    colors: {
      bg: '#fbf7ee',
      surface: '#f4ede0',
      primary: '#8c5e34',
      amber: '#c05621',
      ink: '#433422',
      border: 'rgba(180, 155, 120, 0.3)',
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    category: 'contrast',
    description: 'Maximum accessibility black theme with bright yellow and cyan highlights.',
    author: 'Scriptor Team',
    colors: {
      bg: '#000000',
      surface: '#111111',
      primary: '#00ffff',
      amber: '#ffff00',
      ink: '#ffffff',
      border: '#ffffff',
    },
  },
]
