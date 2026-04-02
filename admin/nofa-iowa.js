/**
 * Iowa NOFA Recipients Management
 * Interactive map and table for tracking NOFA-funded companies
 */

let recipients = [];
let filteredRecipients = [];
let map;
let markers = [];
let currentRecipient = null;

// Status color mapping
const STATUS_COLORS = {
    'not_contacted': '#dc143c',  // Red
    'prospect': '#ffd700',       // Yellow (when is_prospect = true)
    'responded': '#32cd32',      // Green
    'customer': '#4169e1',       // Blue
    'not_interested': '#808080'  // Gray
};

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    if (!checkAuth()) return;
    
    setupLogoutButton();
    initMap();
    await loadRecipients();
});

/**
 * Initialize Leaflet map centered on Iowa
 */
function initMap() {
    // Center on Iowa (approximate center)
    const iowaCenter = [42.0751, -93.4960];
    
    map = L.map('map').setView(iowaCenter, 7);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
}

/**
 * Load all recipients from API
 */
async function loadRecipients() {
    try {
        const response = await apiFetch('/api/nofa-recipients?action=all&state=IA');
        
        if (response.success) {
            recipients = response.data;
            filteredRecipients = recipients;
            renderTable();
            renderMapMarkers();
        } else {
            showNotification('Failed to load recipients', 'error');
        }
    } catch (error) {
        console.error('Error loading recipients:', error);
        showNotification('Failed to load recipients', 'error');
    }
}

/**
 * Render markers on map
 */
function renderMapMarkers() {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    filteredRecipients.forEach(recipient => {
        if (recipient.latitude && recipient.longitude) {
            const lat = parseFloat(recipient.latitude);
            const lng = parseFloat(recipient.longitude);
            
            // Determine marker color based on status or prospect flag
            let color = STATUS_COLORS.not_contacted;
            if (recipient.is_prospect) {
                color = STATUS_COLORS.prospect;
            } else if (recipient.status) {
                color = STATUS_COLORS[recipient.status] || STATUS_COLORS.not_contacted;
            }
            
            // Create custom icon
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${color};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid rgba(255, 255, 255, 0.4);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
            
            // Create popup content
            const fundingDisplay = recipient.funding_amount 
                ? `$${parseFloat(recipient.funding_amount).toLocaleString()}`
                : 'N/A';
            
            const popupContent = `
                <div style="font-family: Roboto, sans-serif; min-width: 200px;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #ff6b1a; font-size: 1.1rem;">
                        ${recipient.company_name}
                    </h3>
                    <p style="margin: 0.25rem 0; color: #fff;">
                        <strong>💰 Funding:</strong> ${fundingDisplay}
                    </p>
                    ${recipient.grant_program ? `
                        <p style="margin: 0.25rem 0; color: #fff;">
                            <strong>Program:</strong> ${recipient.grant_program}
                        </p>
                    ` : ''}
                    <p style="margin: 0.25rem 0; color: #fff;">
                        <strong>📍 Location:</strong> ${recipient.city || 'N/A'}, ${recipient.state || 'IA'}
                    </p>
                    ${recipient.award_date ? `
                        <p style="margin: 0.25rem 0; color: #fff;">
                            <strong>📅 Award:</strong> ${new Date(recipient.award_date).toLocaleDateString()}
                        </p>
                    ` : ''}
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                        <button onclick="viewRecipient(${recipient.id})" 
                                style="flex: 1; padding: 0.5rem; background: #ff6b1a; color: #000; 
                                       border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            View Details
                        </button>
                        ${!recipient.is_prospect ? `
                            <button onclick="markAsProspectFromMap(${recipient.id})" 
                                    style="flex: 1; padding: 0.5rem; background: #32cd32; color: #000; 
                                           border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                → Prospect
                            </button>
                        ` : `
                            <span style="flex: 1; padding: 0.5rem; background: rgba(255, 215, 0, 0.2); 
                                         color: #ffd700; border-radius: 6px; text-align: center; font-size: 0.85rem;">
                                ✓ Prospect
                            </span>
                        `}
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });
            
            // Click marker to also highlight row in table
            marker.on('click', () => {
                highlightTableRow(recipient.id);
            });
            
            markers.push(marker);
        }
    });
    
    // Fit map bounds to show all markers if there are any
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * Render recipients table
 */
function renderTable() {
    const container = document.getElementById('tableContainer');
    
    if (filteredRecipients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Recipients Found</h3>
                <p>Start by adding NOFA recipients to track potential business opportunities.</p>
            </div>
        `;
        return;
    }
    
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Company</th>
                    <th>Funding</th>
                    <th>Program</th>
                    <th>Location</th>
                    <th>Award Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRecipients.map(recipient => `
                    <tr onclick="viewRecipient(${recipient.id})" data-recipient-id="${recipient.id}">
                        <td>
                            <span class="company-name">${recipient.company_name}</span>
                            ${recipient.is_prospect ? '<span style="color: #ffd700; margin-left: 0.5rem;">★</span>' : ''}
                        </td>
                        <td class="funding-amount">
                            ${recipient.funding_amount 
                                ? '$' + parseFloat(recipient.funding_amount).toLocaleString() 
                                : 'N/A'}
                        </td>
                        <td>${recipient.grant_program || 'N/A'}</td>
                        <td>${recipient.city || 'N/A'}, ${recipient.state || 'IA'}</td>
                        <td>
                            ${recipient.award_date 
                                ? new Date(recipient.award_date).toLocaleDateString() 
                                : 'N/A'}
                        </td>
                        <td>
                            <span class="status-badge ${recipient.is_prospect ? 'prospect' : recipient.status}">
                                ${recipient.is_prospect 
                                    ? 'Prospect' 
                                    : formatStatus(recipient.status)}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
}

/**
 * Filter recipients based on selected filters
 */
function filterRecipients() {
    const statusFilter = document.getElementById('statusFilter').value;
    const prospectFilter = document.getElementById('prospectFilter').value;
    
    filteredRecipients = recipients.filter(recipient => {
        // Status filter
        if (statusFilter && recipient.status !== statusFilter) {
            return false;
        }
        
        // Prospect filter
        if (prospectFilter === 'true' && !recipient.is_prospect) {
            return false;
        }
        if (prospectFilter === 'false' && recipient.is_prospect) {
            return false;
        }
        
        return true;
    });
    
    renderTable();
    renderMapMarkers();
}

/**
 * Search recipients by company name
 */
function searchRecipients() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filterRecipients(); // Reset to current filters
        return;
    }
    
    filteredRecipients = recipients.filter(recipient => {
        return recipient.company_name.toLowerCase().includes(searchTerm) ||
               (recipient.city && recipient.city.toLowerCase().includes(searchTerm)) ||
               (recipient.county && recipient.county.toLowerCase().includes(searchTerm));
    });
    
    renderTable();
    renderMapMarkers();
}

/**
 * View recipient details
 */
function viewRecipient(id) {
    const recipient = recipients.find(r => r.id === id);
    if (!recipient) return;
    
    currentRecipient = recipient;
    
    document.getElementById('viewCompanyName').textContent = recipient.company_name;
    
    const fundingDisplay = recipient.funding_amount 
        ? '$' + parseFloat(recipient.funding_amount).toLocaleString()
        : 'N/A';
    
    const detailsHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Funding Amount</span>
                <span class="detail-value" style="color: #32cd32; font-weight: 600;">${fundingDisplay}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Grant Program</span>
                <span class="detail-value">${recipient.grant_program || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Award Date</span>
                <span class="detail-value">
                    ${recipient.award_date ? new Date(recipient.award_date).toLocaleDateString() : 'N/A'}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value">
                    <span class="status-badge ${recipient.is_prospect ? 'prospect' : recipient.status}">
                        ${recipient.is_prospect ? 'Prospect' : formatStatus(recipient.status)}
                    </span>
                </span>
            </div>
            
            <div class="detail-item full-width" style="border-top: 1px solid rgba(255,107,26,0.2); padding-top: 1rem; margin-top: 0.5rem;">
                <h3 style="color: var(--white); margin: 0 0 1rem 0;">Contact Information</h3>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">Contact Person</span>
                <span class="detail-value">${recipient.contact_person || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-value">
                    ${recipient.email 
                        ? `<a href="mailto:${recipient.email}" style="color: var(--primary-color);">${recipient.email}</a>`
                        : 'N/A'}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phone</span>
                <span class="detail-value">
                    ${recipient.phone 
                        ? `<a href="tel:${recipient.phone}" style="color: var(--primary-color);">${recipient.phone}</a>`
                        : 'N/A'}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Website</span>
                <span class="detail-value">
                    ${recipient.website 
                        ? `<a href="${recipient.website}" target="_blank" style="color: var(--primary-color);">${recipient.website}</a>`
                        : 'N/A'}
                </span>
            </div>
            
            <div class="detail-item full-width" style="border-top: 1px solid rgba(255,107,26,0.2); padding-top: 1rem; margin-top: 0.5rem;">
                <h3 style="color: var(--white); margin: 0 0 1rem 0;">Location</h3>
            </div>
            
            <div class="detail-item full-width">
                <span class="detail-label">Address</span>
                <span class="detail-value">${recipient.address || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">City</span>
                <span class="detail-value">${recipient.city || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">County</span>
                <span class="detail-value">${recipient.county || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">State</span>
                <span class="detail-value">${recipient.state || 'IA'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">ZIP Code</span>
                <span class="detail-value">${recipient.zip || 'N/A'}</span>
            </div>
            
            ${recipient.service_area || recipient.project_description ? `
                <div class="detail-item full-width" style="border-top: 1px solid rgba(255,107,26,0.2); padding-top: 1rem; margin-top: 0.5rem;">
                    <h3 style="color: var(--white); margin: 0 0 1rem 0;">Project Details</h3>
                </div>
            ` : ''}
            
            ${recipient.service_area ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Service Area</span>
                    <span class="detail-value">${recipient.service_area}</span>
                </div>
            ` : ''}
            
            ${recipient.project_description ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Project Description</span>
                    <span class="detail-value">${recipient.project_description}</span>
                </div>
            ` : ''}
            
            ${recipient.notes ? `
                <div class="detail-item full-width">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">${recipient.notes}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('viewModalBody').innerHTML = detailsHTML;
    
    // Update "Mark as Prospect" button
    const prospectBtn = document.getElementById('markProspectBtn');
    if (recipient.is_prospect) {
        prospectBtn.textContent = 'Already a Prospect';
        prospectBtn.disabled = true;
        prospectBtn.style.opacity = '0.5';
    } else {
        prospectBtn.textContent = 'Mark as Prospect';
        prospectBtn.disabled = false;
        prospectBtn.style.opacity = '1';
    }
    
    document.getElementById('viewModal').classList.add('active');
}

/**
 * Close view modal
 */
function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
    currentRecipient = null;
}

/**
 * Open add recipient modal
 */
function openAddModal() {
    document.getElementById('formModalTitle').textContent = 'Add NOFA Recipient';
    document.getElementById('recipientForm').reset();
    document.getElementById('recipientId').value = '';
    document.getElementById('formModal').classList.add('active');
}

/**
 * Open edit modal from view modal
 */
function openEditModal() {
    if (!currentRecipient) return;
    
    closeViewModal();
    
    document.getElementById('formModalTitle').textContent = 'Edit Recipient';
    document.getElementById('recipientId').value = currentRecipient.id;
    
    // Populate form
    const form = document.getElementById('recipientForm');
    Object.keys(currentRecipient).forEach(key => {
        const input = form.elements[key];
        if (input && currentRecipient[key] !== null) {
            input.value = currentRecipient[key];
        }
    });
    
    document.getElementById('formModal').classList.add('active');
}

/**
 * Close form modal
 */
function closeFormModal() {
    document.getElementById('formModal').classList.remove('active');
}

/**
 * Save recipient (create or update)
 */
async function saveRecipient(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const recipientId = data.id;
    delete data.id; // Remove id from data object
    
    try {
        let response;
        if (recipientId) {
            // Update existing
            response = await apiFetch(`/api/nofa-recipients?id=${recipientId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Create new
            response = await apiFetch('/api/nofa-recipients', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        if (response.success) {
            showNotification(response.message || 'Recipient saved successfully', 'success');
            closeFormModal();
            await loadRecipients();
        } else {
            showNotification(response.message || 'Failed to save recipient', 'error');
        }
    } catch (error) {
        console.error('Error saving recipient:', error);
        showNotification('Failed to save recipient', 'error');
    }
}

/**
 * Delete current recipient
 */
async function deleteRecipient() {
    if (!currentRecipient) return;
    
    if (!confirm(`Are you sure you want to delete ${currentRecipient.company_name}?`)) {
        return;
    }
    
    try {
        const response = await apiFetch(`/api/nofa-recipients?id=${currentRecipient.id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Recipient deleted successfully', 'success');
            closeViewModal();
            await loadRecipients();
        } else {
            showNotification('Failed to delete recipient', 'error');
        }
    } catch (error) {
        console.error('Error deleting recipient:', error);
        showNotification('Failed to delete recipient', 'error');
    }
}

/**
 * Mark recipient as prospect
 */
async function markAsProspect() {
    if (!currentRecipient || currentRecipient.is_prospect) return;
    
    try {
        // Create prospect from recipient
        const prospectData = {
            company_name: currentRecipient.company_name,
            contact_person: currentRecipient.contact_person,
            email: currentRecipient.email,
            phone: currentRecipient.phone,
            website: currentRecipient.website,
            address: currentRecipient.address,
            city: currentRecipient.city,
            state: currentRecipient.state,
            zip: currentRecipient.zip,
            nofa_recipient_id: currentRecipient.id,
            source: 'nofa_recipient',
            notes: `NOFA Recipient: ${currentRecipient.grant_program || 'Unknown'} - $${currentRecipient.funding_amount || '0'}`
        };
        
        const response = await apiFetch('/api/prospects', {
            method: 'POST',
            body: JSON.stringify(prospectData)
        });
        
        if (response.success) {
            showNotification(`${currentRecipient.company_name} marked as prospect!`, 'success');
            closeViewModal();
            await loadRecipients();
        } else {
            showNotification('Failed to create prospect', 'error');
        }
    } catch (error) {
        console.error('Error creating prospect:', error);
        showNotification('Failed to create prospect', 'error');
    }
}

/**
 * Mark as prospect from map popup
 */
async function markAsProspectFromMap(id) {
    const recipient = recipients.find(r => r.id === id);
    if (!recipient) return;
    
    currentRecipient = recipient;
    await markAsProspect();
}

/**
 * Highlight table row when marker is clicked
 */
function highlightTableRow(id) {
    // Remove existing highlights
    document.querySelectorAll('tbody tr').forEach(row => {
        row.style.background = '';
    });
    
    // Highlight the row
    const row = document.querySelector(`tr[data-recipient-id="${id}"]`);
    if (row) {
        row.style.background = 'rgba(255, 107, 26, 0.2)';
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Format status for display
 */
function formatStatus(status) {
    if (!status) return 'Not Contacted';
    
    const formatted = status.replace(/_/g, ' ');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
