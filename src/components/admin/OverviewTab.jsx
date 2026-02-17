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
                {/* Weekly Presence Chart */}
                <div className="lg:col-span-2 bg-white/2 border border-white/5 p-8 rounded-3xl">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] mb-2">Performance_Semanal</h3>
                            <p className="text-lg font-black text-white italic tracking-tight uppercase">Engajamento de Presença</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                                <span className="text-[8px] font-mono text-gray-500 uppercase">Check-ins</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-2 px-2">
                        {weeklyStats.map((day, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group">
                                <div className="relative w-full flex items-end justify-center mb-4 h-full">
                                    <div
                                        className="w-full max-w-[40px] bg-primary-500/10 border-t border-x border-primary-500/20 group-hover:bg-primary-500/30 transition-all rounded-t-sm relative"
                                        style={{ height: `${(day.count / (employees.length || 1)) * 100}%`, minHeight: '4px' }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-xs">
                                            {day.count}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono text-gray-500 group-hover:text-primary-500 transition-colors uppercase">{day.date}</span>
                            </div>
                        ))}
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
