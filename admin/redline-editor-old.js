// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let canvas, ctx, imageCanvas, imageCtx;
let isDrawing = false;
let currentTool = 'select';
let currentColor = '#ff0000';
let currentWidth = 3;
let startX, startY;
let shapes = []; // Store all shapes as objects
let selectedShape = null;
let dragMode = null; // null, 'move', 'resize', 'rotate'
let dragStartX, dragStartY;
let resizeHandle = null; // 'tl', 'tr', 'bl', 'br', 'top', 'bottom', 'left', 'right'

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const useSessionStorage = urlParams.get('useSessionStorage') === 'true';
const imageUrl = useSessionStorage ? sessionStorage.getItem('redlineImage') : urlParams.get('image');
const projectId = urlParams.get('project_id');
const customerId = urlParams.get('customer_id');
const fileName = urlParams.get('filename');

// Initialize
function init() {
    if (!imageUrl) {
        alert('No image specified');
        window.history.back();
        return;
    }

    document.getElementById('fileName').textContent = decodeURIComponent(fileName || 'Redline Editor');
    
    imageCanvas = document.getElementById('imageCanvas');
    imageCtx = imageCanvas.getContext('2d');
    
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    
    // Load image
    loadImage(decodeURIComponent(imageUrl));
    
    // Setup event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch support
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Color picker
    document.getElementById('colorPicker').addEventListener('change', (e) => {
        currentColor = e.target.value;
    });
    
    // Stroke width
    document.getElementById('strokeWidth').addEventListener('change', (e) => {
        currentWidth = parseInt(e.target.value);
    });
}

// Load image
function loadImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Convert GitHub URL to raw if needed
    if (url.includes('github.com')) {
        if (url.includes('/blob/')) {
            url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        } else if (!url.includes('raw.githubusercontent.com')) {
            url = url.replace('github.com', 'raw.githubusercontent.com');
        }
    }
    
    img.src = url;
    
    img.onload = function() {
        // Set canvas size to image size
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image
        imageCtx.drawImage(img, 0, 0);
        
        // Position canvases
        imageCanvas.style.left = '0';
        imageCanvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.top = '0';
    };
    
    img.onerror = function() {
        alert('Failed to load image');
        window.history.back();
    };
}

// Select tool
function selectTool(tool) {
    currentTool = tool;
    
    // Update active button
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    
    // Update cursor
    if (tool === 'text') {
        canvas.style.cursor = 'text';
    } else if (tool === 'eraser') {
        canvas.style.cursor = 'not-allowed';
    } else {
        canvas.style.cursor = 'crosshair';
    }
}

// Get mouse position
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Handle touch events
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Start drawing
function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    
    if (currentTool === 'text') {
        addText(pos.x, pos.y);
        isDrawing = false;
    } else if (currentTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        currentDrawing = [{x: pos.x, y: pos.y, tool: 'pen', color: currentColor, width: currentWidth}];
    }
}

// Draw
function draw(e) {
    if (!isDrawing) return;
    
    const pos = getMousePos(e);
    
    if (currentTool === 'pen') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentWidth;
        ctx.lineCap = 'round';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        currentDrawing.push({x: pos.x, y: pos.y});
    } else if (currentTool === 'eraser') {
        ctx.clearRect(pos.x - currentWidth/2, pos.y - currentWidth/2, currentWidth, currentWidth);
    } else {
        // For shapes, clear and redraw
        redrawCanvas();
        drawShape(startX, startY, pos.x, pos.y);
    }
}

// Stop drawing
function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentTool !== 'pen' && currentTool !== 'eraser' && currentTool !== 'text') {
        const pos = getMousePos(e);
        const shape = {
            tool: currentTool,
            startX: startX,
            startY: startY,
            endX: pos.x,
            endY: pos.y,
            color: currentColor,
            width: currentWidth
        };
        drawingHistory.push(shape);
    } else if (currentTool === 'pen' && currentDrawing.length > 0) {
        drawingHistory.push(currentDrawing);
        currentDrawing = [];
    }
}

// Draw shape
function drawShape(x1, y1, x2, y2) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentWidth;
    
    switch(currentTool) {
        case 'line':
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
            
        case 'rectangle':
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            break;
            
        case 'circle':
            const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            ctx.beginPath();
            ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
            ctx.stroke();
            break;
    }
}

// Add text
function addText(x, y) {
    const text = prompt('Enter text:');
    if (text) {
        ctx.font = `${currentWidth * 8}px Arial`;
        ctx.fillStyle = currentColor;
        ctx.fillText(text, x, y);
        
        drawingHistory.push({
            tool: 'text',
            x: x,
            y: y,
            text: text,
            color: currentColor,
            size: currentWidth * 8
        });
    }
}

// Redraw canvas
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawingHistory.forEach(item => {
        if (Array.isArray(item)) {
            // Pen stroke
            if (item.length > 0) {
                ctx.strokeStyle = item[0].color;
                ctx.lineWidth = item[0].width;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(item[0].x, item[0].y);
                item.forEach(point => {
                    ctx.lineTo(point.x, point.y);
                });
                ctx.stroke();
            }
        } else if (item.tool === 'text') {
            ctx.font = `${item.size}px Arial`;
            ctx.fillStyle = item.color;
            ctx.fillText(item.text, item.x, item.y);
        } else {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            drawShape(item.startX, item.startY, item.endX, item.endY);
        }
    });
}

// Clear canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear all annotations?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawingHistory = [];
    }
}

// Undo last
function undoLast() {
    if (drawingHistory.length > 0) {
        drawingHistory.pop();
        redrawCanvas();
    }
}

// Save redline
async function saveRedline() {
    // Combine image and drawings
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = imageCanvas.width;
    finalCanvas.height = imageCanvas.height;
    const finalCtx = finalCanvas.getContext('2d');
    
    // Draw image
    finalCtx.drawImage(imageCanvas, 0, 0);
    
    // Draw annotations
    finalCtx.drawImage(canvas, 0, 0);
    
    // Convert to blob
    finalCanvas.toBlob(async (blob) => {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = async function() {
            const base64data = reader.result;
            
            try {
                // Upload redline
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: `redline_${Date.now()}_${fileName}`,
                        fileContent: base64data,
                        fileType: 'image/png',
                        project_id: projectId,
                        type: 'redlines'
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // Update project with new redline
                    const projectResponse = await fetch(`/api/projects?project_id=${projectId}`);
                    const project = await projectResponse.json();
                    const existingRedlines = project.redlines || [];
                    
                    await fetch(`/api/projects?project_id=${projectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            redlines: [...existingRedlines, result]
                        })
                    });
                    
                    alert('Redline saved successfully!');
                    window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
                } else {
                    alert('Failed to save redline');
                }
            } catch (error) {
                console.error('Error saving redline:', error);
                alert('Failed to save redline');
            }
        };
        reader.readAsDataURL(blob);
    }, 'image/png');
}

// Go back
function goBack() {
    if (confirm('Are you sure you want to go back? Unsaved changes will be lost.')) {
        window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
    }
}

// Initialize on load
init();
