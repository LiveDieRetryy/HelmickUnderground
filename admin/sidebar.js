// Shared sidebar navigation for all admin pages
function renderSidebar(activePage = '') {
    return `
        <!-- Mobile Toggle Button -->
        <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
        
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <h2>Admin Panel</h2>
            </div>

            <nav class="sidebar-nav">
                <a href="/admin/index.html" class="sidebar-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">📊</span>
                    <span class="sidebar-nav-item-text">Dashboard</span>
                </a>
                <a href="/admin/inbox.html" class="sidebar-nav-item ${activePage === 'inbox' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">📬</span>
                    <span class="sidebar-nav-item-text">Quote Requests</span>
                </a>
                <a href="/admin/analytics.html" class="sidebar-nav-item ${activePage === 'analytics' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">📈</span>
                    <span class="sidebar-nav-item-text">Analytics</span>
                </a>
                <a href="/admin/gallery-manager.html" class="sidebar-nav-item ${activePage === 'gallery' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">📸</span>
                    <span class="sidebar-nav-item-text">Gallery Manager</span>
                </a>
                <a href="/admin/rates.html" class="sidebar-nav-item ${activePage === 'rates' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">💰</span>
                    <span class="sidebar-nav-item-text">Rates Management</span>
                </a>
                <a href="/admin/rate-recipients.html" class="sidebar-nav-item ${activePage === 'recipients' ? 'active' : ''}">
                    <span class="sidebar-nav-item-icon">📧</span>
                    <span class="sidebar-nav-item-text">Email Recipients</span>
                </a>
            </nav>

            <div class="sidebar-footer">
                <button id="sidebarLogoutBtn" class="btn-logout" style="width: 100%;">Logout</button>
            </div>
        </aside>
    `;
}

// Shared sidebar styles
function getSidebarStyles() {
    return `
        <style>
            .sidebar {
                width: 280px;
                background: linear-gradient(180deg, 
                    rgba(20, 20, 20, 0.95) 0%, 
                    rgba(10, 10, 10, 0.95) 100%);
                border-right: 2px solid rgba(255, 107, 26, 0.2);
                padding: 2rem 0;
                position: fixed;
                left: 0;
                top: 0;
                height: 100vh;
                overflow-y: auto;
                backdrop-filter: blur(10px);
                box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
                transition: transform 0.3s ease;
                z-index: 1000;
            }

            .sidebar.collapsed {
                transform: translateX(-100%);
            }

            .sidebar-toggle {
                display: none;
                position: fixed;
                top: 1rem;
                left: 1rem;
                z-index: 1001;
                background: linear-gradient(135deg, var(--primary-color) 0%, #ffb366 100%);
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 12px;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(255, 107, 26, 0.4);
                transition: all 0.3s ease;
            }

            .sidebar-toggle:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 25px rgba(255, 107, 26, 0.6);
            }

            .sidebar-logo {
                padding: 1.5rem 1.5rem 2rem;
                text-align: center;
                border-bottom: 2px solid rgba(255, 107, 26, 0.2);
                margin-bottom: 2rem;
            }

            .sidebar-logo h2 {
                color: transparent;
                background: linear-gradient(135deg, #ff6b1a 0%, #ffb366 100%);
                background-clip: text;
                -webkit-background-clip: text;
                font-size: 0.85rem;
                margin-top: 1rem;
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            .sidebar-nav {
                padding: 0;
            }

            .sidebar-nav-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem 1.5rem;
                color: #999;
                text-decoration: none;
                border-left: 3px solid transparent;
                position: relative;
                transition: all 0.3s ease;
            }

            .sidebar-nav-item::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 3px;
                background: linear-gradient(180deg, var(--primary-color) 0%, #ffb366 100%);
                transform: scaleY(0);
                transition: transform 0.3s ease;
            }

            .sidebar-nav-item:hover,
            .sidebar-nav-item.active {
                background: rgba(255, 107, 26, 0.1);
                color: var(--white);
            }

            .sidebar-nav-item:hover::before,
            .sidebar-nav-item.active::before {
                transform: scaleY(1);
            }

            .sidebar-nav-item-icon {
                font-size: 1.5rem;
                width: 30px;
                text-align: center;
            }

            .sidebar-nav-item-text {
                font-weight: 600;
                font-size: 0.95rem;
            }

            .sidebar-footer {
                position: absolute;
                bottom: 2rem;
                left: 1.5rem;
                right: 1.5rem;
            }

            .main-content {
                margin-left: 280px;
                padding: 3rem;
                min-height: 100vh;
            }

            .btn-logout {
                background: linear-gradient(135deg, #dc143c 0%, #a01028 100%);
                color: var(--white);
                border: 2px solid rgba(220, 20, 60, 0.5);
                padding: 1rem 2rem;
                border-radius: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 1rem;
                box-shadow: 0 4px 15px rgba(220, 20, 60, 0.3);
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .btn-logout:hover {
                background: linear-gradient(135deg, #a01028 0%, #dc143c 100%);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(220, 20, 60, 0.5);
                border-color: #dc143c;
            }

            @media (max-width: 768px) {
                .sidebar-toggle {
                    display: block;
                }

                .sidebar {
                    width: 280px;
                    transform: translateX(-100%);
                }

                .sidebar.active {
                    transform: translateX(0);
                }

                .sidebar.collapsed {
                    transform: translateX(-100%);
                }

                .main-content {
                    margin-left: 0;
                    padding: 5rem 1rem 2rem;
                }
            }
        </style>
    `;
}

// Toggle sidebar for mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// Initialize sidebar
function initSidebar(activePage = '') {
    // Add styles to head
    const stylesAdded = document.getElementById('sidebar-styles');
    if (!stylesAdded) {
        const styleElement = document.createElement('div');
        styleElement.id = 'sidebar-styles';
        styleElement.innerHTML = getSidebarStyles();
        document.head.appendChild(styleElement);
    }

    // Render sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = renderSidebar(activePage);
        
        // Attach logout handler
        const logoutBtn = document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                sessionStorage.removeItem('adminLoggedIn');
                window.location.href = '/admin/index.html';
            });
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const toggle = document.querySelector('.sidebar-toggle');
                if (sidebar && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }
}
