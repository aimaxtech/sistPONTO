import React from 'react';

const SettingsTab = ({
    geofence,
    setGeofence,
    isSavingSettings,
    currentCompany,
    companyForm,
    setCompanyForm,
    handleSaveCompany,
    logoPreview,
    showColorPicker,
    setShowColorPicker,
    customColor,
    handleCustomColorChange
}) => {
    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Configurações _Master</h2>
                <div className="flex gap-4">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">CompID: {currentCompany?.id?.slice(0, 8)}</span>
                    <span className="text-[10px] font-mono text-primary-500 font-black uppercase">V 2.0.4</span>
                </div>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-12">
                {/* Geofence & Rules */}
                <section className="space-y-6">
                    <h3 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                        Cerca Virtual & Jornada
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/2 p-8 border border-white/5 rounded-2xl">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Latitude Central</label>
                                <input type="number" step="any" placeholder="-22.12345" className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-white outline-none focus:border-primary-500 transition-all" value={companyForm.latitude || ''} onChange={e => setCompanyForm({ ...companyForm, latitude: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Longitude Central</label>
                                <input type="number" step="any" placeholder="-45.12345" className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-white outline-none focus:border-primary-500 transition-all" value={companyForm.longitude || ''} onChange={e => setCompanyForm({ ...companyForm, longitude: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Raio de Tolerância (Metros)</label>
                                <input type="number" placeholder="100" className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-white outline-none focus:border-primary-500 transition-all" value={companyForm.radius || 100} onChange={e => setCompanyForm({ ...companyForm, radius: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Carga Horária Diária (Horas)</label>
                                <input type="number" placeholder="8" className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-white outline-none focus:border-primary-500 transition-all" value={companyForm.workHours || 8} onChange={e => setCompanyForm({ ...companyForm, workHours: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Identity & Branding */}
                <section className="space-y-6">
                    <h3 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                        Identidade Visual
                    </h3>
                    <div className="bg-white/2 p-8 border border-white/5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Código de Acesso Corporativo</label>
                                <input type="text" readOnly className="w-full bg-white/5 border border-white/10 p-4 text-sm font-mono text-primary-500 cursor-not-allowed uppercase" value={currentCompany?.loginCode || 'GERANDO...'} />
                                <p className="text-[8px] text-gray-600 uppercase italic">Este código deve ser compartilhado com os funcionários para o primeiro acesso.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 border border-white/10 bg-black/20 rounded-xl">
                            {logoPreview || currentCompany?.logoUrl ? (
                                <img src={logoPreview || currentCompany.logoUrl} className="h-20 w-auto mb-4 object-contain" />
                            ) : (
                                <div className="h-20 w-20 border-2 border-dashed border-white/10 flex items-center justify-center text-3xl mb-4">🏢</div>
                            )}
                            <button type="button" className="text-[9px] font-black text-white hover:text-primary-500 transition-colors uppercase">Alterar Logo</button>
                        </div>
                    </div>
                </section>

                <button type="submit" disabled={isSavingSettings} className="w-full py-5 bg-primary-500 text-black font-black uppercase tracking-[0.4em] hover:bg-primary-400 shadow-2xl transition-all active:scale-95">
                    {isSavingSettings ? 'PROCESSANDO...' : '🚀 ATUALIZAR_SISTEMA_LOCAL'}
                </button>
            </form>

            <div className="pt-10 border-t border-white/10">
                <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">🛠️</span>
                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Hardware Lab & Simulations</h4>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono uppercase mb-6 leading-relaxed">
                        Injete dados de simulação no banco para testar o Overview e Banco de Horas.
                        Cria violações de geofence (São Paulo vs Local Atual) e horas extras de ontem.
                    </p>
                    <button
                        onClick={async () => {
                            const { simulateSystemData } = await import('../../scripts/simulateData');
                            await simulateSystemData(currentCompany.id, 'user_teste_simulacao');
                        }}
                        className="px-8 py-4 bg-red-600/20 border border-red-600/30 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95"
                    >
                        Disparar Simulação de Crise
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsTab;
