// Authentication check with JWT - must be included on all admin pages
(function() {
    /**
     * Check if user is authenticated with valid JWT token
     * @returns {Promise<boolean>} True if authenticated, false otherwise
     */
    async function checkAuth() {
        try {
            // First check if token exists in localStorage
            const token = localStorage.getItem('auth_token');
            if (!token) {
                redirectToLogin();
                return false;
            }

            // Verify token with server
            const response = await fetch('/api/auth?action=verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include' // Include cookies
            });

            const data = await response.json();

            if (data.success) {
                // Token is valid, store user info
                if (data.user) {
                    localStorage.setItem('admin_user', JSON.stringify(data.user));
                }
                return true;
            } else {
                // Token invalid or expired
                redirectToLogin();
                return false;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            redirectToLogin();
            return false;
        }
    }

    /**
     * Redirect to login page and clear auth data
     */
    function redirectToLogin() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('csrf_token'); // Clear CSRF token
        sessionStorage.removeItem('adminLoggedIn'); // Remove old auth method
        window.location.href = '/admin/index.html';
    }

    /**
     * Logout user by clearing token and cookies
     */
    async function logout() {
        try {
            // Call logout endpoint to clear cookie
            await fetch('/api/auth?action=logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and redirect
            redirectToLogin();
        }
    }

    /**
     * Get auth token for API requests
     * @returns {string|null} JWT token or null
     */
    function getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    /**
     * Get CSRF token for API requests
     * @returns {string|null} CSRF token or null
     */
    function getCsrfToken() {
        return localStorage.getItem('csrf_token');
    }

    /**
     * Refresh CSRF token from server
     * @returns {Promise<string|null>} New CSRF token or null
     */
    async function refreshCsrfToken() {
        try {
            const response = await fetch('/api/auth?action=csrf', {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success && data.csrfToken) {
                localStorage.setItem('csrf_token', data.csrfToken);
                return data.csrfToken;
            }
        } catch (error) {
            console.error('Failed to refresh CSRF token:', error);
        }
        return null;
    }

    /**
     * Get authenticated user info
     * @returns {object|null} User object or null
     */
    function getUser() {
        const userJson = localStorage.getItem('admin_user');
        return userJson ? JSON.parse(userJson) : null;
    }

    // Check auth immediately when script loads
    checkAuth();

    // Setup logout button if present
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    // Export functions for use in other scripts
    window.adminAuth = {
        checkAuth,
        logout,
        getAuthToken,
        getCsrfToken,
        refreshCsrfToken,
        getUser,
        redirectToLogin
    };
})();

