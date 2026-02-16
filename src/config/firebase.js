// Firebase Configuration - Credenciais carregadas via variáveis de ambiente (.env)
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Coordenadas da Estufa de Mudas (Exemplo - AJUSTAR COM LOCALIZAÇÃO REAL)
export const GREENHOUSE_LOCATION = {
    latitude: -23.550520,  // Substitua pela latitude real
    longitude: -46.633308, // Substitua pela longitude real
    radius: 100 // Raio em metros para considerar "dentro da estufa"
};

// Tipos de registro de ponto
export const PUNCH_TYPES = {
    ENTRADA: 'entrada',
    SAIDA_ALMOCO: 'saida_almoco',
    VOLTA_ALMOCO: 'volta_almoco',
    SAIDA: 'saida'
};

// Labels amigáveis
export const PUNCH_LABELS = {
    entrada: 'Entrada',
    saida_almoco: 'Saída para Almoço',
    volta_almoco: 'Volta do Almoço',
    saida: 'Saída'
};
