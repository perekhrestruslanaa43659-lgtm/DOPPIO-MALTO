
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'app', 'staff', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startTarget = 'loading ? (';
const endTarget = '<StationsManagerModal';

const startTargetIndex = content.indexOf(startTarget);
const endTargetIndex = content.indexOf(endTarget);

if (startTargetIndex === -1 || endTargetIndex === -1) {
    console.error('Could not find start or end marker');
    process.exit(1);
}

// Find the `{` immediately before `loading ? (`
let startIndex = content.lastIndexOf('{', startTargetIndex);
// Verify it's not too far (e.g. within 50 chars)
if (startTargetIndex - startIndex > 100) {
    console.error('Start { is too far from loading ? (');
    process.exit(1);
}

// Find the `}` immediately before `<StationsManagerModal`
let endIndex = content.lastIndexOf('}', endTargetIndex);
// Verify it's not too far
if (endTargetIndex - endIndex > 100) {
    console.error('End } is too far from <StationsManagerModal');
    process.exit(1);
}

// We want to replace from startIndex to endIndex + 1 (to include '}')
const originalBlock = content.substring(startIndex, endIndex + 1);
console.log('Replacing block of length:', originalBlock.length);

const newContent = `{
                loading ? (
                    <div className="text-center py-10 text-gray-500">Caricamento staff...</div>
                ) : staff.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <div className="text-gray-400 text-lg mb-2">Nessun dipendente trovato</div>
                        <p className="text-gray-500 text-sm">Aggiungine uno o importa da Excel</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {['MANAGER', 'SALA', 'CUCINA'].map(section => {
                            const sectionStaff = staff.filter(s => {
                                const r = (s.ruolo || '').toUpperCase();
                                if (section === 'MANAGER') return r === 'MANAGER' || r.includes('DIRETTORE') || r.includes('TITOLARE');
                                if (section === 'CUCINA') return r === 'CUCINA' || r.includes('CHEF') || r.includes('CUOCO') || r.includes('LAVAPIATTI');
                                return r === 'SALA' || (!r.includes('MANAGER') && !r.includes('DIRETTORE') && !r.includes('TITOLARE') && !r.includes('CUCINA') && !r.includes('CHEF') && !r.includes('CUOCO'));
                            });

                            if (sectionStaff.length === 0) return null;

                            return (
                                <div key={section} className="animate-in fade-in duration-500">
                                    <div className="flex items-center gap-3 mb-4">
                                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white border-l-4 border-indigo-500 pl-3">
                                            {section}
                                        </h2>
                                        <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                            {sectionStaff.length}
                                        </span>
                                    </div>

                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {sectionStaff.map(s => {
                                                const initials = \`\${s.nome[0] || ''}\${s.cognome?.[0] || ''}\`.toUpperCase();
                                                const skillColors: any = {
                                                    SENIOR: 'from-purple-500 to-purple-600',
                                                    MEDIUM: 'from-blue-500 to-blue-600',
                                                    JUNIOR: 'from-orange-500 to-orange-600'
                                                };
                                                const skillColor = skillColors[s.skillLevel || ''] || 'from-gray-500 to-gray-600';

                                                return (
                                                    <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md dark:hover:shadow-indigo-900/10 transition-all duration-200 overflow-hidden group">
                                                        {/* Header with Avatar */}
                                                        <div className="p-6 pb-4">
                                                            <div className="flex items-start gap-4">
                                                                <div className={\`w-14 h-14 rounded-full bg-gradient-to-br \${skillColor} flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0\`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                                                        {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                                                    </h3>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold">
                                                                            {s.ruolo}
                                                                        </span>
                                                                        {s.productivityWeight !== undefined && s.productivityWeight !== 1.0 && (
                                                                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold border border-purple-200 dark:border-purple-800" title="Peso Produttività">
                                                                                {s.productivityWeight * 100}%
                                                                            </span>
                                                                        )}
                                                                        {s.skillLevel && (
                                                                            <span className="ml-2 text-yellow-500 font-bold" title={s.skillLevel}>
                                                                                {renderSkillLevel(s.skillLevel)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Info Section */}
                                                        <div className="px-6 pb-4 space-y-3">
                                                            {s.email && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <span className="text-gray-600 dark:text-gray-300 truncate">{s.email}</span>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 group relative hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition">
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                                                        Ore Contratto
                                                                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50" />
                                                                    </div>
                                                                    <div className="flex items-center text-sm font-bold text-gray-900 dark:text-white gap-1">
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-10 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                            defaultValue={s.oreMinime}
                                                                            onBlur={(e) => quickUpdateHours(s.id, parseInt(e.target.value) || 0, s.oreMassime)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                        <span className="text-gray-400">-</span>
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-10 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                            defaultValue={s.oreMassime}
                                                                            onBlur={(e) => quickUpdateHours(s.id, s.oreMinime, parseInt(e.target.value) || 0)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                        <span className="text-gray-400 text-xs font-normal">h</span>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-3 cursor-text hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition relative group">
                                                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 flex justify-between">
                                                                        Costo Orario
                                                                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50" />
                                                                    </div>
                                                                    <div className="flex items-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                                                        <span className="mr-1">€</span>
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-full"
                                                                            defaultValue={s.costoOra}
                                                                            onBlur={(e) => quickUpdateCost(s.id, parseFloat(e.target.value) || 0)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {s.postazioni.length > -1 && (
                                                                <div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Postazioni</div>
                                                                    <div className="flex flex-wrap gap-1.5 items-center">
                                                                        {interactPostazioni(s.postazioni, (p) => quickUpdateStations(s.id, s.postazioni, p, 'remove'))}
                                                                        <div className="relative">
                                                                            <button className="p-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300 transition">
                                                                                <Plus size={12} />
                                                                            </button>
                                                                            <select
                                                                                className="absolute inset-0 opacity-0 cursor-pointer w-full bg-slate-800"
                                                                                value=""
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) quickUpdateStations(s.id, s.postazioni, e.target.value, 'add');
                                                                                }}
                                                                            >
                                                                                <option value="">+</option>
                                                                                {availableStations.filter(as => !s.postazioni.includes(as)).sort().map(as => (
                                                                                    <option key={as} value={as}>{as}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions Footer */}
                                                        <div className="px-6 py-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                                                            <button
                                                                onClick={() => startEdit(s)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition text-sm font-medium"
                                                                title="Modifica"
                                                            >
                                                                <Edit2 size={14} />
                                                                Modifica
                                                            </button>
                                                            <button
                                                                onClick={() => setManagingAvailability({ id: s.id, nome: \`\${s.nome} \${s.cognome}\` })}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition text-sm font-medium"
                                                                title="Disponibilità"
                                                            >
                                                                <Clock size={14} />
                                                                Orari
                                                            </button>
                                                            <button
                                                                onClick={() => removeRow(s.id, s.nome)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition text-sm font-medium"
                                                                title="Elimina"
                                                            >
                                                                <Trash2 size={14} />
                                                                Elimina
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // LIST VIEW (Table)
                                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                                                    <tr>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ruolo</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ore (Min-Max)</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Postazioni</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Azioni</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                                    {sectionStaff.map(s => (
                                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                                                            <td className="p-4 font-medium text-gray-900 dark:text-white">
                                                                {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                                            </td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-300">
                                                                <div className="flex flex-wrap gap-1">
                                                                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold w-fit">{s.ruolo}</span>
                                                                    {s.productivityWeight !== undefined && s.productivityWeight !== 1.0 && (
                                                                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold border border-purple-200 dark:border-purple-800 w-fit" title="Peso Produttività">
                                                                            {s.productivityWeight * 100}%
                                                                        </span>
                                                                    )}
                                                                    {s.skillLevel && (
                                                                        <span className="text-yellow-500 font-bold ml-1" title={s.skillLevel}>
                                                                            {renderSkillLevel(s.skillLevel)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{s.email || '-'}</td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">
                                                                <div className="flex items-center gap-1 group">
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-8 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                        defaultValue={s.oreMinime}
                                                                        onBlur={(e) => quickUpdateHours(s.id, parseInt(e.target.value) || 0, s.oreMassime)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                    <span>-</span>
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-8 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                        defaultValue={s.oreMassime}
                                                                        onBlur={(e) => quickUpdateHours(s.id, s.oreMinime, parseInt(e.target.value) || 0)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                    <span className="opacity-0 group-hover:opacity-50 ml-1"><Edit2 size={10} /></span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-sm w-32">
                                                                <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1 w-full border border-transparent hover:border-gray-300 dark:hover:border-slate-600 transition">
                                                                    <span className="text-gray-400 mr-1">€</span>
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-full font-medium text-gray-700 dark:text-gray-300"
                                                                        defaultValue={s.costoOra}
                                                                        onBlur={(e) => quickUpdateCost(s.id, parseFloat(e.target.value) || 0)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex flex-wrap gap-1 items-center">
                                                                    {interactPostazioni(s.postazioni, (p) => quickUpdateStations(s.id, s.postazioni, p, 'remove'))}
                                                                    <div className="relative inline-block align-middle">
                                                                        <button className="p-0.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-400 transition">
                                                                            <Plus size={10} />
                                                                        </button>
                                                                        <select
                                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                if (e.target.value) quickUpdateStations(s.id, s.postazioni, e.target.value, 'add');
                                                                            }}
                                                                        >
                                                                            <option value="">+</option>
                                                                            {availableStations.filter(as => !s.postazioni.includes(as)).sort().map(as => (
                                                                                <option key={as} value={as}>{as}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => startEdit(s)}
                                                                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition"
                                                                        title="Modifica"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setManagingAvailability({ id: s.id, nome: \`\${s.nome} \${s.cognome}\` })}
                                                                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition"
                                                                        title="Disponibilità"
                                                                    >
                                                                        <Clock size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => removeRow(s.id, s.nome)}
                                                                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition"
                                                                        title="Elimina"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            }`;

const finalContent = content.substring(0, startIndex) + newContent + content.substring(endIndex + 1);
fs.writeFileSync(filePath, finalContent);
console.log('Successfully rewrote app/staff/page.tsx');
