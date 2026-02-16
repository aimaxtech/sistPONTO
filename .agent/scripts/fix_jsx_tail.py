
import sys

filepath = r'c:/Users/Fabio/Desktop/SistemaPonto/src/pages/AdminDashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Goal: Fix the structure from line 1714 onwards.
# Currently looks like:
# 1714:                                         </form>
# 1715:                                     </div>
# 1716:                                 </div>
# 1717:                             </div>
# 1718:             )}
# 1719:                         </main>
# 1720: 
# 1721:         {/* MODAL ... */}
# 1722:                     {showCompanySetup && (

# Search for the form closing
found_index = -1
for i in range(len(lines)):
    if '</form>' in lines[i] and 'Salvar Perfil' in lines[max(0, i-2)]:
        found_index = i
        break

if found_index != -1:
    # We found the end of the settings form.
    # We need to correctly close everything.
    # 1. Close the Organization Profile div (1611)
    # 2. Close the container div (1610)
    # 3. Close the grid-cols container (1528)
    # 4. Close the settings tab div (1521)
    # 5. Close the settings tab conditional (1520)
    # 6. Close the main tag (1001)
    
    # Let's find where the modal ends too.
    modal_end_index = -1
    for j in range(len(lines)-1, found_index, -1):
        if 'export default AdminDashboard' in lines[j]:
            modal_end_index = j
            break
            
    if modal_end_index != -1:
        # Re-construct the whole tail
        tail = lines[:found_index+1]
        tail.append('                                    </div>\n')
        tail.append('                                </div>\n')
        tail.append('                            </div>\n')
        tail.append('                        </div>\n')
        tail.append('                    )}\n')
        tail.append('                </main>\n')
        tail.append('\n')
        tail.append('                {/* MODAL DE CONFIGURAÇÃO INICIAL DA EMPRESA (BLOQUEANTE) */}\n')
        tail.append('                {showCompanySetup && (\n')
        tail.append('                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in">\n')
        tail.append('                        <div className="bg-gray-900 border border-emerald-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(16,185,129,0.1)] rounded-sm relative">\n')
        tail.append('                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse"></div>\n')
        tail.append('                            <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-8 text-center">\n')
        tail.append('                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3 mb-2">\n')
        tail.append('                                    <span className="text-emerald-500 animate-bounce">⚡</span> Configuração _Inicial\n')
        tail.append('                                </h2>\n')
        tail.append('                                <p className="text-[10px] text-emerald-500/60 font-mono uppercase tracking-[0.2em]">\n')
        tail.append('                                    Identificação da Organização Obrigatória\n')
        tail.append('                                </p>\n')
        tail.append('                            </div>\n')
        # ... and so on ... 
        # Actually, I'll just append what was there starting from line 1738 if I can find it
        
        modal_body_index = -1
        for k in range(found_index, len(lines)):
            if '<form onSubmit={handleSaveCompany} className="p-8 space-y-8">' in lines[k]:
                modal_body_index = k
                break
        
        if modal_body_index != -1:
            tail.extend(lines[modal_body_index : modal_end_index-3]) # Up to before the broken end
            tail.append('                                </form>\n')
            tail.append('                            </div>\n')
            tail.append('                        </div>\n')
            tail.append('                    )}\n')
            tail.append('            </div>\n')
            tail.append('        );\n')
            tail.append('};\n')
            tail.append('\n')
            tail.append('export default AdminDashboard;\n')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(tail)
            print("RECONSTRUCTED SUCCESSFULLY")
        else:
            print("MODAL BODY NOT FOUND")
    else:
        print("EXPORT NOT FOUND")
else:
    print("SETTINGS FORM END NOT FOUND")
