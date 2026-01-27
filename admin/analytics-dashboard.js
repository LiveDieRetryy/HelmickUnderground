// Check auth
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = '/admin/login.html';
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

        if (!dataRes.ok || !statsRes.ok) {
            const errorText = await dataRes.text();
            console.error('Error response:', errorText);
            throw new Error('Failed to load analytics');
        }

        analyticsData = await dataRes.json();
        const stats = await statsRes.json();

        console.log('Loaded analytics:', analyticsData.length, 'entries');
        console.log('Stats:', stats);

        // Calculate average daily
        const oldest = analyticsData.length > 0 ? new Date(analyticsData[analyticsData.length - 1].timestamp) : new Date();
        const daysSince = Math.max(1, Math.ceil((new Date() - oldest) / (1000 * 60 * 60 * 24)));
        const avgDaily = Math.round(analyticsData.length / daysSince);

        // Update stats
        document.getElementById('totalVisits').textContent = stats.total || 0;
        document.getElementById('todayVisits').textContent = stats.today || 0;
        document.getElementById('weekVisits').textContent = stats.week || 0;
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#999' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                x: {
                    ticks: { color: '#999' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                }
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#999' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                y: {
                    ticks: { color: '#999' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Device types chart
function createDevicesChart() {
    const deviceCounts = {};
    analyticsData.forEach(entry => {
        deviceCounts[entry.deviceType] = (deviceCounts[entry.deviceType] || 0) + 1;
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
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#999' }
                }
            }
        }
    });
}

// Browsers chart
function createBrowsersChart() {
    const browserCounts = {};
    analyticsData.forEach(entry => {
        browserCounts[entry.browser] = (browserCounts[entry.browser] || 0) + 1;
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
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#999' }
                }
            }
        }
    });
}

// Top locations chart
function createLocationsChart() {
    const locationCounts = {};
    analyticsData.forEach(entry => {
        const loc = entry.city && entry.country ? `${entry.city}, ${entry.country}` : entry.country || 'Unknown';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const sorted = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    new Chart(document.getElementById('locationsChart'), {
        type: 'bar',
        data: {
            labels: sorted.map(([loc]) => loc),
            datasets: [{
                label: 'Visits',
                data: sorted.map(([, count]) => count),
                backgroundColor: 'rgba(99, 102, 241, 0.7)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#999' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                y: {
                    ticks: { color: '#999' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Recent visits table
function createVisitsTable() {
    const tbody = document.querySelector('#visitsTable tbody');
    const recent = analyticsData.slice(0, 50);

    tbody.innerHTML = recent.map(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        return `
            <tr>
                <td>${dateStr}</td>
                <td>${entry.page || '/'}</td>
                <td>${entry.city && entry.country ? `${entry.city}, ${entry.country}` : entry.country || 'Unknown'}</td>
                <td>${entry.deviceType || 'Unknown'}</td>
                <td>${entry.browser || 'Unknown'}</td>
            </tr>
        `;
    }).join('');
}

// Load on page load
checkAuth();
loadData();
