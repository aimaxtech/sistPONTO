import React from 'react';
import { generatePDFReport, generateEspelhoPontoPDF } from '../../utils/pdfGenerator';

const ReportsTab = ({
    currentCompany, reportFilters, setReportFilters, employees, handleGenerateReport,
    isGeneratingReport, reportData, geofence, calculateDistance,
    setPreviewPhoto, setAuditLog, setEditData, setShowEditModal,
    setShowDeleteConfirm, handleCertificateUpload, handleApproveJustification,
    handleRejectJustification
}) => {

    const exportToPDF = () => {
        generatePDFReport(reportData, reportFilters, currentCompany);
    };

    const generateEspelhoPonto = () => {
        if (reportFilters.employeeId === 'all') return alert("Selecione um funcionário específico para gerar o espelho de ponto.");
        const emp = employees.find(e => e.id === reportFilters.employeeId);
        if (!emp) return alert("Funcionário não encontrado.");

        generateEspelhoPontoPDF(reportData, emp, {
            startDate: reportFilters.start,
            endDate: reportFilters.end
        }, currentCompany);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Filtros Estratégicos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/2 p-6 border border-white/5 rounded-2xl">
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest pl-1">Início</label>
                    <input type="date" className="w-full bg-white/5 border border-white/10 p-3 text-xs text-white outline-none focus:border-primary-500" value={reportFilters.start} onChange={e => setReportFilters({ ...reportFilters, start: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest pl-1">Fim</label>
                    <input type="date" className="w-full bg-white/5 border border-white/10 p-3 text-xs text-white outline-none focus:border-primary-500" value={reportFilters.end} onChange={e => setReportFilters({ ...reportFilters, end: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest pl-1">Colaborador</label>
                    <select className="w-full bg-white/5 border border-white/10 p-3 text-xs text-white uppercase outline-none focus:border-primary-500" value={reportFilters.employeeId} onChange={e => setReportFilters({ ...reportFilters, employeeId: e.target.value })}>
                        <option value="all">TODOS OS OPERADORES</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div className="flex items-end">
                    <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="w-full py-3 bg-primary-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-primary-400 transition-all shadow-lg shadow-primary-500/10">
                        {isGeneratingReport ? 'Processando...' : '🔍 Filtrar Dados'}
                    </button>
                </div>
            </div>

            {/* Ações de Exportação */}
            {reportData.length > 0 && (
                <div className="flex gap-4 animate-fade-in">
                    <button onClick={exportToPDF} className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                        <span>📥</span> Exportar PDF Geral
                    </button>
                    <button onClick={generateEspelhoPonto} className="flex-1 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                        <span>📄</span> Gerar Espelho de Ponto
                    </button>
                </div>
            )}

            {/* Tabela de Resultados */}
            <div className="bg-white/2 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Operador / Data</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Tipo</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Horário</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status/Anexos</th>
                                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Controles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {reportData.map(log => {
                                let distance = null;
                                if (log.location && geofence) {
                                    distance = calculateDistance(log.location.latitude, log.location.longitude, geofence.latitude, geofence.longitude);
                                }
                                const isViolation = distance > (geofence?.radius || 100);

                                return (
                                    <tr key={log.id} className="hover:bg-white/2 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-white uppercase">{log.userName}</span>
                                                <span className="text-[9px] font-mono text-gray-500">{log.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-xs ${log.type === 'entrada' ? 'bg-primary-500/10 text-primary-500' :
                                                log.type === 'justificativa' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {log.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-black text-white italic tracking-tighter">
                                                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </span>
                                                {log.lastEdit && (
                                                    <span className="text-[7px] text-blue-400 font-bold uppercase tracking-tighter mt-1 flex items-center gap-1" title={`Editado por admin: ${log.lastEdit.reason}`}>
                                                        ✏️ Editado
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center gap-2">
                                                {isViolation && <span className="text-[8px] text-red-500 font-black uppercase tracking-widest">⚠️ Fora de Raio</span>}
                                                <div className="flex gap-2">
                                                    {log.photo && (
                                                        <button onClick={() => setPreviewPhoto(log.photo)} className="p-2 bg-white/5 hover:bg-primary-500/20 text-gray-400 hover:text-primary-500 rounded-sm transition-all" title="Ver Biometria">📸</button>
                                                    )}
                                                    {log.certificateUrl && (
                                                        <button onClick={() => setPreviewPhoto(log.certificateUrl)} className="p-2 bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 rounded-sm transition-all" title="Ver Atestado">📄</button>
                                                    )}
                                                </div>
                                                {log.status && (
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-xs ${log.status === 'aprovado' ? 'bg-green-500 text-black' :
                                                        log.status === 'rejeitado' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                                                        }`}>
                                                        {log.status}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {log.type === 'justificativa' && log.status === 'pendente' ? (
                                                <div className="flex justify-end gap-2 animate-fade-in">
                                                    <button onClick={() => handleApproveJustification(log.id)} className="px-3 py-1.5 bg-green-500 text-black font-black text-[9px] uppercase tracking-widest hover:bg-green-400">Aprovar</button>
                                                    <button onClick={() => handleRejectJustification(log.id)} className="px-3 py-1.5 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-red-500">Rejeitar</button>
                                                </div>
                                            ) : log.type !== 'justificativa' && (
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setAuditLog(log); setEditData({ type: log.type, date: log.date, time: log.timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }); setShowEditModal(true); }} className="p-2 hover:bg-blue-500/20 text-blue-500" title="Editar Log">✏️</button>
                                                    <button onClick={() => { setAuditLog(log); setShowDeleteConfirm(true); }} className="p-2 hover:bg-red-500/20 text-red-500" title="Excluir Log">🗑️</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {reportData.length === 0 && (
                        <div className="py-20 text-center text-gray-600 italic uppercase tracking-[0.4em] font-black text-[10px]">Aguardando Seleção de Filtros</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportsTab;
