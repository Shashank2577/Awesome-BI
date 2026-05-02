'use client';

import { Theme } from './types';
import { getTheme, updateTheme as apiUpdateTheme, resetTheme as apiResetTheme } from './api';

const DEFAULT_THEME: Theme = {
  name: 'Default Light',
  mode: 'light',
  colors: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  fonts: { heading: 'Inter', body: 'Inter' },
  borderRadius: 8,
  logo: null,
  branding: { companyName: 'Awesome BI', tagline: 'Intelligent Business Intelligence' },
};

let _cachedTheme: Theme = DEFAULT_THEME;

export async function loadTheme(): Promise<Theme> {
  try {
    const theme = await getTheme() as Theme;
    if (theme && theme.colors) {
      _cachedTheme = theme;
    }
  } catch {
    // keep defaults
  }
  return _cachedTheme;
}

export function getCurrentTheme(): Theme {
  return _cachedTheme;
}

export async function saveTheme(theme: Partial<Theme>): Promise<Theme> {
  const result = await apiUpdateTheme(theme) as { theme: Theme };
  _cachedTheme = result.theme;
  return _cachedTheme;
}

export async function resetToDefaults(): Promise<Theme> {
  const result = await apiResetTheme() as { theme: Theme };
  _cachedTheme = result.theme;
  return _cachedTheme;
}
