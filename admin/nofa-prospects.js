/**
 * Marketing Prospects Management
 * Track and manage outreach to potential customers
 */

let prospects = [];
let filteredProspects = [];
let currentProspect = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    if (!checkAuth()) return;
    
    setupLogoutButton();
    await loadProspects();
});

/**
 * Load all prospects from API
 */
async function loadProspects() {
    try {
        const response = await apiFetch('/api/nofa?type=prospects&action=all');
        
        if (response.success) {
            prospects = response.data;
            filteredProspects = prospects;
            updateStats();
            filterProspects();
        } else {
            showNotification('Failed to load prospects', 'error');
        }
    } catch (error) {
        console.error('Error loading prospects:', error);
        showNotification('Failed to load prospects', 'error');
    }
}

/**
 * Update stats cards
 */
function updateStats() {
    const stats = {
        total: prospects.length,
        not_contacted: prospects.filter(p => p.status === 'not_contacted').length,
        email_sent: prospects.filter(p => p.status === 'email_sent').length,
        responded: prospects.filter(p => p.status === 'responded').length
    };
    
    document.getElementById('totalCount').textContent = stats.total;
    document.getElementById('notContactedCount').textContent = stats.not_contacted;
    document.getElementById('emailSentCount').textContent = stats.email_sent;
    document.getElementById('respondedCount').textContent = stats.responded;
}

/**
 * Filter and render prospects
 */
function filterProspects() {
    const statusFilter = document.getElementById('statusFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;
    
    // Filter by status
    filteredProspects = prospects.filter(prospect => {
        if (statusFilter && prospect.status !== statusFilter) {
            return false;
        }
        return true;
    });
    
    // Sort
    filteredProspects.sort((a, b) => {
        if (sortFilter === 'next_followup') {
            const dateA = a.next_followup || a.created_at;
            const dateB = b.next_followup || b.created_at;
            return new Date(dateB) - new Date(dateA);
        } else if (sortFilter === 'created') {
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortFilter === 'company') {
            return a.company_name.localeCompare(b.company_name);
        }
        return 0;
    });
    
    renderProspects();
}

/**
 * Render prospects grid
 */
function renderProspects() {
    const container = document.getElementById('prospectsGrid');
    
    if (filteredProspects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Prospects Yet</h3>
                <p>Mark NOFA recipients as prospects or add companies manually to start tracking your outreach.</p>
                <button class="btn btn-primary" onclick="window.location.href='nofa-iowa.html'" style="margin-top: 1rem;">
                    View NOFA Recipients
                </button>
            </div>
        `;
        return;
    }
    
    const prospectsHTML = filteredProspects.map(prospect => {
        const followupDate = prospect.next_followup 
            ? new Date(prospect.next_followup).toLocaleDateString()
            : 'Not set';
        
        const lastContactDate = prospect.last_contacted 
            ? new Date(prospect.last_contacted).toLocaleDateString()
            : 'Never';
        
        const isOverdue = prospect.next_followup && new Date(prospect.next_followup) < new Date();
        
        return `
            <div class="prospect-card" onclick="viewProspect(${prospect.id})">
                <div class="prospect-header">
                    <h3>${prospect.company_name}</h3>
                    <span class="prospect-status ${prospect.status}">
                        ${formatStatus(prospect.status)}
                    </span>
                </div>
                
                <div class="prospect-info">
                    <div class="prospect-info-item">
                        <strong>Contact Person</strong>
                        ${prospect.contact_person || 'N/A'}
                    </div>
                    <div class="prospect-info-item">
                        <strong>Email</strong>
                        ${prospect.email || 'N/A'}
                    </div>
                    <div class="prospect-info-item">
                        <strong>Phone</strong>
                        ${prospect.phone || 'N/A'}
                    </div>
                    <div class="prospect-info-item">
                        <strong>Location</strong>
                        ${prospect.city ? `${prospect.city}, ${prospect.state || 'IA'}` : 'N/A'}
                    </div>
                    <div class="prospect-info-item">
                        <strong>Last Contacted</strong>
                        ${lastContactDate}
                    </div>
                    <div class="prospect-info-item ${isOverdue ? 'text-danger' : ''}">
                        <strong>Next Follow-up</strong>
                        ${followupDate}
                        ${isOverdue ? ' <span style="color: #dc143c;">⚠ Overdue</span>' : ''}
                    </div>
                </div>
                
                ${prospect.notes ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,107,26,0.2); color: var(--gray); font-size: 0.9rem;">
                        ${prospect.notes.substring(0, 100)}${prospect.notes.length > 100 ? '...' : ''}
                    </div>
                ` : ''}
                
                <div class="prospect-actions" onclick="event.stopPropagation()">
                    ${prospect.email ? `
                        <button class="btn-email" onclick="sendEmail(${prospect.id})">
                            📧 Send Email
                        </button>
                    ` : ''}
                    <button class="btn-edit" onclick="editProspect(${prospect.id})">
                        ✏️ Edit
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = prospectsHTML;
}

/**
 * View prospect details (could expand to full modal if needed)
 */
function viewProspect(id) {
    const prospect = prospects.find(p => p.id === id);
    if (!prospect) return;
    
    // For now, just open edit modal
    editProspect(id);
}

/**
 * Edit prospect
 */
function editProspect(id) {
    const prospect = prospects.find(p => p.id === id);
    if (!prospect) return;
    
    currentProspect = prospect;
    
    document.getElementById('formModalTitle').textContent = 'Edit Prospect';
    document.getElementById('prospectId').value = prospect.id;
    document.getElementById('deleteBtn').style.display = 'block';
    
    // Populate form
    const form = document.getElementById('prospectForm');
    Object.keys(prospect).forEach(key => {
        const input = form.elements[key];
        if (input && prospect[key] !== null) {
            // Handle date formatting
            if ((key === 'next_followup' || key === 'last_contacted') && prospect[key]) {
                const date = new Date(prospect[key]);
                input.value = date.toISOString().split('T')[0];
            } else {
                input.value = prospect[key];
            }
        }
    });
    
    document.getElementById('formModal').classList.add('active');
}

/**
 * Open add prospect modal
 */
function openAddModal() {
    document.getElementById('formModalTitle').textContent = 'Add Prospect';
    document.getElementById('prospectForm').reset();
    document.getElementById('prospectId').value = '';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('formModal').classList.add('active');
}

/**
 * Close form modal
 */
function closeFormModal() {
    document.getElementById('formModal').classList.remove('active');
    currentProspect = null;
}

/**
 * Save prospect (create or update)
 */
async function saveProspect(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const prospectId = data.id;
    delete data.id;
    
    // Clean up empty date fields
    if (!data.next_followup) delete data.next_followup;
    if (!data.last_contacted) delete data.last_contacted;
    
    try {
        let response;
        if (prospectId) {
            // Update existing
            response = await apiFetch(`/api/nofa?type=prospects&id=${prospectId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Create new
            response = await apiFetch('/api/nofa?type=prospects', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        if (response.success) {
            showNotification(response.message || 'Prospect saved successfully', 'success');
            closeFormModal();
            await loadProspects();
        } else {
            showNotification(response.message || 'Failed to save prospect', 'error');
        }
    } catch (error) {
        console.error('Error saving prospect:', error);
        showNotification('Failed to save prospect', 'error');
    }
}

/**
 * Delete current prospect
 */
async function deleteProspect() {
    if (!currentProspect) return;
    
    if (!confirm(`Are you sure you want to delete ${currentProspect.company_name}?`)) {
        return;
    }
    
    try {
        const response = await apiFetch(`/api/nofa?type=prospects&id=${currentProspect.id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Prospect deleted successfully', 'success');
            closeFormModal();
            await loadProspects();
        } else {
            showNotification('Failed to delete prospect', 'error');
        }
    } catch (error) {
        console.error('Error deleting prospect:', error);
        showNotification('Failed to delete prospect', 'error');
    }
}

/**
 * Send marketing email to prospect
 */
function sendEmail(id) {
    const prospect = prospects.find(p => p.id === id);
    if (!prospect || !prospect.email) return;
    
    // For now, open default email client
    // In the future, this could open a custom email builder
    const subject = encodeURIComponent('Underground Utility Services - Helmick Underground LLC');
    const body = encodeURIComponent(`Dear ${prospect.contact_person || 'Sir/Madam'},\n\nI hope this email finds you well. I wanted to reach out regarding potential contracting opportunities for underground utility services...\n\nBest regards,\nHelmick Underground LLC`);
    
    window.location.href = `mailto:${prospect.email}?subject=${subject}&body=${body}`;
    
    // TODO: In the future, integrate with email-builder or track sends automatically
    showNotification('Email client opened. Remember to update status after sending!', 'info');
}

/**
 * Format status for display
 */
function formatStatus(status) {
    if (!status) return 'Not Contacted';
    
    const formatted = status.replace(/_/g, ' ');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
