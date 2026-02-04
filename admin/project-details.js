// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let currentProject = null;
let customerId = null;

// Load project details
async function loadProjectDetails() {
    // Get project ID and customer ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    customerId = urlParams.get('customer_id');
    
    if (!projectId) {
        alert('Project not found');
        window.history.back();
        return;
    }
    
    try {
        const response = await fetch(`/api/projects?project_id=${projectId}`);
        if (response.ok) {
            currentProject = await response.json();
            displayProject(currentProject);
        } else {
            alert('Failed to load project');
            window.history.back();
        }
    } catch (error) {
        console.error('Error loading project:', error);
        alert('Failed to load project');
        window.history.back();
    }
}

// Display project information
function displayProject(project) {
    // Project name and number
    document.getElementById('projectName').textContent = project.project_name;
    document.getElementById('projectNumber').textContent = `Project #${project.project_number}`;
    
    // Status badge
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = project.status;
    statusBadge.className = `status-badge status-${project.status}`;
    
    // Project info grid
    const infoHtml = `
        <div class="info-box">
            <div class="info-label">Customer</div>
            <div class="info-value">${project.customer_id}</div>
        </div>
        ${project.job_address ? `
            <div class="info-box">
                <div class="info-label">Job Address</div>
                <div class="info-value">${project.job_address}${project.job_city ? `, ${project.job_city}` : ''}${project.job_state ? `, ${project.job_state}` : ''}</div>
            </div>
        ` : ''}
        <div class="info-box">
            <div class="info-label">Total Estimate</div>
            <div class="info-value" style="color: var(--primary-color);">$${(project.total_estimate || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        </div>
        <div class="info-box">
            <div class="info-label">Total Billed</div>
            <div class="info-value" style="color: var(--green);">$${(project.total_billed || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        </div>
        ${project.start_date ? `
            <div class="info-box">
                <div class="info-label">Start Date</div>
                <div class="info-value">${new Date(project.start_date).toLocaleDateString()}</div>
            </div>
        ` : ''}
        ${project.estimated_completion ? `
            <div class="info-box">
                <div class="info-label">Estimated Completion</div>
                <div class="info-value">${new Date(project.estimated_completion).toLocaleDateString()}</div>
            </div>
        ` : ''}
        ${project.actual_completion ? `
            <div class="info-box">
                <div class="info-label">Actual Completion</div>
                <div class="info-value">${new Date(project.actual_completion).toLocaleDateString()}</div>
            </div>
        ` : ''}
    `;
    
    document.getElementById('projectInfo').innerHTML = infoHtml;
    
    // Description
    if (project.description) {
        document.getElementById('descriptionSection').style.display = 'block';
        document.getElementById('descriptionContent').textContent = project.description;
    }
    
    // Notes
    if (project.notes) {
        document.getElementById('notesSection').style.display = 'block';
        document.getElementById('notesContent').textContent = project.notes;
    }
    
    // Display files
    displayFiles(project.prints || [], 'prints');
    displayFiles(project.redlines || [], 'redlines');
}

// Display files
function displayFiles(files, type) {
    const gridId = type === 'prints' ? 'printsGrid' : 'redlinesGrid';
    const emptyId = type === 'prints' ? 'printsEmpty' : 'redlinesEmpty';
    
    const grid = document.getElementById(gridId);
    const empty = document.getElementById(emptyId);
    
    if (files.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    empty.style.display = 'none';
    
    grid.innerHTML = files.map((file, index) => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const icon = isPdf ? '📄' : '🖼️';
        
        return `
            <div class="file-card">
                <div class="file-icon">${icon}</div>
                <div class="file-name">${file.name}</div>
                <div class="file-actions">
                    <button class="file-action-btn" data-file-url="${file.url}" data-file-name="${file.name}" data-action="view">👁️ View</button>
                    <button class="file-action-btn" data-file-url="${file.url}" data-file-name="${file.name}" data-action="download">⬇️ Download</button>
                    <button class="file-action-btn" style="color: var(--red);" data-index="${index}" data-type="${type}" data-action="delete">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners to buttons
    setTimeout(() => {
        document.querySelectorAll('.file-action-btn').forEach(btn => {
            btn.addEventListener('click', handleFileAction);
        });
    }, 0);
}

// Handle file actions
function handleFileAction(e) {
    const button = e.currentTarget;
    const action = button.dataset.action;
    
    if (action === 'view') {
        e.preventDefault();
        viewFile(button.dataset.fileUrl, button.dataset.fileName);
    } else if (action === 'download') {
        e.preventDefault();
        downloadFile(button.dataset.fileUrl, button.dataset.fileName);
    } else if (action === 'delete') {
        e.preventDefault();
        deleteFile(parseInt(button.dataset.index), button.dataset.type);
    }
}

// View file
function viewFile(url, fileName) {
    if (!fileName) {
        fileName = url.split('/').pop();
    }
    
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);
    
    document.getElementById('fileViewerTitle').textContent = fileName;
    
    const content = document.getElementById('fileViewerContent');
    
    // Convert GitHub download URL to raw URL for proper viewing
    let viewUrl = url;
    if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        viewUrl = url.replace('github.com', 'raw.githubusercontent.com')
                     .replace('/blob/', '/');
    }
    
    if (isPdf) {
        content.innerHTML = `<iframe src="${viewUrl}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    } else if (isImage) {
        content.innerHTML = `<img src="${viewUrl}" alt="${fileName}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else {
        content.innerHTML = `<div style="color: white; text-align: center;"><p>Preview not available</p><a href="${url}" target="_blank" style="color: var(--primary-color);">Open in new tab</a></div>`;
    }
    
    document.getElementById('fileViewerModal').classList.add('active');
}

// Close file viewer
function closeFileViewer() {
    document.getElementById('fileViewerModal').classList.remove('active');
    document.getElementById('fileViewerContent').innerHTML = '';
}

// Download file
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

// Delete file
async function deleteFile(index, type) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    const files = type === 'prints' ? [...(currentProject.prints || [])] : [...(currentProject.redlines || [])];
    files.splice(index, 1);
    
    try {
        const updateData = type === 'prints' ? { prints: files } : { redlines: files };
        
        const response = await fetch(`/api/projects?project_id=${currentProject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            currentProject = await response.json();
            displayFiles(files, type);
        } else {
            alert('Failed to delete file');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file');
    }
}

// Upload prints
function uploadPrints() {
    document.getElementById('printsUpload').click();
}

// Upload redlines
function uploadRedlines() {
    document.getElementById('redlinesUpload').click();
}

// Handle file upload
async function handleFileUpload(event, type) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const filePromises = files.map(file => {
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
                project_id: currentProject.id,
                type: type
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Update project with new files
            const existingFiles = type === 'prints' ? (currentProject.prints || []) : (currentProject.redlines || []);
            const updateData = type === 'prints' 
                ? { prints: [...existingFiles, ...result.files] }
                : { redlines: [...existingFiles, ...result.files] };
            
            const updateResponse = await fetch(`/api/projects?project_id=${currentProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            if (updateResponse.ok) {
                currentProject = await updateResponse.json();
                displayFiles(type === 'prints' ? currentProject.prints : currentProject.redlines, type);
                alert('Files uploaded successfully!');
            }
        } else {
            alert('Failed to upload files');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Failed to upload files');
    }
    
    // Reset file input
    event.target.value = '';
}

// Edit project
function editProject() {
    window.location.href = `customer-details.html?id=${customerId}&edit_project=${currentProject.id}`;
}

// Create invoice for project
function createInvoice() {
    sessionStorage.setItem('invoiceProject', JSON.stringify({
        id: currentProject.id,
        project_number: currentProject.project_number,
        project_name: currentProject.project_name,
        job_address: currentProject.job_address,
        job_city: currentProject.job_city,
        job_state: currentProject.job_state
    }));
    
    window.location.href = 'create-invoice.html';
}

// Delete project
async function deleteProject() {
    if (!confirm(`Are you sure you want to delete project #${currentProject.project_number}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects?project_id=${currentProject.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Project deleted successfully');
            window.location.href = `customer-details.html?id=${customerId}`;
        } else {
            alert('Failed to delete project');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project');
    }
}

// Go back
function goBack() {
    if (customerId) {
        window.location.href = `customer-details.html?id=${customerId}`;
    } else {
        window.history.back();
    }
}

// Initialize on page load
loadProjectDetails();
