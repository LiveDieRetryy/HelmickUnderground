// Company profiles management
let companyProfiles = [];
let currentEditingIndex = null;

// Load profiles from localStorage
function loadProfiles() {
    const saved = localStorage.getItem('companyProfiles');
    companyProfiles = saved ? JSON.parse(saved) : [];
    displayProfiles();
}

// Display all profiles
function displayProfiles() {
    const container = document.getElementById('profilesContainer');
    
    if (companyProfiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📁</div>
                <h3 style="color: var(--white); margin-bottom: 0.5rem;">No Company Profiles</h3>
                <p style="color: var(--gray);">Create your first company profile to manage line item codes</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = companyProfiles.map((profile, index) => `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-name">${profile.name}</div>
                <div class="profile-actions">
                    <button onclick="editProfile(${index})" class="btn-icon" title="Edit">
                        ✏️
                    </button>
                    <button onclick="deleteProfile(${index})" class="btn-icon delete" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>            ${profile.contactPerson || profile.phone || profile.email || profile.address ? `
                <div class="profile-info">
                    ${profile.contactPerson ? `<div class="profile-info-row"><span class="profile-info-label">Contact:</span> ${profile.contactPerson}</div>` : ''}
                    ${profile.phone ? `<div class="profile-info-row"><span class="profile-info-label">Phone:</span> ${profile.phone}</div>` : ''}
                    ${profile.email ? `<div class="profile-info-row"><span class="profile-info-label">Email:</span> ${profile.email}</div>` : ''}
                    ${profile.address ? `<div class="profile-info-row"><span class="profile-info-label">Address:</span> ${profile.address}</div>` : ''}
                    ${profile.city || profile.state || profile.zip ? `<div class="profile-info-row"><span class="profile-info-label"></span> ${[profile.city, profile.state, profile.zip].filter(Boolean).join(', ')}</div>` : ''}
                </div>
            ` : ''}            <div class="line-items-list">
                ${profile.lineItems && profile.lineItems.length > 0 ? 
                    profile.lineItems.map(item => `
                        <div class="line-item">
                            <div class="line-item-code">${item.code}</div>
                            <div class="line-item-description">${item.description}</div>
                            <div class="line-item-price">$${parseFloat(item.price).toFixed(2)}</div>
                        </div>
                    `).join('') :
                    '<div style="color: var(--gray); text-align: center; padding: 1rem;">No line items added yet</div>'
                }
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 107, 26, 0.15); color: var(--gray); font-size: 0.85rem;">
                ${profile.lineItems ? profile.lineItems.length : 0} line item${(profile.lineItems && profile.lineItems.length !== 1) ? 's' : ''}
            </div>
        </div>
    `).join('');
}

// Open modal to add new profile
function openAddProfileModal() {
    currentEditingIndex = null;
    document.getElementById('modalTitle').textContent = 'Add Company Profile';
    document.getElementById('companyName').value = '';
    document.getElementById('contactPerson').value = '';
    document.getElementById('companyPhone').value = '';
    document.getElementById('companyEmail').value = '';
    document.getElementById('companyAddress').value = '';
    document.getElementById('companyCity').value = '';
    document.getElementById('companyState').value = '';
    document.getElementById('companyZip').value = '';
    document.getElementById('lineItemsContainer').innerHTML = '';
    addLineItemRow(); // Start with one empty row
    document.getElementById('profileModal').style.display = 'block';
}

// Open modal to edit existing profile
function editProfile(index) {
    currentEditingIndex = index;
    const profile = companyProfiles[index];
    
    document.getElementById('modalTitle').textContent = 'Edit Company Profile';
    document.getElementById('companyName').value = profile.name;
    document.getElementById('contactPerson').value = profile.contactPerson || '';
    document.getElementById('companyPhone').value = profile.phone || '';
    document.getElementById('companyEmail').value = profile.email || '';
    document.getElementById('companyAddress').value = profile.address || '';
    document.getElementById('companyCity').value = profile.city || '';
    document.getElementById('companyState').value = profile.state || '';
    document.getElementById('companyZip').value = profile.zip || '';
    
    // Clear and populate line items
    const container = document.getElementById('lineItemsContainer');
    container.innerHTML = '';
    
    if (profile.lineItems && profile.lineItems.length > 0) {
        profile.lineItems.forEach(item => {
            addLineItemRow(item.code, item.description, item.price);
        });
    } else {
        addLineItemRow(); // Add one empty row if no items
    }
    
    document.getElementById('profileModal').style.display = 'block';
}

// Close profile modal
function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
    currentEditingIndex = null;
}

// Add a line item input row
function addLineItemRow(code = '', description = '', price = '') {
    const container = document.getElementById('lineItemsContainer');
    const rowId = `lineItem_${Date.now()}`;
    
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.id = rowId;
    row.innerHTML = `
        <div class="form-group" style="margin: 0;">
            <label>Code</label>
            <input type="text" class="item-code" placeholder="e.g. EXC-001" value="${code}">
        </div>
        <div class="form-group" style="margin: 0;">
            <label>Description</label>
            <input type="text" class="item-description" placeholder="e.g. Excavation per hour" value="${description}">
        </div>
        <div class="form-group" style="margin: 0;">
            <label>Price</label>
            <input type="number" class="item-price" placeholder="0.00" step="0.01" min="0" value="${price}">
        </div>
        <button onclick="removeLineItemRow('${rowId}')" class="btn-icon delete" title="Remove">
            ✕
        </button>
    `;
    
    container.appendChild(row);
}

// Remove a line item row
function removeLineItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }
}

// Save profile
function saveProfile() {
    const companyName = document.getElementById('companyName').value.trim();
    
    if (!companyName) {
        alert('Please enter a company name');
        return;
    }
    
    // Collect all line items
    const lineItemRows = document.querySelectorAll('.line-item-row');
    const lineItems = [];
    
    lineItemRows.forEach(row => {
        const code = row.querySelector('.item-code').value.trim();
        const description = row.querySelector('.item-description').value.trim();
        const price = row.querySelector('.item-price').value.trim();
        
        // Only add if all fields are filled
        if (code && description && price) {
            lineItems.push({
                code,
                description,
                price: parseFloat(price)
            });
        }
    });
    
    if (lineItems.length === 0) {
        if (!confirm('No line items added. Save profile anyway?')) {
            return;
        }
    }
    
    const profileData = {
        name: companyName,
        contactPerson: document.getElementById('contactPerson').value.trim(),
        phone: document.getElementById('companyPhone').value.trim(),
        email: document.getElementById('companyEmail').value.trim(),
        address: document.getElementById('companyAddress').value.trim(),
        city: document.getElementById('companyCity').value.trim(),
        state: document.getElementById('companyState').value.trim().toUpperCase(),
        zip: document.getElementById('companyZip').value.trim(),
        lineItems,
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditingIndex !== null) {
        // Update existing profile
        companyProfiles[currentEditingIndex] = profileData;
    } else {
        // Add new profile
        profileData.createdAt = new Date().toISOString();
        companyProfiles.push(profileData);
    }
    
    // Save to localStorage
    localStorage.setItem('companyProfiles', JSON.stringify(companyProfiles));
    
    // Close modal and refresh display
    closeProfileModal();
    displayProfiles();
    
    alert(`Profile "${companyName}" saved successfully!`);
}

// Delete profile
function deleteProfile(index) {
    const profile = companyProfiles[index];
    
    if (!confirm(`Are you sure you want to delete the profile "${profile.name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    companyProfiles.splice(index, 1);
    localStorage.setItem('companyProfiles', JSON.stringify(companyProfiles));
    displayProfiles();
}

// Initialize on page load
loadProfiles();
