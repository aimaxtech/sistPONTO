
import { db } from './src/services/firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

async function checkUser() {
    console.log("🔍 Verificando usuário 001 da empresa 70844...");
    const emailBuscado = "70844.001@empresa.ponto";

    try {
        const q = query(collection(db, 'users'), where('email', '==', emailBuscado));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log("❌ Usuário NÃO encontrado no Firestore com o email:", emailBuscado);
            console.log("Buscando todos os usuários para depuração...");
            const all = await getDocs(collection(db, 'users'));
            all.forEach(d => console.log(` - Encontrado: ${d.data().email} (Role: ${d.data().role})`));
        } else {
            const data = snap.docs[0].data();
            console.log("✅ Usuário encontrado!");
            console.log("Data:", JSON.stringify(data, null, 2));
            console.log("PasswordOverride existe?", !!data.passwordOverride);
        }
    } catch (e) {
        console.error("Erro na busca:", e);
    }
}

checkUser();
