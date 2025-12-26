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
    // In Supabase Storage, folders typically don't have an 'id' field
    // Files have both 'id' and other metadata, while folders only have 'name'
    const folders = data.filter(item => !item.id);
    const files = data.filter(item => item.id);

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
 * @returns {Object} Object with publicUrl and error (if any)
 */
export function getSchedulingFileUrl(filePath) {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }

    const { data } = supabase.storage
      .from('scheduling')
      .getPublicUrl(filePath);

    if (!data || !data.publicUrl) {
      throw new Error('Failed to generate public URL');
    }

    return { publicUrl: data.publicUrl, error: null };
  } catch (error) {
    console.error('Error getting public URL:', error);
    return { publicUrl: null, error: error.message };
  }
}
