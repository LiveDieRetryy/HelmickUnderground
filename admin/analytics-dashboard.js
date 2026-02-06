// Check auth
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = '/admin/index.html';
        return false;
    }
    return true;
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 100000;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Clear analytics modal
function openClearModal() {
    document.getElementById('clearConfirmModal').style.display = 'flex';
}

function closeClearModal() {
    document.getElementById('clearConfirmModal').style.display = 'none';
}

async function confirmClearAnalytics() {
    closeClearModal();
    
    try {
        const response = await fetch('/api/analytics?action=clear', { method: 'POST' });
        if (!response.ok) throw new Error('Failed to clear analytics');
        
        showNotification('Analytics cleared successfully!', 'success');
        window.location.reload();
    } catch (error) {
        console.error('Error clearing analytics:', error);
        showNotification('Failed to clear analytics: ' + error.message, 'error');
    }
}

// Clear analytics button event
document.getElementById('clearBtn').addEventListener('click', () => {
    openClearModal();
});

// Set up confirm button
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmClearBtn');
    if (confirmBtn) {
        confirmBtn.onclick = confirmClearAnalytics;
    }
});

let analyticsData = [];

// Load data
async function loadData() {
    if (!checkAuth()) return;

    try {
        console.log('Fetching analytics...');
        
        const [dataRes, statsRes] = await Promise.all([
            fetch('/api/analytics?action=all'),
            fetch('/api/analytics?action=stats')
        ]);

        console.log('Analytics response:', dataRes.status);
        console.log('Stats response:', statsRes.status);

        if (!dataRes.ok) {
            const errorText = await dataRes.text();
            console.error('Error response:', errorText);
            throw new Error('Failed to load analytics');
        }

        const response = await dataRes.json();
        analyticsData = response.entries || [];

        console.log('Loaded analytics:', analyticsData.length, 'entries');
        console.log('Response:', response);

        // Calculate average daily based on unique visitors
        const uniqueVisitorsByDay = {};
        analyticsData.forEach(entry => {
            const date = new Date(entry.timestamp).toDateString();
            if (!uniqueVisitorsByDay[date]) {
                uniqueVisitorsByDay[date] = new Set();
            }
            uniqueVisitorsByDay[date].add(entry.ip);
        });
        
        const daysWithVisits = Object.keys(uniqueVisitorsByDay).length;
        const totalUniqueVisitors = new Set(analyticsData.map(e => e.ip)).size;
        const avgDaily = daysWithVisits > 0 ? Math.round(totalUniqueVisitors / daysWithVisits) : 0;

        // Update page view stats from the response
        document.getElementById('totalVisits').textContent = response.pageViews?.total || 0;
        document.getElementById('todayVisits').textContent = response.pageViews?.today || 0;
        document.getElementById('weekVisits').textContent = response.pageViews?.week || 0;
        document.getElementById('avgVisits').textContent = avgDaily;

        // Hide loading
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';

        // Create charts
        createVisitsChart();
        createPagesChart();
        createDevicesChart();
        createBrowsersChart();
        createLocationsChart();
        createVisitsTable();

    } catch (error) {
        console.error('Error loading analytics:', error);
        
        // Try to get response text for debugging
        let errorDetails = error.message;
        try {
            const testRes = await fetch('/api/analytics?action=all');
            const testText = await testRes.text();
            console.error('API Response:', testText);
            errorDetails = testText.substring(0, 200);
        } catch (e) {
            console.error('Could not fetch error details:', e);
        }
        
        document.getElementById('loading').innerHTML = `
            <div style="color: var(--red);">
                <div style="font-size: 2rem;">⚠️</div>
                <p>Error loading analytics</p>
                <p style="font-size: 0.9rem; color: var(--gray);">${error.message}</p>
                <p style="font-size: 0.8rem; color: var(--gray); margin-top: 1rem; max-width: 600px; word-break: break-all;">${errorDetails}</p>
                <p style="font-size: 0.85rem; color: var(--gray); margin-top: 1rem;">Check browser console for full details</p>
            </div>
        `;
    }
}

// Visits over time chart
function createVisitsChart() {
    const last30Days = {};
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        last30Days[key] = 0;
    }

    analyticsData.forEach(entry => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        if (last30Days.hasOwnProperty(date)) {
            last30Days[date]++;
        }
    });

    const labels = Object.keys(last30Days).map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = Object.values(last30Days);

    new Chart(document.getElementById('visitsChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visits',
                data: data,
                borderColor: '#ff6b1a',
                backgroundColor: 'rgba(255, 107, 26, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1.5 : 2.5,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#999',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                x: {
                    ticks: { 
                        color: '#999',
                        maxRotation: window.innerWidth < 768 ? 45 : 0,
                        minRotation: window.innerWidth < 768 ? 45 : 0,
                        font: {
                            size: window.innerWidth < 768 ? 9 : 12
                        }
                    },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Top pages chart
function createPagesChart() {
    const pageCounts = {};
    analyticsData.forEach(entry => {
        pageCounts[entry.page] = (pageCounts[entry.page] || 0) + 1;
    });

    const sorted = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    new Chart(document.getElementById('pagesChart'), {
        type: 'bar',
        data: {
            labels: sorted.map(([page]) => page.replace(/^\//, '') || 'Home'),
            datasets: [{
                label: 'Views',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(255, 107, 26, 0.7)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 0.8 : 1.2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => `Views: ${context.parsed.x}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#999',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                y: {
                    ticks: { 
                        color: '#999',
                        font: {
                            size: window.innerWidth < 768 ? 9 : 12
                        },
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return window.innerWidth < 768 && label.length > 20 
                                ? label.substring(0, 17) + '...'
                                : label;
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Device types chart
function createDevicesChart() {
    // Count unique IPs per device type
    const deviceIPs = {};
    analyticsData.forEach(entry => {
        const deviceType = entry.device_type || entry.deviceType || 'Unknown';
        if (!deviceIPs[deviceType]) {
            deviceIPs[deviceType] = new Set();
        }
        deviceIPs[deviceType].add(entry.ip);
    });
    
    // Convert to counts
    const deviceCounts = {};
    Object.entries(deviceIPs).forEach(([device, ips]) => {
        deviceCounts[device] = ips.size;
    });

    new Chart(document.getElementById('devicesChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(deviceCounts),
            datasets: [{
                data: Object.values(deviceCounts),
                backgroundColor: [
                    'rgba(255, 107, 26, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(34, 197, 94, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1 : 1.5,
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: { 
                        color: '#999',
                        padding: window.innerWidth < 768 ? 10 : 15,
                        font: {
                            size: window.innerWidth < 768 ? 11 : 13
                        },
                        boxWidth: window.innerWidth < 768 ? 15 : 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Browsers chart
function createBrowsersChart() {
    // Count unique IPs per browser
    const browserIPs = {};
    analyticsData.forEach(entry => {
        const browser = entry.browser || 'Unknown';
        if (!browserIPs[browser]) {
            browserIPs[browser] = new Set();
        }
        browserIPs[browser].add(entry.ip);
    });
    
    // Convert to counts
    const browserCounts = {};
    Object.entries(browserIPs).forEach(([browser, ips]) => {
        browserCounts[browser] = ips.size;
    });

    const sorted = Object.entries(browserCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    new Chart(document.getElementById('browsersChart'), {
        type: 'doughnut',
        data: {
            labels: sorted.map(([browser]) => browser),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: [
                    'rgba(255, 107, 26, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1 : 1.5,
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: { 
                        color: '#999',
                        padding: window.innerWidth < 768 ? 10 : 15,
                        font: {
                            size: window.innerWidth < 768 ? 11 : 13
                        },
                        boxWidth: window.innerWidth < 768 ? 15 : 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Top locations chart
function createLocationsChart() {
    // Count unique IPs per location
    const locationIPs = {};
    analyticsData.forEach(entry => {
        const loc = entry.city && entry.country ? `${entry.city}, ${entry.country}` : entry.country || 'Unknown';
        if (!locationIPs[loc]) {
            locationIPs[loc] = new Set();
        }
        locationIPs[loc].add(entry.ip);
    });
    
    // Convert to counts
    const locationCounts = {};
    Object.entries(locationIPs).forEach(([loc, ips]) => {
        locationCounts[loc] = ips.size;
    });

    const sorted = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    new Chart(document.getElementById('locationsChart'), {
        type: 'bar',
        data: {
            labels: sorted.map(([loc]) => loc),
            datasets: [{
                label: 'Unique Visitors',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(99, 102, 241, 0.7)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 0.8 : 1.2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => `Unique Visitors: ${context.parsed.x}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#999',
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    },
                    grid: { color: 'rgba(99, 102, 241, 0.1)' }
                },
                y: {
                    ticks: { 
                        color: '#999',
                        font: {
                            size: window.innerWidth < 768 ? 9 : 12
                        },
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return window.innerWidth < 768 && label.length > 20 
                                ? label.substring(0, 17) + '...'
                                : label;
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Handle window resize to recreate charts
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Destroy and recreate charts on significant resize
        const charts = Chart.instances;
        if (charts && charts.length > 0) {
            const shouldRecreate = Math.abs(window.innerWidth - (window.lastWidth || window.innerWidth)) > 100;
            if (shouldRecreate) {
                charts.forEach(chart => chart.destroy());
                loadAnalyticsData();
                window.lastWidth = window.innerWidth;
            }
        }
    }, 250);
});

// Recent visits table - grouped by visitor session
function createVisitsTable() {
    const tbody = document.querySelector('#visitsTable tbody');
    
    // Helper function to format page names
    function formatPageName(path) {
        if (!path || path === '/') return 'Home';
        
        const pageNames = {
            '/about': 'About',
            '/about.html': 'About',
            '/contact': 'Contact',
            '/contact.html': 'Contact',
            '/services': 'Services',
            '/services.html': 'Services',
            '/gallery': 'Gallery',
            '/gallery.html': 'Gallery',
            '/rates': 'Rates',
            '/rates.html': 'Rates',
            '/privacy-policy': 'Privacy Policy',
            '/privacy-policy.html': 'Privacy Policy',
            '/terms-of-service': 'Terms of Service',
            '/terms-of-service.html': 'Terms of Service',
            '/thank-you': 'Thank You',
            '/thank-you.html': 'Thank You'
        };
        
        // Check for service pages
        if (path.includes('/services/')) {
            const serviceName = path.replace('/services/', '').replace('.html', '').replace(/-/g, ' ');
            return serviceName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        return pageNames[path] || path;
    }

    // Group visits by IP address
    const sessionsByIP = {};
    
    analyticsData.forEach(entry => {
        const ip = entry.ip || 'unknown';
        
        if (!sessionsByIP[ip]) {
            sessionsByIP[ip] = {
                ip: ip,
                visits: [],
                firstVisit: entry.timestamp,
                location: '',
                device: entry.device_type || 'Unknown',
                browser: entry.browser || 'Unknown'
            };
            
            // Format location
            if (entry.city && entry.region && entry.country) {
                sessionsByIP[ip].location = `${entry.city}, ${entry.region}, ${entry.country}`;
            } else if (entry.city && entry.country) {
                sessionsByIP[ip].location = `${entry.city}, ${entry.country}`;
            } else if (entry.country) {
                sessionsByIP[ip].location = entry.country;
            } else {
                sessionsByIP[ip].location = 'Unknown';
            }
        }
        
        sessionsByIP[ip].visits.push({
            page: entry.page,
            timestamp: entry.timestamp
        });
    });

    // Convert to array and sort by most recent first
    const sessions = Object.values(sessionsByIP)
        .sort((a, b) => new Date(b.firstVisit) - new Date(a.firstVisit))
        .slice(0, 50); // Limit to 50 unique visitors

    tbody.innerHTML = sessions.map((session, index) => {
        const date = new Date(session.firstVisit);
        const dateStr = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        const detailsId = `session-details-${index}`;
        const visitsList = session.visits
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map(visit => {
                const visitTime = new Date(visit.timestamp).toLocaleString('en-US', { 
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit'
                });
                return `<div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255, 107, 26, 0.1);">
                    <span style="color: var(--gray); font-size: 0.85rem;">${visitTime}</span>
                    <span style="color: var(--white); margin-left: 1rem;">${formatPageName(visit.page)}</span>
                </div>`;
            }).join('');

        return `
            <tr style="cursor: pointer; transition: background 0.2s;" onclick="toggleSessionDetails('${detailsId}')" onmouseover="this.style.background='rgba(255, 107, 26, 0.05)'" onmouseout="this.style.background=''">
                <td style="text-align: center;">
                    <span id="toggle-${detailsId}" style="display: inline-block; transition: transform 0.3s;">▶</span>
                </td>
                <td>${dateStr}</td>
                <td>${session.location}</td>
                <td style="color: var(--primary-color); font-weight: 600;">${session.visits.length} page${session.visits.length !== 1 ? 's' : ''}</td>
                <td>${session.device}</td>
                <td>${session.browser}</td>
            </tr>
            <tr id="${detailsId}" style="display: none;">
                <td colspan="6" style="background: rgba(255, 107, 26, 0.03); padding: 0;">
                    <div style="padding: 1rem 2rem; max-height: 400px; overflow-y: auto;">
                        <h4 style="color: var(--primary-color); margin: 0 0 1rem 0; font-size: 0.9rem;">Page Views (${session.visits.length} total)</h4>
                        ${visitsList}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Toggle session details
window.toggleSessionDetails = function(detailsId) {
    const detailsRow = document.getElementById(detailsId);
    const toggleIcon = document.getElementById(`toggle-${detailsId}`);
    
    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        toggleIcon.style.transform = 'rotate(90deg)';
        toggleIcon.textContent = '▼';
    } else {
        detailsRow.style.display = 'none';
        toggleIcon.style.transform = 'rotate(0deg)';
        toggleIcon.textContent = '▶';
    }
};

// Load on page load
checkAuth();
loadData();
