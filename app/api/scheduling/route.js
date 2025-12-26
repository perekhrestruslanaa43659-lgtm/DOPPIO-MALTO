import { NextResponse } from 'next/server';
import { loadSchedulingFiles } from '../../../backend/scheduling';

/**
 * GET /api/scheduling
 * Load all files and folders from the scheduling bucket
 * Query parameters:
 * - path: Optional folder path within the scheduling bucket
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path') || '';

    const result = await loadSchedulingFiles(folderPath);

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error in /api/scheduling:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load scheduling files'
      },
      { status: 500 }
    );
  }
}
