import { db } from "./firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * FERRAMENTAS EXECUTÁVEIS
 * Braço da IA no banco de dados.
 */
const tools = {
    get_employees: async (companyId) => {
        try {
            const q = query(
                collection(db, "users"),
                where("companyId", "==", companyId),
                where("role", "==", "employee")
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                email: d.data().email
            }));
        } catch (e) { return []; }
    },

    abonar_falta: async ({ employeeId, employeeName, date, reason, companyId }) => {
        try {
            await addDoc(collection(db, "logs"), {
                userId: employeeId,
                userName: employeeName,
                companyId: companyId,
                type: 'justificativa',
                date: date,
                time: '12:00',
                timestamp: new Date(),
                status: 'aprovado',
                obs: `Abono Automático via RAQUEL: ${reason}`,
                approvedBy: 'RAQUEL_AI',
                approvedAt: new Date().toISOString()
            });
            return `Sucesso! O abono para ${employeeName} no dia ${date} foi registrado.`;
        } catch (e) {
            console.error(e);
            return "Erro técnico ao gravar no banco de dados.";
        }
    },

    auditar_ponto: async ({ employeeName, companyId }) => {
        try {
            const employees = await tools.get_employees(companyId);
            const target = employees.find(e => e.name.toLowerCase().includes(employeeName.toLowerCase()));
            if (!target) return "Funcionário não encontrado.";

            const q = query(collection(db, "logs"), where("userId", "==", target.id), where("companyId", "==", companyId));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data());

            const logsByDay = logs.reduce((acc, log) => { acc[log.date] = acc[log.date] || []; acc[log.date].push(log); return acc; }, {});
            let inconsistencies = [];

            Object.keys(logsByDay).forEach(date => {
                const dayLogs = logsByDay[date].filter(l => l.type !== 'justificativa');
                if (dayLogs.length % 2 !== 0) {
                    inconsistencies.push({ date, count: dayLogs.length });
                }
            });

            if (inconsistencies.length === 0) return `✅ Nenhuma inconsistência grave encontrada para ${target.name}.`;
            return `🔍 Auditoria para ${target.name}:\nEncontrei ${inconsistencies.length} dias com batidas incompletas (ex: entrada sem saída).\nDias: ${inconsistencies.slice(0, 5).map(i => i.date).join(', ')}.`;
        } catch (e) { return "Erro na auditoria."; }
    },
    gerar_dados_ficticios: async ({ employeeName, companyId }) => {
        try {
            const employees = await tools.get_employees(companyId);
            const target = employees.find(e => e.name.toLowerCase().includes(employeeName.toLowerCase()));
            if (!target) return "Funcionário não encontrado.";

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const batch = [];
            for (let i = 0; i < 30; i++) {
                const day = new Date(startDate);
                day.setDate(day.getDate() + i);
                const dateStr = day.toISOString().split('T')[0];
                if (day.getDay() === 0 || day.getDay() === 6) continue;

                ['08:00', '12:00', '13:00', '18:00'].forEach(time => {
                    batch.push(addDoc(collection(db, "logs"), {
                        userId: target.id,
                        userName: target.name,
                        companyId,
                        type: time === '08:00' ? 'entrada' :
                            time === '12:00' ? 'saida_almoco' :
                                time === '13:00' ? 'volta_almoco' : 'saida',
                        date: dateStr,
                        time: time,
                        timestamp: new Date(`${dateStr}T${time}:00`),
                        status: 'ok'
                    }));
                });
            }
            await Promise.all(batch);
            return `✅ Dados de teste gerados para ${target.name} nos últimos 30 dias!`;
        } catch (e) { return "Erro ao gerar dados."; }
    }
};

// Histórico de mensagens por sessão (simula o chat contínuo)
let chatHistory = [];

/**
 * Inicializa o chat da RAQUEL (reseta o histórico)
 */
export const startRaquelChat = (companyId, companyName) => {
    if (!GROQ_API_KEY) {
        console.error("RAQUEL: VITE_GROQ_API_KEY não está definida.");
        return null;
    }

    const systemPrompt = `
IDENTIDADE:
Você é a Raquel, a assistente de RH super amigável e prestativa da empresa ${companyName || 'AIMAX TECH'}.
Responda sempre com educação, entusiasmo e de forma acolhedora em português brasileiro. Seu objetivo é facilitar a vida do gestor.

SINTAXE DE AÇÃO (IMPORTANTE):
Quando você precisar realizar uma ação no banco de dados, você deve incluir o comando JSON envolto em tags <COMMAND></COMMAND> no FINAL da sua resposta.
NUNCA mostre o JSON fora dessas tags. O usuário não deve ver o código.

Exemplo de comando:
<COMMAND>{ "action": "abonar_falta", "params": { "employeeName": "NOME", "date": "YYYY-MM-DD", "reason": "MOTIVO" } }</COMMAND>

REGRAS DE OURO:
1. NUNCA invente números ou estatísticas (como "120 horas trabalhadas") se você não tiver os dados reais na sua frente.
2. Se o usuário pedir para abonar, PRIMEIRO pergunte os detalhes (quem, quando, motivo).
3. SÓ gere o comando <COMMAND> quando tiver certeza dos dados ou quando for uma consulta (relatório).
4. Você pode gerar relatórios, abonar faltas e AUDITAR o ponto para encontrar esquecimentos (ação "auditar_ponto").
5. Ao pedir um relatório, diga algo como "Vou buscar as informações agora mesmo" e deixe o sistema processar os dados reais.
6. Para perguntas normais, responda apenas texto amigável.

Contexto Atual:
- Data Hoje: ${new Date().toLocaleDateString('pt-BR')}
- CompanyID: ${companyId}
`;

    // Reseta histórico com system prompt
    chatHistory = [{ role: "system", content: systemPrompt }];

    console.log("RAQUEL (Groq): Chat iniciado com modelo", GROQ_MODEL);
    return { companyId }; // Retorna objeto de sessão simples
};

/**
 * Envia mensagem para a RAQUEL via Groq API
 */
export const sendMessageToRaquel = async (session, message, companyId) => {
    try {
        if (!session || !GROQ_API_KEY) {
            return { text: "RAQUEL OFF-LINE. Chave de API não configurada." };
        }

        chatHistory.push({ role: "user", content: message });

        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: chatHistory,
                max_tokens: 1024,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || "";

        // Adiciona resposta da IA ao histórico original
        chatHistory.push({ role: "assistant", content: responseText });

        // --- FILTRAGEM DE SEGURANÇA (Para o usuário nunca ver código) ---
        // 1. Detectar comando entre tags <COMMAND> ou blocos de JSON soltos
        const commandRegex = /<COMMAND>([\s\S]*?)<\/COMMAND>/;
        const backupRegex = /\{[\s\S]*"action":[\s\S]*\}/;

        let jsonPayload = null;
        let cleanText = responseText;

        const match = responseText.match(commandRegex);
        if (match) {
            jsonPayload = match[1];
            cleanText = responseText.replace(commandRegex, "").trim();
        } else {
            const backupMatch = responseText.match(backupRegex);
            if (backupMatch) {
                jsonPayload = backupMatch[0];
                cleanText = responseText.replace(backupRegex, "").trim();
            }
        }

        // Se houver comando, tenta executar as ferramentas
        if (jsonPayload) {
            try {
                const command = JSON.parse(jsonPayload.trim());

                if (command.action === 'abonar_falta') {
                    const employees = await tools.get_employees(companyId);
                    const targetEmp = employees.find(e =>
                        e.name.toLowerCase().includes(command.params.employeeName.toLowerCase())
                    );
                    if (targetEmp) {
                        const actionResult = await tools.abonar_falta({
                            ...command.params,
                            employeeId: targetEmp.id,
                            employeeName: targetEmp.name,
                            companyId
                        });
                        return { text: `${cleanText}\n\n✅ SISTEMA: ${actionResult}` };
                    }
                }

                if (command.action === 'gerar_dados') {
                    const employees = await tools.get_employees(companyId);
                    const targetEmp = employees.find(e =>
                        e.name.toLowerCase().includes(command.params.employeeName.toLowerCase())
                    );
                    if (targetEmp) {
                        const result = await tools.gerar_dados_ficticios({ employeeName: targetEmp.name, companyId });
                        return { text: `${cleanText}\n\n🤖 ${result}` };
                    }
                }

                if (command.action === 'gerar_relatorio') {
                    const employees = await tools.get_employees(companyId);
                    const searchTerm = command.params.employeeName.toLowerCase();
                    const targetEmp = searchTerm === 'todos'
                        ? 'ALL'
                        : employees.find(e =>
                            e.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
                        );

                    if (targetEmp) {
                        let qLogs;
                        if (targetEmp === 'ALL') {
                            qLogs = query(collection(db, "logs"), where("companyId", "==", companyId), where("date", ">=", command.params.startDate), where("date", "<=", command.params.endDate));
                        } else {
                            qLogs = query(collection(db, "logs"), where("userId", "==", targetEmp.id), where("date", ">=", command.params.startDate), where("date", "<=", command.params.endDate));
                        }

                        const snap = await getDocs(qLogs);
                        const logs = snap.docs.map(d => d.data());

                        if (logs.length === 0) return { text: `${cleanText}\n\n📂 Nenhum registro encontrado para ${command.params.employeeName} neste período.` };

                        // Calcular estatísticas reais para evitar alucinação
                        const totalLogs = logs.length;
                        const uniqueDays = [...new Set(logs.map(l => l.date))].length;

                        const realSummary = `📊 **DADOS REAIS ENCONTRADOS:**\n- Total de registros: ${totalLogs}\n- Dias com batidas: ${uniqueDays} dia(s)`;

                        return {
                            text: `${cleanText}\n\n${realSummary}\n\nClique nos botões abaixo para ver o detalhamento completo:`,
                            actionData: {
                                type: 'PDF_REPORT',
                                data: logs,
                                filters: command.params,
                                employee: targetEmp === 'ALL' ? null : targetEmp
                            }
                        };
                    }
                }
            } catch (jsonErr) {
                console.error("Erro ao processar ação oculta:", jsonErr);
            }
        }

        // Se chegou aqui, removeu o código mas não executou nada (ou deu erro), retorna apenas o texto limpo
        return { text: cleanText };

    } catch (e) {
        console.error("Erro RAQUEL (Groq):", e);
        const errMsg = e?.message || String(e);
        if (errMsg.includes('401') || errMsg.includes('invalid_api_key')) {
            return { text: `❌ Chave de API inválida. Verifique a VITE_GROQ_API_KEY.` };
        }
        if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
            return { text: `⏳ Muitas requisições. Aguarde alguns segundos e tente novamente.` };
        }
        return { text: `❌ Erro de conexão: ${errMsg}` };
    }
};
