export const THEMES = [
    {
        id: 'emerald',
        name: 'Emerald Tech',
        primary: '#10b981',
        secondary: '#059669',
        dark: '#064e3b',
        colors: {
            50: '#f0fdf4',
            500: '#10b981',
            600: '#059669',
            700: '#047857'
        }
    },
    {
        id: 'blue',
        name: 'Corporate Blue',
        primary: '#2563eb',
        secondary: '#1d4ed8',
        dark: '#1e3a8a',
        colors: {
            50: '#eff6ff',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8'
        }
    },
    {
        id: 'purple',
        name: 'Royal Purple',
        primary: '#9333ea',
        secondary: '#7e22ce',
        dark: '#581c87',
        colors: {
            50: '#faf5ff',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce'
        }
    },
    {
        id: 'amber',
        name: 'Industrial Amber',
        primary: '#d97706',
        secondary: '#b45309',
        dark: '#78350f',
        colors: {
            50: '#fffbeb',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309'
        }
    },
    {
        id: 'carbon',
        name: 'Minimal Carbon',
        primary: '#4b5563',
        secondary: '#374151',
        dark: '#111827',
        colors: {
            50: '#f9fafb',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151'
        }
    },
    {
        id: 'custom',
        name: 'Custom Theme',
        primary: '#10b981', // Placeholder - será substituído pela cor escolhida
        secondary: '#059669',
        dark: '#064e3b',
        colors: {
            50: '#f0fdf4',
            500: '#10b981',
            600: '#059669',
            700: '#047857'
        },
        isCustom: true
    }
];

export const getThemeById = (id) => THEMES.find(t => t.id === id) || THEMES[0];
