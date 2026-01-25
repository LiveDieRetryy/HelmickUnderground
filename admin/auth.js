// Authentication check - must be included on all admin pages
(function() {
    // Check if user is logged in
    function checkAuth() {
        const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
        if (!isLoggedIn) {
            // Redirect to login page
            window.location.href = '/admin/';
            return false;
        }
        return true;
    }

    // Check auth immediately when script loads
    checkAuth();

    // Setup logout button if present
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('adminLoggedIn');
            window.location.href = '/admin/';
        });
    }
})();
