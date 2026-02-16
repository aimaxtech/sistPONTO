
import sys

filepath = r'c:/Users/Fabio/Desktop/SistemaPonto/src/pages/AdminDashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

found_index = -1
for i in range(len(lines)):
    if 'Salvar Perfil' in lines[i] and '</button>' in lines[i+1]:
        found_index = i + 2
        break

if found_index != -1:
    new_tail = lines[:found_index]
    new_tail.append('                                    </form>\n')
    new_tail.append('                                </div>\n')
    new_tail.append('                            </div>\n')
    new_tail.append('                        </div>\n')
    new_tail.append('                    </div>\n')
    new_tail.append('                )}\n')
    new_tail.append('            </main>\n')
    new_tail.append('\n')
    new_tail.append('            {/* MODAL DE CONFIGURAÇÃO INICIAL DA EMPRESA (BLOQUEANTE) */}\n')
    new_tail.append('            {showCompanySetup && (\n')
    new_tail.append('                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in">\n')
    new_tail.append('                    <div className="bg-gray-900 border border-emerald-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.1)] rounded-sm relative">\n')
    new_tail.append('                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse"></div>\n')
    new_tail.append('                        <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-8 text-center">\n')
    new_tail.append('                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3 mb-2">\n')
    new_tail.append('                                <span className="text-emerald-500 animate-bounce">⚡</span> Configuração _Inicial\n')
    new_tail.append('                            </h2>\n')
    new_tail.append('                            <p className="text-[10px] text-emerald-500/60 font-mono uppercase tracking-[0.2em]">\n')
    new_tail.append('                                Identificação da Organização Obrigatória\n')
    new_tail.append('                            </p>\n')
    new_tail.append('                        </div>\n')
    new_tail.append('\n')
    new_tail.append('                        <form onSubmit={handleSaveCompany} className="p-8 space-y-8">\n')
    new_tail.append('                            <div className="bg-emerald-500/5 p-6 border border-emerald-500/20 rounded-sm">\n')
    new_tail.append('                                <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 text-center">Seu Código de Acesso Corporativo</label>\n')
    new_tail.append('                                <div className="text-4xl font-mono text-white font-black tracking-widest text-center select-all">\n')
    new_tail.append('                                    {currentCompany?.loginCode || "GERADO APÓS SALVAR"}\n')
    new_tail.append('                                </div>\n')
    new_tail.append('                                <p className="text-[9px] text-gray-500 mt-3 text-center uppercase tracking-widest">Este código vinculará todos os seus colaboradores</p>\n')
    new_tail.append('                            </div>\n')
    new_tail.append('                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">\n')
    new_tail.append('                                <div>\n')
    new_tail.append('                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">Nome Fantasia</label>\n')
    new_tail.append('                                    <input\n')
    new_tail.append('                                        type="text"\n')
    new_tail.append('                                        required\n')
    new_tail.append('                                        className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm uppercase transition-all"\n')
    new_tail.append('                                        placeholder="MINHA ORGANIZAÇÃO LTDA"\n')
    new_tail.append('                                        value={companyForm.name}\n')
    new_tail.append('                                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}\n')
    new_tail.append('                                    />\n')
    new_tail.append('                                </div>\n')
    new_tail.append('                                <div>\n')
    new_tail.append('                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 pl-1">CNPJ</label>\n')
    new_tail.append('                                    <input\n')
    new_tail.append('                                        type="text"\n')
    new_tail.append('                                        maxLength={18}\n')
    new_tail.append('                                        value={companyForm.cnpj || ""}\n')
    new_tail.append('                                        onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })}\n')
    new_tail.append('                                        className="w-full bg-white/5 border border-white/10 p-4 focus:border-emerald-500 outline-none text-white font-mono text-sm uppercase transition-all"\n')
    new_tail.append('                                        placeholder="00.000.000/0001-00"\n')
    new_tail.append('                                    />\n')
    new_tail.append('                                </div>\n')
    new_tail.append('                            </div>\n')
    new_tail.append('                            <button\n')
    new_tail.append('                                type="submit"\n')
    new_tail.append('                                disabled={isSavingSettings}\n')
    new_tail.append('                                className="w-full py-5 bg-emerald-600 text-black font-black text-xs uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] relative overflow-hidden group"\n')
    new_tail.append('                            >\n')
    new_tail.append('                                {isSavingSettings ? "CONFIGURANDO..." : "FINALIZAR CONFIGURAÇÃO"}\n')
    new_tail.append('                            </button>\n')
    new_tail.append('                        </form>\n')
    new_tail.append('                    </div>\n')
    new_tail.append('                </div>\n')
    new_tail.append('            )}\n')
    new_tail.append('        </div>\n') # Closure for relative z-10 (680)
    new_tail.append('    </div>\n') # Closure for root container (673)
    new_tail.append('    );\n')
    new_tail.append('};\n')
    new_tail.append('\n')
    new_tail.append('export default AdminDashboard;\n')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_tail)
    print("SUCCESS")
else:
    print("NOT FOUND")
