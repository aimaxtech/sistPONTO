
const fs = require('fs');

async function createTestUser() {
    try {
        const envConfig = fs.readFileSync('.env', 'utf8');
        const match = envConfig.match(/VITE_FIREBASE_API_KEY=(.*)/);

        if (match) {
            const apiKey = match[1].trim();
            const email = `admin_saas_${Date.now()}@teste.com`;
            const password = "teste123456";

            console.log("Criando usuário com API Key:", apiKey.substring(0, 5) + "...");

            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
            const body = JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: true
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });

            const data = await response.json();

            if (data.error) {
                console.error("❌ ERRO:", data.error.message);

                if (data.error.message.includes('INVALID_KEY_TYPE')) {
                    console.error("Verifique se a API Key permite Identity Toolkit.");
                }
            } else {
                console.log("\n✅ Usuário Criado com Sucesso!");
                console.log("--------------------------------");
                console.log("Email:", data.email);
                console.log("Senha:", password);
                console.log("UID:", data.localId);
                console.log("--------------------------------");
                console.log("Acesse o sistema e faça login para ver o fluxo de 'Criar Organização'!");
            }

        } else {
            console.error("Não encontrei VITE_FIREBASE_API_KEY no arquivo .env");
        }
    } catch (e) {
        console.error("Erro geral:", e);
    }
}

createTestUser();
