// Admin credentials (case sensitive)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'HUAdmin';

// Check if user is logged in
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (isLoggedIn) {
        showDashboard();
    }
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        showDashboard();
    } else {
        errorDiv.textContent = 'Invalid username or password. Please try again.';
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    sessionStorage.removeItem('adminLoggedIn');
    location.reload();
});

// Show dashboard
function showDashboard() {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadGalleryItems();
    setupDragAndDrop();
}

// Drag and drop functionality
function setupDragAndDrop() {
    const imageDropZone = document.getElementById('imageDropZone');
    const videoDropZone = document.getElementById('videoDropZone');
    const imageInput = document.getElementById('itemImageFile');
    const videoInput = document.getElementById('itemVideoFile');
    const imageFileName = document.getElementById('imageFileName');
    const videoFileName = document.getElementById('videoFileName');

    // Setup image drop zone
    if (imageDropZone && imageInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, () => {
                imageDropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, () => {
                imageDropZone.classList.remove('drag-over');
            }, false);
        });

        imageDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                imageInput.files = files;
                imageFileName.textContent = `✓ ${files[0].name}`;
                imageFileName.style.display = 'block';
            }
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                imageFileName.textContent = `✓ ${e.target.files[0].name}`;
                imageFileName.style.display = 'block';
            } else {
                imageFileName.style.display = 'none';
            }
        });
    }

    // Setup video drop zone
    if (videoDropZone && videoInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, () => {
                videoDropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, () => {
                videoDropZone.classList.remove('drag-over');
            }, false);
        });

        videoDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                videoInput.files = files;
                videoFileName.textContent = `✓ ${files[0].name}`;
                videoFileName.style.display = 'block';
            }
        });

        videoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                videoFileName.textContent = `✓ ${e.target.files[0].name}`;
                videoFileName.style.display = 'block';
            } else {
                videoFileName.style.display = 'none';
            }
        });
    }
}

// Type selector
const typeBtns = document.querySelectorAll('.type-btn');
const imageUploadGroup = document.getElementById('imageUploadGroup');
const videoUploadGroup = document.getElementById('videoUploadGroup');
const itemImageFile = document.getElementById('itemImageFile');
const itemVideoFile = document.getElementById('itemVideoFile');

typeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        typeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const type = this.dataset.type;
        
        // Hide all
        imageUploadGroup.style.display = 'none';
        videoUploadGroup.style.display = 'none';
        
        // Reset required
        itemImageFile.required = false;
        itemVideoFile.required = false;
        
        // Show appropriate input
        if (type === 'image') {
            imageUploadGroup.style.display = 'block';
            itemImageFile.required = true;
        } else if (type === 'video') {
            videoUploadGroup.style.display = 'block';
            itemVideoFile.required = true;
        }
    });
});

// Drag and drop functionality
function setupDropZone(dropZoneId, fileInputId, fileNameDisplayId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    const fileNameDisplay = document.getElementById(fileNameDisplayId);
    
    if (!dropZone || !fileInput) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            displayFileName(files[0], fileNameDisplay);
        }
    }, false);
    
    // Handle file selection via click
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            displayFileName(e.target.files[0], fileNameDisplay);
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function displayFileName(file, displayElement) {
    if (displayElement) {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        displayElement.textContent = `✓ ${file.name} (${sizeInMB}MB)`;
        displayElement.style.display = 'block';
    }
}

// Initialize drop zones
setupDropZone('imageDropZone', 'itemImageFile', 'imageFileName');
setupDropZone('videoDropZone', 'itemVideoFile', 'videoFileName');

// Add item form handler
document.getElementById('addItemForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const type = document.querySelector('.type-btn.active').dataset.type;
    const title = document.getElementById('itemTitle').value;
    const description = document.getElementById('itemDescription').value;
    const date = document.getElementById('itemDate').value;
    
    const newItem = {
        id: Date.now(),
        title: title,
        description: description,
        date: date || null
    };
    
    try {
        // Handle different types
        if (type === 'image') {
            const file = document.getElementById('itemImageFile').files[0];
            if (!file) {
                alert('Please select an image');
                return;
            }
            
            // Check size
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be under 5MB');
                return;
            }
            
            showSuccess('⏳ Uploading image...');
            const uploadedPath = await uploadFile(file);
            newItem.type = 'image';
            newItem.image = uploadedPath;
            newItem.fileSize = file.size;
            
        } else if (type === 'video') {
            const videoFile = document.getElementById('itemVideoFile').files[0];
            
            if (!videoFile) {
                alert('Please select a video file');
                return;
            }
            
            // Direct upload to Cloudinary - supports up to 100MB!
            const MAX_SIZE = 100 * 1024 * 1024; // 100MB limit
            
            if (videoFile.size > MAX_SIZE) {
                alert('Video must be under 100MB');
                return;
            }
            
            showSuccess('⏳ Uploading video to Cloudinary...');
            
            try {
                const uploadedUrl = await uploadFile(videoFile);
                newItem.type = 'video';
                newItem.videoFile = uploadedUrl;
                newItem.fileSize = videoFile.size;
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                hideProgress();
                alert('Upload failed: ' + uploadError.message);
                return;
            }
        }
        
        // Add to gallery data
        await addGalleryItem(newItem);
        
        // Reset form
        this.reset();
        typeBtns[0].click(); // Reset to image type
        
        // Reload items list
        loadGalleryItems();
        
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Error adding item: ' + error.message);
    }
});

// Upload file to Cloudinary (videos) or GitHub (images)
async function uploadFile(file) {
    const isVideo = file.type.startsWith('video/');
    
    if (isVideo) {
        // Upload to Cloudinary
        return uploadToCloudinary(file);
    } else {
        // Upload images to GitHub as before
        return uploadToGitHub(file);
    }
}

// Upload to Cloudinary
async function uploadToCloudinary(file) {
    const cloudName = 'dbt9vsoji';
    const uploadPreset = 'HelmickUnderground';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'videos');
    
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Cloudinary upload failed');
        }
        
        const data = await response.json();
        return data.secure_url; // Returns full URL to video
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Upload to GitHub (for images)
async function uploadToGitHub(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileContent: e.target.result,
                        fileType: file.type
                    })
                });
                
                if (!response.ok) {
                    // Try to parse as JSON, but handle plain text errors
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const error = await response.json();
                        throw new Error(error.error || 'Upload failed');
                    } else {
                        const text = await response.text();
                        throw new Error(`Upload failed (${response.status}): ${text.substring(0, 100)}`);
                    }
                }
                
                const result = await response.json();
                resolve(result.path);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Compress video to fit within target size
async function compressVideo(file, targetSizeBytes) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        
        video.onerror = (e) => {
            console.error('Video load error:', e);
            reject(new Error('Failed to load video file'));
        };
        
        video.onloadedmetadata = async function() {
            try {
                console.log(`Original video: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
                
                // Create canvas with reduced resolution
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate scale to reduce to 720p max
                const maxWidth = 1280;
                const maxHeight = 720;
                let scale = 1;
                
                if (video.videoWidth > maxWidth || video.videoHeight > maxHeight) {
                    scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight);
                }
                
                canvas.width = Math.floor(video.videoWidth * scale);
                canvas.height = Math.floor(video.videoHeight * scale);
                
                console.log(`Compressed size: ${canvas.width}x${canvas.height}`);
                
                // Calculate target bitrate - aim for 2.5MB to leave room for base64 overhead
                const durationSeconds = video.duration;
                const targetSizeMB = 2.5; // Target 2.5MB raw (becomes ~3.3MB base64)
                const targetBitrate = Math.floor((targetSizeMB * 8 * 1024 * 1024) / durationSeconds * 0.7); // Use 70% for safety
                const videoBitrate = Math.min(600000, Math.max(150000, targetBitrate)); // Between 150kbps and 600kbps
                
                console.log(`Target bitrate: ${videoBitrate} bps`);
                
                // Check if MediaRecorder is supported
                if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    reject(new Error('Video compression not supported in this browser'));
                    return;
                }
                
                const stream = canvas.captureStream(25); // 25 fps
                const chunks = [];
                
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'video/webm;codecs=vp8',
                    videoBitsPerSecond: videoBitrate
                });
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    console.log(`Compressed video size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);
                    
                    if (blob.size > targetSizeBytes * 1.1) {
                        reject(new Error(`Compressed size (${(blob.size / (1024 * 1024)).toFixed(2)}MB) still too large. Try a shorter video.`));
                    } else {
                        const compressedFile = new File([blob], 
                            file.name.replace(/\.[^/.]+$/, '.webm'), 
                            { type: 'video/webm' }
                        );
                        resolve(compressedFile);
                    }
                };
                
                mediaRecorder.onerror = (e) => {
                    console.error('MediaRecorder error:', e);
                    reject(new Error('Compression failed'));
                };
                
                // Start recording
                mediaRecorder.start(100); // Collect data every 100ms
                
                // Show progress bar
                showProgress(0);
                
                // Play and draw video frames
                await video.play();
                
                let frameCount = 0;
                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frameCount++;
                        
                        // Update progress based on video time
                        const progress = (video.currentTime / video.duration) * 100;
                        showProgress(Math.min(progress, 99));
                        
                        requestAnimationFrame(drawFrame);
                    }
                };
                
                video.addEventListener('ended', () => {
                    console.log(`Processed ${frameCount} frames`);
                    showProgress(100);
                    setTimeout(() => {
                        mediaRecorder.stop();
                        hideProgress();
                    }, 500);
                });
                
                drawFrame();
                
            } catch (err) {
                console.error('Compression error:', err);
                reject(err);
            }
        };
        
        // Load video
        video.src = URL.createObjectURL(file);
        video.load();
    });
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Load gallery items
async function loadGalleryItems() {
    try {
        const response = await fetch('/api/gallery');
        const data = await response.json();
        const container = document.getElementById('galleryItemsList');
        
        // Store items globally for edit modal
        galleryItems = data.items || [];
        
        if (!data.items || data.items.length === 0) {
            container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 2rem;">No gallery items yet. Add your first item above!</p>';
            return;
        }
        
        container.innerHTML = data.items.map((item, index) => `
            <div class="gallery-item-row" data-id="${item.id}" draggable="true">
                <div class="drag-handle">
                    <button class="order-btn" onclick="moveItem(${item.id}, -1)" ${index === 0 ? 'disabled' : ''} title="Move up">▲</button>
                    <div class="drag-icon">⋮⋮</div>
                    <button class="order-btn" onclick="moveItem(${item.id}, 1)" ${index === data.items.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
                </div>
                ${item.type === 'image' 
                    ? `<img src="${item.image}" alt="${item.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23333\' width=\'100\' height=\'100\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23666\' font-family=\'Arial\' font-size=\'12\'%3ENo Image%3C/text%3E%3C/svg%3E'">`
                    : `<div class="video-thumb">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                       </div>`
                }
                <div class="item-info">
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                    ${item.date ? `<p><strong>Date:</strong> ${item.date}</p>` : ''}
                    <p><strong>Type:</strong> ${item.type === 'image' ? '📷 Image' : '🎥 Video'}${item.fileSize ? ` • ${formatFileSize(item.fileSize)}` : ' <span style="color: var(--gray); font-size: 0.85em;">(size: unknown - uploaded before tracking)</span>'}</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-small btn-edit" onclick="openEditModal(${item.id})">Edit</button>
                    <button class="btn btn-small btn-delete" onclick="deleteItem(${item.id})">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Setup drag and drop
        setupDragAndDropReorder();
    } catch (error) {
        console.error('Error loading gallery items:', error);
    }
}

// Setup drag and drop reordering
function setupDragAndDropReorder() {
    const rows = document.querySelectorAll('.gallery-item-row');
    
    rows.forEach(row => {
        row.addEventListener('dragstart', handleDragStart);
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('drop', handleDrop);
        row.addEventListener('dragenter', handleDragEnter);
        row.addEventListener('dragleave', handleDragLeave);
        row.addEventListener('dragend', handleDragEnd);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const draggedId = parseInt(draggedElement.dataset.id);
        const targetId = parseInt(this.dataset.id);
        
        const draggedIndex = galleryItems.findIndex(item => item.id === draggedId);
        const targetIndex = galleryItems.findIndex(item => item.id === targetId);
        
        // Reorder the items array
        const [removed] = galleryItems.splice(draggedIndex, 1);
        galleryItems.splice(targetIndex, 0, removed);
        
        // Save the new order
        saveOrder();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.gallery-item-row').forEach(row => {
        row.classList.remove('drag-over');
    });
}

// Move item up or down
async function moveItem(id, direction) {
    const index = galleryItems.findIndex(item => item.id === id);
    const newIndex = index + direction;
    
    if (newIndex < 0 || newIndex >= galleryItems.length) return;
    
    // Swap items
    [galleryItems[index], galleryItems[newIndex]] = [galleryItems[newIndex], galleryItems[index]];
    
    // Save the new order
    await saveOrder();
}

// Save the new order to the API
async function saveOrder() {
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'reorder',
                items: galleryItems
            })
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Server error: ${text}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            loadGalleryItems();
        } else {
            alert('Failed to reorder items: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error reordering items:', error);
        alert('Error reordering items: ' + error.message);
    }
}

// Add gallery item
async function addGalleryItem(item) {
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'add',
                item: item
            })
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to add item';
            
            // Try to parse JSON error, fallback to text
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } else {
                const errorText = await response.text();
                if (errorText.includes('Request Entity Too Large') || response.status === 413) {
                    errorMessage = 'File too large for upload. The compressed video is still over the 10MB limit. Please try:\n1. A shorter video clip\n2. Lower quality source video\n3. Use TikTok embed instead';
                } else {
                    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                }
            }
            
            if (errorMessage.includes('GitHub token not configured')) {
                alert('⚠️ SETUP REQUIRED:\n\nThe gallery admin needs a GitHub token to work.\n\nPlease follow these steps:\n\n1. Read GITHUB_TOKEN_SETUP.txt in your project folder\n2. Create a GitHub Personal Access Token\n3. Add it to Vercel environment variables\n4. Redeploy\n\nThis is a one-time setup that takes 5 minutes.');
                return;
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        showSuccess('✅ Item added successfully! It\'s now live for everyone to see!');
    } catch (error) {
        console.error('Error adding item:', error);
        throw error; // Re-throw so the calling function can handle it
    }
}

// Delete item
async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'delete',
                item: { id: id }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete item');
        }
        
        showSuccess('✅ Item deleted successfully!');
        loadGalleryItems();
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item. Please try again.');
    }
}

// Download JSON file
function downloadJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gallery-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('✅ SUCCESS! File downloaded to your Downloads folder.\n\n📁 NEXT STEPS:\n1. Move gallery-data.json to: C:\\Users\\Admin\\HelmickUnderground\n2. Replace the existing file\n3. Run: git add . && git commit -m "Update gallery" && git push\n4. Wait 30 seconds and check your gallery!');
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showProgress(percent) {
    const container = document.getElementById('progressContainer');
    const bar = document.getElementById('progressBar');
    const percentText = document.getElementById('progressPercent');
    
    container.classList.add('active');
    bar.style.width = percent + '%';
    percentText.textContent = Math.round(percent) + '%';
}

function hideProgress() {
    const container = document.getElementById('progressContainer');
    container.classList.remove('active');
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
}

// Edit item functions
let galleryItems = [];

function openEditModal(id) {
    const item = galleryItems.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemTitle').value = item.title;
    document.getElementById('editItemDescription').value = item.description;
    document.getElementById('editItemDate').value = item.date || '';
    
    document.getElementById('editModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('editItemForm').reset();
}

// Handle edit form submission
document.getElementById('editItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = parseInt(document.getElementById('editItemId').value);
    const title = document.getElementById('editItemTitle').value;
    const description = document.getElementById('editItemDescription').value;
    const date = document.getElementById('editItemDate').value;
    
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'edit',
                item: {
                    id: id,
                    title: title,
                    description: description,
                    date: date
                }
            })
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Server error: ${text}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Item updated successfully!');
            closeEditModal();
            loadGalleryItems();
        } else {
            alert('Failed to update item: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating item:', error);
        alert('Error updating item: ' + error.message);
    }
});

// Close modal when clicking outside
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('editModal').classList.contains('active')) {
        closeEditModal();
    }
});

// Make functions available globally
window.deleteItem = deleteItem;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.moveItem = moveItem;

// Check auth on page load
checkAuth();
