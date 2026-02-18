import React from 'react';

const OverviewTab = ({ stats, weeklyStats, setActiveTab, setShowRegisterModal, recentLogs, currentCompany, geofence, calculateDistance, setPreviewPhoto, employees }) => {
    return (
        <div className="space-y-10 animate-fade-in">
            {/* Real-time Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white/2 border border-white/5 p-6 rounded-2xl group hover:border-primary-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Equipe Total</span>
                        <span className="text-xl">👥</span>
                    </div>
                    <p className="text-4xl font-black text-white italic tracking-tighter">{employees.length.toString().padStart(2, '0')}</p>
                    <p className="text-[8px] font-mono text-gray-600 uppercase mt-2">Colaboradores Ativos</p>
                </div>

                <div className="bg-white/2 border border-white/5 p-6 rounded-2xl group hover:border-primary-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Presentes Hoje</span>
                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping"></div>
                    </div>
                    <p className="text-4xl font-black text-white italic tracking-tighter">
                        {stats.loading ? '--' : stats.present.toString().padStart(2, '0')}
                    </p>
                    <div className="w-full bg-white/5 h-1 mt-4 rounded-full overflow-hidden">
                        <div className="bg-primary-500 h-full transition-all duration-1000" style={{ width: `${(stats.present / (employees.length || 1)) * 100}%` }}></div>
                    </div>
                </div>

                <div className="bg-white/2 border border-white/5 p-6 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Aguardando Avaliação</span>
                        <span className="text-xl">📄</span>
                    </div>
                    <p className="text-4xl font-black text-white italic tracking-tighter">{stats.justifications.toString().padStart(2, '0')}</p>
                    <button onClick={() => setActiveTab('reports')} className="text-[8px] font-mono text-yellow-500/50 uppercase mt-2 hover:text-yellow-500 transition-colors">Ver Justificativas →</button>
                </div>

                <div className="bg-primary-500 p-6 rounded-2xl flex flex-col justify-between group cursor-pointer hover:bg-primary-400 transition-all active:scale-95" onClick={() => setShowRegisterModal(true)}>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-black uppercase tracking-widest">Ações Rápidas</span>
                        <span className="text-2xl text-black">＋</span>
                    </div>
                    <div>
                        <p className="text-xl font-black text-black uppercase italic leading-none">Novo</p>
                        <p className="text-xl font-black text-black uppercase italic leading-none">Contrato</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Atividade em Tempo Real (Substituindo Gráfico) */}
                <div className="lg:col-span-2 bg-white/2 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-white/5">
                        <h3 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] mb-2">Monitoramento_Live</h3>
                        <p className="text-xl font-black text-white italic tracking-tight uppercase">Registros de Hoje</p>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar max-h-[400px]">
                        {recentLogs.length > 0 ? (
                            <div className="divide-y divide-white/5">
                                {recentLogs.map((log) => (
                                    <div key={log.id} className="p-6 hover:bg-white/2 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-2 rounded-full ${log.type === 'entrada' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                                                    log.type === 'saida' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                                        'bg-primary-500 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]'
                                                }`} />
                                            <div>
                                                <p className="text-xs font-black text-white uppercase tracking-tight group-hover:text-primary-500 transition-colors">
                                                    {log.userName}
                                                </p>
                                                <p className="text-[9px] font-mono text-gray-500 uppercase">
                                                    Registrou {log.type.replace('_', ' ')} • ID_{log.userId?.slice(-4)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-white italic tracking-tighter">
                                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </p>
                                            <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Sincronizado_OK</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-center p-10">
                                <span className="text-4xl mb-4 grayscale opacity-20">📡</span>
                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Aguardando_Atividade_Nuvem</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Critical Alerts Feed */}
                <div className="bg-white/2 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Critical_Alerts</h3>
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar max-h-[400px]">
                        {recentLogs.filter(l => {
                            if (l.isViolation) return true;
                            if (l.location && currentCompany?.latitude && currentCompany?.longitude) {
                                const dist = calculateDistance(l.location.latitude, l.location.longitude, currentCompany.latitude, currentCompany.longitude);
                                return dist > (currentCompany.radius || 100);
                            }
                            return false;
                        }).map(log => (
                            <div key={log.id} className="p-5 border-b border-white/5 bg-red-500/5 hover:bg-red-500/10 transition-colors group cursor-pointer" onClick={() => log.photo && setPreviewPhoto(log.photo)}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white uppercase">{log.userName}</span>
                                        <span className="text-[8px] font-mono text-red-500/70 uppercase">Violação de Perímetro</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-[8px] bg-red-500 text-black px-1.5 font-black uppercase tracking-tighter">ALERTA_GPS</span>
                                    {log.photo && <span className="text-[8px] bg-white/10 text-white px-1.5 font-black uppercase tracking-tighter">FOTO_CAPTURADA</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('reports')} className="p-4 text-[10px] font-black text-gray-500 hover:text-white transition-colors uppercase text-center border-t border-white/5">Visualizar Relatório Completo</button>
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
