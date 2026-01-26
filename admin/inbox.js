// Check auth
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

let allSubmissions = [];
let currentFilter = 'all';

// Load data
async function loadData() {
    if (!checkAuth()) return;

    try {
        console.log('Fetching submissions...');
        
        const [submissionsRes, statsRes] = await Promise.all([
            fetch('/api/contact-submissions?action=all'),
            fetch('/api/contact-submissions?action=stats')
        ]);

        console.log('Submissions response:', submissionsRes.status);
        console.log('Stats response:', statsRes.status);

        if (!submissionsRes.ok || !statsRes.ok) {
            const errorText = await submissionsRes.text();
            console.error('Error response:', errorText);
            throw new Error('Failed to load data');
        }

        allSubmissions = await submissionsRes.json();
        const stats = await statsRes.json();

        console.log('Loaded submissions:', allSubmissions.length);
        console.log('Stats:', stats);

        // Update filter dropdown counts
        updateFilterCounts(stats);

        // Hide loading
        document.getElementById('loading').style.display = 'none';
        document.getElementById('submissionsList').style.display = 'block';

        // Render
        renderSubmissions();

    } catch (error) {
        console.error('Error loading data:', error);
        
        // Try to get response text for debugging
        let errorDetails = error.message;
        try {
            const testRes = await fetch('/api/contact-submissions?action=all');
            const testText = await testRes.text();
            console.error('API Response:', testText);
            errorDetails = testText.substring(0, 200);
        } catch (e) {
            console.error('Could not fetch error details:', e);
        }
        
        document.getElementById('loading').innerHTML = `
            <div style="color: var(--red);">
                <div style="font-size: 2rem;">⚠️</div>
                <p>Error loading submissions</p>
                <p style="font-size: 0.9rem; color: var(--gray);">${error.message}</p>
                <p style="font-size: 0.8rem; color: var(--gray); margin-top: 1rem; max-width: 600px; word-break: break-all;">${errorDetails}</p>
                <p style="font-size: 0.85rem; color: var(--gray); margin-top: 1rem;">Check browser console for full details</p>
            </div>
        `;
    }
}

// Update filter dropdown counts
function updateFilterCounts(stats) {
    const totalCount = stats.total || 0;
    const unreadCount = stats.unread || 0;
    const readCount = stats.read || 0;
    const acknowledgedCount = stats.acknowledged || 0;
    const contactedCount = stats.contacted || 0;
    const scheduledCount = stats.scheduled || 0;
    const quotedCount = stats.quoted || 0;
    const completedCount = stats.completed || 0;
    const declinedCount = (stats.declined || 0);
    const todayCount = stats.today || 0;
    
    // Update select options with counts
    const select = document.getElementById('statusFilter');
    select.options[0].text = `All (${totalCount})`;
    select.options[1].text = `📬 Unread (${unreadCount})`;
    select.options[2].text = `📖 Read (${readCount})`;
    select.options[3].text = `✉️ Acknowledged (${acknowledgedCount})`;
    select.options[4].text = `📞 Contacted (${contactedCount})`;
    select.options[5].text = `📅 Scheduled (${scheduledCount})`;
    select.options[6].text = `💰 Quoted (${quotedCount})`;
    select.options[7].text = `✅ Completed (${completedCount})`;
    select.options[8].text = `❌ Declined (${declinedCount})`;
    
    // Update today count
    document.getElementById('todayCount').innerHTML = `Today: <strong style="color: var(--primary-color);">${todayCount}</strong>`;
}

// Filter submissions
function filterSubmissions() {
    currentFilter = document.getElementById('statusFilter').value;
    renderSubmissions();
}

// Render submissions
function renderSubmissions() {
    const container = document.getElementById('submissionsList');
    
    // Filter submissions based on current filter
    const filteredSubmissions = currentFilter === 'all' 
        ? allSubmissions 
        : allSubmissions.filter(sub => sub.status === currentFilter);

    if (filteredSubmissions.length === 0) {
        const message = currentFilter === 'all' 
            ? 'Quote requests will appear here when customers submit the contact form'
            : `No submissions with status: ${currentFilter}`;
        
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <h3>No submissions yet</h3>
                <p>${message}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredSubmissions.map(sub => {
        const date = new Date(sub.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        return `
            <div class="submission-card ${sub.status === 'unread' ? 'unread' : ''}" onclick="viewSubmission(${sub.id})">
                <div class="submission-header">
                    <div class="submission-name">${sub.name}</div>
                    <select class="card-status-dropdown status-${sub.status}" onchange="updateStatusFromCard(${sub.id}, this.value)" onclick="event.stopPropagation()">
                        <option value="unread" ${sub.status === 'unread' ? 'selected' : ''}>📬 Unread</option>
                        <option value="read" ${sub.status === 'read' ? 'selected' : ''}>📖 Read</option>
                        <option value="acknowledged" ${sub.status === 'acknowledged' ? 'selected' : ''}>✉️ Acknowledged</option>
                        <option value="contacted" ${sub.status === 'contacted' ? 'selected' : ''}>📞 Contacted</option>
                        <option value="scheduled" ${sub.status === 'scheduled' ? 'selected' : ''}>📅 Scheduled</option>
                        <option value="quoted" ${sub.status === 'quoted' ? 'selected' : ''}>💰 Quoted</option>
                        <option value="completed" ${sub.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                        <option value="declined" ${sub.status === 'declined' ? 'selected' : ''}>❌ Declined</option>
                    </select>
                </div>
                <div class="submission-info">
                    <div class="info-item">
                        <strong>Email:</strong> ${sub.email}
                    </div>
                    <div class="info-item">
                        <strong>Phone:</strong> ${sub.phone || 'Not provided'}
                    </div>
                    <div class="info-item">
                        <strong>Date:</strong> ${dateStr}
                    </div>
                </div>
                ${sub.services && sub.services.length > 0 ? `
                    <div class="services-list">
                        ${sub.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="message-preview">${sub.message}</div>
            </div>
        `;
    }).join('');
}

// View submission
async function viewSubmission(id) {
    const sub = allSubmissions.find(s => s.id == id);
    if (!sub) return;

    // Auto-mark as read if it's unread
    if (sub.status === 'unread') {
        try {
            const response = await fetch(`/api/contact-submissions?action=updateStatus&id=${id}&status=read`);
            if (response.ok) {
                sub.status = 'read';
                renderSubmissions();
                // Update counts
                loadData();
            }
        } catch (error) {
            console.error('Error auto-marking as read:', error);
        }
    }

    const date = new Date(sub.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    document.getElementById('modalBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-label">Status</div>
            <select id="statusSelect" class="status-select" onchange="updateStatus(${id}, this.value)">
                <option value="unread" ${sub.status === 'unread' ? 'selected' : ''}>📬 Unread</option>
                <option value="read" ${sub.status === 'read' ? 'selected' : ''}>📖 Read</option>
                <option value="acknowledged" ${sub.status === 'acknowledged' ? 'selected' : ''}>✉️ Acknowledged</option>
                <option value="contacted" ${sub.status === 'contacted' ? 'selected' : ''}>📞 Contacted</option>
                <option value="scheduled" ${sub.status === 'scheduled' ? 'selected' : ''}>📅 Scheduled</option>
                <option value="quoted" ${sub.status === 'quoted' ? 'selected' : ''}>💰 Quoted</option>
                <option value="completed" ${sub.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                <option value="declined" ${sub.status === 'declined' ? 'selected' : ''}>❌ Declined</option>
            </select>
        </div>
        <div class="detail-section">
            <div class="detail-label">Name</div>
            <div class="detail-value">${sub.name}</div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Email</div>
            <div class="detail-value"><a href="mailto:${sub.email}" style="color: var(--primary-color);">${sub.email}</a></div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Phone</div>
            <div class="detail-value"><a href="tel:${sub.phone}" style="color: var(--primary-color);">${sub.phone || 'Not provided'}</a></div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Date Submitted</div>
            <div class="detail-value">${dateStr}</div>
        </div>
        ${sub.services && sub.services.length > 0 ? `
            <div class="detail-section">
                <div class="detail-label">Services Requested</div>
                <div class="services-list">
                    ${sub.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        <div class="detail-section">
            <div class="detail-label">Message</div>
            <div class="detail-value" style="white-space: pre-wrap;">${sub.message}</div>
        </div>
        ${sub.notes ? `
            <div class="detail-section" data-notes-section="${sub.id}">
                <div class="detail-label">Contact Notes <button onclick="editNotes(${sub.id}, '${sub.notes.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 0.9rem; margin-left: 0.5rem;">✏️ Edit</button></div>
                <div class="detail-value" style="white-space: pre-wrap; background: rgba(255, 107, 26, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--primary-color);">${sub.notes}</div>
            </div>
        ` : ''}
        ${sub.scheduled_date ? `
            <div class="detail-section">
                <div class="detail-label">📅 Scheduled Meeting</div>
                <div class="detail-value" style="background: rgba(34, 197, 94, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid #22c55e; font-weight: 600;">${new Date(sub.scheduled_date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</div>
            </div>
        ` : ''}
        ${sub.quote_data ? `
            <div class="detail-section">
                <div class="detail-label">💰 Quote Details</div>
                <div style="background: rgba(255, 107, 26, 0.05); padding: 1.5rem; border-radius: 12px; border: 2px solid rgba(255, 107, 26, 0.3);">
                    ${(() => {
                        try {
                            const quote = typeof sub.quote_data === 'string' ? JSON.parse(sub.quote_data) : sub.quote_data;
                            return `
                                <div style="margin-bottom: 1rem;">
                                    <strong style="color: var(--primary-color);">Total: $${quote.subtotal.toFixed(2)}</strong>
                                </div>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    ${quote.lineItems.map(item => `
                                        <div style="padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; margin-bottom: 0.5rem;">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                                <strong>${item.name}</strong>
                                                <span style="color: var(--primary-color); font-weight: 700;">$${(item.quantity * item.rate).toFixed(2)}</span>
                                            </div>
                                            <div style="color: var(--gray); font-size: 0.9rem;">
                                                Qty: ${item.quantity} × $${item.rate.toFixed(2)}
                                                ${item.description ? `<br>${item.description}` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${quote.notes ? `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 107, 26, 0.2); color: var(--gray); font-size: 0.9rem; white-space: pre-wrap;">${quote.notes}</div>` : ''}
                            `;
                        } catch (e) {
                            return '<span style="color: var(--red);">Error displaying quote data</span>';
                        }
                    })()}
                </div>
            </div>
        ` : ''}
        ${sub.ip ? `
            <div class="detail-section">
                <div class="detail-label">IP Address</div>
                <div class="detail-value" style="color: var(--gray); font-size: 0.9rem;">${sub.ip}</div>
            </div>
        ` : ''}
        ${sub.status === 'acknowledged' ? `
            <button class="btn-send-ack" onclick="showNotesForm(${sub.id})">
                <span>📞</span>
                <span>Mark as Contacted</span>
            </button>
            <div id="notesForm-${sub.id}" style="display: none; margin-top: 1.5rem; padding: 1.5rem; background: rgba(255, 107, 26, 0.05); border-radius: 12px; border: 2px solid rgba(255, 107, 26, 0.3);">
                <h3 style="color: var(--primary-color); margin-bottom: 1rem;">Contact Notes</h3>
                <textarea id="notesInput-${sub.id}" placeholder="Enter notes from your conversation with the customer..." style="width: 100%; min-height: 120px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 1rem; color: var(--white); font-family: inherit; resize: vertical;"></textarea>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button onclick="saveNotes(${sub.id})" style="flex: 1; background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
                        Save & Mark as Contacted
                    </button>
                    <button onclick="hideNotesForm(${sub.id})" style="flex: 0 0 auto; background: rgba(255, 255, 255, 0.1); color: var(--white); padding: 0.75rem 1.5rem; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-weight: 700; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        ` : sub.status === 'contacted' ? `
            <button class="btn-send-ack" onclick="showScheduleForm(${sub.id})">
                <span>📅</span>
                <span>Schedule Meeting</span>
            </button>
            <div id="scheduleForm-${sub.id}" style="display: none; margin-top: 1.5rem; padding: 1.5rem; background: rgba(255, 107, 26, 0.05); border-radius: 12px; border: 2px solid rgba(255, 107, 26, 0.3);">
                <h3 style="color: var(--primary-color); margin-bottom: 1rem;">Schedule First Meeting</h3>
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem;">Meeting Date</label>
                        <input type="date" id="scheduleDate-${sub.id}" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-family: inherit;">
                    </div>
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem;">Meeting Time</label>
                        <input type="time" id="scheduleTime-${sub.id}" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-family: inherit;">
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button onclick="saveSchedule(${sub.id})" style="flex: 1; background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
                        Save & Mark as Scheduled
                    </button>
                    <button onclick="hideScheduleForm(${sub.id})" style="flex: 0 0 auto; background: rgba(255, 255, 255, 0.1); color: var(--white); padding: 0.75rem 1.5rem; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-weight: 700; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        ` : sub.status === 'scheduled' ? `
            <button class="btn-send-ack" onclick="window.location.href='/admin/quote-builder.html?id=${sub.id}'">
                <span>📝</span>
                <span>Build Quote</span>
            </button>
        ` : `
            <button class="btn-send-ack" id="sendAckBtn-${sub.id}" onclick="sendAcknowledgmentEmail(${sub.id})">
                <span>📧</span>
                <span>Send Acknowledgment Email</span>
            </button>
        `}
        <button class="btn-delete" onclick="deleteSubmission(${sub.id})">🗑️ Delete This Submission</button>
    `;

    document.getElementById('detailModal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// Delete submission
async function deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
        const response = await fetch(`/api/contact-submissions?action=delete&id=${id}`);
        if (!response.ok) throw new Error('Delete failed');

        closeModal();
        loadData(); // Refresh
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Failed to delete submission');
    }
}

// Update status
async function updateStatus(id, newStatus) {
    try {
        const response = await fetch(`/api/contact-submissions?action=updateStatus&id=${id}&status=${newStatus}`);
        if (!response.ok) throw new Error('Update failed');
        
        // Update local data
        const sub = allSubmissions.find(s => s.id == id);
        if (sub) sub.status = newStatus;
        
        // Refresh display
        loadData();
        
        console.log(`Updated submission ${id} to status: ${newStatus}`);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status');
    }
}

// Update status from card dropdown
async function updateStatusFromCard(id, newStatus) {
    if (!newStatus) return; // Ignore if "Change Status..." is selected
    
    try {
        const response = await fetch(`/api/contact-submissions?action=updateStatus&id=${id}&status=${newStatus}`);
        if (!response.ok) throw new Error('Update failed');
        
        // Update local data
        const sub = allSubmissions.find(s => s.id == id);
        if (sub) sub.status = newStatus;
        
        // Refresh display
        loadData();
        
        console.log(`Updated submission ${id} to status: ${newStatus}`);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status');
    }
}

// Send acknowledgment email
async function sendAcknowledgmentEmail(id) {
    const sub = allSubmissions.find(s => s.id == id);
    if (!sub) return;

    const btn = document.getElementById(`sendAckBtn-${id}`);
    if (!btn) return;

    // Disable button
    btn.disabled = true;
    btn.innerHTML = '<span>📧</span><span>Sending...</span>';

    try {
        const response = await fetch('/api/send-acknowledgment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: sub.name,
                email: sub.email,
                services: sub.services
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send email');
        }

        // Success
        btn.innerHTML = '<span>✅</span><span>Email Sent!</span>';
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.color = '#10b981';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';

        // Update status to acknowledged
        await fetch(`/api/contact-submissions?action=updateStatus&id=${id}&status=acknowledged`);
        sub.status = 'acknowledged';
        
        // Refresh display
        loadData();
        
        // Close modal and refresh
        setTimeout(() => {
            closeModal();
        }, 2000);

        // Reset button after 3 seconds
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span>📧</span><span>Send Acknowledgment Email</span>';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 3000);

    } catch (error) {
        console.error('Error sending acknowledgment email:', error);
        
        // Error state
        btn.innerHTML = '<span>❌</span><span>Failed to Send</span>';
        btn.style.background = 'rgba(239, 68, 68, 0.2)';
        btn.style.color = '#ef4444';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.5)';

        // Reset button after 3 seconds
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span>📧</span><span>Send Acknowledgment Email</span>';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 3000);
        
        alert('Failed to send acknowledgment email: ' + error.message);
    }
}

// Mark as contacted
async function markAsContacted(id) {
    const notes = prompt('Enter notes from your conversation with the customer:');
    if (notes === null) return; // User cancelled
    
    try {
        const response = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, status: 'contacted', notes })
        });

        if (!response.ok) throw new Error('Failed to update status');

        // Refresh data and close modal
        await loadData();
        closeModal();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to mark as contacted: ' + error.message);
    }
}

// Show notes form
function showNotesForm(id) {
    const form = document.getElementById(`notesForm-${id}`);
    const button = form.previousElementSibling;
    if (form && button) {
        button.style.display = 'none';
        form.style.display = 'block';
        document.getElementById(`notesInput-${id}`).focus();
    }
}

// Hide notes form
function hideNotesForm(id) {
    const form = document.getElementById(`notesForm-${id}`);
    const button = form.previousElementSibling;
    if (form && button) {
        form.style.display = 'none';
        button.style.display = 'flex';
        document.getElementById(`notesInput-${id}`).value = '';
    }
}

// Save notes and mark as contacted
async function saveNotes(id) {
    const notesInput = document.getElementById(`notesInput-${id}`);
    const notes = notesInput.value.trim();
    
    if (!notes) {
        alert('Please enter notes from your conversation.');
        notesInput.focus();
        return;
    }
    
    try {
        const response = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, status: 'contacted', notes })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update status');
        }

        // Refresh data and close modal
        await loadData();
        closeModal();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to mark as contacted: ' + error.message);
    }
}

// Edit existing notes
function editNotes(id, currentNotes) {
    const notesSection = document.querySelector(`#modalBody [data-notes-section="${id}"]`);
    if (!notesSection) return;
    
    notesSection.innerHTML = `
        <div class="detail-label">Contact Notes</div>
        <textarea id="editNotesInput-${id}" style="width: 100%; min-height: 120px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 1rem; color: var(--white); font-family: inherit; resize: vertical;">${currentNotes}</textarea>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button onclick="saveEditedNotes(${id})" style="flex: 1; background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
                Save Changes
            </button>
            <button onclick="cancelEditNotes(${id}, '${currentNotes.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')" style="flex: 0 0 auto; background: rgba(255, 255, 255, 0.1); color: var(--white); padding: 0.75rem 1.5rem; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; font-weight: 700; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;
    document.getElementById(`editNotesInput-${id}`).focus();
}

// Save edited notes
async function saveEditedNotes(id) {
    const notesInput = document.getElementById(`editNotesInput-${id}`);
    const notes = notesInput.value.trim();
    
    if (!notes) {
        alert('Notes cannot be empty.');
        notesInput.focus();
        return;
    }
    
    try {
        const response = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, notes })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update notes');
        }

        // Refresh data and reopen modal to show updated notes
        await loadData();
        const submission = allSubmissions.find(s => s.id === id);
        if (submission) {
            showDetails(submission);
        }
    } catch (error) {
        console.error('Error updating notes:', error);
        alert('Failed to update notes: ' + error.message);
    }
}

// Cancel edit notes
function cancelEditNotes(id, originalNotes) {
    const notesSection = document.querySelector(`#modalBody [data-notes-section="${id}"]`);
    if (!notesSection) return;
    
    notesSection.innerHTML = `
        <div class="detail-label">Contact Notes <button onclick="editNotes(${id}, '${originalNotes.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 0.9rem; margin-left: 0.5rem;">✏️ Edit</button></div>
        <div class="detail-value" style="white-space: pre-wrap; background: rgba(255, 107, 26, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--primary-color);">${originalNotes}</div>
    `;
}

// Show schedule form
function showScheduleForm(id) {
    const form = document.getElementById(`scheduleForm-${id}`);
    const button = form.previousElementSibling;
    if (form && button) {
        button.style.display = 'none';
        form.style.display = 'block';
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById(`scheduleDate-${id}`).value = today;
        document.getElementById(`scheduleDate-${id}`).focus();
    }
}

// Hide schedule form
function hideScheduleForm(id) {
    const form = document.getElementById(`scheduleForm-${id}`);
    const button = form.previousElementSibling;
    if (form && button) {
        form.style.display = 'none';
        button.style.display = 'flex';
        document.getElementById(`scheduleDate-${id}`).value = '';
        document.getElementById(`scheduleTime-${id}`).value = '';
    }
}

// Save schedule and mark as scheduled
async function saveSchedule(id) {
    const dateInput = document.getElementById(`scheduleDate-${id}`);
    const timeInput = document.getElementById(`scheduleTime-${id}`);
    
    const date = dateInput.value;
    const time = timeInput.value;
    
    if (!date) {
        alert('Please select a meeting date.');
        dateInput.focus();
        return;
    }
    
    if (!time) {
        alert('Please select a meeting time.');
        timeInput.focus();
        return;
    }
    
    // Combine date and time into ISO string
    const scheduledDate = new Date(`${date}T${time}`).toISOString();
    
    try {
        const response = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, status: 'scheduled', scheduled_date: scheduledDate })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to schedule meeting');
        }

        // Refresh data and close modal
        await loadData();
        closeModal();
    } catch (error) {
        console.error('Error scheduling meeting:', error);
        alert('Failed to schedule meeting: ' + error.message);
    }
}

// Close modal on outside click
document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') {
        closeModal();
    }
});

// Load on page load
checkAuth();
loadData();
