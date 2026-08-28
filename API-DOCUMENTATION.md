# Google Drive Backend API Documentation

This document outlines the API endpoints implemented in the codebase. All endpoints, payloads, query parameters, responses, and planned but unimplemented features are documented below.

---

## Base Configuration

*   **API Base URL**: `http://localhost:3000` (or as configured via `PORT` in `.env`)
*   **Authentication Mechanism**: HTTP-Only Cookie containing a state-backed JWT.
    *   Cookie Name: `gdrive_token`
    *   **Frontend Note**: Make sure to include `credentials: 'include'` (in `fetch`) or `withCredentials: true` (in `axios`) on all request configurations.

### Error Response Format
When a request fails, the API returns a standardized error payload:
```json
{
  "success": false,
  "message": "Error details or message description",
  "code": "ERROR_CODE"
}
```

---

## System / Utility Endpoints

### Health Check
Retrieves the health status of database and Redis services.

*   **URL**: `/health`
*   **Method**: `GET`
*   **Auth Required**: No
*   **Response (`200 OK` - Healthy)**:
    ```json
    {
      "status": "ok",
      "timestamp": "2026-08-28T07:15:00.000Z",
      "services": {
        "database": "ok",
        "redis": "ok"
      }
    }
    ```
*   **Response (`503 Service Unavailable` - Degraded)**:
    ```json
    {
      "status": "degraded",
      "timestamp": "2026-08-28T07:15:00.000Z",
      "services": {
        "database": "error",
        "redis": "ok"
      }
    }
    ```

---

## Authentication Endpoints (`/auth`)

### 1. Initiate Google Login
Initiates the OAuth 2.0 flow. Redirects the user to the Google consent screen.

*   **URL**: `/auth/google`
*   **Method**: `GET`
*   **Auth Required**: No
*   **Frontend Action**: Direct the browser window to this URL (do not fetch asynchronously).
    ```javascript
    window.location.href = 'http://localhost:3000/auth/google';
    ```

---

### 2. Google OAuth Callback
Google redirects the user here after authorization. On success, sets the HTTP-Only cookie `gdrive_token` and redirects to the frontend dashboard.

*   **URL**: `/auth/google/callback`
*   **Method**: `GET`
*   **Auth Required**: No
*   **Redirect Destination**: Redirects to `${CLIENT_URL}/dashboard` (defaults to `http://localhost:5000/dashboard`).

---

### 3. Google OAuth Failure Fallback
Redirect fallback endpoint when Google OAuth fails.

*   **URL**: `/auth/failure`
*   **Method**: `GET`
*   **Auth Required**: No
*   **Response (`401 Unauthorized`)**:
    ```json
    {
      "success": false,
      "message": "Google authentication failed"
    }
    ```

---

### 4. Get Current User Profile
Retrieves the logged-in user's profile metadata and storage usage metrics.

*   **URL**: `/auth/me`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "email": "user@example.com",
        "name": "Jane Doe",
        "avatar": "https://lh3.googleusercontent.com/a/avatar-url",
        "quota": 2147483648,
        "usedStorage": 0,
        "createdAt": "2026-08-27T13:10:00.000Z"
      }
    }
    ```

---

### 5. Logout
Revokes the session in Redis and clears the `gdrive_token` cookie.

*   **URL**: `/auth/logout`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Logged out successfully"
    }
    ```

---

## Folder Management Endpoints (`/folders`)

### 1. Create Folder
Creates a new folder at the root level or nested inside an existing parent folder.

*   **URL**: `/folders`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "name": "Project Documents",
      "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2" // Optional or null for root-level
    }
    ```
*   **Response (`201 Created`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
        "name": "Project Documents",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
        "isStarred": false,
        "deletedAt": null,
        "createdAt": "2026-08-27T15:20:00.000Z",
        "updatedAt": "2026-08-27T15:20:00.000Z"
      }
    }
    ```

---

### 2. List Root Folders
Lists active folders belonging to the user that reside at the root level (`parentId` is null).

*   **URL**: `/folders`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
          "name": "Finance",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "parentId": null,
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-27T15:10:00.000Z",
          "updatedAt": "2026-08-27T15:10:00.000Z"
        }
      ]
    }
    ```

---

### 3. List Starred Folders
Lists all starred active folders belonging to the user.

*   **URL**: `/folders/starred`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [...]
    }
    ```

---

### 4. List Trashed Folders
Lists all soft-deleted folders currently in the user's trash.

*   **URL**: `/folders/trash`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [...]
    }
    ```

---

### 5. Clear Trash
Permanently purges all soft-deleted folders and files. 

*   **URL**: `/folders/trash`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Deletion Rules**:
    *   **Unshared Files**: Hard-deleted from PostgreSQL, and physically deleted from S3.
    *   **Shared Files**: (Note: User-facing share creation is not implemented. However, the backend contains cascading logic that handles existing shared records: if a file has shared references, ownership is transferred to the first shared recipient, it is restored to active status for them, and its share record is removed. If no other users point to the file, it is hard-deleted from both the DB and S3).
    *   **Folders**: Permanently deletes all soft-deleted folders owned by the user.
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Trash cleared successfully"
    }
    ```

---

### 6. Get Folder Contents
Retrieves folder metadata along with its immediate child folders. (Note: Files inside this folder are retrieved via `/files?folderId=<id>`).

*   **URL**: `/folders/:id`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "folder": {
          "id": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
          "name": "Finance",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "parentId": null,
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-27T15:10:00.000Z",
          "updatedAt": "2026-08-27T15:10:00.000Z"
        },
        "children": [
          {
            "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
            "name": "Tax Receipts 2026",
            "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
            "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
            "isStarred": false,
            "deletedAt": null,
            "createdAt": "2026-08-27T15:20:00.000Z",
            "updatedAt": "2026-08-27T15:20:00.000Z"
          }
        ]
      }
    }
    ```

---

### 7. Get Full Recursive Subtree (Tree)
Returns a flat list of all folders recursively nested under the target folder (using a PostgreSQL CTE recursive query).

*   **URL**: `/folders/:id/tree`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
          "name": "Finance",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "parentId": null,
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-27T15:10:00.000Z",
          "updatedAt": "2026-08-27T15:10:00.000Z"
        },
        {
          "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
          "name": "Tax Receipts 2026",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-27T15:20:00.000Z",
          "updatedAt": "2026-08-27T15:20:00.000Z"
        }
      ]
    }
    ```

---

### 8. Get Breadcrumbs (Ancestor Path)
Returns the chronological chain of ancestor folders from root down to the parent of the specified folder (using recursive CTE).

*   **URL**: `/folders/:id/breadcrumb`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
          "name": "Finance",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "parentId": null,
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-27T15:10:00.000Z",
          "updatedAt": "2026-08-27T15:10:00.000Z"
        }
      ]
    }
    ```

---

### 9. Rename Folder
Updates the name of a folder.

*   **URL**: `/folders/:id/rename`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "name": "Tax Documents - FY2026"
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
        "name": "Tax Documents - FY2026",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
        "isStarred": false,
        "deletedAt": null,
        "createdAt": "2026-08-27T15:20:00.000Z",
        "updatedAt": "2026-08-28T07:15:00.000Z"
      }
    }
    ```

---

### 10. Star / Unstar Folder
Toggles the starred state of a folder.

*   **URL**: `/folders/:id/star`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "isStarred": true
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
        "name": "Tax Documents - FY2026",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
        "isStarred": true,
        "deletedAt": null,
        "createdAt": "2026-08-27T15:20:00.000Z",
        "updatedAt": "2026-08-28T07:15:00.000Z"
      }
    }
    ```

---

### 11. Soft Delete Folder (Move to Trash)
Moves a folder to trash by setting the `deletedAt` timestamp.

*   **URL**: `/folders/:id`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Folder moved to trash"
    }
    ```

---

### 12. Restore Folder from Trash
Restores a soft-deleted folder back to active status (resets `deletedAt` to null).

*   **URL**: `/folders/:id/restore`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
        "name": "Tax Documents - FY2026",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "parentId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
        "isStarred": true,
        "deletedAt": null,
        "createdAt": "2026-08-27T15:20:00.000Z",
        "updatedAt": "2026-08-28T07:15:00.000Z"
      }
    }
    ```

---

## Multipart Upload Endpoints (`/uploads`)

### 1. Initiate Upload Session
Checks user storage quota, validates folder ownership, requests an S3 Multipart Upload Session, and saves metadata in the database.

*   **URL**: `/uploads/initiate`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "filename": "annual-report.pdf",
      "mimeType": "application/pdf",
      "size": 15728640, // size in bytes (15 MB)
      "folderId": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2" // optional destination folder ID (or null/omit for root)
    }
    ```
*   **Response (`201 Created`)**:
    ```json
    {
      "success": true,
      "data": {
        "uploadId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "key": "uploads/787c8a32-1bfa-4c4f-9e67-d86b5952f4b0/3fa85f64-5717-4562-b3fc-2c963f66afa6-annual-report.pdf"
      }
    }
    ```

---

### 2. Generate Presigned URL for Upload Part
Generates a signed AWS S3 URL to upload a specific part/chunk of the file.

*   **URL**: `/uploads/:id/parts/:partNumber/presign`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Route Parameters**:
    *   `:id` — The `uploadId` returned from `/uploads/initiate`.
    *   `:partNumber` — The 1-based index of the part (e.g. 1, 2, 3, etc.). Must be between 1 and 10000.
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "url": "https://my-bucket.s3.amazonaws.com/uploads/..."
      }
    }
    ```

---

### 3. Complete Upload Session
Informs AWS S3 to assemble the uploaded parts into a single object, indexes the uploaded parts in the database, atomically creates the file record, updates the user's used storage, and marks the upload session as `completed`.

*   **URL**: `/uploads/:id/complete`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "parts": [
        { "partNumber": 1, "etag": "\"b742b78ac1e...\"" },
        { "partNumber": 2, "etag": "\"a983b63ec5a...\"" }
      ]
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "originalName": "annual-report.pdf",
        "s3Key": "uploads/787c8a32-1bfa-4c4f-9e67-d86b5952f4b0/3fa85f64-5717-4562-b3fc-2c963f66afa6-annual-report.pdf",
        "s3Bucket": "my-bucket",
        "mimeType": "application/pdf",
        "size": 15728640,
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "folderId": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
        "thumbnailStatus": "pending",
        "isStarred": false,
        "createdAt": "2026-08-28T07:20:00.000Z",
        "updatedAt": "2026-08-28T07:20:00.000Z"
      }
    }
    ```

---

### 4. Abort Upload Session
Aborts the upload session in AWS S3 and updates the session status in the database to `aborted`.

*   **URL**: `/uploads/:id/abort`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Upload aborted successfully"
    }
    ```

---

## File Management Endpoints (`/files`)

Files are created implicitly via the multipart upload workflow. These endpoints are used to list, manage, and delete existing file records.

### 1. List Files
Lists files owned by the user. Supports filtering and searching via optional query parameters.

*   **URL**: `/files`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Query Parameters** (all optional):
    *   `folderId` — Filter files inside a specific folder ID. Use `"root"` or `"null"` to list root-level files only. Omit to list all files recursively.
    *   `q` — Case-insensitive search term against `originalName`.
    *   `starred` — Set to `"true"` to filter starred files only.
    *   `trash` — Set to `"true"` to filter soft-deleted files only.
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
          "originalName": "annual-report.pdf",
          "s3Key": "uploads/787c8a32-1bfa-4c4f-9e67-d86b5952f4b0/3fa85f64-5717-4562-b3fc-2c963f66afa6-annual-report.pdf",
          "s3Bucket": "my-bucket",
          "mimeType": "application/pdf",
          "size": 15728640,
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "folderId": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
          "thumbnailS3Key": null,
          "thumbnailStatus": "pending",
          "isStarred": false,
          "deletedAt": null,
          "createdAt": "2026-08-28T07:20:00.000Z",
          "updatedAt": "2026-08-28T07:20:00.000Z"
        }
      ]
    }
    ```

---

### 2. Get Presigned Download URL
Generates a signed AWS S3 URL for downloading the file. The link defaults to a 15-minute expiration window and forces a file download via `Content-Disposition`.

*   **URL**: `/files/:id/download`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "url": "https://my-bucket.s3.amazonaws.com/uploads/...&X-Amz-Expires=900&..."
      }
    }
    ```
*   **Frontend Action**: Redirect the user or open the link in a new tab to initiate download:
    ```javascript
    const { data } = await api.get(`/files/${fileId}/download`);
    window.open(data.data.url, '_blank');
    ```

---

### 3. Get Thumbnail URL (*Planned Feature Status*)
Generates a signed AWS S3 URL to view the thumbnail image.

*   **URL**: `/files/:id/thumbnail`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Backend Behavior**:
    *   Since **async thumbnail generation is planned but not yet implemented**, this endpoint currently always returns `202 Accepted` with `data: null`.
*   **Response (`202 Accepted` - Not Yet Generated)**:
    ```json
    {
      "success": true,
      "data": null,
      "message": "Thumbnail not yet available"
    }
    ```
*   **Frontend Action**: See the **Planned / Unimplemented Features** section below for instructions on how to handle this in the UI.

---

### 4. Rename File
Renames the file's display name (`originalName`). The underlying S3 Key is unchanged.

*   **URL**: `/files/:id/rename`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "name": "Annual Report - FY2026.pdf"
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "originalName": "Annual Report - FY2026.pdf",
        "updatedAt": "2026-08-28T07:22:00.000Z"
      }
    }
    ```

---

### 5. Star / Unstar File
Toggles the starred state of a file.

*   **URL**: `/files/:id/star`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "isStarred": true
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "isStarred": true,
        "updatedAt": "2026-08-28T07:22:00.000Z"
      }
    }
    ```

---

### 6. Move File
Moves a file to another folder or to the root level.

*   **URL**: `/files/:id/move`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "folderId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2" // folder UUID, or null to move to root-level
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "folderId": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
        "updatedAt": "2026-08-28T07:25:00.000Z"
      }
    }
    ```

---

### 7. Soft Delete File (Move to Trash)
Moves a file to the user's trash by setting `deletedAt`. Atomically decrements the file size from the user's `usedStorage` quota.

*   **URL**: `/files/:id`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "File moved to trash"
    }
    ```

---

### 8. Restore File from Trash
Restores a soft-deleted file by clearing `deletedAt`. Atomically increments the file size back onto the user's `usedStorage` quota.

*   **URL**: `/files/:id/restore`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "deletedAt": null,
        "updatedAt": "2026-08-28T07:28:00.000Z"
      }
    }
    ```

---

### 9. Permanently Delete File
Irreversibly deletes the file record from the database and immediately removes the physical file from AWS S3. If the file was active (not soft-deleted), decrements the user's `usedStorage` quota.

*   **URL**: `/files/:id/permanent`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "File permanently deleted"
    }
    ```

---

## Share Management Endpoints (`/shares`)

All sharing endpoints require the `gdrive_token` cookie to be present.

### 1. Create Share
Shares a file or folder with another user by their email address.

*   **URL**: `/shares`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "resourceType": "file", // "file" or "folder"
      "resourceId": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
      "email": "recipient@example.com",
      "permission": "view", // "view" or "edit"
      "expiresAt": "2026-09-01T00:00:00.000Z" // Optional, null or omit for no expiration
    }
    ```
*   **Response (`201 Created`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
        "resourceType": "file",
        "resourceId": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "sharedWithId": "b1c2d3e4-f5a6-7b8c-9d0e-f1a2b3c4d5e6",
        "permission": "view",
        "expiresAt": "2026-09-01T00:00:00.000Z",
        "createdAt": "2026-08-28T08:00:00.000Z",
        "updatedAt": "2026-08-28T08:00:00.000Z"
      }
    }
    ```

---

### 2. List Received Shares ("Shared with Me")
Lists all active shares shared with the logged-in user. Excludes expired shares.

*   **URL**: `/shares/received`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
          "resourceType": "file",
          "resourceId": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
          "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
          "sharedWithId": "b1c2d3e4-f5a6-7b8c-9d0e-f1a2b3c4d5e6",
          "permission": "view",
          "expiresAt": "2026-09-01T00:00:00.000Z",
          "createdAt": "2026-08-28T08:00:00.000Z",
          "updatedAt": "2026-08-28T08:00:00.000Z"
        }
      ]
    }
    ```

---

### 3. List Sent Shares ("My Shares")
Lists all shares created/sent by the logged-in user.

*   **URL**: `/shares/sent`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [...]
    }
    ```

---

### 4. Update Share
Updates the permission level or expiration date of a share record.

*   **URL**: `/shares/:id`
*   **Method**: `PATCH`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "permission": "edit", // Optional
      "expiresAt": null // Optional, pass null to remove expiration date
    }
    ```
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
        "permission": "edit",
        "expiresAt": null,
        "updatedAt": "2026-08-28T08:05:00.000Z"
      }
    }
    ```

---

### 5. Revoke Share
Deletes a share record, revoking recipient access.

*   **URL**: `/shares/:id`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Share revoked successfully"
    }
    ```

---

## Public Link Endpoints (`/public`)

Manage and resolve unauthenticated access links.

### 1. Create Public Link
Generates a unique, public access URL token for a file or folder.

*   **URL**: `/public`
*   **Method**: `POST`
*   **Auth Required**: Yes
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
    ```json
    {
      "resourceType": "file", // "file" or "folder"
      "resourceId": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
      "expiresAt": "2026-09-05T12:00:00.000Z" // Optional, null or omit for no expiration
    }
    ```
*   **Response (`201 Created`)**:
    ```json
    {
      "success": true,
      "data": {
        "id": "c8d7e6f5-a4b3-c2d1-e0f9-a8b7c6d5e4f3",
        "token": "4gY8hJ2kLmNpQrStUvWxY", // Unique generated token (NanoID)
        "resourceType": "file",
        "resourceId": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
        "ownerId": "787c8a32-1bfa-4c4f-9e67-d86b5952f4b0",
        "expiresAt": "2026-09-05T12:00:00.000Z",
        "createdAt": "2026-08-28T08:10:00.000Z"
      }
    }
    ```

---

### 2. List My Public Links
Lists all active public links created by the user.

*   **URL**: `/public`
*   **Method**: `GET`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "data": [...]
    }
    ```

---

### 3. Resolve Public Link
Fetches resource info and access credentials using a public link token. **This endpoint does not require authentication.**

*   **URL**: `/public/:token`
*   **Method**: `GET`
*   **Auth Required**: No
*   **Response (`200 OK` - File Resource)**: Returns metadata and a signed AWS S3 download URL.
    ```json
    {
      "success": true,
      "data": {
        "type": "file",
        "file": {
          "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
          "originalName": "annual-report.pdf",
          "mimeType": "application/pdf",
          "size": 15728640,
          "createdAt": "2026-08-28T07:20:00.000Z"
        },
        "url": "https://my-bucket.s3.amazonaws.com/uploads/...&X-Amz-Expires=900&..."
      }
    }
    ```
*   **Response (`200 OK` - Folder Resource)**: Returns folder metadata, active subfolders, and files inside it.
    ```json
    {
      "success": true,
      "data": {
        "type": "folder",
        "folder": {
          "id": "e5bfa7cd-f00e-461b-90f7-eeab196a0bf2",
          "name": "Project Documents",
          "createdAt": "2026-08-27T15:20:00.000Z"
        },
        "subfolders": [
          {
            "id": "d718a38c-8517-4ef8-bc23-8889aa36a7b2",
            "name": "Subfolder Name",
            "createdAt": "2026-08-28T07:00:00.000Z"
          }
        ],
        "files": [
          {
            "id": "e6a0d24c-9f66-4c74-bfb7-251f92e35a09",
            "originalName": "annual-report.pdf",
            "mimeType": "application/pdf",
            "size": 15728640,
            "createdAt": "2026-08-28T07:20:00.000Z"
          }
        ]
      }
    }
    ```

---

### 4. Revoke Public Link
Revokes/deletes a public link token.

*   **URL**: `/public/:id`
*   **Method**: `DELETE`
*   **Auth Required**: Yes
*   **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Public link revoked successfully"
    }
    ```

---

## Planned / Unimplemented Features

The following features have database structures or placeholder configurations in place, but **are not yet implemented** on the backend.

### 1. Async Thumbnail Generation (Phase 6)
*   **Current State**: 
    *   The database fields `thumbnail_s3_key` and `thumbnail_status` exist in the `files` schema.
    *   The `GET /files/:id/thumbnail` route exists.
    *   However, the background RabbitMQ worker (`src/worker.ts`) and image/PDF/video thumbnail generation consumers have **not** been implemented. 
    *   All newly uploaded files remain in `"pending"` or `"processing"` thumbnail status indefinitely.
*   **Backend Output**: `GET /files/:id/thumbnail` will consistently return `202 Accepted` with `data: null`.
*   **Frontend Action & Guidelines**:
    *   **DO NOT** initiate polling loops on `/files/:id/thumbnail`.
    *   **DO NOT** display infinite loading spinners or loaders in the file explorer.
    *   **Fallback Strategy**: When rendering the file list or preview, the frontend should inspect the file's `mimeType` or check for the `202` response status, and immediately display a matching static file icon instead (e.g., standard icons for images, PDFs, videos, audio, etc.).

---

## Frontend Integration Recipes

### 1. File Upload Pipeline
To perform a resumable multipart upload:
1.  **Initiate Upload**: Send a `POST` request to `/uploads/initiate` with the file metadata. Save the returned `uploadId` and S3 key.
2.  **Upload Parts**:
    *   Slice the file into chunks of equal size (must be at least 5 MB per chunk, except the last one).
    *   For each chunk, request a signed S3 upload URL by calling `GET /uploads/:id/parts/:partNumber/presign`.
    *   Perform a `PUT` request with the chunk's binary data directly to the returned presigned URL.
    *   Retrieve and store the S3 response `ETag` header along with its 1-indexed `partNumber`.
3.  **Complete Upload**: Send a `POST` request to `/uploads/:id/complete` listing all etags and part numbers in order. This registers the file record and adds its size to the user's storage quota.
4.  **Abort Upload**: If the upload is cancelled by the user, send a `POST` request to `/uploads/:id/abort` to abort S3 upload and mark the session as aborted.
