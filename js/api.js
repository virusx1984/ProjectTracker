/**
 * api.js
 * Connects to the real Python Flask backend via RESTful APIs.
 */

const BASE_URL = 'http://127.0.0.1:5000/api/v1';

const TrackerAPI = {
    
    // ============================================================
    // 1. API: Save Project Version (POST /api/v1/project/save)
    // ============================================================
    saveProject: async function(payload) {
        const response = await fetch(`${BASE_URL}/project/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Failed to save project to server');
        }
        return result;
    },

    // ============================================================
    // 2. API: Load Latest Version (GET /api/v1/project/latest)
    // ============================================================
    getLatest: async function(projectName) {
        const response = await fetch(`${BASE_URL}/project/latest?projectName=${encodeURIComponent(projectName)}`);
        
        const result = await response.json();
        
        // Handle 404 (New project, no history yet) gracefully
        if (response.status === 404 || result.code === 404) {
            return { code: 404, message: "Project not found on server" };
        }
        
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Failed to load latest version');
        }
        return result;
    },

    // ============================================================
    // 3. API: Get History List (GET /api/v1/project/history)
    // ============================================================
    getHistory: async function(projectName) {
        const response = await fetch(`${BASE_URL}/project/history?projectName=${encodeURIComponent(projectName)}`);
        
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Failed to load history list');
        }
        return result;
    },

    // ============================================================
    // 4. API: Load Specific Version (GET /api/v1/project/version)
    // ============================================================
    getVersion: async function(versionId) {
        const response = await fetch(`${BASE_URL}/project/version?versionId=${encodeURIComponent(versionId)}`);
        
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Failed to load specific version');
        }
        return result;
    },

    // ============================================================
    // 5. API: Get Project List (GET /api/v1/project/list)
    // ============================================================
    getProjectList: async function() {
        const response = await fetch(`${BASE_URL}/project/list`);
        
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Failed to load project list');
        }
        return result;
    }
};