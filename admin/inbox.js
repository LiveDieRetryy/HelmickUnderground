// Inbox Script

let currentSubmissionId = null;
let allSubmissions = [];

// Check authentication
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = '/admin/';
        return false;
    }
    return true;
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = '/admin/';
});

// Load submissions
async function loadSubmissions() {
    if (!checkAuth()) return;

    try {
        const [submissionsResponse, statsResponse] = await Promise.all([
            fetch('/api/contact-submissions?action=all'),
            fetch('/api/contact-submissions?action=stats')
        ]);

        if (!submissionsResponse.ok || !statsResponse.ok) {
            throw new Error('Failed to load submissions');
        }

        allSubmissions = await submissionsResponse.json();
        const stats = await statsResponse.json();

        // Update stats
        document.getElementById('totalSubmissions').textContent = stats.total || 0;
        document.getElementById('unreadSubmissions').textContent = stats.unread || 0;
        document.getElementById('todaySubmissions').textContent = stats.today || 0;

        // Hide loading, show content
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('inboxContent').style.display = 'block';

        // Render submissions
        renderSubmissions();

    } catch (error) {
        console.error('Error loading submissions:', error);
        document.getElementById('loadingMessage').innerHTML = `
            <p style="color: var(--red);">Error loading submissions</p>
            <p style="font-size: 0.9rem; color: var(--gray);">Please try refreshing the page</p>
        `;
    }
}

// Render submissions list
function renderSubmissions() {
    const container = document.getElementById('submissionsList');
    
    if (allSubmissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <h3 style="color: var(--gray); margin-bottom: 0.5rem;">No submissions yet</h3>
                <p>Quote requests will appear here when customers submit the contact form</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allSubmissions.map(submission => {
        const date = new Date(submission.timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const services = submission.services || [];
        const statusClass = submission.status === 'unread' ? 'unread' : 'read';

        return `
            <div class="submission-card ${statusClass}" onclick="viewSubmission(${submission.id})">
                <div class="submission-header">
                    <div class="submission-info">
                        <div class="submission-name">${submission.name}</div>
                        <div class="submission-contact">
                            <a href="tel:${submission.phone}" onclick="event.stopPropagation()">${submission.phone}</a> • 
                            <a href="mailto:${submission.email}" onclick="event.stopPropagation()">${submission.email}</a>
                        </div>
                    </div>
                    <div class="submission-meta">
                        <span class="submission-time">${timeStr}</span>
                        <span class="status-badge ${statusClass}">${submission.status}</span>
                    </div>
                </div>
                ${services.length > 0 ? `
                    <div class="submission-services">
                        ${services.map(service => `<span class="service-tag">${service}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="submission-message">${submission.message}</div>
            </div>
        `;
    }).join('');
}

// View submission details
async function viewSubmission(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;

    currentSubmissionId = id;

    // Populate modal
    document.getElementById('modalName').textContent = submission.name;
    
    const date = new Date(submission.timestamp);
    const timeStr = date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    document.getElementById('modalTime').textContent = timeStr;

    document.getElementById('modalContact').innerHTML = `
        <strong>Phone:</strong> <a href="tel:${submission.phone}" style="color: var(--primary-color); text-decoration: none;">${submission.phone}</a><br>
        <strong>Email:</strong> <a href="mailto:${submission.email}" style="color: var(--primary-color); text-decoration: none;">${submission.email}</a>
    `;

    const services = submission.services || [];
    if (services.length > 0) {
        document.getElementById('modalServices').innerHTML = services.map(service => 
            `<span class="service-tag">${service}</span>`
        ).join('');
    } else {
        document.getElementById('modalServices').innerHTML = '<p style="color: var(--gray);">No services specified</p>';
    }

    document.getElementById('modalMessage').textContent = submission.message;

    // Show modal
    document.getElementById('detailModal').classList.add('active');

    // Mark as read if unread
    if (submission.status === 'unread') {
        try {
            await fetch(`/api/contact-submissions?action=markRead&id=${id}`);
            submission.status = 'read';
            
            // Update stats
            const unreadCount = parseInt(document.getElementById('unreadSubmissions').textContent);
            document.getElementById('unreadSubmissions').textContent = Math.max(0, unreadCount - 1);
            
            // Re-render to update status
            renderSubmissions();
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }
}

// Close modal
function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
    currentSubmissionId = null;
}

// Delete submission
async function deleteSubmission() {
    if (!currentSubmissionId) return;

    if (!confirm('Are you sure you want to delete this submission? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/contact-submissions?action=delete&id=${currentSubmissionId}`);
        if (!response.ok) throw new Error('Delete failed');

        // Remove from local array
        allSubmissions = allSubmissions.filter(s => s.id !== currentSubmissionId);

        // Update stats
        const totalCount = parseInt(document.getElementById('totalSubmissions').textContent);
        document.getElementById('totalSubmissions').textContent = Math.max(0, totalCount - 1);

        // Close modal and re-render
        closeModal();
        renderSubmissions();

    } catch (error) {
        console.error('Error deleting submission:', error);
        alert('Failed to delete submission. Please try again.');
    }
}

// Close modal on overlay click
document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Load submissions on page load
loadSubmissions();
