// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

// State management
const state = {
    canvas: null,
    ctx: null,
    imageCanvas: null,
    imageCtx: null,
    container: null,
    
    // Drawing state
    isDrawing: false,
    currentTool: 'select',
    currentColor: '#ff0000',
    currentWidth: 3,
    shapes: [],
    
    // Selection state
    selectedShape: null,
    dragMode: null,
    dragStart: null,
    shapeBackup: null,
    
    // View state
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: null,
    
    // URL params
    imageUrl: null,
    projectId: null,
    customerId: null,
    fileName: null
};

// Initialize
function init() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const useSessionStorage = urlParams.get('useSessionStorage') === 'true';
    state.imageUrl = useSessionStorage ? sessionStorage.getItem('redlineImage') : urlParams.get('image');
    state.projectId = urlParams.get('project_id');
    state.customerId = urlParams.get('customer_id');
    state.fileName = urlParams.get('filename');
    
    if (!state.imageUrl) {
        alert('No image specified');
        window.history.back();
        return;
    }
    
    document.getElementById('fileName').textContent = decodeURIComponent(state.fileName || 'Redline Editor');
    
    // Get canvas elements
    state.container = document.getElementById('canvasContainer');
    state.imageCanvas = document.getElementById('imageCanvas');
    state.imageCtx = state.imageCanvas.getContext('2d');
    state.canvas = document.getElementById('drawingCanvas');
    state.ctx = state.canvas.getContext('2d');
    
    // Load image
    loadImage();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup controls
    setupControls();
}

// Load image
function loadImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    let loadUrl = state.imageUrl;
    if (!loadUrl.startsWith('data:') && loadUrl.includes('github.com') && loadUrl.includes('/blob/')) {
        loadUrl = loadUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    
    img.onload = function() {
        state.imageCanvas.width = img.width;
        state.imageCanvas.height = img.height;
        state.canvas.width = img.width;
        state.canvas.height = img.height;
        state.imageCtx.drawImage(img, 0, 0);
        render();
    };
    
    img.onerror = function() {
        alert('Failed to load image');
    };
    
    img.src = loadUrl;
}

// Setup event listeners
function setupEventListeners() {
    // Mouse events
    state.canvas.addEventListener('mousedown', handleMouseDown);
    state.canvas.addEventListener('mousemove', handleMouseMove);
    state.canvas.addEventListener('mouseup', handleMouseUp);
    state.canvas.addEventListener('mouseleave', handleMouseUp);
    state.canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    // Touch events
    state.canvas.addEventListener('touchstart', handleTouchStart);
    state.canvas.addEventListener('touchmove', handleTouchMove);
    state.canvas.addEventListener('touchend', handleTouchEnd);
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
}

// Setup controls
function setupControls() {
    document.getElementById('colorPicker').addEventListener('change', (e) => {
        state.currentColor = e.target.value;
        if (state.selectedShape) {
            state.selectedShape.color = state.currentColor;
            render();
        }
    });
    
    document.getElementById('strokeWidth').addEventListener('change', (e) => {
        state.currentWidth = parseInt(e.target.value);
        if (state.selectedShape && state.selectedShape.strokeWidth !== undefined) {
            state.selectedShape.strokeWidth = state.currentWidth;
            render();
        }
    });
}

// Get mouse position in canvas coordinates
function getCanvasPos(clientX, clientY) {
    const rect = state.container.getBoundingClientRect();
    
    // Get position relative to container
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;
    
    // Transform to canvas coordinates (accounting for zoom and pan)
    const canvasX = (containerX - state.panX) / state.zoom;
    const canvasY = (containerY - state.panY) / state.zoom;
    
    return { x: canvasX, y: canvasY };
}

// Handle mouse down
function handleMouseDown(e) {
    const pos = getCanvasPos(e.clientX, e.clientY);
    
    // Pan with middle mouse or ctrl+click
    if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
        state.isPanning = true;
        state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
        state.canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }
    
    if (state.currentTool === 'select') {
        handleSelectMouseDown(pos);
    } else if (state.currentTool === 'text') {
        handleTextClick(pos);
    } else if (state.currentTool === 'eraser') {
        handleEraserClick(pos);
    } else {
        state.isDrawing = true;
        state.dragStart = pos;
        
        if (state.currentTool === 'pen') {
            state.shapes.push({
                type: 'pen',
                points: [pos],
                color: state.currentColor,
                strokeWidth: state.currentWidth
            });
        }
    }
}

// Handle mouse move
function handleMouseMove(e) {
    const pos = getCanvasPos(e.clientX, e.clientY);
    
    // Handle panning
    if (state.isPanning) {
        state.panX = e.clientX - state.panStart.x;
        state.panY = e.clientY - state.panStart.y;
        applyViewTransform();
        return;
    }
    
    // Handle selection drag
    if (state.currentTool === 'select' && state.dragMode) {
        handleSelectDrag(pos);
        return;
    }
    
    // Handle drawing
    if (state.isDrawing) {
        if (state.currentTool === 'pen') {
            state.shapes[state.shapes.length - 1].points.push(pos);
            render();
        } else {
            // Show preview
            renderPreview(pos);
        }
    } else if (state.currentTool === 'select') {
        // Update cursor based on hover
        updateCursor(pos);
    }
}

// Handle mouse up
function handleMouseUp(e) {
    if (state.isPanning) {
        state.isPanning = false;
        state.canvas.style.cursor = state.currentTool === 'select' ? 'default' : 'crosshair';
        return;
    }
    
    if (state.isDrawing && state.currentTool !== 'pen') {
        const pos = getCanvasPos(e.clientX, e.clientY);
        finishShape(pos);
    }
    
    state.isDrawing = false;
    state.dragMode = null;
    state.shapeBackup = null;
}

// Handle wheel for zoom
function handleWheel(e) {
    e.preventDefault();
    
    const rect = state.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get canvas position before zoom
    const canvasX = (mouseX - state.panX) / state.zoom;
    const canvasY = (mouseY - state.panY) / state.zoom;
    
    // Apply zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(0.1, Math.min(5, state.zoom * delta));
    
    // Adjust pan to keep mouse position steady
    state.panX = mouseX - canvasX * state.zoom;
    state.panY = mouseY - canvasY * state.zoom;
    
    applyViewTransform();
}

// Touch event handlers
function handleTouchStart(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0, preventDefault: () => e.preventDefault() });
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

// Keyboard handler
function handleKeyDown(e) {
    if (e.key === 'Delete' && state.selectedShape) {
        deleteSelected();
    } else if (e.key === 'Escape') {
        state.selectedShape = null;
        render();
    }
}

// Select tool handlers
function handleSelectMouseDown(pos) {
    // Check for handle click
    if (state.selectedShape) {
        const handle = getHandleAt(pos);
        if (handle) {
            state.dragMode = handle;
            state.dragStart = pos;
            state.shapeBackup = JSON.parse(JSON.stringify(state.selectedShape));
            return;
        }
    }
    
    // Check for shape click
    const shape = getShapeAt(pos);
    if (shape) {
        state.selectedShape = shape;
        state.dragMode = 'move';
        state.dragStart = pos;
        state.shapeBackup = JSON.parse(JSON.stringify(shape));
    } else {
        state.selectedShape = null;
    }
    render();
}

function handleSelectDrag(pos) {
    if (!state.selectedShape || !state.shapeBackup) return;
    
    const dx = pos.x - state.dragStart.x;
    const dy = pos.y - state.dragStart.y;
    
    if (state.dragMode === 'move') {
        moveShape(state.selectedShape, state.shapeBackup, dx, dy);
    } else if (state.dragMode.startsWith('resize-')) {
        resizeShape(state.selectedShape, state.shapeBackup, pos, state.dragMode);
    }
    
    render();
}

// Move shape
function moveShape(shape, backup, dx, dy) {
    if (shape.type === 'pen') {
        shape.points = backup.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (shape.type === 'line') {
        shape.x1 = backup.x1 + dx;
        shape.y1 = backup.y1 + dy;
        shape.x2 = backup.x2 + dx;
        shape.y2 = backup.y2 + dy;
    } else if (shape.type === 'rectangle' || shape.type === 'circle') {
        shape.x = backup.x + dx;
        shape.y = backup.y + dy;
    } else if (shape.type === 'text') {
        shape.x = backup.x + dx;
        shape.y = backup.y + dy;
    }
}

// Resize shape
function resizeShape(shape, backup, pos, handle) {
    if (shape.type === 'rectangle') {
        const dx = pos.x - state.dragStart.x;
        const dy = pos.y - state.dragStart.y;
        
        if (handle === 'resize-tl') {
            shape.x = backup.x + dx;
            shape.y = backup.y + dy;
            shape.width = backup.width - dx;
            shape.height = backup.height - dy;
        } else if (handle === 'resize-tr') {
            shape.y = backup.y + dy;
            shape.width = backup.width + dx;
            shape.height = backup.height - dy;
        } else if (handle === 'resize-bl') {
            shape.x = backup.x + dx;
            shape.width = backup.width - dx;
            shape.height = backup.height + dy;
        } else if (handle === 'resize-br') {
            shape.width = backup.width + dx;
            shape.height = backup.height + dy;
        }
        
        shape.width = Math.max(10, shape.width);
        shape.height = Math.max(10, shape.height);
    } else if (shape.type === 'circle') {
        const dist = Math.sqrt(Math.pow(pos.x - shape.x, 2) + Math.pow(pos.y - shape.y, 2));
        shape.radius = Math.max(10, dist);
    } else if (shape.type === 'line') {
        if (handle === 'resize-start') {
            shape.x1 = pos.x;
            shape.y1 = pos.y;
        } else if (handle === 'resize-end') {
            shape.x2 = pos.x;
            shape.y2 = pos.y;
        }
    }
}

// Get shape at position
function getShapeAt(pos) {
    for (let i = state.shapes.length - 1; i >= 0; i--) {
        const shape = state.shapes[i];
        if (isPointInShape(pos, shape)) {
            return shape;
        }
    }
    return null;
}

// Check if point is in shape
function isPointInShape(pos, shape) {
    if (shape.type === 'pen') {
        for (let point of shape.points) {
            if (Math.abs(pos.x - point.x) < 10 && Math.abs(pos.y - point.y) < 10) {
                return true;
            }
        }
    } else if (shape.type === 'line') {
        const dist = distToSegment(pos, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
        return dist < shape.strokeWidth + 5;
    } else if (shape.type === 'rectangle') {
        return pos.x >= shape.x && pos.x <= shape.x + shape.width &&
               pos.y >= shape.y && pos.y <= shape.y + shape.height;
    } else if (shape.type === 'circle') {
        const dist = Math.sqrt(Math.pow(pos.x - shape.x, 2) + Math.pow(pos.y - shape.y, 2));
        return dist <= shape.radius;
    } else if (shape.type === 'text') {
        state.ctx.font = `${shape.fontSize}px Arial`;
        const metrics = state.ctx.measureText(shape.text);
        return pos.x >= shape.x && pos.x <= shape.x + metrics.width &&
               pos.y >= shape.y - shape.fontSize && pos.y <= shape.y;
    }
    return false;
}

// Distance from point to line segment
function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(
        Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) +
        Math.pow(p.y - (v.y + t * (w.y - v.y)), 2)
    );
}

// Get handle at position
function getHandleAt(pos) {
    if (!state.selectedShape) return null;
    
    const handleSize = 10;
    const shape = state.selectedShape;
    
    if (shape.type === 'rectangle') {
        const handles = {
            'resize-tl': { x: shape.x, y: shape.y },
            'resize-tr': { x: shape.x + shape.width, y: shape.y },
            'resize-bl': { x: shape.x, y: shape.y + shape.height },
            'resize-br': { x: shape.x + shape.width, y: shape.y + shape.height }
        };
        
        for (let [name, h] of Object.entries(handles)) {
            if (Math.abs(pos.x - h.x) < handleSize && Math.abs(pos.y - h.y) < handleSize) {
                return name;
            }
        }
    } else if (shape.type === 'circle') {
        const hx = shape.x + shape.radius;
        const hy = shape.y;
        if (Math.abs(pos.x - hx) < handleSize && Math.abs(pos.y - hy) < handleSize) {
            return 'resize-br';
        }
    } else if (shape.type === 'line') {
        if (Math.abs(pos.x - shape.x1) < handleSize && Math.abs(pos.y - shape.y1) < handleSize) {
            return 'resize-start';
        }
        if (Math.abs(pos.x - shape.x2) < handleSize && Math.abs(pos.y - shape.y2) < handleSize) {
            return 'resize-end';
        }
    }
    
    return null;
}

// Update cursor
function updateCursor(pos) {
    if (state.selectedShape) {
        const handle = getHandleAt(pos);
        if (handle) {
            if (handle === 'resize-tl' || handle === 'resize-br') {
                state.canvas.style.cursor = 'nwse-resize';
            } else if (handle === 'resize-tr' || handle === 'resize-bl') {
                state.canvas.style.cursor = 'nesw-resize';
            } else {
                state.canvas.style.cursor = 'move';
            }
            return;
        }
    }
    
    if (getShapeAt(pos)) {
        state.canvas.style.cursor = 'move';
    } else {
        state.canvas.style.cursor = 'default';
    }
}

// Handle text click
function handleTextClick(pos) {
    const text = prompt('Enter text:');
    if (text) {
        state.shapes.push({
            type: 'text',
            x: pos.x,
            y: pos.y,
            text: text,
            color: state.currentColor,
            fontSize: state.currentWidth * 8
        });
        render();
    }
}

// Handle eraser click
function handleEraserClick(pos) {
    const shape = getShapeAt(pos);
    if (shape) {
        state.shapes = state.shapes.filter(s => s !== shape);
        render();
    }
}

// Finish shape
function finishShape(pos) {
    if (state.currentTool === 'line') {
        state.shapes.push({
            type: 'line',
            x1: state.dragStart.x,
            y1: state.dragStart.y,
            x2: pos.x,
            y2: pos.y,
            color: state.currentColor,
            strokeWidth: state.currentWidth
        });
    } else if (state.currentTool === 'rectangle') {
        const x = Math.min(state.dragStart.x, pos.x);
        const y = Math.min(state.dragStart.y, pos.y);
        const w = Math.abs(pos.x - state.dragStart.x);
        const h = Math.abs(pos.y - state.dragStart.y);
        
        state.shapes.push({
            type: 'rectangle',
            x: x,
            y: y,
            width: w,
            height: h,
            color: state.currentColor,
            strokeWidth: state.currentWidth
        });
    } else if (state.currentTool === 'circle') {
        const radius = Math.sqrt(
            Math.pow(pos.x - state.dragStart.x, 2) +
            Math.pow(pos.y - state.dragStart.y, 2)
        );
        
        state.shapes.push({
            type: 'circle',
            x: state.dragStart.x,
            y: state.dragStart.y,
            radius: radius,
            color: state.currentColor,
            strokeWidth: state.currentWidth
        });
    }
    
    render();
}

// Render preview
function renderPreview(pos) {
    render();
    
    state.ctx.strokeStyle = state.currentColor;
    state.ctx.lineWidth = state.currentWidth;
    state.ctx.setLineDash([5, 5]);
    
    if (state.currentTool === 'line') {
        state.ctx.beginPath();
        state.ctx.moveTo(state.dragStart.x, state.dragStart.y);
        state.ctx.lineTo(pos.x, pos.y);
        state.ctx.stroke();
    } else if (state.currentTool === 'rectangle') {
        const x = Math.min(state.dragStart.x, pos.x);
        const y = Math.min(state.dragStart.y, pos.y);
        const w = Math.abs(pos.x - state.dragStart.x);
        const h = Math.abs(pos.y - state.dragStart.y);
        state.ctx.strokeRect(x, y, w, h);
    } else if (state.currentTool === 'circle') {
        const radius = Math.sqrt(
            Math.pow(pos.x - state.dragStart.x, 2) +
            Math.pow(pos.y - state.dragStart.y, 2)
        );
        state.ctx.beginPath();
        state.ctx.arc(state.dragStart.x, state.dragStart.y, radius, 0, Math.PI * 2);
        state.ctx.stroke();
    }
    
    state.ctx.setLineDash([]);
}

// Main render function
function render() {
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    
    // Draw all shapes
    for (let shape of state.shapes) {
        drawShape(shape);
    }
    
    // Draw selection
    if (state.selectedShape) {
        drawSelection(state.selectedShape);
    }
}

// Draw a shape
function drawShape(shape) {
    state.ctx.save();
    
    if (shape.type === 'pen') {
        state.ctx.strokeStyle = shape.color;
        state.ctx.lineWidth = shape.strokeWidth;
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        
        if (shape.points.length > 1) {
            state.ctx.beginPath();
            state.ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
                state.ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            state.ctx.stroke();
        }
    } else if (shape.type === 'line') {
        state.ctx.strokeStyle = shape.color;
        state.ctx.lineWidth = shape.strokeWidth;
        state.ctx.beginPath();
        state.ctx.moveTo(shape.x1, shape.y1);
        state.ctx.lineTo(shape.x2, shape.y2);
        state.ctx.stroke();
    } else if (shape.type === 'rectangle') {
        state.ctx.strokeStyle = shape.color;
        state.ctx.lineWidth = shape.strokeWidth;
        state.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'circle') {
        state.ctx.strokeStyle = shape.color;
        state.ctx.lineWidth = shape.strokeWidth;
        state.ctx.beginPath();
        state.ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        state.ctx.stroke();
    } else if (shape.type === 'text') {
        state.ctx.fillStyle = shape.color;
        state.ctx.font = `${shape.fontSize}px Arial`;
        state.ctx.fillText(shape.text, shape.x, shape.y);
    }
    
    state.ctx.restore();
}

// Draw selection handles
function drawSelection(shape) {
    state.ctx.fillStyle = '#00ff00';
    state.ctx.strokeStyle = '#000000';
    state.ctx.lineWidth = 2;
    
    const handleSize = 8;
    
    if (shape.type === 'rectangle') {
        const handles = [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x + shape.width, y: shape.y + shape.height }
        ];
        
        for (let h of handles) {
            state.ctx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
            state.ctx.strokeRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
        }
    } else if (shape.type === 'circle') {
        const hx = shape.x + shape.radius;
        const hy = shape.y;
        state.ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        state.ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        
        state.ctx.strokeStyle = '#00ff00';
        state.ctx.setLineDash([5, 5]);
        state.ctx.beginPath();
        state.ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        state.ctx.stroke();
        state.ctx.setLineDash([]);
    } else if (shape.type === 'line') {
        state.ctx.fillRect(shape.x1 - handleSize/2, shape.y1 - handleSize/2, handleSize, handleSize);
        state.ctx.strokeRect(shape.x1 - handleSize/2, shape.y1 - handleSize/2, handleSize, handleSize);
        state.ctx.fillRect(shape.x2 - handleSize/2, shape.y2 - handleSize/2, handleSize, handleSize);
        state.ctx.strokeRect(shape.x2 - handleSize/2, shape.y2 - handleSize/2, handleSize, handleSize);
    }
}

// Apply view transform
function applyViewTransform() {
    const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    state.imageCanvas.style.transform = transform;
    state.canvas.style.transform = transform;
    state.imageCanvas.style.transformOrigin = '0 0';
    state.canvas.style.transformOrigin = '0 0';
}

// Tool functions
function selectTool(tool) {
    state.currentTool = tool;
    state.selectedShape = null;
    state.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    
    render();
}

function zoomIn() {
    state.zoom = Math.min(state.zoom * 1.2, 5);
    applyViewTransform();
}

function zoomOut() {
    state.zoom = Math.max(state.zoom / 1.2, 0.1);
    applyViewTransform();
}

function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyViewTransform();
}

function clearCanvas() {
    if (confirm('Clear all annotations?')) {
        state.shapes = [];
        state.selectedShape = null;
        render();
    }
}

function undo() {
    if (state.shapes.length > 0) {
        state.shapes.pop();
        state.selectedShape = null;
        render();
    }
}

function deleteSelected() {
    if (state.selectedShape) {
        state.shapes = state.shapes.filter(s => s !== state.selectedShape);
        state.selectedShape = null;
        render();
    }
}

async function saveRedline() {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = state.imageCanvas.width;
        tempCanvas.height = state.imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(state.imageCanvas, 0, 0);
        tempCtx.drawImage(state.canvas, 0, 0);
        
        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        const reader = new FileReader();
        
        reader.onloadend = async function() {
            const base64data = reader.result.split(',')[1];
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: state.fileName,
                    fileContent: base64data,
                    projectId: state.projectId,
                    type: 'redlines'
                })
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const result = await response.json();
            
            const projectResponse = await fetch(`/api/projects?id=${state.projectId}`);
            if (!projectResponse.ok) throw new Error('Failed to fetch project');
            
            const projectData = await projectResponse.json();
            const project = projectData.projects[0];
            const redlines = project.redlines || [];
            redlines.push(result);
            
            const updateResponse = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: state.projectId,
                    redlines: redlines
                })
            });
            
            if (!updateResponse.ok) throw new Error('Failed to update project');
            
            alert('Redline saved successfully!');
            window.location.href = `project-details.html?id=${state.projectId}&customer_id=${state.customerId}`;
        };
        
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error('Error saving redline:', error);
        alert('Failed to save redline: ' + error.message);
        event.target.disabled = false;
        event.target.textContent = '💾 Save Redline';
    }
}

function goBack() {
    if (state.shapes.length > 0) {
        if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
            window.location.href = `project-details.html?id=${state.projectId}&customer_id=${state.customerId}`;
        }
    } else {
        window.location.href = `project-details.html?id=${state.projectId}&customer_id=${state.customerId}`;
    }
}

// Expose functions to window
window.selectTool = selectTool;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.clearCanvas = clearCanvas;
window.undo = undo;
window.saveRedline = saveRedline;
window.goBack = goBack;

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
