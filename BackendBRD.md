# ProjectTracker Pro - Backend API Specifications

**Version:** 1.3.1 (Case-insensitive Search & Enhanced UI Support)
**Date:** 2026-03-12
**Status:** Approved

---

## 1. Overview
The goal of this document is to define the backend RESTful API requirements for the **ProjectTracker Pro** application. 
The backend will serve as a data persistence layer, handling JSON data sent by the frontend, compressing it, and archiving it into an Oracle database.

**Core Architecture:**
* **Architecture:** Decoupled (Frontend-Backend Separation).
* **Protocol:** HTTP/1.1 (RESTful).
* **Data Format:** JSON (Network Transmission) -> Gzip/BLOB (Database Storage).
* **Versioning Strategy:** Insert-only. Every save creates a new version record.
* **Auditing:** Captures Client IP Address via Nginx headers for security auditing.

## 2. Technical Stack Requirements
* **Language/Framework:** Python 3.x / Flask.
* **Database:** Oracle Database 11g (or higher).
* **Database Driver:** `cx_Oracle`.
    * *Requirement:* Must use **`cx_Oracle.SessionPool`** to handle concurrency efficiently.
* **Compression:** Python standard `gzip` library.
* **Proxy Server:** Nginx (Responsible for forwarding `X-Real-IP`).

---

## 3. Database Schema Design

The backend must create a single table to store project versions.

### Table: `PROJECT_VERSIONS`

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **`VERSION_ID`** | `VARCHAR2(36)` | PK, Not Null | Unique UUID (v4) for this specific version. |
| **`PROJECT_NAME`** | `VARCHAR2(200)` | Not Null | The unique identifier for the project. |
| **`DATA_BLOB`** | **`BLOB`** | Not Null | **Gzipped** binary content of the JSON data. |
| **`CREATED_BY`** | `VARCHAR2(50)` | Nullable | User who performed the save action. (Kept for DB audit, removed from UI). |
| **`CREATED_AT`** | `TIMESTAMP` | Default `SYSDATE` | Server-side timestamp. |
| **`SOURCE_IP`** | **`VARCHAR2(45)`** | Nullable | Client IPv4/IPv6 address (Audit Log). |
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
* **Request Headers:**
    * `X-Real-IP` or `X-Forwarded-For` (Injected by Nginx)
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
    1.  **Audit Extraction:**
        * Extract the client IP from the HTTP Header `X-Real-IP`.
        * If the header is missing, fallback to `request.remote_addr`.
    2.  Validate `projectName` and `data` are present.
    3.  Convert `data` object to JSON string.
    4.  **Compress:** Use `gzip.compress()` to convert the JSON string into binary bytes.
    5.  Generate a new UUID for `VERSION_ID`.
    6.  `INSERT` into `PROJECT_VERSIONS` (Include `SOURCE_IP`).
    7.  Commit transaction.
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "message": "Saved successfully",
      "versionId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-03-11 14:30:00"
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

### 4.3. Get Version History (Global Fuzzy & Case-insensitive Search)
Retrieves a list of historical versions across all projects based on a fuzzy search keyword. **Do NOT return the BLOB data here.**

* **Endpoint:** `GET /project/history`
* **Query Parameters:**
    * `keyword` (Optional): A string to fuzzy match against `PROJECT_NAME`. If empty, return the most recent versions across all projects.
    * `limit` (Optional, default 50)
* **Backend Logic:**
    * Must support **case-insensitive** matching. Use `UPPER()` or `LOWER()` function to ensure accurate results.
    * `SELECT VERSION_ID, PROJECT_NAME, CREATED_AT, REMARK, SOURCE_IP FROM PROJECT_VERSIONS WHERE UPPER(PROJECT_NAME) LIKE '%' || UPPER(:keyword) || '%' ORDER BY CREATED_AT DESC`
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "history": [
        {
          "versionId": "uuid-1",
          "projectName": "Fab2_Schedule",
          "createdAt": "2026-03-12 14:30:00",
          "sourceIP": "202.106.0.5",
          "remark": "Updated phase 1 milestones"
        },
        {
          "versionId": "uuid-2",
          "projectName": "Fab1_Alpha_Plan",
          "createdAt": "2026-03-10 09:15:00",
          "sourceIP": "192.168.1.10",
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

### 4.5. Get Project List
Retrieves a distinct list of all project names currently stored in the database. Used to populate the cloud workspace search datalist.

* **Endpoint:** `GET /project/list`
* **Query Parameters:** None
* **Backend Logic:**
    * `SELECT DISTINCT PROJECT_NAME FROM PROJECT_VERSIONS ORDER BY PROJECT_NAME ASC`
* **Success Response (200 OK):**
    ```json
    {
      "code": 200,
      "projects": [
        "Alpha Launch",
        "Fab2_Schedule",
        "My_Project_Schedule"
      ]
    }
    ```

---

## 5. Non-Functional Requirements

1.  **Concurrency:**
    * The API handles database connections via `cx_Oracle.SessionPool` to ensure high throughput.
2.  **Security & Infrastructure:**
    * **SQL Injection:** Use Bind Variables for all SQL queries.
    * **Nginx Configuration:** The reverse proxy (Nginx) MUST be configured to pass the client IP:
        ```nginx
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        ```
    * The Backend MUST prioritize reading `X-Real-IP` over the direct socket connection IP.
3.  **CORS:**
    * Enable `Access-Control-Allow-Origin` headers.
4.  **Error Handling:**
    * Return structured JSON errors (`{ "code": 500, "message": "..." }`).