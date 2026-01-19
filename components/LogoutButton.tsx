'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
            });

            if (response.ok) {
                // Force a hard refresh to clear client-side cache and cookies
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleLogout}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50"
        >
            {loading ? 'Uscita...' : 'Esci'}
        </button>
    );
}
