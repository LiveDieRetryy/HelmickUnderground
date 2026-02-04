// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let customers = [];
let currentCustomerIndex = null;

// Load customer details
function loadCustomerDetails() {
    // Get customer ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');
    
    if (customerId === null) {
        window.location.href = 'customers.html';
        return;
    }
    
    currentCustomerIndex = parseInt(customerId);
    
    // Load customers from localStorage
    const saved = localStorage.getItem('customers');
    customers = saved ? JSON.parse(saved) : [];
    
    if (currentCustomerIndex < 0 || currentCustomerIndex >= customers.length) {
        alert('Customer not found');
        window.location.href = 'customers.html';
        return;
    }
    
    const customer = customers[currentCustomerIndex];
    displayCustomer(customer);
}

// Display customer information
function displayCustomer(customer) {
    // Customer name and type
    document.getElementById('customerName').textContent = customer.name;
    
    const typeBadge = document.getElementById('customerTypeBadge');
    typeBadge.textContent = customer.type;
    
    const typeColors = {
        'Residential': '#3b82f6',
        'Commercial': '#10b981',
        'Municipal': '#f59e0b',
        'Industrial': '#8b5cf6',
        'Agricultural': '#22c55e',
        'Other': '#6b7280'
    };
    
    const typeColor = typeColors[customer.type] || '#ff6b1a';
    typeBadge.style.background = `${typeColor}33`;
    typeBadge.style.color = typeColor;
    typeBadge.style.border = `2px solid ${typeColor}`;
    
    // Contact information
    let contactHtml = '';
    
    if (customer.contactPerson) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Contact Person</div>
                <div class="info-value">${customer.contactPerson}</div>
            </div>
        `;
    }
    
    contactHtml += `
        <div class="info-box">
            <div class="info-label">Phone</div>
            <div class="info-value"><a href="tel:${customer.phone}">${customer.phone}</a></div>
        </div>
    `;
    
    if (customer.email) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Email</div>
                <div class="info-value"><a href="mailto:${customer.email}">${customer.email}</a></div>
            </div>
        `;
    }
    
    if (customer.preferredContact) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Preferred Contact</div>
                <div class="info-value" style="text-transform: capitalize;">${customer.preferredContact}</div>
            </div>
        `;
    }
    
    if (customer.address || customer.city || customer.state || customer.zip) {
        const addressParts = [customer.address, customer.city, customer.state, customer.zip].filter(Boolean);
        contactHtml += `
            <div class="info-box" style="grid-column: 1 / -1;">
                <div class="info-label">Address</div>
                <div class="info-value">${addressParts.join(', ')}</div>
            </div>
        `;
    }
    
    document.getElementById('contactInfo').innerHTML = contactHtml;
    
    // Stats section
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${customer.totalJobs || 0}</div>
            <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${customer.lastJob || 'Never'}</div>
            <div class="stat-label">Last Job</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${customer.customLineItems ? customer.customLineItems.length : 0}</div>
            <div class="stat-label">Custom Rates</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${new Date(customer.created || Date.now()).toLocaleDateString()}</div>
            <div class="stat-label">Customer Since</div>
        </div>
    `;
    
    document.getElementById('statsSection').innerHTML = statsHtml;
    
    // Notes section
    if (customer.notes) {
        document.getElementById('notesSection').style.display = 'block';
        document.getElementById('notesContent').textContent = customer.notes;
    }
    
    // Custom line items section
    if (customer.customLineItems && customer.customLineItems.length > 0) {
        document.getElementById('lineItemsSection').style.display = 'block';
        
        const lineItemsHtml = customer.customLineItems.map(item => `
            <tr>
                <td style="color: var(--white); font-weight: 500;">${item.description}</td>
                <td style="color: var(--primary-color); font-weight: 700;">$${item.rate.toFixed(2)}</td>
            </tr>
        `).join('');
        
        document.getElementById('lineItemsTable').innerHTML = lineItemsHtml;
    }
}

// Edit customer
function editCustomer() {
    window.location.href = `customers.html?edit=${currentCustomerIndex}`;
}

// Create invoice for customer
function createInvoice() {
    const customer = customers[currentCustomerIndex];
    
    // Store customer data in sessionStorage
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        contactPerson: customer.contactPerson,
        customLineItems: customer.customLineItems || []
    }));
    
    // Redirect to invoice page
    window.location.href = 'create-invoice.html';
}

// Delete customer
function deleteCustomer() {
    const customer = customers[currentCustomerIndex];
    
    if (confirm(`Are you sure you want to delete ${customer.name}?\n\nThis will permanently remove this customer from your database.`)) {
        customers.splice(currentCustomerIndex, 1);
        localStorage.setItem('customers', JSON.stringify(customers));
        
        alert('Customer deleted successfully');
        window.location.href = 'customers.html';
    }
}

// Initialize on page load
loadCustomerDetails();

// Projects Management
let projects = [];
let currentFilter = 'all';
let selectedFiles = [];

// Load projects for customer
async function loadProjects() {
    const customer = customers[currentCustomerIndex];
    const customerId = customer.email; // Using email as unique ID
    
    try {
        const response = await fetch(`/api/projects?customer_id=${encodeURIComponent(customerId)}`);
        if (response.ok) {
            projects = await response.json();
            displayProjects();
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Display projects with filtering
function displayProjects() {
    const filteredProjects = currentFilter === 'all' 
        ? projects 
        : projects.filter(p => p.status === currentFilter);
    
    const projectsGrid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('projectsEmptyState');
    
    if (filteredProjects.length === 0) {
        projectsGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    projectsGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    projectsGrid.innerHTML = filteredProjects.map(project => {
        const prints = project.prints || [];
        const redlines = project.redlines || [];
        const totalBilled = project.total_billed || 0;
        const totalEstimate = project.total_estimate || 0;
        
        return `
            <div class="project-card" onclick="viewProject(${project.id})">
                <div class="project-card-header">
                    <span class="project-number">#${project.project_number}</span>
                    <span class="project-status-badge status-${project.status}">${project.status}</span>
                </div>
                <div class="project-name">${project.project_name}</div>
                ${project.job_address ? `
                    <div class="project-address">
                        📍 ${project.job_address}${project.job_city ? `, ${project.job_city}` : ''}${project.job_state ? `, ${project.job_state}` : ''}
                    </div>
                ` : ''}
                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-label">Estimate</span>
                        <span class="project-meta-value">$${totalEstimate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Billed</span>
                        <span class="project-meta-value">$${totalBilled.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Prints</span>
                        <span class="project-meta-value">📄 ${prints.length}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Redlines</span>
                        <span class="project-meta-value">✏️ ${redlines.length}</span>
                    </div>
                </div>
                <div class="project-actions" onclick="event.stopPropagation()">
                    <button class="project-action-btn" onclick="editProject(${project.id})">✏️ Edit</button>
                    <button class="project-action-btn" onclick="createInvoiceForProject(${project.id})">📄 Invoice</button>
                    <button class="project-action-btn" onclick="deleteProject(${project.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filter projects by status
function filterProjects(status) {
    currentFilter = status;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });
    
    displayProjects();
}

// Open create project modal
function openCreateProjectModal() {
    document.getElementById('projectModalTitle').textContent = 'Create New Project';
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    selectedFiles = [];
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('projectModal').classList.add('active');
}

// Close project modal
function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('active');
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [...selectedFiles, ...files];
    displaySelectedFiles();
}

// Display selected files
function displaySelectedFiles() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-item-name">${file.name}</span>
            <button type="button" class="file-item-remove" onclick="removeFile(${index})">×</button>
        </div>
    `).join('');
}

// Remove file from selection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
}

// Save project
async function saveProject(event) {
    event.preventDefault();
    
    const customer = customers[currentCustomerIndex];
    const projectId = document.getElementById('projectId').value;
    
    const projectData = {
        project_number: document.getElementById('projectNumber').value,
        customer_id: customer.email,
        project_name: document.getElementById('projectName').value,
        job_address: document.getElementById('projectJobAddress').value,
        job_city: document.getElementById('projectJobCity').value,
        job_state: document.getElementById('projectJobState').value,
        description: document.getElementById('projectDescription').value,
        status: document.getElementById('projectStatus').value,
        start_date: document.getElementById('projectStartDate').value || null,
        estimated_completion: document.getElementById('projectEstimatedCompletion').value || null,
        total_estimate: parseFloat(document.getElementById('projectEstimate').value) || 0,
        notes: document.getElementById('projectNotes').value
    };
    
    try {
        let response;
        if (projectId) {
            // Update existing project
            response = await fetch(`/api/projects?project_id=${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
        } else {
            // Create new project
            response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
        }
        
        if (response.ok) {
            const savedProject = await response.json();
            
            // Handle file uploads if any
            if (selectedFiles.length > 0) {
                await uploadProjectFiles(savedProject.id);
            }
            
            alert(projectId ? 'Project updated successfully!' : 'Project created successfully!');
            closeProjectModal();
            loadProjects();
        } else {
            // Try to parse error as JSON, fallback to text
            let errorMessage = 'Failed to save project';
            try {
                const error = await response.json();
                errorMessage = error.error || error.message || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
            }
            console.error('Server error:', errorMessage);
            alert(`Error: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Error saving project:', error);
        alert(`Failed to save project: ${error.message}`);
    }
}

// Upload project files
async function uploadProjectFiles(projectId) {
    if (selectedFiles.length === 0) return;
    
    const filePromises = selectedFiles.map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    fileName: file.name,
                    fileContent: e.target.result,
                    fileType: file.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    });
    
    try {
        const filesData = await Promise.all(filePromises);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: filesData,
                project_id: projectId,
                type: 'prints'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            // Update project with file URLs
            const currentProject = projects.find(p => p.id === projectId);
            const existingPrints = currentProject?.prints || [];
            
            await fetch(`/api/projects?project_id=${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prints: [...existingPrints, ...result.files]
                })
            });
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Some files failed to upload');
    }
}

// Edit project
async function editProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectNumber').value = project.project_number;
    document.getElementById('projectName').value = project.project_name;
    document.getElementById('projectJobAddress').value = project.job_address || '';
    document.getElementById('projectJobCity').value = project.job_city || '';
    document.getElementById('projectJobState').value = project.job_state || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('projectEstimate').value = project.total_estimate || '';
    document.getElementById('projectStartDate').value = project.start_date || '';
    document.getElementById('projectEstimatedCompletion').value = project.estimated_completion || '';
    document.getElementById('projectNotes').value = project.notes || '';
    
    selectedFiles = [];
    document.getElementById('fileList').innerHTML = '';
    
    document.getElementById('projectModal').classList.add('active');
}

// View project details
async function viewProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const prints = project.prints || [];
    const redlines = project.redlines || [];
    
    const content = `
        <div style="padding: 1rem 0;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="info-box">
                    <div class="info-label">Project Number</div>
                    <div class="info-value" style="color: var(--primary-color);">#${project.project_number}</div>
                </div>
                <div class="info-box">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <span class="project-status-badge status-${project.status}">${project.status}</span>
                    </div>
                </div>
                <div class="info-box">
                    <div class="info-label">Total Estimate</div>
                    <div class="info-value">$${(project.total_estimate || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="info-box">
                    <div class="info-label">Total Billed</div>
                    <div class="info-value">$${(project.total_billed || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
            
            ${project.job_address ? `
                <div class="info-box" style="margin-bottom: 1.5rem;">
                    <div class="info-label">Job Address</div>
                    <div class="info-value">${project.job_address}${project.job_city ? `, ${project.job_city}` : ''}${project.job_state ? `, ${project.job_state}` : ''}</div>
                </div>
            ` : ''}
            
            ${project.description ? `
                <div class="info-box" style="margin-bottom: 1.5rem;">
                    <div class="info-label">Description</div>
                    <div class="info-value" style="font-weight: 400;">${project.description}</div>
                </div>
            ` : ''}
            
            ${project.notes ? `
                <div class="info-box" style="margin-bottom: 1.5rem;">
                    <div class="info-label">Notes</div>
                    <div class="info-value" style="font-weight: 400;">${project.notes}</div>
                </div>
            ` : ''}
            
            ${prints.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem;">📄 Prints/Blueprints</h3>
                    <div class="file-list">
                        ${prints.map(file => `
                            <div class="file-item">
                                <span class="file-item-name">${file.name}</span>
                                <a href="${file.url}" target="_blank" style="color: var(--primary-color); text-decoration: none;">View</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${redlines.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem;">✏️ Redlines</h3>
                    <div class="file-list">
                        ${redlines.map(file => `
                            <div class="file-item">
                                <span class="file-item-name">${file.name}</span>
                                <a href="${file.url}" target="_blank" style="color: var(--primary-color); text-decoration: none;">View</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button class="btn btn-primary" onclick="editProject(${project.id}); closeViewProjectModal();" style="flex: 1;">✏️ Edit Project</button>
                <button class="btn btn-secondary" onclick="createInvoiceForProject(${project.id}); closeViewProjectModal();" style="flex: 1;">📄 Create Invoice</button>
            </div>
        </div>
    `;
    
    document.getElementById('viewProjectTitle').textContent = project.project_name;
    document.getElementById('viewProjectContent').innerHTML = content;
    document.getElementById('viewProjectModal').classList.add('active');
}

// Close view project modal
function closeViewProjectModal() {
    document.getElementById('viewProjectModal').classList.remove('active');
}

// Create invoice for project
function createInvoiceForProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    const customer = customers[currentCustomerIndex];
    
    if (!project) return;
    
    // Store project and customer data in sessionStorage
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        contactPerson: customer.contactPerson,
        customLineItems: customer.customLineItems || []
    }));
    
    sessionStorage.setItem('invoiceProject', JSON.stringify({
        id: project.id,
        project_number: project.project_number,
        project_name: project.project_name,
        job_address: project.job_address,
        job_city: project.job_city,
        job_state: project.job_state
    }));
    
    window.location.href = 'create-invoice.html';
}

// Delete project
async function deleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (!confirm(`Are you sure you want to delete project #${project.project_number}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects?project_id=${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Project deleted successfully');
            loadProjects();
        } else {
            alert('Failed to delete project');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project');
    }
}

// Load projects when page loads
setTimeout(() => {
    loadProjects();
}, 500);
