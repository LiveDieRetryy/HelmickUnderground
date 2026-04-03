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
    'not_contacted': '#808080',  // Gray
    'prospect': '#ffd700',       // Yellow (when is_prospect = true)
    'responded': '#32cd32',      // Green
    'customer': '#4169e1',       // Blue
    'not_interested': '#dc143c'  // Red
};

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    if (!checkAuth()) return;
    
    setupLogoutButton();
    // Map is now embedded ArcGIS iframe - no need to initialize Leaflet
    await loadRecipients();
});

/**
 * Initialize Leaflet map centered on Iowa
 * NOTE: Map is now an embedded ArcGIS iframe, this function is deprecated
 */
function initMap() {
    // Map initialization removed - using embedded ArcGIS dashboard instead
    console.log('Map is now embedded ArcGIS dashboard - Leaflet map deprecated');
}

/**
 * Load all recipients from API
 */
async function loadRecipients() {
    try {
        const response = await apiFetch('/api/nofa?type=recipients&action=all&state=IA');
        
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
    // Skip if using embedded ArcGIS map instead of Leaflet
    if (!map) {
        console.log(`${filteredRecipients.length} recipients loaded (map rendered by ArcGIS)`);
        return;
    }
    
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
        const statusFilter = document.getElementById('statusFilter')?.value;
        const searchTerm = document.getElementById('searchInput')?.value;
        
        // Check if filters are active
        const hasActiveFilters = statusFilter || searchTerm;
        
        container.innerHTML = `
            <div class="empty-state">
                <h3>${hasActiveFilters ? 'No Recipients Match Your Filters' : 'No Recipients Found'}</h3>
                <p>${hasActiveFilters ? 'Try adjusting your search or filter criteria.' : 'Start by adding NOFA recipients to track potential business opportunities.'}</p>
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
                    <tr data-recipient-id="${recipient.id}">
                        <td onclick="viewRecipient(${recipient.id})" style="cursor: pointer;">
                            <span class="status-indicator ${(recipient.status || 'not_contacted').replaceAll('_', '-')}"></span>
                            <span class="company-name">${recipient.company_name}</span>
                            ${recipient.is_prospect ? '<span style="color: #ffd700; margin-left: 0.5rem;">★</span>' : ''}
                        </td>
                        <td onclick="viewRecipient(${recipient.id})" style="cursor: pointer;" class="funding-amount">
                            ${recipient.funding_amount 
                                ? '$' + parseFloat(recipient.funding_amount).toLocaleString() 
                                : 'N/A'}
                        </td>
                        <td onclick="viewRecipient(${recipient.id})" style="cursor: pointer;">${recipient.grant_program || 'N/A'}</td>
                        <td onclick="viewRecipient(${recipient.id})" style="cursor: pointer;">${recipient.city || 'N/A'}, ${recipient.state || 'IA'}</td>
                        <td onclick="viewRecipient(${recipient.id})" style="cursor: pointer;">
                            ${recipient.award_date 
                                ? new Date(recipient.award_date).toLocaleDateString() 
                                : 'N/A'}
                        </td>
                        <td>
                            <select class="status-dropdown" onchange="updateRecipientStatus(${recipient.id}, this.value)">
                                <option value="not_contacted" ${recipient.status === 'not_contacted' ? 'selected' : ''}>Not Contacted</option>
                                <option value="prospect" ${recipient.status === 'prospect' ? 'selected' : ''}>Prospect</option>
                                <option value="responded" ${recipient.status === 'responded' ? 'selected' : ''}>Responded</option>
                                <option value="customer" ${recipient.status === 'customer' ? 'selected' : ''}>Customer</option>
                                <option value="not_interested" ${recipient.status === 'not_interested' ? 'selected' : ''}>Not Interested</option>
                            </select>
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
    
    filteredRecipients = recipients.filter(recipient => {
        // Status filter
        if (statusFilter && recipient.status !== statusFilter) {
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
            response = await apiFetch(`/api/nofa?type=recipients&id=${recipientId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Create new
            response = await apiFetch('/api/nofa?type=recipients', {
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
        const response = await apiFetch(`/api/nofa?type=recipients&id=${currentRecipient.id}`, {
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
        
        const response = await apiFetch('/api/nofa?type=prospects', {
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
 * Update recipient status from dropdown
 */
async function updateRecipientStatus(recipientId, newStatus) {
    try {
        const response = await apiFetch(`/api/nofa?type=recipients&id=${recipientId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.success) {
            showNotification('Status updated successfully', 'success');
            
            // Update local recipient data
            const recipient = recipients.find(r => r.id === recipientId);
            if (recipient) {
                recipient.status = newStatus;
            }
            
            // Update the filtered recipients array too
            const filteredRecipient = filteredRecipients.find(r => r.id === recipientId);
            if (filteredRecipient) {
                filteredRecipient.status = newStatus;
            }
            
            // Update the status indicator color immediately without full re-render
            const row = document.querySelector(`tr[data-recipient-id="${recipientId}"]`);
            if (row) {
                const statusIndicator = row.querySelector('.status-indicator');
                if (statusIndicator) {
                    // Remove all status classes
                    statusIndicator.className = 'status-indicator';
                    // Add the new status class (convert underscores to hyphens for CSS class)
                    statusIndicator.classList.add(newStatus.replaceAll('_', '-'));
                }
            }
            
            // Re-render map markers to reflect new status color
            renderMapMarkers();
        } else {
            showNotification('Failed to update status', 'error');
            // Reload to reset dropdown to previous value
            await loadRecipients();
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Failed to update status', 'error');
        // Reload to reset dropdown to previous value
        await loadRecipients();
    }
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

/**
 * Open CSV import modal
 */
function openImportModal() {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('fileNameDisplay').textContent = '';
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResults').style.display = 'none';
}

/**
 * Close CSV import modal
 */
function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    document.getElementById('csvFileInput').value = '';
}

/**
 * Handle CSV file selection
 */
function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('fileNameDisplay').textContent = `Selected: ${file.name}`;
    parseAndImportCSV(file);
}

/**
 * Parse CSV and import data
 */
async function parseAndImportCSV(file) {
    const progressDiv = document.getElementById('importProgress');
    const statusDiv = document.getElementById('importStatus');
    const resultsDiv = document.getElementById('importResults');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    progressDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    
    try {
        // Read file
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }
        
        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
        
        // Map common column name variations
        const columnMap = {
            'company': 'company_name',
            'organization': 'company_name',
            'recipient': 'company_name',
            'entity': 'company_name',
            'contact': 'contact_person',
            'amount': 'funding_amount',
            'grant': 'grant_program',
            'program': 'grant_program',
            'award': 'award_date',
            'date': 'award_date',
            'lat': 'latitude',
            'lon': 'longitude',
            'lng': 'longitude',
            'long': 'longitude',
            'description': 'project_description',
            'project': 'project_description'
        };
        
        // Parse data rows
        const recipients = [];
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = parseCSVLine(lines[i]);
                if (values.length === 0 || !values[0]) continue; // Skip empty lines
                
                const row = {};
                header.forEach((col, index) => {
                    if (values[index]) {
                        // Map column name to standard field
                        const mappedCol = columnMap[col] || col;
                        row[mappedCol] = values[index].trim();
                    }
                });
                
                // Ensure required field
                if (!row.company_name) {
                    errors.push(`Row ${i + 1}: Missing company name`);
                    errorCount++;
                    continue;
                }
                
                // Set defaults
                row.state = row.state || 'IA';
                row.status = row.status || 'not_contacted';
                
                recipients.push(row);
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
                errorCount++;
            }
            
            // Update progress
            const progress = Math.floor((i / lines.length) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            statusDiv.textContent = `Parsing row ${i} of ${lines.length - 1}...`;
        }
        
        // Import recipients
        statusDiv.textContent = 'Importing recipients...';
        
        for (let i = 0; i < recipients.length; i++) {
            try {
                const response = await apiFetch('/api/nofa?type=recipients', {
                    method: 'POST',
                    body: JSON.stringify(recipients[i])
                });
                
                if (response.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(`${recipients[i].company_name}: ${response.message}`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`${recipients[i].company_name}: ${error.message}`);
            }
            
            // Update progress
            const progress = Math.floor(((i + 1) / recipients.length) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            statusDiv.textContent = `Importing ${i + 1} of ${recipients.length}...`;
        }
        
        // Show results
        progressDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); padding: 1.5rem; border-radius: 8px; border-left: 4px solid ${successCount > 0 ? 'var(--primary-color)' : '#dc143c'};">
                <h3 style="color: var(--white); margin: 0 0 1rem 0;">Import Complete</h3>
                <div style="color: var(--light-gray); line-height: 2;">
                    <div> Successfully imported: <strong style="color: #32cd32;">${successCount}</strong> recipients</div>
                    ${errorCount > 0 ? `<div> Failed: <strong style="color: #dc143c;">${errorCount}</strong> rows</div>` : ''}
                </div>
                ${errors.length > 0 && errors.length <= 10 ? `
                    <details style="margin-top: 1rem;">
                        <summary style="color: var(--primary-color); cursor: pointer;">View Errors</summary>
                        <div style="margin-top: 0.5rem; padding: 0.75rem; background: #1a1a1a; border-radius: 4px; font-family: monospace; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">
                            ${errors.map(e => `<div>${e}</div>`).join('')}
                        </div>
                    </details>
                ` : ''}
            </div>
        `;
        
        // Reload data
        if (successCount > 0) {
            await loadRecipients();
            showNotification(`Imported ${successCount} recipients successfully!`, 'success');
        }
        
    } catch (error) {
        progressDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); padding: 1.5rem; border-radius: 8px; border-left: 4px solid #dc143c;">
                <h3 style="color: #dc143c; margin: 0 0 1rem 0;">Import Failed</h3>
                <div style="color: var(--light-gray);">${error.message}</div>
            </div>
        `;
        showNotification('Import failed', 'error');
    }
}

/**
 * Parse a CSV line handling quotes and commas
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result.map(v => v.replace(/^"|"$/g, '').trim());
}

/**
 * Download CSV template
 */
function downloadCSVTemplate() {
    const headers = [
        'company_name',
        'contact_person',
        'email',
        'phone',
        'website',
        'funding_amount',
        'grant_program',
        'award_date',
        'address',
        'city',
        'county',
        'state',
        'zip',
        'latitude',
        'longitude',
        'service_area',
        'project_description',
        'notes'
    ];
    
    const exampleRow = [
        'Iowa Fiber Networks',
        'John Doe',
        'john@iowafiber.com',
        '515-555-0100',
        'https://iowafiber.com',
        '5000000',
        'NTIA BEAD',
        '2025-01-15',
        '123 Main St',
        'Des Moines',
        'Polk County',
        'IA',
        '50309',
        '41.5868',
        '-93.6250',
        'Polk County rural areas',
        'Fiber to the home deployment',
        'Potential high-value prospect'
    ];
    
    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nofa_recipients_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Template downloaded!', 'success');
}

/**
 * Fetch NOFA data automatically from government sources
 */
async function fetchFromInternet() {
    const confirmation = confirm(
        '🌐 Auto-Fetch Iowa NOFA Recipients\n\n' +
        'This will automatically fetch broadband funding recipient data from:\n' +
        '• USAspending.gov (Federal grants)\n' +
        '• FCC RDOF data\n' +
        '• USDA ReConnect program\n\n' +
        'This may take 30-60 seconds. Continue?'
    );
    
    if (!confirmation) return;
    
    // Show loading notification
    const loadingNotif = document.createElement('div');
    loadingNotif.id = 'fetchingNotification';
    loadingNotif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #32cd32 0%, #228b22 100%);
        color: white;
        padding: 1.5rem 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        z-index: 10000;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 1rem;
    `;
    loadingNotif.innerHTML = `
        <div class="spinner" style="border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
        <div>
            <div>🌐 Fetching data from government sources...</div>
            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 0.25rem;">This may take a minute</div>
        </div>
    `;
    document.body.appendChild(loadingNotif);
    
    // Add spinner animation
    if (!document.getElementById('spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    try {
        const response = await apiFetch('/api/nofa?type=scraper', {
            method: 'POST',
            body: JSON.stringify({
                source: 'all'
            })
        });
        
        // Remove loading notification
        if (loadingNotif.parentNode) {
            loadingNotif.remove();
        }
        
        if (response.success) {
            const data = response.data;
            
            // Show detailed results
            let message = '✅ Auto-Fetch Complete!\n\n';
            message += `📥 Imported: ${data.imported} new recipients\n`;
            if (data.errors > 0) {
                message += `⚠️ Errors: ${data.errors}\n`;
            }
            message += '\nSources checked:\n';
            data.details.forEach(detail => {
                if (detail.company) {
                    message += `  • ${detail.company} (${detail.status})\n`;
                } else if (detail.source) {
                    message += `  • ${detail.source}: ${detail.status || detail.error}\n`;
                }
            });
            
            alert(message);
            
            showNotification(`Loaded ${data.imported} recipients from government databases!`, 'success');
            
            // Reload the map and table
            await loadRecipients();
        } else {
            showNotification('Failed to fetch data: ' + (response.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        // Remove loading notification
        if (loadingNotif.parentNode) {
            loadingNotif.remove();
        }
        
        console.error('Fetch error:', error);
        showNotification('Failed to fetch data from government sources', 'error');
    }
}

/**
 * Sync NOFA data from the embedded ArcGIS map
 */
async function syncFromMap() {
    const confirmation = confirm(
        '🔄 Clear & Re-Sync from Official Map\n\n' +
        '⚠️ This will DELETE all existing NOFA 009 recipients and re-import fresh data.\n\n' +
        'This ensures you get:\n' +
        '✅ Latest funding amounts\n' +
        '✅ Updated project details\n' +
        '✅ Complete county information\n\n' +
        'Source: Iowa NOFA 009 Broadband Dashboard\n' +
        'Published: 9/4/2025\n\n' +
        'This will take 10-30 seconds. Continue?'
    );
    
    if (!confirmation) return;
    
    // Disable button and show loading state
    const syncBtn = document.getElementById('syncMapBtn');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '⏳ Clearing & Syncing...';
    
    // Show loading notification
    const loadingNotif = document.createElement('div');
    loadingNotif.id = 'syncingNotification';
    loadingNotif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #32cd32 0%, #228b22 100%);
        color: white;
        padding: 1.5rem 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        z-index: 10000;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 1rem;
    `;
    loadingNotif.innerHTML = `
        <div class="spinner" style="border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></div>
        <div>
            <div>🔄 Clearing old data & syncing from map...</div>
            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 0.25rem;">This will take a moment</div>
        </div>
    `;
    document.body.appendChild(loadingNotif);
    
    // Add spinner animation if not already present
    if (!document.getElementById('spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    try {
        const response = await apiFetch('/api/nofa?type=scraper', {
            method: 'POST',
            body: JSON.stringify({
                source: 'arcgis',
                clearExisting: true
            })
        });
        
        // Remove loading notification
        if (loadingNotif.parentNode) {
            loadingNotif.remove();
        }
        
        // Re-enable button
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
        
        if (response.success) {
            const data = response.data;
            
            // Show detailed results
            let message = '✅ Sync Complete!\n\n';
            message += `📥 Imported: ${data.imported} new recipients\n`;
            if (data.errors > 0) {
                message += `⚠️ Errors: ${data.errors}\n`;
            }
            if (data.details && data.details.length > 0) {
                message += '\nProjects:\n';
                data.details.slice(0, 10).forEach(detail => {
                    if (detail.company) {
                        message += `  • ${detail.company} (${detail.status})\n`;
                    }
                });
                if (data.details.length > 10) {
                    message += `  ... and ${data.details.length - 10} more\n`;
                }
            }
            
            alert(message);
            
            if (data.imported > 0) {
                showNotification(`Successfully synced ${data.imported} recipients from map!`, 'success');
                // Reload the table
                await loadRecipients();
            } else {
                showNotification('All recipients already imported', 'info');
            }
        } else {
            showNotification('Failed to sync: ' + (response.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        // Remove loading notification
        if (loadingNotif.parentNode) {
            loadingNotif.remove();
        }
        
        // Re-enable button
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
        
        console.error('Sync error:', error);
        showNotification('Failed to sync data from map', 'error');
    }
}

