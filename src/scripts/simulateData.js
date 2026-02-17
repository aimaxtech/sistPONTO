import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export const simulateSystemData = async (companyId, employeeId) => {
    const logsRef = collection(db, 'logs');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    console.log("Iniciando simulação...");

    // 1. Alertas Críticos (Fora de Perímetro)
    await addDoc(logsRef, {
        userId: employeeId,
        userName: "SIMULAÇÃO ALERTA",
        companyId: companyId,
        type: "entrada",
        date: today,
        timestamp: new Date(),
        location: { latitude: -23.5505, longitude: -46.6333 }, // São Paulo (Longe do Greenhouse)
        photo: "https://via.placeholder.com/300x200?text=FACIAL_AUDIT_FAIL",
        isViolation: true
    });

    // 2. Banco de Horas (Horas Extras ontem)
    // Registro de Ontem: 08:00 às 12:00 | 13:00 às 19:00 (10h totais = 2h extras)
    const logsYesterday = [
        { type: "entrada", time: "08:00" },
        { type: "saida", time: "12:00" },
        { type: "entrada", time: "13:00" },
        { type: "saida", time: "19:00" }
    ];

    for (const log of logsYesterday) {
        const [h, m] = log.time.split(':');
        const ts = new Date(yesterday);
        ts.setHours(h, m, 0);

        await addDoc(logsRef, {
            userId: employeeId,
            userName: "Funcionário Teste",
            companyId: companyId,
            type: log.type === "entrada" ? "entrada" : "saida_almoco",
            date: yesterday,
            timestamp: ts,
            location: { latitude: -22.4247, longitude: -45.4597 } // Local Correto
        });
    }

    alert("Simulação Concluída! Verifique o Dashboard agora.");
};
