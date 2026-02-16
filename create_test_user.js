
const fetch = require('node-fetch'); // Necessário ter node-fetch ou usar nativo do Node 18+
const apiKey = process.env.VITE_FIREBASE_API_KEY || 'SUA_API_KEY_AQUI'; // Ler do .env se possível

async function createTestUser() {
    // Tentar ler .env manualmente
    const fs = require('fs');
    try {
        const envConfig = fs.readFileSync('.env', 'utf8');
        const match = envConfig.match(/VITE_FIREBASE_API_KEY=(.*)/);
        if (match) {
            const key = match[1].trim();
            console.log("API Key encontrada:", key);

            const email = `teste_saas_${Date.now()}@exemplo.com`;
            const password = "senha123teste";

            const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    returnSecureToken: true
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("Erro ao criar usuário:", data.error.message);
            } else {
                console.log("\n✅ Usuário de Teste Criado com Sucesso!");
                console.log("Email:", email);
                console.log("Senha:", password);
                console.log("UID:", data.localId);
                console.log("\n👉 Agora acesse o sistema e faça login com este usuário para testar o fluxo de 'Criar Organização'.");
            }
        } else {
            console.error("Não foi possível ler a API Key do arquivo .env");
        }
    } catch (e) {
        console.error("Erro ao ler arquivo .env:", e);
    }
}

createTestUser();
