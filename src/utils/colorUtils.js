/**
 * Utilitários para manipulação de cores e geração de paletas
 */

/**
 * Converte HEX para RGB
 */
export const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

/**
 * Converte RGB para HEX
 */
export const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

/**
 * Converte HEX para HSL
 */
export const hexToHsl = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    let { r, g, b } = rgb;
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
};

/**
 * Converte HSL para HEX
 */
export const hslToHex = (h, s, l) => {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return rgbToHex(
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    );
};

/**
 * Gera uma paleta completa a partir de uma cor primária
 * Retorna: { 50, 500, 600, 700 }
 */
export const generateColorPalette = (baseColorHex) => {
    const hsl = hexToHsl(baseColorHex);
    if (!hsl) return null;

    const { h, s } = hsl;

    // Gera variações de luminosidade
    // 50: muito claro (94-97%)
    // 500: cor base (45-55%)
    // 600: um pouco mais escuro (35-45%)
    // 700: mais escuro ainda (25-35%)

    return {
        50: hslToHex(h, Math.max(s - 20, 40), 97),  // Muito claro
        500: baseColorHex,                           // Cor base
        600: hslToHex(h, s, Math.max(hsl.l - 15, 35)), // Mais escuro
        700: hslToHex(h, s, Math.max(hsl.l - 25, 25))  // Muito escuro
    };
};

/**
 * Valida se uma cor HEX é válida
 */
export const isValidHex = (hex) => {
    return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

/**
 * Garante que a cor tenha o prefixo #
 */
export const ensureHexPrefix = (hex) => {
    return hex.startsWith('#') ? hex : `#${hex}`;
};
