
import sys

filepath = r'c:/Users/Fabio/Desktop/SistemaPonto/src/pages/AdminDashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want to replace the broken block from around 1506 to 1512
# Old content:
# 1506:                                         </div>
# 1507:                                     </div>
# 1508:                                     </div>
# 1509:                                 )}
# 1510:                         </div>
# 1511:                         </div>
# 1512:                     )}

# We'll search for the specific unique sequence 
found = False
for i in range(len(lines)-10, 0, -1):
    if '</table>' in lines[i] and '</div>' in lines[i+1] and '</div>' in lines[i+2] and '</div>' in lines[i+3] and ')}' in lines[i+4]:
        # Found the spot
        # Replace from i+1 to i+6
        new_block = [
            '                                        </div>\n',
            '                                    </div>\n',
            '                                ) : (\n',
            '                                    <div className="bg-black/20 border border-dashed border-white/5 py-24 text-center">\n',
            '                                        <p className="text-6xl mb-6 opacity-10">📊</p>\n',
            '                                        <p className="text-xs font-black text-gray-600 uppercase tracking-[0.4em] italic">\n',
            '                                            {isGeneratingReport ? \'Synchronizing Cloud Data...\' : \'Aguardando Critérios de Busca\'}\n',
            '                                        </p>\n',
            '                                    </div>\n',
            '                                )}\n',
            '                            </div>\n',
            '                        </div>\n',
            '                    )}\n'
        ]
        lines[i+1:i+7] = new_block
        found = True
        break

if found:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("FIXED")
else:
    print("NOT FOUND")
