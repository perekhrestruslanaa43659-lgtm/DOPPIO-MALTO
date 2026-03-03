
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string | number;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchableSelect({ options, value, onChange, placeholder = "Seleziona...", className = "" }: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setHighlightedIndex(0); // Reset highlight locally
        }
    }, [isOpen]);

    // Scroll to highlighted item
    useEffect(() => {
        if (isOpen && listRef.current) {
            const highlightedElement = listRef.current.children[highlightedIndex + 1] as HTMLElement; // +1 to skip search input container if it's inside or adjust selector
            // Actually, better to use a specific selector or ref array, but let's try scrollIntoView if we can identify it.
            // A simpler way with current structure:
            // The list has a sticky header (index 0). So options start at index 1? No, map is below.
            // Let's rely on simple scrolling for now or improve structure if needed. 
            // Since it's a small list often, maybe skip complex scrolling logic for v1 unless requested.
        }
    }, [highlightedIndex, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
                break;
            case "Enter":
                e.preventDefault();
                e.stopPropagation();
                if (isOpen && filteredOptions.length > 0) {
                    onChange(filteredOptions[highlightedIndex].value);
                    setIsOpen(false);
                } else if (!isOpen) {
                    setIsOpen(true);
                }
                break;
            case "Escape":
                setIsOpen(false);
                break;
        }
    };

    return (
        <div
            className={`relative ${className}`}
            ref={wrapperRef}
            onKeyDown={handleKeyDown}
            onBlur={(e) => {
                // Close if focus moves outside the component
                if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
                    setIsOpen(false);
                }
            }}
        >
            <div
                tabIndex={0}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white flex items-center justify-between cursor-pointer focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm outline-none transition-all"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearchTerm('');
                    // Optional: focus input immediately if opening?
                    // Effect handles it.
                }}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-500' : 'text-gray-900'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className="text-gray-400 ml-2" />
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white shadow-xl max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-gray-100" ref={listRef}>
                    <div className="sticky top-0 bg-white p-2 border-b border-gray-100 z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-8 pr-2 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Cerca..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setHighlightedIndex(0);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    // Propagate keys to wrapper or handle here
                                    // wrapper handleKeyDown captures bubbles, but input needs to not swallow arrow keys unless controlled.
                                    // Actually, standard inputs allow arrow keys for cursor.
                                    // We should only hijack Up/Down if we want list navigation instead of cursor move.
                                    // Let's override Up/Down here to prevent cursor move and Nav list instead.
                                    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
                                        // Let it bubble or handle explicitly?
                                        // e.preventDefault() in wrapper might not work if input swallows it?
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {filteredOptions.length === 0 ? (
                        <div className="cursor-default select-none relative py-2 px-4 text-gray-500 italic text-center">
                            Nessun risultato.
                        </div>
                    ) : (
                        filteredOptions.map((opt, index) => (
                            <div
                                key={opt.value}
                                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 transition-colors ${index === highlightedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                                    } ${String(opt.value) === String(value) ? 'font-medium bg-blue-50/50' : ''}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <span className="block truncate">{opt.label}</span>
                                {String(opt.value) === String(value) && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                                        <Check size={16} />
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
