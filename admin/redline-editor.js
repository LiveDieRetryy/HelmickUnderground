// Check auth
if (!sessionStorage.getItem('adminLoggedIn') && !localStorage.getItem('auth_token')) {
    window.location.href = '/admin/index.html';
}

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Trigger reflow to restart animation
    void toast.offsetWidth;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

let canvas, ctx, imageCanvas, imageCtx;
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#ff0000';
let currentWidth = 3;
let startX, startY;
let drawingHistory = [];
let currentDrawing = [];
let selectedShape = null;
let dragMode = null; // null, 'move', 'resize-tl', 'resize-tr', 'resize-bl', 'resize-br', 'rotate'
let dragStartX, dragStartY;
let originalShape = null;

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const useSessionStorage = urlParams.get('useSessionStorage') === 'true';
const imageUrl = useSessionStorage ? sessionStorage.getItem('redlineImage') : urlParams.get('image');
const projectId = urlParams.get('project_id');
const customerId = urlParams.get('customer_id');
const editMode = urlParams.get('edit_mode') === 'true';
const originalUrl = urlParams.get('original_url');
const fileName = urlParams.get('filename');

// Initialize
function init() {
    console.log('Init called');
    console.log('Image URL:', imageUrl);
    console.log('Project ID:', projectId);
    console.log('Customer ID:', customerId);
    console.log('File Name:', fileName);
    
    if (!imageUrl) {
        showToast('No image specified', 'error');
        setTimeout(() => window.history.back(), 1500);
        return;
    }

    document.getElementById('fileName').textContent = decodeURIComponent(fileName || 'Redline Editor');
    
    imageCanvas = document.getElementById('imageCanvas');
    imageCtx = imageCanvas.getContext('2d');
    
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    
    console.log('Canvas elements:', imageCanvas, canvas);
    
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
    
    // Double-click to edit text
    canvas.addEventListener('dblclick', handleDoubleClick);
    
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
    
    console.log('Loading image:', url);
    
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
        console.log('Image loaded successfully:', img.width, 'x', img.height);
        // Set canvas size to image size
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image
        imageCtx.drawImage(img, 0, 0);
        console.log('Image drawn to canvas');
    };
    
    img.onerror = function(error) {
        console.error('Failed to load image:', error, url);
        showToast('Failed to load image', 'error');
        setTimeout(() => window.history.back(), 1500);
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
    
    // Calculate scale between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert screen coordinates to canvas coordinates
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// Handle touch events
let lastTouchDistance = 0;
let isPinching = false;
let canvasScale = 1;
let canvasPanX = 0;
let canvasPanY = 0;

function handleTouch(e) {
    e.preventDefault();
    
    // Multi-touch gestures (pinch-to-zoom, pan)
    if (e.touches.length === 2) {
        isPinching = true;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // Calculate distance for pinch-to-zoom
        const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        if (e.type === 'touchmove' && lastTouchDistance > 0) {
            const scale = distance / lastTouchDistance;
            canvasScale *= scale;
            canvasScale = Math.max(0.5, Math.min(canvasScale, 3)); // Limit zoom 0.5x - 3x
            
            // Apply transform
            const wrapper = document.querySelector('.canvas-wrapper');
            wrapper.style.transform = `scale(${canvasScale}) translate(${canvasPanX}px, ${canvasPanY}px)`;
        }
        
        lastTouchDistance = distance;
        return;
    }
    
    // Reset pinch state
    if (e.type === 'touchstart') {
        isPinching = false;
        lastTouchDistance = 0;
    }
    
    // Single touch - drawing
    if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(
            e.type === 'touchstart' ? 'mousedown' : 
            e.type === 'touchmove' ? 'mousemove' : 'mouseup',
            {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            }
        );
        canvas.dispatchEvent(mouseEvent);
    }
}

// Start drawing
function startDrawing(e) {
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    
    if (currentTool === 'text') {
        // Don't create new text if already editing
        if (isTextInputActive) return;
        
        // Check if clicking on existing text (will be handled by double-click)
        const clickedShape = getShapeAt(pos.x, pos.y);
        if (clickedShape && clickedShape.tool === 'text') {
            return; // Don't create new text, wait for potential double-click
        }
        
        addText(pos.x, pos.y);
        return;
    }
    
    if (currentTool === 'select') {
        // Check if clicking on a handle
        if (selectedShape) {
            const handle = getHandleAt(pos.x, pos.y);
            if (handle) {
                dragMode = handle;
                dragStartX = pos.x;
                dragStartY = pos.y;
                originalShape = JSON.parse(JSON.stringify(selectedShape));
                return;
            }
        }
        
        // Check if clicking on a shape
        const clickedShape = getShapeAt(pos.x, pos.y);
        if (clickedShape) {
            selectedShape = clickedShape;
            dragMode = 'move';
            dragStartX = pos.x;
            dragStartY = pos.y;
            originalShape = JSON.parse(JSON.stringify(selectedShape));
            redrawCanvas();
        } else {
            selectedShape = null;
            redrawCanvas();
        }
        return;
    }
    
    isDrawing = true;
    
    if (currentTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        currentDrawing = [{x: pos.x, y: pos.y, tool: 'pen', color: currentColor, width: currentWidth}];
    }
}

// Draw
function draw(e) {
    const pos = getMousePos(e);
    
    if (currentTool === 'select' && dragMode) {
        const dx = pos.x - dragStartX;
        const dy = pos.y - dragStartY;
        
        if (dragMode === 'move') {
            selectedShape.startX = originalShape.startX + dx;
            selectedShape.startY = originalShape.startY + dy;
            if (selectedShape.endX !== undefined) {
                selectedShape.endX = originalShape.endX + dx;
                selectedShape.endY = originalShape.endY + dy;
            }
            // Update text position if it's a text element
            if (selectedShape.tool === 'text') {
                selectedShape.x = originalShape.x + dx;
                selectedShape.y = originalShape.y + dy;
            }
        } else if (dragMode.startsWith('resize-')) {
            // Handle resize based on corner
            if (dragMode === 'resize-tl') {
                selectedShape.startX = originalShape.startX + dx;
                selectedShape.startY = originalShape.startY + dy;
            } else if (dragMode === 'resize-tr') {
                selectedShape.endX = originalShape.endX + dx;
                selectedShape.startY = originalShape.startY + dy;
            } else if (dragMode === 'resize-bl') {
                selectedShape.startX = originalShape.startX + dx;
                selectedShape.endY = originalShape.endY + dy;
            } else if (dragMode === 'resize-br') {
                selectedShape.endX = originalShape.endX + dx;
                selectedShape.endY = originalShape.endY + dy;
            }
        } else if (dragMode === 'rotate') {
            // Calculate rotation angle
            const centerX = (selectedShape.startX + selectedShape.endX) / 2;
            const centerY = (selectedShape.startY + selectedShape.endY) / 2;
            const angle = Math.atan2(pos.y - centerY, pos.x - centerX);
            selectedShape.rotation = angle;
        }
        
        redrawCanvas();
        return;
    }
    
    if (!isDrawing) return;
    
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
    if (currentTool === 'select' && dragMode) {
        dragMode = null;
        return;
    }
    
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
            width: currentWidth,
            rotation: 0
        };
        drawingHistory.push(shape);
    } else if (currentTool === 'pen' && currentDrawing.length > 0) {
        drawingHistory.push(currentDrawing);
        currentDrawing = [];
    }
}

// Draw shape
function drawShape(x1, y1, x2, y2, tool, color, width) {
    // Use provided parameters or fall back to current settings
    const shapeType = tool || currentTool;
    ctx.strokeStyle = color || currentColor;
    ctx.lineWidth = width || currentWidth;
    
    switch(shapeType) {
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

// Handle double-click to edit text
function handleDoubleClick(e) {
    const pos = getMousePos(e);
    const shape = getShapeAt(pos.x, pos.y);
    
    if (shape && shape.tool === 'text') {
        editText(shape, pos.x, pos.y);
    }
}

// Add text with inline input
let pendingTextPosition = null;
let textInputElement = null;
let isTextInputActive = false;
let editingTextShape = null;

function addText(x, y) {
    console.log('addText called at:', x, y);
    pendingTextPosition = {x, y};
    
    textInputElement = document.getElementById('inlineTextInput');
    console.log('Text input element:', textInputElement);
    
    if (!textInputElement) {
        console.error('Text input element not found!');
        return;
    }
    
    // Prevent immediate blur
    isTextInputActive = true;
    
    // Get the canvas position to calculate absolute position
    const canvasRect = canvas.getBoundingClientRect();
    const displayScaleX = canvasRect.width / canvas.width;
    const displayScaleY = canvasRect.height / canvas.height;
    
    // Position the input at the clicked location
    const inputX = canvasRect.left + (x * displayScaleX);
    const inputY = canvasRect.top + (y * displayScaleY);
    
    console.log('Positioning input at:', inputX, inputY);
    
    textInputElement.style.left = inputX + 'px';
    textInputElement.style.top = inputY + 'px';
    textInputElement.style.fontSize = (currentWidth * 8 * displayScaleY) + 'px';
    textInputElement.style.display = 'block';
    textInputElement.value = '';
    
    // Focus after a small delay to prevent immediate blur
    setTimeout(() => {
        textInputElement.focus();
        
        // Handle Enter key and blur
        const handleComplete = () => {
            if (!isTextInputActive) return;
            
            console.log('handleComplete called');
            const text = textInputElement.value.trim();
            if (text && pendingTextPosition) {
                ctx.font = `${currentWidth * 8}px Arial`;
                ctx.fillStyle = currentColor;
                ctx.fillText(text, pendingTextPosition.x, pendingTextPosition.y);
                
                // Measure text for bounding box
                const metrics = ctx.measureText(text);
                const textWidth = metrics.width;
                const textHeight = currentWidth * 8;
                
                drawingHistory.push({
                    tool: 'text',
                    x: pendingTextPosition.x,
                    y: pendingTextPosition.y,
                    text: text,
                    color: currentColor,
                    size: currentWidth * 8,
                    // Add bounding box properties for manipulation
                    startX: pendingTextPosition.x,
                    startY: pendingTextPosition.y - textHeight,
                    endX: pendingTextPosition.x + textWidth,
                    endY: pendingTextPosition.y,
                    rotation: 0
                });
                console.log('Text added to history');
            }
            textInputElement.style.display = 'none';
            textInputElement.value = '';
            pendingTextPosition = null;
            isTextInputActive = false;
            textInputElement.removeEventListener('blur', handleComplete);
            textInputElement.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleComplete();
            } else if (e.key === 'Escape') {
                textInputElement.style.display = 'none';
                textInputElement.value = '';
                pendingTextPosition = null;
                isTextInputActive = false;
                textInputElement.removeEventListener('blur', handleComplete);
                textInputElement.removeEventListener('keydown', handleKeydown);
            }
        };
        
        textInputElement.addEventListener('blur', handleComplete);
        textInputElement.addEventListener('keydown', handleKeydown);
    }, 100);
}

// Edit existing text
function editText(shape, clickX, clickY) {
    if (isTextInputActive) return;
    
    editingTextShape = shape;
    pendingTextPosition = {x: shape.x, y: shape.y};
    
    textInputElement = document.getElementById('inlineTextInput');
    if (!textInputElement) return;
    
    isTextInputActive = true;
    
    const canvasRect = canvas.getBoundingClientRect();
    const displayScaleX = canvasRect.width / canvas.width;
    const displayScaleY = canvasRect.height / canvas.height;
    
    const inputX = canvasRect.left + (shape.x * displayScaleX);
    const inputY = canvasRect.top + (shape.y * displayScaleY);
    
    textInputElement.style.left = inputX + 'px';
    textInputElement.style.top = inputY + 'px';
    textInputElement.style.fontSize = (shape.size * displayScaleY) + 'px';
    textInputElement.style.display = 'block';
    textInputElement.value = shape.text;
    
    setTimeout(() => {
        textInputElement.focus();
        textInputElement.select();
        
        const handleComplete = () => {
            if (!isTextInputActive) return;
            
            const newText = textInputElement.value.trim();
            if (newText && editingTextShape) {
                // Update the existing text
                editingTextShape.text = newText;
                
                // Recalculate bounding box
                ctx.font = `${editingTextShape.size}px Arial`;
                const metrics = ctx.measureText(newText);
                const textWidth = metrics.width;
                const textHeight = editingTextShape.size;
                
                editingTextShape.startX = editingTextShape.x;
                editingTextShape.startY = editingTextShape.y - textHeight;
                editingTextShape.endX = editingTextShape.x + textWidth;
                editingTextShape.endY = editingTextShape.y;
                
                redrawCanvas();
            }
            
            textInputElement.style.display = 'none';
            textInputElement.value = '';
            pendingTextPosition = null;
            editingTextShape = null;
            isTextInputActive = false;
            textInputElement.removeEventListener('blur', handleComplete);
            textInputElement.removeEventListener('keydown', handleKeydown);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleComplete();
            } else if (e.key === 'Escape') {
                textInputElement.style.display = 'none';
                textInputElement.value = '';
                pendingTextPosition = null;
                editingTextShape = null;
                isTextInputActive = false;
                textInputElement.removeEventListener('blur', handleComplete);
                textInputElement.removeEventListener('keydown', handleKeydown);
                redrawCanvas();
            }
        };
        
        textInputElement.addEventListener('blur', handleComplete);
        textInputElement.addEventListener('keydown', handleKeydown);
    }, 100);
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
            ctx.save();
            ctx.fillStyle = item.color;
            ctx.font = `${item.size}px Arial`;
            
            // Apply rotation if present
            if (item.rotation) {
                const centerX = (item.startX + item.endX) / 2;
                const centerY = (item.startY + item.endY) / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate(item.rotation);
                ctx.translate(-centerX, -centerY);
            }
            
            // Check if text was resized and scale accordingly
            if (item.startX && item.endX) {
                const metrics = ctx.measureText(item.text);
                const originalWidth = metrics.width;
                const originalHeight = item.size;
                const currentWidth = item.endX - item.startX;
                const currentHeight = item.endY - item.startY;
                const scaleX = currentWidth / originalWidth;
                const scaleY = currentHeight / originalHeight;
                
                if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                    ctx.translate(item.x, item.y);
                    ctx.scale(scaleX, scaleY);
                    ctx.translate(-item.x, -item.y);
                    ctx.fillText(item.text, item.x, item.y);
                } else {
                    ctx.fillText(item.text, item.x, item.y);
                }
            } else {
                ctx.fillText(item.text, item.x, item.y);
            }
            
            ctx.restore();
        } else {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            
            if (item.rotation) {
                ctx.save();
                const centerX = (item.startX + item.endX) / 2;
                const centerY = (item.startY + item.endY) / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate(item.rotation);
                ctx.translate(-centerX, -centerY);
            }
            
            drawShape(item.startX, item.startY, item.endX, item.endY, item.tool, item.color, item.width);
            
            if (item.rotation) {
                ctx.restore();
            }
        }
    });
    
    // Draw selection handles if shape is selected
    if (selectedShape) {
        drawSelectionHandles();
    }
}

// Get shape at position
function getShapeAt(x, y) {
    for (let i = drawingHistory.length - 1; i >= 0; i--) {
        const item = drawingHistory[i];
        if (Array.isArray(item)) continue;
        
        if (item.tool === 'text') {
            // Save current context state
            ctx.save();
            ctx.font = `${item.size}px Arial`;
            const metrics = ctx.measureText(item.text);
            ctx.restore();
            
            // Create a bounding box around the text
            const textWidth = metrics.width;
            const textHeight = item.size;
            const padding = 5;
            
            if (x >= item.x - padding && 
                x <= item.x + textWidth + padding && 
                y >= item.y - textHeight - padding && 
                y <= item.y + padding) {
                return item;
            }
        } else if (item.tool === 'line') {
            const dist = distanceToLine(x, y, item.startX, item.startY, item.endX, item.endY);
            if (dist < 10) return item;
        } else if (item.tool === 'rectangle') {
            const minX = Math.min(item.startX, item.endX);
            const maxX = Math.max(item.startX, item.endX);
            const minY = Math.min(item.startY, item.endY);
            const maxY = Math.max(item.startY, item.endY);
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                return item;
            }
        } else if (item.tool === 'circle') {
            const radius = Math.sqrt(Math.pow(item.endX - item.startX, 2) + Math.pow(item.endY - item.startY, 2));
            const dist = Math.sqrt(Math.pow(x - item.startX, 2) + Math.pow(y - item.startY, 2));
            if (dist <= radius) return item;
        }
    }
    return null;
}

// Distance from point to line segment
function distanceToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Draw selection handles
function drawSelectionHandles() {
    if (!selectedShape) return;
    
    const handleSize = 8;
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    if (selectedShape.tool === 'line') {
        // Draw handles at endpoints
        [
            {x: selectedShape.startX, y: selectedShape.startY},
            {x: selectedShape.endX, y: selectedShape.endY}
        ].forEach(point => {
            ctx.fillRect(point.x - handleSize/2, point.y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(point.x - handleSize/2, point.y - handleSize/2, handleSize, handleSize);
        });
    } else {
        // Draw handles at corners
        const corners = [
            {x: selectedShape.startX, y: selectedShape.startY, type: 'resize-tl'},
            {x: selectedShape.endX, y: selectedShape.startY, type: 'resize-tr'},
            {x: selectedShape.startX, y: selectedShape.endY, type: 'resize-bl'},
            {x: selectedShape.endX, y: selectedShape.endY, type: 'resize-br'}
        ];
        
        corners.forEach(corner => {
            ctx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
        });
        
        // Draw rotation handle
        const centerX = (selectedShape.startX + selectedShape.endX) / 2;
        const centerY = selectedShape.startY - 30;
        ctx.beginPath();
        ctx.arc(centerX, centerY, handleSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
}

// Get handle at position
function getHandleAt(x, y) {
    if (!selectedShape) return null;
    
    const handleSize = 8;
    const tolerance = handleSize;
    
    if (selectedShape.tool === 'line') {
        if (Math.abs(x - selectedShape.startX) < tolerance && Math.abs(y - selectedShape.startY) < tolerance) {
            return 'resize-tl';
        }
        if (Math.abs(x - selectedShape.endX) < tolerance && Math.abs(y - selectedShape.endY) < tolerance) {
            return 'resize-br';
        }
    } else {
        const corners = [
            {x: selectedShape.startX, y: selectedShape.startY, type: 'resize-tl'},
            {x: selectedShape.endX, y: selectedShape.startY, type: 'resize-tr'},
            {x: selectedShape.startX, y: selectedShape.endY, type: 'resize-bl'},
            {x: selectedShape.endX, y: selectedShape.endY, type: 'resize-br'}
        ];
        
        for (const corner of corners) {
            if (Math.abs(x - corner.x) < tolerance && Math.abs(y - corner.y) < tolerance) {
                return corner.type;
            }
        }
        
        // Check rotation handle
        const centerX = (selectedShape.startX + selectedShape.endX) / 2;
        const centerY = selectedShape.startY - 30;
        if (Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) < tolerance) {
            return 'rotate';
        }
    }
    
    return null;
}

// Clear canvas
function clearCanvas() {
    if (confirm('Are you sure you want to clear all annotations?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawingHistory = [];
    }
}

// Undo last
function undo() {
    if (drawingHistory.length > 0) {
        drawingHistory.pop();
        redrawCanvas();
    }
}

// Alias for compatibility
const undoLast = undo;

// Save redline
let pendingSaveBlob = null;

async function saveRedline() {
    // Show save as modal
    const defaultName = editMode ? (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'redline') : 'redline';
    document.getElementById('saveAsFilename').value = defaultName;
    document.getElementById('saveAsModal').classList.add('active');
    
    // Focus the input
    setTimeout(() => {
        document.getElementById('saveAsFilename').focus();
        document.getElementById('saveAsFilename').select();
    }, 100);
}

// Close save as modal
function closeSaveAsModal() {
    document.getElementById('saveAsModal').classList.remove('active');
    pendingSaveBlob = null;
}

// Confirm save from modal
async function confirmSave(event) {
    event.preventDefault();
    
    const customFileName = document.getElementById('saveAsFilename').value.trim();
    
    if (!customFileName) {
        showToast('Please enter a filename', 'error');
        return;
    }
    
    // Add .png extension if not present
    const finalFileName = customFileName.endsWith('.png') ? customFileName : `${customFileName}.png`;
    
    // Close modal
    closeSaveAsModal();
    
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
                        fileName: finalFileName,
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
                    let existingRedlines = project.redlines || [];
                    
                    // If editing, replace the existing redline; otherwise add new one
                    if (editMode && originalUrl) {
                        const index = existingRedlines.findIndex(r => r.url === originalUrl);
                        if (index !== -1) {
                            existingRedlines[index] = result;
                        } else {
                            existingRedlines.push(result);
                        }
                    } else {
                        existingRedlines.push(result);
                    }
                    
                    await fetch(`/api/projects?project_id=${projectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            redlines: existingRedlines
                        })
                    });
                    
                    showToast('Redline saved successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
                    }, 1000);
                } else {
                    showToast('Failed to save redline', 'error');
                }
            } catch (error) {
                console.error('Error saving redline:', error);
                showToast('Failed to save redline', 'error');
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

// Expose functions to window for onclick handlers
window.selectTool = selectTool;
window.clearCanvas = clearCanvas;
window.undo = undo;
window.undoLast = undo;
window.saveRedline = saveRedline;
window.confirmSave = confirmSave;
window.closeSaveAsModal = closeSaveAsModal;
window.goBack = goBack;

// Initialize on load
window.addEventListener('DOMContentLoaded', function() {
    init();
});
