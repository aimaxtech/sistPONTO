import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '../config/firebase';

// Initialize Firebase
let app, auth, db, storage;

try {
    if (!firebaseConfig.apiKey) {
        throw new Error("API Key do Firebase não encontrada. Verifique o arquivo .env");
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Enable offline persistence
    // enableIndexedDbPersistence(db).catch((err) => {
    //     if (err.code == 'failed-precondition') {
    //         console.warn("Persistência falhou: Múltiplas abas abertas.");
    //     } else if (err.code == 'unimplemented') {
    //         console.warn("O navegador não suporta persistência offline.");
    //     }
    // });
} catch (error) {
    console.error("Erro CRÍTICO ao inicializar Firebase:", error);
    document.body.innerHTML = `<div style="color: red; padding: 20px;"><h1>Erro de Configuração</h1><p>${error.message}</p></div>`;
}

export { auth, db, storage };
export default app;
