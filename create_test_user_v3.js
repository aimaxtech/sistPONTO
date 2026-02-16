
import fs from 'fs';

async function createTestUser() {
    try {
        const envConfig = fs.readFileSync('.env', 'utf8');
        const match = envConfig.match(/VITE_FIREBASE_API_KEY=(.*)/);

        if (match) {
            const apiKey = match[1].trim();
            const timestamp = Date.now();
            const email = `admin_saas_${timestamp}@teste.com`;
            const password = "teste123456";

            console.log("-----------------------------------------");
            console.log("🔑 API Key:", apiKey.substring(0, 5) + "...");
            console.log("📧 Email:", email);
            console.log("-----------------------------------------");

            // Firebase Auth REST API: SignUp
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
                    console.error("Dica: Verifique se sua API Key tem permissão para Identity Toolkit no Google Cloud Console.");
                }
            } else {
                console.log("\n✅ Usuário Criado com Sucesso!");
                console.log("--------------------------------root");
                console.log("UID:", data.localId);
                console.log("--------------------------------");
                console.log("👉 Use estas credenciais para logar na aplicação e testar o fluxo 'Criar Organização'.");
            }

        } else {
            console.error("Não encontrei VITE_FIREBASE_API_KEY no arquivo .env");
        }
    } catch (e) {
        console.error("Erro geral:", e);
    }
}

createTestUser();
