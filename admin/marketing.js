// Marketing Outreach Page - Email Composer
// Handles recipient loading, email composition, and sending via Gmail

let recipients = [];
let selectedRecipient = null;
let emailHistory = [];
let currentFilter = 'all';
let searchTerm = '';

// Email Templates
const emailTemplates = {
    introduction: {
        name: 'Introduction',
        description: 'Introduce Helmick Underground services',
        subject: 'Underground Utility Services for {company}',
        body: `Hello {name},

I hope this message finds you well. My name is with Helmick Underground LLC, and I'm reaching out regarding your recent NOFA funding for broadband infrastructure in Iowa.

Why Helmick Underground?

We specialize in underground utility services with a proven track record in fiber optic installation and broadband infrastructure projects. Our team brings:

- Expert fiber optic cable installation and splicing
- Precision directional drilling and underground boring
- Professional utility line location and repair services
- Full support for commercial and municipal projects
- Modern equipment and experienced crew

Your NOFA Project

We understand that {company} has been awarded funding for expanding broadband access in your service area. Our services are specifically designed to support projects like yours, ensuring quality installation and on-time completion.

Let's Connect

I'd welcome the opportunity to discuss how we can support your infrastructure projects. Whether you need installation services, equipment support, or consulting on project execution, we're here to help.

Best regards,

Helmick Underground LLC
Underground Utility Experts
(712) 330-6073 | (712) 330-2060`
    },
    followup: {
        name: 'Follow-Up',
        description: 'Follow up on previous contact',
        subject: 'Following Up: Partnership with {company}',
        body: `Hello {name},

I wanted to follow up on my previous message regarding underground utility services for your NOFA-funded broadband projects.

Quick Recap

Helmick Underground specializes in:
- Fiber optic installation for broadband expansion
- Directional drilling and underground boring
- Utility line services for municipal projects
- Professional project support from planning to completion

Timeline Considerations

We understand that NOFA projects often have strict timelines and requirements. Our experienced team is ready to support your project schedule and ensure quality results.

Next Steps

Would you be available for a brief call this week? I'd be happy to:
- Answer any questions about our services
- Discuss your specific project requirements
- Provide references from similar projects
- Share competitive pricing information

I look forward to hearing from you.

Best regards,

Helmick Underground LLC
(712) 330-6073 | (712) 330-2060`
    },
    partnership: {
        name: 'Partnership Opportunity',
        description: 'Propose partnership or collaboration',
        subject: 'Partnership Opportunity: {company} & Helmick Underground',
        body: `Hello {name},

I'm reaching out to explore a partnership opportunity between Helmick Underground and {company} for your broadband infrastructure initiatives.

About Our Partnership Approach

We work collaboratively with utilities, municipalities, and broadband providers to deliver:
- Turnkey underground utility installation services
- Flexible project support tailored to your needs
- Competitive and transparent pricing
- Quality workmanship with modern equipment
- Reliable communication and project management

Your Success is Our Priority

With your NOFA funding and our installation expertise, we can work together to:
- Meet aggressive deployment timelines
- Ensure quality fiber optic installations
- Manage costs effectively
- Achieve your broadband expansion goals

Our Track Record

Helmick Underground has successfully completed numerous fiber optic and underground utility projects across Iowa. We understand the unique challenges of rural broadband deployment and NOFA-funded initiatives.

Let's Discuss Collaboration

I'd value the opportunity to explore how we can support {company}'s infrastructure projects. Can we schedule a brief call to discuss potential collaboration?

Best regards,

Helmick Underground LLC
Your Partner in Underground Infrastructure
(712) 330-6073 | (712) 330-2060`
    },
    custom: {
        name: 'Custom Message',
        description: 'Write your own message',
        subject: '',
        body: ''
    }
};

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication first
    if (!checkAuth()) {
        return;
    }
    
    // Load recipients and email history
    await Promise.all([
        loadRecipients(),
        loadEmailHistory()
    ]);
    
    // Setup event listeners
    setupEventListeners();
    
    // Update stats
    updateStats();
});

// Setup event listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', function(e) {
        searchTerm = e.target.value.toLowerCase();
        filterAndRenderRecipients();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterAndRenderRecipients();
        });
    });
}

// Load recipients from API
async function loadRecipients() {
    try {
        const response = await apiFetch('/api/nofa?type=recipients&action=all&state=Iowa');
        if (response && response.success) {
            recipients = response.data || [];
            filterAndRenderRecipients();
        }
    } catch (error) {
        console.error('Failed to load recipients:', error);
        showToast('Failed to load recipients', 'error');
    }
}

// Load email history
async function loadEmailHistory() {
    try {
        const response = await apiFetch('/api/emails?action=all');
        if (response && Array.isArray(response)) {
            emailHistory = response.filter(email => email.email_type === 'marketing');
        }
    } catch (error) {
        console.error('Failed to load email history:', error);
    }
}

// Filter and render recipients
function filterAndRenderRecipients() {
    let filtered = recipients;
    
    // Apply filter
    if (currentFilter === 'with-email') {
        filtered = filtered.filter(r => r.contact_email);
    } else if (currentFilter === 'priority') {
        filtered = filtered.filter(r => r.is_prospect === 'Yes' || r.priority_contact === true);
    }
    
    // Apply search
    if (searchTerm) {
        filtered = filtered.filter(r => {
            const name = (r.contact_name || '').toLowerCase();
            const company = (r.company_name || '').toLowerCase();
            return name.includes(searchTerm) || company.includes(searchTerm);
        });
    }
    
    // Render
    renderRecipients(filtered);
}

// Render recipients list
function renderRecipients(recipientsToRender) {
    const container = document.getElementById('recipientsList');
    
    if (recipientsToRender.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--gray);">No recipients found</div>';
        return;
    }
    
    container.innerHTML = recipientsToRender.map(recipient => {
        const hasEmail = recipient.contact_email && recipient.contact_email.trim() !== '';
        const emailsSentToThis = emailHistory.filter(e => 
            e.recipient_email === recipient.contact_email
        ).length;
        
        const isSelected = selectedRecipient && selectedRecipient.id === recipient.id;
        
        return `
            <div class="recipient-item ${hasEmail ? 'has-email' : 'no-email'} ${isSelected ? 'selected' : ''}" 
                 data-id="${recipient.id}"
                 onclick="selectRecipient(${recipient.id})">
                <div class="recipient-name">${recipient.contact_name || 'Unknown'}</div>
                <div class="recipient-company">${recipient.company_name || 'N/A'}</div>
                <div class="recipient-location">${recipient.city || 'Unknown'}, ${recipient.state || 'IA'}</div>
                ${hasEmail ? `
                    <div class="recipient-stats">
                        <span class="stat-item ${emailsSentToThis > 0 ? 'has-sent' : ''}">
                            📧 ${emailsSentToThis} sent
                        </span>
                        ${recipient.funding_amount ? `
                            <span class="stat-item">
                                💰 $${formatNumber(recipient.funding_amount)}
                            </span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Select a recipient
window.selectRecipient = function(recipientId) {
    selectedRecipient = recipients.find(r => r.id === recipientId);
    
    if (!selectedRecipient) return;
    
    // Update selected state in UI
    document.querySelectorAll('.recipient-item').forEach(item => {
        item.classList.remove('selected');
        if (parseInt(item.dataset.id) === recipientId) {
            item.classList.add('selected');
        }
    });
    
    // Render composer
    renderComposer();
};

// Render email composer
function renderComposer() {
    const container = document.getElementById('composerBody');
    
    if (!selectedRecipient) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>👈 Select a Recipient</h3>
                <p>Choose a company from the list to compose and send a personalized email.</p>
            </div>
        `;
        return;
    }
    
    // Check if recipient has email
    if (!selectedRecipient.contact_email || selectedRecipient.contact_email.trim() === '') {
        container.innerHTML = `
            <div class="empty-state">
                <h3>❌ No Email Address</h3>
                <p><strong>${selectedRecipient.company_name}</strong> does not have an email address on file.</p>
                <p style="font-size: 0.9rem; margin-top: 1rem;">Add an email address to the recipient's profile to send them a message.</p>
            </div>
        `;
        return;
    }
    
    // Get email history for this recipient
    const recipientEmails = emailHistory.filter(e => 
        e.recipient_email === selectedRecipient.contact_email
    );
    
    container.innerHTML = `
        <!-- Recipient Info -->
        <div style="background: rgba(255, 107, 26, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary-color); margin-bottom: 2rem;">
            <strong style="color: var(--white); font-size: 1.1rem;">${selectedRecipient.contact_name || 'Unknown'}</strong>
            <div style="color: var(--gray); margin-top: 0.3rem;">${selectedRecipient.company_name}</div>
            <div style="color: var(--gray); font-size: 0.9rem; margin-top: 0.3rem;">
                📧 ${selectedRecipient.contact_email}
            </div>
            ${recipientEmails.length > 0 ? `
                <div style="color: var(--success); font-size: 0.9rem; margin-top: 0.5rem;">
                    ✅ ${recipientEmails.length} email${recipientEmails.length > 1 ? 's' : ''} sent previously
                    ${recipientEmails.length > 0 ? `(Last: ${formatDate(recipientEmails[0].sent_at)})` : ''}
                </div>
            ` : `
                <div style="color: var(--warning); font-size: 0.9rem; margin-top: 0.5rem;">
                    ⚠️ No previous emails sent
                </div>
            `}
        </div>
        
        <!-- Template Selector -->
        <div class="form-group">
            <label>Choose a Template:</label>
            <div class="template-selector">
                ${Object.entries(emailTemplates).map(([key, template]) => `
                    <button class="template-btn ${key === 'introduction' ? 'active' : ''}" 
                            data-template="${key}"
                            onclick="selectTemplate('${key}')">
                        <strong>${template.name}</strong>
                        <span>${template.description}</span>
                    </button>
                `).join('')}
            </div>
        </div>
        
        <!-- Email Form -->
        <form id="emailForm" onsubmit="sendEmail(event)">
            <div class="form-group">
                <label>Subject Line:</label>
                <input type="text" id="emailSubject" required placeholder="Email subject...">
                <div class="form-hint">Use {name} or {company} to personalize</div>
                <div class="variable-tags">
                    <span class="variable-tag" onclick="insertVariable('emailSubject', '{name}')">Insert {name}</span>
                    <span class="variable-tag" onclick="insertVariable('emailSubject', '{company}')">Insert {company}</span>
                </div>
            </div>
            
            <div class="form-group">
                <label>Message:</label>
                <textarea id="emailBody" required placeholder="Your message..."></textarea>
                <div class="form-hint">Use {name} or {company} to personalize</div>
                <div class="variable-tags">
                    <span class="variable-tag" onclick="insertVariable('emailBody', '{name}')">Insert {name}</span>
                    <span class="variable-tag" onclick="insertVariable('emailBody', '{company}')">Insert {company}</span>
                </div>
            </div>
        </form>
        
        <!-- Previous Emails -->
        ${recipientEmails.length > 0 ? `
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255, 107, 26, 0.2);">
                <h3 style="color: var(--white); margin-bottom: 1rem;">Previous Emails:</h3>
                ${recipientEmails.slice(0, 3).map(email => `
                    <div style="background: var(--black); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid var(--success);">
                        <div style="color: var(--white); font-weight: 600;">${email.subject}</div>
                        <div style="color: var(--gray); font-size: 0.85rem; margin-top: 0.3rem;">
                            Sent: ${formatDate(email.sent_at)}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    // Load introduction template by default
    selectTemplate('introduction');
    
    // Render action buttons
    renderActionButtons();
}

// Render action buttons
function renderActionButtons() {
    const panel = document.querySelector('.composer-panel');
    
    // Remove existing action buttons if any
    const existing = panel.querySelector('.action-buttons');
    if (existing) {
        existing.remove();
    }
    
    // Add new action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    actionButtons.innerHTML = `
        <button type="button" class="btn-preview" onclick="previewEmail()">
            👁️ Preview
        </button>
        <button type="submit" class="btn-send" form="emailForm" id="sendBtn">
            📧 Send Email
        </button>
    `;
    
    panel.appendChild(actionButtons);
}

// Select email template
window.selectTemplate = function(templateKey) {
    const template = emailTemplates[templateKey];
    
    // Update active state
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.template === templateKey) {
            btn.classList.add('active');
        }
    });
    
    // Populate form
    document.getElementById('emailSubject').value = template.subject;
    document.getElementById('emailBody').value = template.body;
};

// Insert variable into field
window.insertVariable = function(fieldId, variable) {
    const field = document.getElementById(fieldId);
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const text = field.value;
    
    field.value = text.substring(0, start) + variable + text.substring(end);
    field.focus();
    field.selectionStart = field.selectionEnd = start + variable.length;
};

// Preview email
window.previewEmail = function() {
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    
    if (!subject || !body) {
        showToast('Please fill in subject and message', 'error');
        return;
    }
    
    // Replace variables with actual values
    const recipientName = selectedRecipient.contact_name || 'there';
    const companyName = selectedRecipient.company_name || 'your company';
    
    const processedSubject = subject
        .replace(/\{name\}/gi, recipientName)
        .replace(/\{company\}/gi, companyName);
        
    const processedBody = body
        .replace(/\{name\}/gi, recipientName)
        .replace(/\{company\}/gi, companyName);
    
    // Show preview in modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div style="background: var(--card-dark); border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--primary-color);">
            <div style="background: var(--primary-color); padding: 1.5rem; border-radius: 12px 12px 0 0;">
                <h2 style="margin: 0; color: white;">Email Preview</h2>
            </div>
            <div style="padding: 2rem;">
                <div style="margin-bottom: 1rem;">
                    <strong style="color: var(--gray);">To:</strong>
                    <div style="color: var(--white); margin-top: 0.5rem;">${selectedRecipient.contact_email}</div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong style="color: var(--gray);">Subject:</strong>
                    <div style="color: var(--white); margin-top: 0.5rem;">${processedSubject}</div>
                </div>
                <div>
                    <strong style="color: var(--gray);">Message:</strong>
                    <div style="color: var(--white); margin-top: 0.5rem; white-space: pre-wrap; line-height: 1.6;">${processedBody}</div>
                </div>
            </div>
            <div style="padding: 1.5rem; border-top: 1px solid rgba(255, 107, 26, 0.2); text-align: right;">
                <button onclick="this.closest('[style*=fixed]').remove()" style="padding: 0.75rem 1.5rem; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    Close Preview
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

// Send email
window.sendEmail = async function(event) {
    event.preventDefault();
    
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    
    if (!selectedRecipient || !selectedRecipient.contact_email) {
        showToast('Please select a recipient with an email address', 'error');
        return;
    }
    
    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
    
    try {
        const response = await apiFetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emailType: 'marketing',
                to: selectedRecipient.contact_email,
                subject: subject,
                body: body,
                recipientName: selectedRecipient.contact_name,
                companyName: selectedRecipient.company_name,
                metadata: {
                    recipient_id: selectedRecipient.id,
                    company: selectedRecipient.company_name,
                    funding_amount: selectedRecipient.funding_amount
                }
            })
        });
        
        if (response.success) {
            showToast('Email sent successfully! ✅', 'success');
            
            // Reload email history
            await loadEmailHistory();
            
            // Re-render composer to show updated history
            renderComposer();
            
            // Update stats
            updateStats();
            
            // Clear form (optional - commented out so they can send similar emails)
            // document.getElementById('emailSubject').value = '';
            // document.getElementById('emailBody').value = '';
        } else {
            throw new Error(response.error || 'Failed to send email');
        }
    } catch (error) {
        console.error('Send email error:', error);
        showToast(error.message || 'Failed to send email', 'error');
    } finally {
        // Re-enable button
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
};

// Update statistics
function updateStats() {
    const totalRecipients = recipients.length;
    const withEmail = recipients.filter(r => r.contact_email && r.contact_email.trim() !== '').length;
    const emailsSent = emailHistory.length;
    
    // Calculate this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = emailHistory.filter(e => {
        const sentDate = new Date(e.sent_at);
        return sentDate >= firstDayOfMonth;
    }).length;
    
    document.getElementById('totalRecipients').textContent = totalRecipients;
    document.getElementById('withEmail').textContent = withEmail;
    document.getElementById('emailsSent').textContent = emailsSent;
    document.getElementById('thisMonth').textContent = thisMonth;
}

// Show toast message
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `message-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility: Format number
function formatNumber(num) {
    if (!num) return '0';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

// Utility: Format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
