// Marketing Outreach Page - Email Composer
// Handles email composition and sending via Gmail

let emailHistory = [];

// Email Templates
const emailTemplates = {
    introduction: {
        name: 'Introduction',
        description: 'Local crew for fiber builds',
        subject: 'Local Crew for 2026–2027 Fiber Builds',
        body: `Hi {name},

I'm reaching out regarding your 2026–2027 fiber build plans for {company}.

My name is Tommy Helmick. I'm a partner at Helmick Underground formerly known as Triple J Construction, out of Mount Vernon. We're a local owner-operator crew focused on plowing and directional drilling.

We've been in business since 1988, with extensive experience working with Qwest/CenturyLink across a wide range of projects, as well as building out rural networks with Springville Cooperative, and assisting with Panora Fiber's build.

What sets us apart is how we operate as a crew.

No rotating subs or shifting crews. Just a consistent team that maintains steady production from start to finish.

We handle everything from prep through completion, which keeps the project moving without relying on multiple crews.

Being local, we take pride in the work we leave behind. Site cleanup is a priority, and we aim to leave every job looking as good as we found it.

We run a full setup with the versatility to handle a variety of conditions. A Ditch Witch 1250 quad track for direct bury with backups in place, multiple drills including a Vermeer 20x22 and two Astec DD 2024s for crossings and long pipe sections, with a Larson trailer that allows for fast figure eighting and smooth transitions between pipe and plow. More importantly, it's an experienced crew that shows up every day and keeps that equipment producing efficiently.

We're local, CDL A, fully insured. With a focus on continuing to help build rural infrastructure within our own community.

I'd be glad to stop by, introduce myself, and talk through how we can help you hit your 2026 and 2027 goals.

Would you have 15 minutes sometime this week or next?

I look forward to hearing from you,

Tommy Helmick`
    },
    followup: {
        name: 'Follow-Up',
        description: 'Follow up on contact',
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
        description: 'Propose collaboration',
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
        description: 'Write your own',
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
    
    // Load email history for stats
    await loadEmailHistory();
    
    // Initialize composer immediately
    initializeComposer();
    
    // Update stats
    updateStats();
    
    // Render outbox
    renderOutbox();
});

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

// Initialize the composer with template selector
function initializeComposer() {
    const composerBody = document.getElementById('composerBody');
    
    composerBody.innerHTML = `
        <!-- Template Selector -->
        <div class="template-selector">
            <button class="template-btn active" data-template="introduction" onclick="selectTemplate('introduction')">
                <strong>Introduction</strong>
                <span>Local crew for fiber builds</span>
            </button>
            <button class="template-btn" data-template="followup" onclick="selectTemplate('followup')">
                <strong>Follow-Up</strong>
                <span>Follow up on contact</span>
            </button>
            <button class="template-btn" data-template="partnership" onclick="selectTemplate('partnership')">
                <strong>Partnership</strong>
                <span>Propose collaboration</span>
            </button>
            <button class="template-btn" data-template="custom" onclick="selectTemplate('custom')">
                <strong>Custom</strong>
                <span>Write your own</span>
            </button>
        </div>

        <!-- Email Form -->
        <form id="emailForm" onsubmit="sendEmail(event)">
            <div class="form-group">
                <label>Subject:</label>
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
    `;
    
    // Load introduction template by default
    selectTemplate('introduction');
    
    // Render action buttons
    renderActionButtons();
}

// Render action buttons
function renderActionButtons() {
    const composerBody = document.getElementById('composerBody');
    
    // Remove existing action buttons if any
    const existing = composerBody.querySelector('.action-buttons');
    if (existing) {
        existing.remove();
    }
    
    // Add preview button only
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    actionButtons.innerHTML = `
        <button type="button" class="btn-send" onclick="previewEmail()" style="width: 100%;">
            👁️ Preview & Send Email
        </button>
    `;
    
    composerBody.appendChild(actionButtons);
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

// Generate HTML email template (matching buildMarketing() from api/emails.js)
function generateEmailHTML(bodyText) {
    // Split by double newlines to identify paragraphs
    const paragraphs = bodyText.split('\n\n').filter(p => p.trim());
    
    // Build HTML paragraphs with proper styling
    let htmlContent = '';
    paragraphs.forEach(para => {
        const trimmed = para.trim();
        
        // Check if it's a bulleted list
        if (trimmed.includes('\n-') || trimmed.includes('\n•')) {
            const items = trimmed.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
            const listItems = items.map(item => {
                const text = item.replace(/^[-•]\s*/, '').trim();
                return `<li style="margin-bottom: 0.5rem; color: #444;">${text}</li>`;
            }).join('');
            
            htmlContent += `
                <ul style="margin: 1.5rem 0; padding-left: 1.5rem; line-height: 1.8;">
                    ${listItems}
                </ul>
            `;
        } else if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith('?') && !trimmed.endsWith('!')) {
            // Likely a heading or subheading
            htmlContent += `
                <h3 style="color: #ff6b1a; margin: 1.5rem 0 1rem; font-size: 1.1rem; font-weight: 600;">
                    ${trimmed}
                </h3>
            `;
        } else {
            // Regular paragraph
            const formatted = trimmed.replace(/\n/g, '<br>');
            htmlContent += `
                <p style="margin-bottom: 1.2rem; line-height: 1.8; color: #333; font-size: 1rem;">
                    ${formatted}
                </p>
            `;
        }
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 650px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Header with Logo -->
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 2rem; text-align: center; border-bottom: 4px solid #ff6b1a;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground" style="max-width: 220px; height: auto; margin-bottom: 0.5rem;">
        </div>
        
        <!-- Main Content -->
        <div style="padding: 2.5rem 2rem;">
            ${htmlContent}
        </div>
        
        <!-- Call to Action -->
        <div style="background: linear-gradient(135deg, rgba(255, 107, 26, 0.1) 0%, rgba(255, 107, 26, 0.05) 100%); padding: 1.5rem; margin: 0 2rem 2rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
            <p style="margin: 0; color: #333; font-size: 0.95rem; line-height: 1.6;">
                <strong style="color: #ff6b1a;">Learn more about our services:</strong><br>
                <a href="https://helmickunderground.com" style="color: #0066cc; text-decoration: underline; font-weight: 600;">HelmickUnderground.com</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%); padding: 2rem; text-align: center; border-top: 2px solid #ff6b1a;">
            <p style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: #ff6b1a;">
                Helmick Underground LLC
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.95rem;">
                📞 <strong style="color: #ff6b1a;">319-721-9925</strong>
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.9rem;">
                📧 HelmickUnderground@gmail.com
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.9rem;">
                🌐 HelmickUnderground.com
            </p>
            <p style="margin: 1.5rem 0 0 0; color: #777; font-size: 0.8rem; line-height: 1.5;">
                Expert underground utility services for fiber optic installation,<br>
                directional drilling, and broadband infrastructure in Iowa
            </p>
            <p style="margin: 1rem 0 0 0; color: #666; font-size: 0.75rem;">
                © ${new Date().getFullYear()} Helmick Underground LLC. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;
}

// Preview email
window.previewEmail = function() {
    // Get form values
    const companyName = document.getElementById('companyName').value.trim();
    const contactName = document.getElementById('contactName').value.trim();
    const emailAddress = document.getElementById('emailAddress').value.trim();
    
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    
    // Validate
    if (!companyName || !contactName || !emailAddress) {
        showToast('Please fill in all required recipient information', 'error');
        return;
    }
    
    if (!subject || !body) {
        showToast('Please fill in subject and message', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Replace variables with actual values
    const processedSubject = subject
        .replace(/\{name\}/gi, contactName)
        .replace(/\{company\}/gi, companyName);
        
    const processedBody = body
        .replace(/\{name\}/gi, contactName)
        .replace(/\{company\}/gi, companyName);
    
    // Generate HTML email template (matching buildMarketing() from api/emails.js)
    const emailHTML = generateEmailHTML(processedBody);
    
    // Show preview in modal with send button
    const modalId = 'emailPreviewModal_' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 2rem;
        overflow-y: auto;
    `;
    
    const recipientInfo = `
        <div style="background: linear-gradient(135deg, rgba(255, 107, 26, 0.15) 0%, rgba(255, 107, 26, 0.05) 100%); padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 8px; border-left: 4px solid var(--primary-color);">
            <div style="color: var(--primary-color); font-weight: 600; font-size: 1rem; margin-bottom: 0.75rem;">📧 Sending To:</div>
            <div style="color: var(--white); font-size: 0.95rem; margin-bottom: 0.3rem;"><strong>${contactName}</strong> at ${companyName}</div>
            <div style="color: var(--gray); font-size: 0.9rem;">${emailAddress}</div>
        </div>
    `;
    
    modal.innerHTML = `
        <div style="background: var(--card-dark); border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--primary-color); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); padding: 1.5rem; color: var(--white); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1;">
                <div>
                    <h3 style="margin: 0 0 0.3rem 0; font-size: 1.4rem;">📧 Email Preview</h3>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Review before sending</div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 1.2rem; font-weight: bold; transition: all 0.2s;">✕</button>
            </div>
            <div style="padding: 2rem;">
                ${recipientInfo}
                
                <div style="margin-bottom: 1.5rem;">
                    <div style="color: var(--gray); font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">Subject Line:</div>
                    <div style="color: var(--white); font-size: 1.1rem; font-weight: 600; padding: 0.75rem; background: rgba(255, 107, 26, 0.1); border-radius: 6px;">${processedSubject}</div>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <div style="color: var(--gray); font-size: 0.85rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px;">Email Template Preview:</div>
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.1);">
                        <iframe id="emailPreviewFrame_${modalId}" style="width: 100%; border: none; border-radius: 4px; display: block; background: white;"></iframe>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <button onclick="document.getElementById('${modalId}').remove()" style="background: var(--black); border: 2px solid rgba(255, 107, 26, 0.3); color: var(--gray); padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; transition: all 0.2s;">
                        ← Go Back
                    </button>
                    <button id="sendEmailBtn_${modalId}" onclick="confirmAndSendEmail('${modalId}')" style="background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); border: none; color: white; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px rgba(255, 107, 26, 0.4); transition: all 0.2s;">
                        📧 Send Email →
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load HTML email into iframe
    const iframe = document.getElementById(`emailPreviewFrame_${modalId}`);
    iframe.srcdoc = emailHTML;
    
    // Auto-resize iframe based on content
    iframe.onload = function() {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const height = iframeDoc.body.scrollHeight;
            iframe.style.height = height + 'px';
        } catch(e) {
            // Fallback height if cross-origin issues
            iframe.style.height = '600px';
        }
    };
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

// Confirm and send email from modal
window.confirmAndSendEmail = async function(modalId) {
    const sendBtn = document.getElementById(`sendEmailBtn_${modalId}`);
    const originalText = sendBtn.innerHTML;
    
    // Disable button and show loading
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
    
    // Get form values again
    const companyName = document.getElementById('companyName').value.trim();
    const contactName = document.getElementById('contactName').value.trim();
    const emailAddress = document.getElementById('emailAddress').value.trim();
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    
    // Validate all fields
    if (!companyName || !contactName || !emailAddress) {
        showToast('Please fill in all recipient information', 'error');
        return;
    }
    
    if (!subject || !body) {
        showToast('Please fill in subject and message', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        const response = await apiFetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emailType: 'marketing',
                to: emailAddress,
                subject: subject,
                body: body,
                recipientName: contactName,
                companyName: companyName,
                metadata: {
                    company: companyName,
                    contact: contactName
                }
            })
        });
        
        if (response.success) {
            // Close the modal
            document.getElementById(modalId).remove();
            
            showToast('Email sent successfully! ✅', 'success');
            
            // Reload email history for stats
            await loadEmailHistory();
            updateStats();
            renderOutbox();
            
            // Clear recipient form fields (ready for next email)
            document.getElementById('companyName').value = '';
            document.getElementById('contactName').value = '';
            document.getElementById('emailAddress').value = '';
            
            // Optionally scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(response.error || 'Failed to send email');
        }
    } catch (error) {
        console.error('Send email error:', error);
        showToast(error.message || 'Failed to send email', 'error');
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
};

// Update statistics
function updateStats() {
    const emailsSent = emailHistory.length;
    
    // Calculate this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = emailHistory.filter(e => {
        const sentDate = new Date(e.sent_at);
        return sentDate >= firstDayOfMonth;
    }).length;
    
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

// Render outbox with sent emails
function renderOutbox() {
    const outboxBody = document.getElementById('outboxBody');
    
    if (!emailHistory || emailHistory.length === 0) {
        outboxBody.innerHTML = `
            <div class="empty-outbox">
                <h3>No emails sent yet</h3>
                <p>Sent marketing emails will appear here</p>
            </div>
        `;
        return;
    }
    
    // Sort by most recent first
    const sortedEmails = [...emailHistory].sort((a, b) => {
        return new Date(b.sent_at) - new Date(a.sent_at);
    });
    
    const emailList = sortedEmails.map((email, index) => {
        const sentDate = new Date(email.sent_at);
        const formattedDate = sentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        
        // Get preview text (first 150 chars)
        const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : email.metadata;
        const bodyText = metadata?.body || email.subject || '';
        const preview = bodyText.substring(0, 150).replace(/</g, '&lt;').replace(/>/g, '&gt;') + (bodyText.length > 150 ? '...' : '');
        
        return `
            <div class="email-item" onclick="viewEmailDetail(${index})">
                <div class="email-item-header">
                    <div class="email-item-info">
                        <div class="email-recipient">${email.recipient_name || 'Unknown'}</div>
                        <div class="email-company">${metadata?.company || email.recipient_email || ''}</div>
                    </div>
                    <div class="email-date">${formattedDate}</div>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${preview}</div>
            </div>
        `;
    }).join('');
    
    outboxBody.innerHTML = `<div class="email-list">${emailList}</div>`;
    
    // Store sorted emails for detail view
    window.sortedEmailHistory = sortedEmails;
}

// View email detail in modal
function viewEmailDetail(index) {
    const email = window.sortedEmailHistory[index];
    if (!email) {
        console.error('Email not found at index:', index);
        return;
    }
    
    const modal = document.getElementById('emailModal');
    const modalBody = document.getElementById('emailModalBody');
    
    const sentDate = new Date(email.sent_at);
    const formattedDate = sentDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    
    const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : email.metadata;
    const bodyContent = metadata?.body || 'No content available';
    
    modalBody.innerHTML = `
        <div class="email-meta">
            <div class="email-meta-label">To:</div>
            <div class="email-meta-value">${email.recipient_name || 'Unknown'} &lt;${email.recipient_email || 'No email'}&gt;</div>
            
            <div class="email-meta-label">Company:</div>
            <div class="email-meta-value">${metadata?.company || 'N/A'}</div>
            
            <div class="email-meta-label">Subject:</div>
            <div class="email-meta-value">${email.subject || 'No subject'}</div>
            
            <div class="email-meta-label">Sent:</div>
            <div class="email-meta-value">${formattedDate}</div>
        </div>
        
        <div class="email-content">${bodyContent.replace(/\n/g, '<br>')}</div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close email detail modal
function closeEmailModal() {
    const modal = document.getElementById('emailModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Close modal on outside click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('emailModal');
    if (e.target === modal) {
        closeEmailModal();
    }
});
