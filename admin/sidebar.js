// Mobile menu toggle functionality
function initMobileMenu() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!mobileToggle || !sidebar || !overlay) return;
    
    // Toggle sidebar
    mobileToggle.addEventListener('click', function() {
        this.classList.toggle('active');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });
    
    // Close sidebar when clicking overlay
    overlay.addEventListener('click', function() {
        mobileToggle.classList.remove('active');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
    
    // Close sidebar when clicking a nav link on mobile
    const navLinks = sidebar.querySelectorAll('.sidebar-nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                mobileToggle.classList.remove('active');
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }
        });
    });
}

// Update unread quote notification badge
async function updateQuoteNotification() {
    try {
        const response = await fetch('/api/contact-submissions?action=stats');
        if (!response.ok) return;
        
        const stats = await response.json();
        const unreadCount = stats.unread || 0;
        
        // Find all Quote Requests nav items across all pages
        const quoteNavItems = document.querySelectorAll('a[href="/admin/inbox.html"]');
        
        quoteNavItems.forEach(navItem => {
            // Remove existing badge if present
            const existingBadge = navItem.querySelector('.notification-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Add badge if there are unread quotes
            if (unreadCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                navItem.appendChild(badge);
            }
        });
    } catch (error) {
        console.error('Error fetching quote notification:', error);
    }
}

// Highlight active page in sidebar
function highlightActivePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && href.includes(currentPage)) {
            item.classList.add('active');
        }
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
        highlightActivePage();
        updateQuoteNotification();
        
        // Update notification every 30 seconds
        setInterval(updateQuoteNotification, 30000);
    });
} else {
    initMobileMenu();
    highlightActivePage();
    updateQuoteNotification();
    
    // Update notification every 30 seconds
    setInterval(updateQuoteNotification, 30000);
}
