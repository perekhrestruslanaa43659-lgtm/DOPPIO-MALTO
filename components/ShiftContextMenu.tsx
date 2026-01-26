
import React, { useEffect, useRef } from 'react';
import { Copy, Trash2, UserPlus, FileX, Scissors, Clipboard } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
}

export const ContextMenu = ({ x, y, onClose, onAction }: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div
            ref={ref}
            style={{ top: y, left: x }}
            className="fixed z-[100] bg-white border border-gray-200 shadow-xl rounded-lg py-1 min-w-[160px] flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
            <button onClick={() => onAction('copy')} className="px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2">
                <Copy size={14} className="text-gray-500" /> Copia
            </button>
            <button onClick={() => onAction('paste')} className="px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2">
                <Clipboard size={14} className="text-gray-500" /> Incolla
            </button>
            <div className="h-px bg-gray-100 my-1" />

            <button onClick={() => onAction('assign')} className="px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2">
                <UserPlus size={14} className="text-blue-500" /> Assegna Staff
            </button>
            <button onClick={() => onAction('absence')} className="px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2">
                <FileX size={14} className="text-orange-500" /> Segna Assente
            </button>

            <div className="h-px bg-gray-100 my-1" />

            <button onClick={() => onAction('delete')} className="px-3 py-2 text-xs text-left hover:bg-red-50 text-red-600 flex items-center gap-2">
                <Trash2 size={14} /> Elimina
            </button>
        </div>
    );
};
