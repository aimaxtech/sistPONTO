import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDFReport = (data, filters, company) => {
    const doc = new jsPDF();
    const tableColumn = ["Data", "Funcionário", "Tipo", "Horário", "Status/Local"];
    const tableRows = [];

    data.forEach(log => {
        const logTime = log.time || (log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--');
        const rowData = [
            log.date,
            log.userName || filters.employeeName,
            log.type.toUpperCase(),
            logTime,
            log.status === 'aprovado' ? "ABONADO" : "NORMAL"
        ];
        tableRows.push(rowData);
    });

    // Cabeçalho Profissional
    doc.setFontSize(14);
    doc.text(company?.razaoSocial || company?.name || "RELATÓRIO DE PONTO", 14, 15);
    doc.setFontSize(8);
    doc.text(`CNPJ: ${company?.cnpj || '---'} | ENDEREÇO: ${company?.address || '---'}`, 14, 20);
    doc.text(`PERÍODO: ${filters.start || filters.startDate} A ${filters.end || filters.endDate}`, 14, 25);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        headStyles: { fillColor: [16, 185, 129] } // Emerald color to match theme
    });

    doc.save(`relatorio_ponto_raquel_${new Date().getTime()}.pdf`);
};

export const generateEspelhoPontoPDF = (data, employee, filters, company) => {
    const doc = new jsPDF();

    // Cabeçalho Oficial
    doc.setFontSize(16);
    doc.text("ESPELHO DE PONTO MENSAL", 105, 15, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 20, 196, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DA EMPRESA", 14, 30);
    doc.setFont("helvetica", "normal");
    doc.text(`RAZÃO SOCIAL: ${company?.razaoSocial || company?.name || '---'}`, 14, 35);
    doc.text(`CNPJ: ${company?.cnpj || '---'}`, 14, 40);
    doc.text(`ENDEREÇO: ${company?.address || '---'}`, 14, 45);

    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO COLABORADOR", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`NOME: ${employee.name}`, 14, 60);
    doc.text(`CPF: ${employee.cpf || '---'}`, 14, 65);
    doc.text(`PERÍODO DE APURAÇÃO: ${filters.startDate} até ${filters.endDate}`, 14, 70);

    const tableColumn = ["Data", "Entrada", "Saída Almoço", "Volta Almoço", "Saída", "Observação"];
    const rowsByDate = data.reduce((acc, log) => {
        acc[log.date] = acc[log.date] || [];
        acc[log.date].push(log);
        return acc;
    }, {});

    const tableRows = Object.keys(rowsByDate).sort().map(date => {
        const dayLogs = rowsByDate[date].sort((a, b) => {
            const timeA = a.time || (a.timestamp?.toDate ? a.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00');
            const timeB = b.time || (b.timestamp?.toDate ? b.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00');
            return timeA.localeCompare(timeB);
        });

        const getFmtTime = (l) => l.time || (l.timestamp?.toDate ? l.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--');

        const e1 = dayLogs.find(l => l.type === 'entrada');
        const s1 = dayLogs.find(l => l.type === 'saida_almoco');
        const e2 = dayLogs.find(l => l.type === 'volta_almoco') || dayLogs.filter(l => l.type === 'entrada')[1];
        const s2 = dayLogs.find(l => l.type === 'saida');

        return [
            date.split('-').reverse().join('/'),
            e1 ? getFmtTime(e1) : '--:--',
            s1 ? getFmtTime(s1) : '--:--',
            e2 ? getFmtTime(e2) : '--:--',
            s2 ? getFmtTime(s2) : '--:--',
            dayLogs.some(l => l.status === 'aprovado') ? "ABONADO" : ""
        ];
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 80,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] }
    });

    const finalY = Math.min(doc.lastAutoTable.finalY + 40, 270);
    doc.setFontSize(8);
    doc.line(14, finalY, 90, finalY);
    doc.text("DECLARO QUE AS HORAS ACIMA SÃO EXPRESSÃO DA VERDADE", 14, finalY + 4);
    doc.text(employee.name, 14, finalY + 8);

    doc.line(120, finalY, 196, finalY);
    doc.text("RESPONSÁVEL PELA EMPRESA", 120, finalY + 4);
    doc.text(company?.razaoSocial || company?.name || "", 120, finalY + 8);

    doc.save(`espelho_ponto_${employee.name}_${filters.startDate}.pdf`);
};
