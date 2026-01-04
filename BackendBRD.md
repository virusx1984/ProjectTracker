# ProjectTracker Pro - Backend API Specifications

**Version:** 1.0.0
**Date:** 2026-01-04
**Status:** Draft / Approved

---

## 1. Overview
The goal of this document is to define the backend RESTful API requirements for the **ProjectTracker Pro** application. 
The backend will serve as a data persistence layer, handling JSON data sent by the frontend, compressing it, and archiving it into an Oracle database.

**Core Architecture:**
* **Architecture:** Decoupled (Frontend-Backend Separation).
* **Protocol:** HTTP/1.1 (RESTful).
* **Data Format:** JSON (Network Transmission) -> Gzip/BLOB (Database Storage).
* **Versioning Strategy:** Insert-only. Every save creates a new version record.

## 2. Technical Stack Requirements
* **Language/Framework:** Python 3.x / Flask.
* **Database:** Oracle Database 11g (or higher).
* **Database Driver:** `cx_Oracle`.
    * *Requirement:* Must use **`cx_Oracle.SessionPool`** to handle concurrency efficiently.
* **Compression:** Python standard `gzip` library.

---

## 3. Database Schema Design

The backend must create a single table to store project versions.

### Table: `PROJECT_VERSIONS`

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **`VERSION_ID`** | `VARCHAR2(36)` | PK, Not Null | Unique UUID (v4) for this specific version. |
| **`PROJECT_NAME`** | `VARCHAR2(200)` | Not Null | The unique identifier for the project (e.g., "Fab2_Schedule"). |
| **`DATA_BLOB`** | **`BLOB`** | Not Null | **Gzipped** binary content of the JSON data. |
| **`CREATED_BY`** | `VARCHAR2(50)` | Nullable | User who performed the save action. |
| **`CREATED_AT`** | `TIMESTAMP` | Default `SYSDATE` | Server-side timestamp. |
| **`REMARK`** | `VARCHAR2(500)` | Nullable | Optional commit message or note. |

### Indices
* **Index 1:** `(PROJECT_NAME, CREATED_AT DESC)` 
    * *Purpose:* Critical for performance. Allows O(1) retrieval of the "Latest" version.

---

## 4. API Interface Specifications

**Base URL:** `/api/v1`

### 4.1. Save Project Version
Creates a new version record in the database.

* **Endpoint:** `POST /project/save`
* **Content-Type:** `application/json`
* **Request Body:**
    ```json
    {
      "projectName": "Fab2_Schedule",
      "user": "Admin",
      "remark": "Updated phase 1 milestones",
      "data": {
        // ... Complete Project JSON Object ...
      }
    }
    ```
* **Backend Logic:**
    1.  Validate `projectName` and `data` are present.
    2.  Convert `data` object to JSON string.
    3.  **Compress:** Use `gzip.compress()` to convert the JSON string into binary bytes.
    4.  Generate a new UUID for `VERSION_ID`.
    5.  `INSERT` into `PROJECT_VERSIONS` (Store the binary bytes into the BLOB column).
    6.  Commit transaction.
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "message": "Saved successfully",
      "versionId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-01-04 14:30:00"
    }
    ```

### 4.2. Load Latest Version
Retrieves the most recent data for a specific project.

* **Endpoint:** `GET /project/latest`
* **Query Parameters:**
    * `projectName` (Required): e.g., `Fab2_Schedule`
* **Backend Logic:**
    1.  Query `PROJECT_VERSIONS` filtered by `projectName`.
    2.  Order by `CREATED_AT DESC`.
    3.  Fetch the first row (Limit 1).
    4.  **Decompress:** Read the `DATA_BLOB` and use `gzip.decompress()` to restore the JSON string.
    5.  Parse and return the JSON object.
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "projectName": "Fab2_Schedule",
      "versionId": "...",
      "timestamp": "...",
      "data": {
        // ... The Decompressed JSON Data ...
      }
    }
    ```
* **Error Response (404 Not Found):**
    * If no records exist for this `projectName`.

### 4.3. Get Version History (Metadata Only)
Retrieves a list of historical versions for rollback purposes. **Do NOT return the BLOB data here.**

* **Endpoint:** `GET /project/history`
* **Query Parameters:**
    * `projectName` (Required)
    * `limit` (Optional, default 20)
* **Backend Logic:**
    * `SELECT VERSION_ID, CREATED_AT, CREATED_BY, REMARK FROM PROJECT_VERSIONS WHERE ... ORDER BY CREATED_AT DESC`
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "history": [
        {
          "versionId": "uuid-1",
          "createdAt": "2026-01-04 14:30:00",
          "createdBy": "Admin",
          "remark": "Updated phase 1 milestones"
        },
        {
          "versionId": "uuid-2",
          "createdAt": "2026-01-03 09:15:00",
          "createdBy": "UserB",
          "remark": "Initial commit"
        }
      ]
    }
    ```

### 4.4. Load Specific Version
Retrieves the full data for a specific historical version.

* **Endpoint:** `GET /project/version`
* **Query Parameters:**
    * `versionId` (Required): UUID of the version.
* **Backend Logic:**
    1.  Select `DATA_BLOB` by `VERSION_ID`.
    2.  **Decompress** and return JSON.

---

## 5. Non-Functional Requirements

1.  **Concurrency:**
    * The API handles database connections via `cx_Oracle.SessionPool` to ensure high throughput.
    * Do not open/close a new connection for every request.
2.  **Security:**
    * Implement basic SQL Injection protection (Use Bind Variables for all SQL queries: `:1`, `:2` etc.).
3.  **CORS (Cross-Origin Resource Sharing):**
    * The backend must enable CORS headers (`Access-Control-Allow-Origin: *` or specific frontend domain) to allow the frontend to fetch data.
4.  **Error Handling:**
    * All DB errors or internal exceptions must return a structured JSON error:
        ```json
        { "code": 500, "message": "Oracle ORA-XXXX: Connection timeout" }
        ```