# Scheduling Files API

This API endpoint allows you to load files and folders from the Supabase Storage "scheduling" bucket.

## Endpoint

`GET /api/scheduling`

## Query Parameters

- `path` (optional): Folder path within the scheduling bucket. Defaults to the root folder if not provided.

## Response Format

```json
{
  "success": true,
  "path": "folder/path",
  "folders": [
    // Array of folder objects
  ],
  "files": [
    {
      "id": "file-id",
      "name": "filename.pdf",
      "created_at": "2025-12-26T10:00:00Z",
      "updated_at": "2025-12-26T10:00:00Z",
      "metadata": {}
    }
  ],
  "total": 10
}
```

## Example Usage

### Get files from root folder
```bash
curl http://localhost:3000/api/scheduling
```

### Get files from a specific subfolder
```bash
curl http://localhost:3000/api/scheduling?path=2025/january
```

## Backend Functions

The following functions are available in `/backend/scheduling.js`:

### loadSchedulingFiles(folderPath)
Loads all files and folders from the scheduling bucket.

**Parameters:**
- `folderPath` (string, optional): Path within the scheduling bucket

**Returns:**
- Promise<Object>: Object containing success status, path, folders, files, and total count

### getSchedulingFileUrl(filePath)
Gets a public URL for a file in the scheduling bucket.

**Parameters:**
- `filePath` (string): Path to the file in the scheduling bucket

**Returns:**
- Object: `{ publicUrl: string | null, error: string | null }`
  - `publicUrl`: The public URL for the file (or null if error)
  - `error`: Error message if the operation failed (or null if successful)

## Setup

Make sure you have the following environment variables configured:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

The Supabase Storage bucket "scheduling" must exist in your project.
