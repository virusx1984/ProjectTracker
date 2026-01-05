/**
 * MockAPI.js
 * * Simulates the Python Flask + Oracle Backend using LocalStorage.
 * Implements the API Contract defined in the Backend Requirement Document.
 */

const MockAPI = {
    // Simulate network latency (in ms) to test UI spinners
    LATENCY: 800,
    STORAGE_KEY: 'PROJECT_TRACKER_MOCK_DB',

    /**
     * Helper: Generate a fake UUID (v4 style)
     */
    // [NEW] Helper: Generate Fake IP
    _getRandomIP: function() {
        return Math.floor(Math.random() * 255) + "." + 
               Math.floor(Math.random() * 255) + "." + 
               Math.floor(Math.random() * 255) + "." + 
               Math.floor(Math.random() * 255);
    },

    _generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Helper: Read "Database" from LocalStorage
     */
    _getDB: function() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return { versions: [] }; // Initial Empty DB
        return JSON.parse(raw);
    },

    /**
     * Helper: Write "Database" to LocalStorage
     */
    _saveDB: function(db) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(db));
    },

    /**
     * Helper: Simulate Async Network Call
     */
    _networkCall: function(callback) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const result = callback();
                    resolve(result);
                } catch (e) {
                    console.error("MockAPI Error:", e);
                    reject({ code: 500, message: "Internal Server Error (Mock)" });
                }
            }, this.LATENCY);
        });
    },

    // ============================================================
    // 1. API: Save Project Version (POST /api/v1/project/save)
    // ============================================================
    saveProject: function(payload) {
        return this._networkCall(() => {
            const { projectName, user, remark, data } = payload;
            
            if (!projectName || !data) throw new Error("Missing required fields");

            const db = this._getDB();
            
            const newRecord = {
                versionId: this._generateUUID(),
                projectName: projectName,
                user: user || 'Anonymous',
                remark: remark || '',
                createdAt: new Date().toISOString(), // Server timestamp
                sourceIP: this._getRandomIP(),
                data: data // Storing raw JSON instead of BLOB for Mock
            };

            db.versions.push(newRecord);
            this._saveDB(db);

            console.log(`[MockAPI] Saved version ${newRecord.versionId} for ${projectName}`);

            return {
                code: 200,
                message: "Saved successfully",
                versionId: newRecord.versionId,
                timestamp: newRecord.createdAt
            };
        });
    },

    // ============================================================
    // 2. API: Load Latest Version (GET /api/v1/project/latest)
    // ============================================================
    getLatest: function(projectName) {
        return this._networkCall(() => {
            const db = this._getDB();
            
            // Filter by project name
            const projectVersions = db.versions.filter(v => v.projectName === projectName);
            
            if (projectVersions.length === 0) {
                // Simulate 404 Not Found
                return { code: 404, message: "Project not found" };
            }

            // Sort by createdAt DESC (Newest first)
            projectVersions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            const latest = projectVersions[0];

            console.log(`[MockAPI] Loaded latest version for ${projectName}`);

            return {
                code: 200,
                projectName: latest.projectName,
                versionId: latest.versionId,
                timestamp: latest.createdAt,
                data: latest.data
            };
        });
    },

    // ============================================================
    // 3. API: Get History List (GET /api/v1/project/history)
    // ============================================================
    getHistory: function(projectName) {
        return this._networkCall(() => {
            const db = this._getDB();
            
            // Filter by project name
            const projectVersions = db.versions.filter(v => v.projectName === projectName);
            
            // Sort by createdAt DESC
            projectVersions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Return Metadata ONLY (No 'data' field) to simulate lightweight response
            const historyList = projectVersions.map(v => ({
                versionId: v.versionId,
                createdAt: v.createdAt,
                createdBy: v.user,
                sourceIP: v.sourceIP,
                remark: v.remark
            }));

            return {
                code: 200,
                history: historyList
            };
        });
    },

    // ============================================================
    // 4. API: Load Specific Version (GET /api/v1/project/version)
    // ============================================================
    getVersion: function(versionId) {
        return this._networkCall(() => {
            const db = this._getDB();
            const target = db.versions.find(v => v.versionId === versionId);

            if (!target) {
                return { code: 404, message: "Version not found" };
            }

            console.log(`[MockAPI] Loaded specific version ${versionId}`);

            return {
                code: 200,
                versionId: target.versionId,
                timestamp: target.createdAt,
                data: target.data
            };
        });
    },

    // ============================================================
    // Utility: Clear All Data (For debugging)
    // ============================================================
    clearAll: function() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log("[MockAPI] Database cleared.");
        location.reload();
    }
};