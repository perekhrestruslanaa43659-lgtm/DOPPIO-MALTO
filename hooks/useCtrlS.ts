import { useEffect, useCallback } from 'react';

/**
 * useCtrlS — fires `callback` when the user presses Ctrl+S (or Cmd+S on Mac).
 * Also dispatches a global `app:save` CustomEvent so any component can subscribe
 * without prop drilling.
 *
 * Usage:
 *   useCtrlS(() => saveMyData());
 */
export function useCtrlS(callback?: () => void) {
    const handler = useCallback(
        (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                callback?.();
                window.dispatchEvent(new CustomEvent('app:save'));
            }
        },
        [callback]
    );

    useEffect(() => {
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handler]);
}

/**
 * useOnAppSave — subscribe to the global `app:save` event without registering
 * a new Ctrl+S handler (useful for sub-components).
 */
export function useOnAppSave(callback: () => void) {
    const cb = useCallback(callback, [callback]);
    useEffect(() => {
        const wrapped = () => cb();
        window.addEventListener('app:save', wrapped);
        return () => window.removeEventListener('app:save', wrapped);
    }, [cb]);
}
