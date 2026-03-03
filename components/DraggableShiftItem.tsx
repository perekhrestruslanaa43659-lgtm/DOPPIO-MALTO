
import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShiftItemProps {
    assignment: any;
    type: 'PRANZO' | 'SERA';
    onUpdate: (id: number, data: any) => void;
    onContextMenu: (e: React.MouseEvent, asn: any) => void;
}

export const DraggableShiftItem = ({ assignment, type, onUpdate, onContextMenu }: ShiftItemProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `shift-${assignment.id}`,
        data: { assignment }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 1,
        touchAction: 'none',
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");

    const startTime = assignment.start_time || assignment.shiftTemplate?.oraInizio || "";
    const endTime = assignment.end_time || assignment.shiftTemplate?.oraFine || "";
    const station = assignment.postazione || "";
    const accent = assignment._groupAccent;

    // Left accent border per group
    const accentBorder =
        accent === 'MANAGER' ? 'border-l-[3px] border-l-indigo-400' :
            accent === 'SALA' ? 'border-l-[3px] border-l-sky-400' :
                accent === 'CUCINA' ? 'border-l-[3px] border-l-amber-400' : '';

    // Pastel palette: PRANZO = soft blue, SERA = soft violet
    const colorScheme = type === 'PRANZO'
        ? 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100'
        : 'bg-violet-50 border-violet-200 text-violet-900 hover:bg-violet-100';

    const handleDoubleClick = () => {
        setEditValue(`${startTime}-${endTime}`);
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        const [start, end] = editValue.split('-');
        if (start && end && (start !== startTime || end !== endTime)) {
            onUpdate(assignment.id, { start_time: start.trim(), end_time: end.trim() });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
    };

    if (isEditing) {
        return (
            <div className="p-1 bg-white border border-indigo-400 rounded-xl shadow-md z-50">
                <input
                    autoFocus
                    className="w-full text-xs font-mono outline-none"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="HH:mm-HH:mm"
                />
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => onContextMenu(e, assignment)}
            className={`
                relative group rounded-xl px-2 py-1.5 text-xs border cursor-grab active:cursor-grabbing
                flex flex-col gap-0.5 shadow-sm hover:shadow-md transition-all duration-150 select-none
                ${colorScheme}
                ${!assignment.status ? '' : ''}
                ${accentBorder}
            `}
        >
            {/* Row 1: time range + note icon */}
            <div className="flex items-center justify-between gap-1 font-bold leading-none w-full">
                <span className="whitespace-nowrap text-[11px] tracking-tight">{startTime}–{endTime}</span>
                {assignment.note && (
                    <span title={assignment.note} className="flex-shrink-0">
                        <FileText size={8} className="opacity-50" />
                    </span>
                )}
            </div>
            {/* Row 2: postazione */}
            {station
                ? <span className="text-[9px] font-semibold opacity-60 truncate leading-tight">{station}</span>
                : <span className="text-[9px] italic opacity-25 leading-tight">—</span>
            }
            {!assignment.status && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" title="Draft" />}
        </div>
    );
};
