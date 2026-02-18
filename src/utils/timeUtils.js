/**
 * Utilitários para cálculo de jornada e banco de horas
 */

/**
 * Retorna a data de hoje no fuso horário de Brasília (UTC-3) formatada como YYYY-MM-DD
 */
export const getTodayStr = () => {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');
};

export const getBrTimestampMinutes = () => {
    const now = new Date();
    const brTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now);
    const [h, m] = brTime.split(':');
    return (parseInt(h) * 60) + parseInt(m);
};

/**
 * Calcula o total de minutos trabalhados em um dia baseado nos logs
 * @param {Array} dayLogs - Lista de logs de um único dia
 * @returns {number} - Total de minutos trabalhados
 */
export const calculateWorkedMinutes = (dayLogs) => {
    if (!dayLogs || dayLogs.length === 0) return 0;

    // Verificar se existe uma justificativa aprovada para este dia
    // Se houver, e não houver outros logs, ou se for para completar a jornada
    const isDayExcused = dayLogs.some(l => (l.type === 'justificativa' || l.isAbonado) && l.status === 'aprovado');

    // Se o dia está totalmente abonado por atestado, retornamos um flag ou tratamos no balance
    // Por enquanto, calculamos os minutos reais batidos
    const punchLogs = dayLogs.filter(l => l.type !== 'justificativa');
    if (punchLogs.length < 2) return 0;

    const sortedLogs = [...punchLogs].sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.date + 'T' + (a.time || '00:00'));
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.date + 'T' + (b.time || '00:00'));
        return timeA - timeB;
    });

    let totalMinutes = 0;
    for (let i = 0; i < sortedLogs.length - 1; i += 2) {
        const start = sortedLogs[i].timestamp?.toDate ? sortedLogs[i].timestamp.toDate() : new Date(sortedLogs[i].date + 'T' + (sortedLogs[i].time || '00:00'));
        const end = sortedLogs[i + 1].timestamp?.toDate ? sortedLogs[i + 1].timestamp.toDate() : new Date(sortedLogs[i + 1].date + 'T' + (sortedLogs[i + 1].time || '00:00'));
        const diffMs = end - start;
        if (diffMs > 0) totalMinutes += Math.floor(diffMs / (1000 * 60));
    }

    return totalMinutes;
};

/**
 * Formata minutos em string legível (ex: 08h 30m)
 */
export const formatMinutes = (totalMinutes) => {
    const isNegative = totalMinutes < 0;
    const absMinutes = Math.abs(totalMinutes);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    return `${isNegative ? '-' : '+'}${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

/**
 * Calcula o saldo do dia baseado em uma jornada esperada e abonos
 */
export const calculateDailyBalance = (dayLogs, workedMinutes, expectedHours = 8) => {
    // Se o dia tem justificativa aprovada, o saldo é ZERO (não deve nem negativo nem positivo extra)
    // A menos que tenha trabalhado mais que a jornada, aí conta o extra? 
    // Geralmente atestado abona o que faltou.
    const isDayExcused = dayLogs && dayLogs.some(l => (l.type === 'justificativa' || l.isAbonado) && l.status === 'aprovado');

    const expectedMinutes = expectedHours * 60;
    if (isDayExcused) {
        // Se trabalhou mais que o esperado, conta o extra. Se trabalhou menos, o abono cobre a diferença.
        return Math.max(0, workedMinutes - expectedMinutes);
    }

    return workedMinutes - expectedMinutes;
};
