import { supabase } from '../lib/supabaseClient';

export default function SaveChangesButton({ shifts }) {
  const handleSave = async () => {
    try {
      const { data, error } = await supabase.from('shifts').upsert(shifts);

      if (error) {
        console.error('Error saving shifts:', error);
      } else {
        console.log('Shifts saved successfully:', data);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  return (
    <button onClick={handleSave}>
      Salva Modifiche
    </button>
  );
}