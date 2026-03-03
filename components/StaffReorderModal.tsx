import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
    staff: any[];
    onClose: () => void;
    onSave: () => void;
}

export default function StaffReorderModal({ staff, onClose, onSave }: Props) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setItems([...staff]);
    }, [staff]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleAutoSort = () => {
        if (!confirm("Questo riorganizzerà tutto lo staff secondo la gerarchia aziendale:\n\nSALA:\n1. Direttore\n2. Vice Direttore\n3. Junior Manager\n4. Operatori\n\nCUCINA:\n1. Capo Cucina\n2. Manager\n3. Operatori\n\nConfermi?")) return;

        const sorted = [...items].sort((a, b) => {
            const pA = getRolePriority(a);
            const pB = getRolePriority(b);
            if (pA !== pB) return pA - pB;
            // Name fallback
            return (a.nome || '').localeCompare(b.nome || '');
        });
        setItems(sorted);
    };

    const saveOrder = async () => {
        setLoading(true);
        try {
            // Update all staff listIndex
            // Since we don't have batch update, we do one by one or create a new endpoint.
            // For ~15 staff, Promise.all is acceptable.
            const promises = items.map((s, index) =>
                api.updateStaff(s.id, { listIndex: index })
            );
            await Promise.all(promises);
            onSave();
            onClose();
        } catch (e: any) {
            alert("Errore salvataggio: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Reusing the logic from page.tsx for consistency
    const getRolePriority = (s: any) => {
        const role = (s.ruolo || '').toLowerCase();
        const name = (s.nome || '').toLowerCase();

        if (role.includes('store') || role.includes('general') || role.includes('titolare') || role.includes('proprietario')) return 5;

        // Juan special case
        if (name.includes('juan')) return 15;

        // Managers
        if (role.includes('junior')) return 12;
        if (role.includes('vice')) return 8;
        if (role.includes('manager') || role.includes('responsabile') || role.includes('direttore')) return 10;

        if (role.includes('formazione') || role.includes('apprendista') || role.includes('training')) return 18;
        if (role.includes('sala') || role.includes('cameriere') || role.includes('barista') || role.includes('runner') || role.includes('operatore')) return 20;
        if (role.includes('supporto') || role.includes('extra') || role.includes('stagista') || name.includes('supporto')) return 30;
        if (role.includes('cucina') || role.includes('cuoco') || role.includes('chef') || role.includes('pizzaiolo') || role.includes('lavapiatti')) return 40;

        return 25;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 outline-none" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl p-6 w-[500px] max-h-[80vh] flex flex-col outline-none"
                onClick={e => e.stopPropagation()}
                tabIndex={-1}
            >
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-800">Riordina Staff</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <div className="mb-4 bg-blue-50 p-3 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <p>Trascina le righe per cambiare l'ordine manuale. Usa "Auto Ordinamento" per applicare la gerarchia predefinita.</p>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 border rounded-lg">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <ul className="divide-y divide-gray-100">
                                {items.map((staff, index) => (
                                    <SortableItem key={staff.id} id={staff.id} staff={staff} index={index + 1} />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                    <button
                        onClick={handleAutoSort}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        <RefreshCw size={14} /> Auto Ordinamento
                    </button>

                    <button
                        onClick={saveOrder}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"
                    >
                        {loading ? 'Salvataggio...' : <><Save size={16} /> Salva Ordine</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SortableItem(props: { id: number, staff: any, index: number }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50">
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical size={20} />
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-mono font-bold text-gray-500">
                {props.index}
            </div>
            <div className="flex-1">
                <div className="font-bold text-sm text-gray-800">{props.staff.nome} {props.staff.cognome}</div>
                <div className="text-[10px] text-gray-400">{props.staff.ruolo}</div>
            </div>
        </li>
    );
}
