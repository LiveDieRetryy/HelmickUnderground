// Analytics Dashboard Script

// Check authentication
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = 'index.html';
});

// Load and display analytics
async function loadAnalytics() {
    if (!checkAuth()) return;

    try {
        const response = await fetch('/api/analytics?action=all');
        if (!response.ok) {
            throw new Error('Failed to load analytics data');
        }

        const data = await response.json();
        
        // Hide loading, show content
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('analyticsContent').style.display = 'block';

        // Calculate statistics
        calculateStats(data);
        
        // Create charts
        createVisitsChart(data);
        createPagesChart(data);
        createDevicesChart(data);
        createLocationsChart(data);
        
        // Populate recent visits table
        populateRecentVisits(data);

    } catch (error) {
        console.error('Error loading analytics:', error);
        document.getElementById('loadingMessage').innerHTML = `
            <p style="color: var(--red);">Error loading analytics data</p>
            <p style="font-size: 0.9rem; color: var(--gray);">Please try refreshing the page</p>
        `;
    }
}

// Calculate statistics
function calculateStats(data) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayVisits = data.filter(entry => new Date(entry.timestamp) >= today).length;
    const weekVisits = data.filter(entry => new Date(entry.timestamp) >= weekAgo).length;
    
    // Calculate average daily visits
    const oldestEntry = data.length > 0 ? new Date(data[data.length - 1].timestamp) : today;
    const daysDiff = Math.max(1, Math.ceil((now - oldestEntry) / (1000 * 60 * 60 * 24)));
    const avgDaily = Math.round(data.length / daysDiff);

    document.getElementById('totalVisits').textContent = data.length;
    document.getElementById('todayVisits').textContent = todayVisits;
    document.getElementById('weekVisits').textContent = weekVisits;
    document.getElementById('avgDaily').textContent = avgDaily;
}

// Create visits by day chart
function createVisitsChart(data) {
    const last30Days = {};
    const now = new Date();
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last30Days[dateStr] = 0;
    }
    
    // Count visits per day
    data.forEach(entry => {
        const dateStr = entry.timestamp.split('T')[0];
        if (last30Days.hasOwnProperty(dateStr)) {
            last30Days[dateStr]++;
        }
    });
    
    const ctx = document.getElementById('visitsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(last30Days).map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Visits',
                data: Object.values(last30Days),
                borderColor: '#ff6b1a',
                backgroundColor: 'rgba(255, 107, 26, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                x: {
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                }
            }
        }
    });
}

// Create top pages chart
function createPagesChart(data) {
    const pageCounts = {};
    data.forEach(entry => {
        const page = entry.page === '/' ? 'Home' : entry.page.replace(/^\//, '').replace(/\.html$/, '') || 'Other';
        pageCounts[page] = (pageCounts[page] || 0) + 1;
    });
    
    const sortedPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    const ctx = document.getElementById('pagesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedPages.map(([page]) => page),
            datasets: [{
                label: 'Views',
                data: sortedPages.map(([, count]) => count),
                backgroundColor: '#ff6b1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                y: {
                    ticks: { color: '#b0b0b0' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Create device types chart
function createDevicesChart(data) {
    const deviceCounts = {};
    data.forEach(entry => {
        const device = entry.deviceType || 'Unknown';
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });
    
    const ctx = document.getElementById('devicesChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(deviceCounts),
            datasets: [{
                data: Object.values(deviceCounts),
                backgroundColor: ['#ff6b1a', '#ff8c47', '#e65500', '#b0b0b0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#b0b0b0' }
                }
            }
        }
    });
}

// Create locations chart
function createLocationsChart(data) {
    const locationCounts = {};
    data.forEach(entry => {
        const location = entry.city && entry.region && entry.country
            ? `${entry.city}, ${entry.region}`
            : entry.country || 'Unknown';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    const sortedLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const ctx = document.getElementById('locationsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedLocations.map(([loc]) => loc),
            datasets: [{
                label: 'Visits',
                data: sortedLocations.map(([, count]) => count),
                backgroundColor: '#ff6b1a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255, 107, 26, 0.1)' }
                },
                y: {
                    ticks: { color: '#b0b0b0' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Populate recent visits table
function populateRecentVisits(data) {
    const tbody = document.getElementById('recentVisits');
    const recent = data.slice(0, 50); // Show last 50 visits
    
    tbody.innerHTML = recent.map(entry => {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        const page = entry.page || '/';
        const location = entry.city && entry.country 
            ? `${entry.city}, ${entry.country}`
            : entry.country || 'Unknown';
        const device = `${entry.deviceType || 'Unknown'} / ${entry.browser || 'Unknown'}`;
        const referrer = entry.referrer === 'direct' ? 'Direct' : new URL(entry.referrer).hostname;
        
        return `
            <tr>
                <td>${timeStr}</td>
                <td>${page}</td>
                <td>${location}</td>
                <td>${device}</td>
                <td>${referrer}</td>
            </tr>
        `;
    }).join('');
}

// Load analytics on page load
loadAnalytics();
