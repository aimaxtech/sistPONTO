import React from 'react';

const EmployeesTab = ({
    searchTerm,
    setSearchTerm,
    onAddEmployee,
    filteredEmployees,
    formatCPF,
    setSelectedEmp,
    setStatusData,
    setShowStatusModal,
    handleResetPassword,
    handleDeleteEmployee
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase border-l-4 border-primary-500 pl-4">
                    Gestão de Equipe
                </h2>
                <div className="flex w-full md:w-auto gap-4">
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="BUSCAR COLABORADOR..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 p-3 pl-10 focus:border-primary-500 outline-none font-mono text-xs text-white uppercase"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                    </div>
                    <button
                        onClick={onAddEmployee}
                        className="bg-primary-500 text-black px-6 py-3 font-black text-[10px] uppercase tracking-widest hover:bg-primary-400 transition-all flex items-center gap-2 shadow-lg shadow-primary-500/20"
                    >
                        <span>➕</span> NOVO_CONTRATO
                    </button>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                {/* Desktop View */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px] uppercase tracking-widest">
                        <thead>
                            <tr className="bg-primary-500/10 text-primary-500 border-b border-white/5">
                                <th className="px-6 py-4 font-black">Colaborador</th>
                                <th className="px-6 py-4 font-black">Identificação</th>
                                <th className="px-6 py-4 font-black">Status</th>
                                <th className="px-6 py-4 font-black">Banco_Horas</th>
                                <th className="px-6 py-4 text-right font-black">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-400">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 border border-white/10 bg-white/5 text-gray-400 flex items-center justify-center font-black text-lg group-hover:border-primary-500/50 transition-all">
                                                {emp.name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white uppercase tracking-tighter">{emp.name}</div>
                                                <div className="text-[9px] text-gray-600 font-mono">MATRÍCULA: {emp.matricula || '0000'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs">
                                        {emp.cpf ? formatCPF(emp.cpf) : '---'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(!emp.status || emp.status === 'ativo') ? (
                                            <span className="text-[9px] font-black text-primary-500 bg-primary-500/10 px-3 py-1 rounded-sm uppercase border border-primary-500/20 blur-[0.3px] group-hover:blur-none transition-all">Ativo</span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-[9px] font-black ${emp.status === 'ferias' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' : 'text-orange-500 bg-orange-500/10 border-orange-500/20'} px-3 py-1 rounded-sm uppercase border`}>
                                                    {emp.status === 'ferias' ? 'Férias' : 'Afastado'}
                                                </span>
                                                {emp.statusEnd && (
                                                    <span className="text-[8px] text-gray-600">Retorno: {new Date(emp.statusEnd).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-white bg-white/5 px-2 py-1 border border-white/10">± 00h 00m</span>
                                            <span className="text-[7px] text-gray-600 opacity-50">STABLE</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setSelectedEmp(emp); setStatusData({ type: emp.status || 'ativo', start: emp.statusStart || '', end: emp.statusEnd || '' }); setShowStatusModal(true); }}
                                                className="w-9 h-9 border border-white/10 hover:border-primary-500 shadow-lg flex items-center justify-center transition-all hover:bg-primary-500/10"
                                                title="Gerenciar Status/Férias"
                                            >🗓️</button>
                                            <button
                                                onClick={() => handleResetPassword(emp)}
                                                className="w-9 h-9 border border-white/10 hover:border-blue-500 shadow-lg flex items-center justify-center transition-all hover:bg-blue-500/10"
                                                title="Resetar Senha"
                                            >🔑</button>
                                            <button
                                                onClick={() => handleDeleteEmployee(emp)}
                                                className="w-9 h-9 border border-white/10 hover:border-red-500 shadow-lg flex items-center justify-center transition-all hover:bg-red-500/10"
                                                title="Remover Colaborador"
                                            >🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden space-y-4 p-4">
                    {filteredEmployees.map((emp) => (
                        <div key={emp.id} className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 border border-white/10 bg-white/5 text-gray-400 flex items-center justify-center font-black text-xl">
                                        {emp.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-white uppercase tracking-tight italic">{emp.name}</div>
                                        <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">ID: {emp.matricula || '0000'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(!emp.status || emp.status === 'ativo') ? (
                                        <span className="text-[8px] font-black text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded uppercase">Ativo</span>
                                    ) : (
                                        <span className={`text-[8px] font-black ${emp.status === 'ferias' ? 'text-blue-500 bg-blue-500/10' : 'text-orange-500 bg-orange-500/10'} px-2 py-0.5 rounded uppercase`}>
                                            {emp.status === 'ferias' ? 'FÉRIAS' : 'AFASTADO'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-white/5">
                                <div>
                                    <p className="text-[8px] text-gray-600 uppercase font-black mb-1">CPF</p>
                                    <p className="text-[10px] text-white font-mono">{emp.cpf ? formatCPF(emp.cpf) : 'SEM CPF'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-gray-600 uppercase font-black mb-1">Banco_Horas</p>
                                    <p className="text-[10px] text-primary-500 font-bold">± 00h 00m</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <button
                                    onClick={() => { setSelectedEmp(emp); setStatusData({ type: emp.status || 'ativo', start: emp.statusStart || '', end: emp.statusEnd || '' }); setShowStatusModal(true); }}
                                    className="px-3 py-1.5 border border-white/10 text-[9px] font-black text-white hover:border-primary-500"
                                >STATUS</button>
                                <div className="flex gap-2">
                                    <button onClick={() => handleResetPassword(emp)} className="p-2 border border-white/10 text-lg">🔑</button>
                                    <button onClick={() => handleDeleteEmployee(emp)} className="p-2 border border-white/10 text-lg text-red-500">🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EmployeesTab;
