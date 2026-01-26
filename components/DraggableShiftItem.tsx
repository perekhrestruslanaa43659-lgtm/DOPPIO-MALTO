
import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clock, MapPin, Copy, Trash2, UserPlus, FileX } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShiftItemProps {
    assignment: any;
    type: 'PRANZO' | 'SERA'; // Visual hint
    onUpdate: (id: number, data: any) => void; // For Inline Edit
    onContextMenu: (e: React.MouseEvent, asn: any) => void;
}

export const DraggableShiftItem = ({ assignment, type, onUpdate, onContextMenu }: ShiftItemProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `shift-${assignment.id}`,
        data: { assignment }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 1,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");

    const startTime = assignment.start_time || assignment.shiftTemplate?.oraInizio || "";
    const endTime = assignment.end_time || assignment.shiftTemplate?.oraFine || "";
    const station = assignment.postazione || "";

    const handleDoubleClick = () => {
        setEditValue(`${startTime}-${endTime}`);
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        // Parse "HH:mm-HH:mm"
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
            <div className="p-1 bg-white border border-blue-500 rounded shadow-md z-50">
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
                relative group rounded px-2 py-1 text-xs border cursor-grab active:cursor-grabbing
                flex flex-col gap-0.5 hover:shadow-md transition-shadow select-none
                ${type === 'PRANZO' ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-amber-100 border-amber-300 text-amber-900'}
                ${!assignment.status ? 'border-dashed opacity-80' : ''} 
            `}
        >
            <div className="flex items-center justify-between font-bold leading-none">
                <span>{startTime} - {endTime}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-80 font-medium truncate">
                <MapPin size={8} />
                {station || <span className="italic text-gray-400">No Post.</span>}
            </div>
            {!assignment.status && <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full" title="Draft" />}
        </div>
    );
};
