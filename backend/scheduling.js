import { supabase } from '../lib/supabaseClient';

/**
 * Load all files and folders from the scheduling bucket in Supabase Storage
 * @param {string} folderPath - Optional folder path within the scheduling bucket (default: root)
 * @returns {Promise<Object>} Object containing files and folders
 */
export async function loadSchedulingFiles(folderPath = '') {
  try {
    const { data, error } = await supabase.storage
      .from('scheduling')
      .list(folderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Error loading scheduling files:', error);
      throw error;
    }

    // Separate files and folders
    const folders = data.filter(item => item.id === null);
    const files = data.filter(item => item.id !== null);

    return {
      success: true,
      path: folderPath,
      folders,
      files,
      total: data.length
    };
  } catch (error) {
    console.error('Error in loadSchedulingFiles:', error);
    throw error;
  }
}

/**
 * Get a public URL for a file in the scheduling bucket
 * @param {string} filePath - Path to the file in the scheduling bucket
 * @returns {string} Public URL for the file
 */
export function getSchedulingFileUrl(filePath) {
  const { data } = supabase.storage
    .from('scheduling')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
