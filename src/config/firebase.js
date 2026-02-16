// Firebase Configuration
// IMPORTANTE: Substitua com suas credenciais do Firebase Console
export const firebaseConfig = {
    apiKey: "AIzaSyDeJMig3nv638VW9JrpcH6I27LIq8ilQOk",
    authDomain: "sisponto-c9905.firebaseapp.com",
    projectId: "sisponto-c9905",
    storageBucket: "sisponto-c9905.firebasestorage.app",
    messagingSenderId: "456198943472",
    appId: "1:456198943472:web:c03a1d0cb2dc447beb0835",
    measurementId: "G-RB48Z0ZPM6"
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
