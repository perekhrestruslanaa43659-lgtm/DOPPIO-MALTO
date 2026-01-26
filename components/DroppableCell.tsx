
import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
    staffId: number;
    date: string;
    type: 'PRANZO' | 'SERA';
    children?: React.ReactNode;
}

export const DroppableCell = ({ staffId, date, type, children }: DroppableCellProps) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `cell-${staffId}|${date}|${type}`,
        data: { staffId, date, type }
    });

    return (
        <td
            ref={setNodeRef}
            className={`
                border-r border-gray-100 p-1 min-w-[100px] h-[50px] align-top transition-colors
                ${isOver ? (type === 'PRANZO' ? 'bg-blue-100' : 'bg-indigo-100') : ''}
            `}
        >
            <div className="h-full w-full flex flex-col gap-1 min-h-[40px]">
                {children}
            </div>
        </td>
    );
};
