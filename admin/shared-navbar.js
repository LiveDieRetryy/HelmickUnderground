// Shared Admin Navbar
function loadAdminNavbar() {
    const navbarHTML = `
        <nav class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <h2>Admin Panel</h2>
            </div>
            
            <div class="sidebar-nav">
                <a href="/admin/" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📊</span>
                    <span class="sidebar-nav-item-text">Dashboard</span>
                </a>
                
                <div style="padding: 0.5rem 1.5rem 0.15rem; color: rgba(255, 107, 26, 0.7); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Customer Management</div>
                <a href="/admin/inbox.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📬</span>
                    <span class="sidebar-nav-item-text">Work Requests</span>
                </a>
                <a href="/admin/schedule.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📅</span>
                    <span class="sidebar-nav-item-text">Schedule</span>
                </a>
                
                <div style="padding: 0.5rem 1.5rem 0.15rem; color: rgba(255, 107, 26, 0.7); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Financial</div>
                <a href="/admin/invoices.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">🧾</span>
                    <span class="sidebar-nav-item-text">Invoices</span>
                </a>
                <a href="/admin/standalone-quote-builder.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📋</span>
                    <span class="sidebar-nav-item-text">Build Quote</span>
                </a>
                <a href="/admin/rates.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">💰</span>
                    <span class="sidebar-nav-item-text">Rates Management</span>
                </a>
                
                <div style="padding: 0.5rem 1.5rem 0.15rem; color: rgba(255, 107, 26, 0.7); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Content & Analytics</div>
                <a href="/admin/gallery-manager.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📸</span>
                    <span class="sidebar-nav-item-text">Gallery Manager</span>
                </a>
                <a href="/admin/analytics.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📈</span>
                    <span class="sidebar-nav-item-text">Analytics</span>
                </a>
                
                <div style="padding: 0.5rem 1.5rem 0.15rem; color: rgba(255, 107, 26, 0.7); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Settings</div>
                <a href="/admin/rate-recipients.html" class="sidebar-nav-item">
                    <span class="sidebar-nav-item-icon">📧</span>
                    <span class="sidebar-nav-item-text">Email Recipients</span>
                </a>
                
                <a href="../" class="sidebar-nav-item" style="margin-top: 0.75rem; border-top: 2px solid rgba(255, 107, 26, 0.2); padding-top: 0.75rem;">
                    <span class="sidebar-nav-item-icon">🌐</span>
                    <span class="sidebar-nav-item-text">View Website</span>
                </a>
            </div>

            <div class="sidebar-footer">
                <button id="logoutBtn" class="btn-logout">
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </nav>
    `;
    
    // Insert navbar - check if dashboardContent div exists (for pages with login)
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) {
        console.log('Injecting navbar into dashboardContent');
        dashboardContent.insertAdjacentHTML('afterbegin', navbarHTML);
    } else {
        console.log('Injecting navbar into body');
        document.body.insertAdjacentHTML('afterbegin', navbarHTML);
    }
    
    console.log('Navbar injected successfully');
    
    // Set active nav item based on current page
    const currentPath = window.location.pathname;
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPath || 
            (href === '/admin/' && (currentPath === '/admin/' || currentPath === '/admin/index.html')) ||
            (href !== '/admin/' && href !== '../' && currentPath.includes(href))) {
            item.classList.add('active');
        }
    });
}

// Export for manual loading (don't auto-load on dashboard due to login screen)
if (typeof window !== 'undefined') {
    window.loadAdminNavbar = loadAdminNavbar;
}

// Auto-load on other pages (not dashboard)
if (document.readyState === 'loading' && !document.getElementById('dashboardContent')) {
    document.addEventListener('DOMContentLoaded', loadAdminNavbar);
} else if (!document.getElementById('dashboardContent')) {
    loadAdminNavbar();
}
