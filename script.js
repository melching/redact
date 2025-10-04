// Image Censor Tool Script

const imageLoader = document.getElementById('imageLoader');
const uploadArea = document.getElementById('uploadArea');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const pixelateBtn = document.getElementById('pixelateBtn');
const colorBarBtn = document.getElementById('colorBarBtn'); // Renamed from blackBarBtn
const pixelSizeInput = document.getElementById('pixelSizeInput');
const barColorInput = document.getElementById('barColorInput');
const historyList = document.getElementById('historyList');
const historySection = document.getElementById('historySection');
const loadNewBtn = document.getElementById('loadNewBtn');
const mainContainer = document.getElementById('mainContainer'); // Added

let originalImage = null;
// Offscreen canvas for full-resolution editing
let offscreenCanvas = null;
let offscreenCtx = null;

let isDrawing = false;
let startX, startY, endX, endY;
let currentTool = null; // 'pixelate', 'colorBar'

// History state
let history = [];
let currentHistoryIndex = -1;

// --- Image Loading ---

imageLoader.addEventListener('change', handleImageUpload);
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
document.addEventListener('paste', handlePaste);
loadNewBtn.addEventListener('click', handleLoadNew);

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImageFromFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImageFromFile(file);
    } else {
        alert("Please drop an image file.");
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            loadImageFromFile(blob);
            // Prevent pasting text into input fields etc.
            e.preventDefault();
            return; // Process only the first image found
        }
    }
}

function loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        originalImage = new Image();
        originalImage.onload = function() {
            // Set visible canvas size for display
            resizeVisibleCanvas(originalImage);

            // Create and setup offscreen canvas at full resolution
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = originalImage.width;
            offscreenCanvas.height = originalImage.height;
            offscreenCtx = offscreenCanvas.getContext('2d');

            // Draw the original image to the offscreen canvas
            offscreenCtx.drawImage(originalImage, 0, 0);
            console.log(`Offscreen canvas created: ${offscreenCanvas.width}x${offscreenCanvas.height}`);

            // Initialize history with the offscreen canvas state
            clearHistory();
            // Use offscreen canvas for initial history state
            saveHistoryState("Initial Image", offscreenCanvas);

            downloadBtn.disabled = false; // Enable download button
            uploadArea.style.display = 'none'; // Hide upload area
            // Show the main editor/history container
            mainContainer.style.display = 'flex';
            historySection.style.display = 'block';
            canvas.style.display = 'block'; // Ensure the canvas itself is visible

            // Draw the initial state onto the visible canvas
            drawVisibleCanvas();
        }
        originalImage.onerror = function() {
            alert("Error loading image.");
            resetState();
        }
        originalImage.src = event.target.result;
    }
    reader.onerror = function() {
        alert("Error reading file.");
        resetState();
    }
    reader.readAsDataURL(file);
}

// Renamed from setCanvasSize for clarity - operates on the VISIBLE canvas
function resizeVisibleCanvas(img) {
    // Adjust visible canvas size to fit image within max dimensions, maintaining aspect ratio
    const viewportWidth = window.innerWidth * 0.9 - 300; // Adjust for sidebar width
    const viewportHeight = window.innerHeight * 0.8; // Adjust for potential header/footer space

    // Use the OFFSCREEN canvas dimensions for ratio calculation
    const sourceWidth = offscreenCanvas ? offscreenCanvas.width : img.width;
    const sourceHeight = offscreenCanvas ? offscreenCanvas.height : img.height;

    let ratio = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight, 1); // Don't scale up

    // Set the display size of the visible canvas
    canvas.width = sourceWidth * ratio;
    canvas.height = sourceHeight * ratio;
    console.log(`Visible canvas resized to: ${canvas.width}x${canvas.height}`);
}

// Function to draw the offscreen canvas onto the visible canvas
function drawVisibleCanvas() {
    if (!offscreenCanvas) return;

    // Ensure visible canvas aspect ratio matches offscreen
    resizeVisibleCanvas(offscreenCanvas); // Use offscreen dimensions as reference

    // Clear the visible canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the potentially scaled-down offscreen canvas onto the visible one
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
    console.log("Visible canvas updated from offscreen canvas.");
}

// Function to draw an image (usually from history) onto the canvas
function drawImageState(img) {
    resizeVisibleCanvas(img); // Ensure canvas size matches the image state being drawn
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function resetState() {
    originalImage = null;
    offscreenCanvas = null; // Clear offscreen canvas
    offscreenCtx = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
    historySection.style.display = 'none'; // Hide history
    mainContainer.style.display = 'none'; // Hide main container
    uploadArea.style.display = 'block'; // Show upload area
    downloadBtn.disabled = true;
    imageLoader.value = ''; // Reset file input
    pixelateBtn.classList.remove('selected');
    colorBarBtn.classList.remove('selected');
    currentTool = null;
    clearHistory();
    console.log("State reset.");
}


// --- History Management ---

function clearHistory() {
    history = [];
    currentHistoryIndex = -1;
    updateHistoryUI();
}

function saveHistoryState(actionName = "Edit", sourceCanvas) {
    if (!sourceCanvas) return;
    // If we are not at the end of history (i.e., we reverted), clear future states
    if (currentHistoryIndex < history.length - 1) {
        history = history.slice(0, currentHistoryIndex + 1);
    }

    const dataURL = sourceCanvas.toDataURL(); // Get data from the provided canvas
    history.push({ action: actionName, state: dataURL });
    currentHistoryIndex++;
    updateHistoryUI();
    console.log(`History saved: ${actionName}, index: ${currentHistoryIndex}`);
}

function revertToHistoryStep(index) {
    if (index < 0 || index >= history.length || !offscreenCtx) return;

    console.log(`Reverting to history index: ${index}`);
    currentHistoryIndex = index;
    const historyEntry = history[currentHistoryIndex];

    const img = new Image();
    img.onload = () => {
        // Draw the history state onto the OFFSCREEN canvas at full resolution
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.drawImage(img, 0, 0);
        console.log("Offscreen canvas updated from history.");

        // Update the VISIBLE canvas
        drawVisibleCanvas();
        updateHistoryUI(); // Update UI to show active state
    };
    img.onerror = () => {
        alert("Error reloading history state.");
        resetState(); // Fallback to reset
    };
    img.src = historyEntry.state; // State is dataURL from offscreen canvas
}

function updateHistoryUI() {
    historyList.innerHTML = ''; // Clear existing list
    history.forEach((entry, index) => {
        const li = document.createElement('li');
        li.textContent = `${index}: ${entry.action}`;
        li.dataset.index = index;
        if (index === currentHistoryIndex) {
            li.classList.add('active');
        }
        li.addEventListener('click', () => {
            revertToHistoryStep(index);
        });
        historyList.appendChild(li);
    });
    // Scroll to bottom or ensure active item is visible if needed
    historyList.scrollTop = historyList.scrollHeight;
}

// --- Tool Selection ---

pixelateBtn.addEventListener('click', () => {
    currentTool = 'pixelate';
    console.log("Tool selected: Pixelate");
    pixelateBtn.classList.add('selected');
    colorBarBtn.classList.remove('selected');
});

// Updated for renamed button/tool
colorBarBtn.addEventListener('click', () => {
    currentTool = 'colorBar';
    console.log("Tool selected: Color Bar");
    colorBarBtn.classList.add('selected');
    pixelateBtn.classList.remove('selected');
});


// --- Drawing/Censoring Logic ---

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', drawSelection);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('mouseleave', cancelDrawing); // Cancel if mouse leaves canvas

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    // Get the mouse position relative to the canvas element's displayed position
    const clientX = evt.clientX - rect.left;
    const clientY = evt.clientY - rect.top;
    
    // Scale the mouse coordinates from the displayed size to the internal canvas size
    // This is necessary because CSS might scale the canvas display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: clientX * scaleX,
        y: clientY * scaleY
    };
}

function startDrawing(e) {
    if (!currentTool || currentHistoryIndex < 0 || !offscreenCanvas) return;

    isDrawing = true;
    // Get coords relative to VISIBLE canvas
    const pos = getMousePos(canvas, e);
    startX = pos.x;
    startY = pos.y;
}

function drawSelection(e) {
    if (!isDrawing) return;

    // 1. Get current mouse position relative to VISIBLE canvas
    const pos = getMousePos(canvas, e);
    endX = pos.x;
    endY = pos.y;

    // 2. Redraw the visible canvas from the offscreen source first
    drawVisibleCanvas();

    // 3. Draw the selection rectangle on top of the VISIBLE canvas using FLOORED coordinates
    const rectX = Math.floor(Math.min(startX, endX));
    const rectY = Math.floor(Math.min(startY, endY));
    const rectWidth = Math.floor(Math.abs(endX - startX));
    const rectHeight = Math.floor(Math.abs(endY - startY));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent black
    if (rectWidth > 0 && rectHeight > 0) {
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    }
}

function endDrawing(e) {
    if (!isDrawing || !offscreenCanvas) return;
    isDrawing = false;

    // Get end coordinates relative to VISIBLE canvas
    const pos = getMousePos(canvas, e);
    endX = pos.x;
    endY = pos.y;

    // Calculate the scale factor between visible and offscreen canvas
    const scaleX = offscreenCanvas.width / canvas.width;
    const scaleY = offscreenCanvas.height / canvas.height;

    // Calculate the selection area in OFFSCREEN canvas coordinates
    const offscreenStartX = startX * scaleX;
    const offscreenStartY = startY * scaleY;
    const offscreenEndX = endX * scaleX;
    const offscreenEndY = endY * scaleY;

    // Use integer coordinates in OFFSCREEN space
    const sx = Math.floor(offscreenStartX);
    const sy = Math.floor(offscreenStartY);
    const ex = Math.floor(offscreenEndX);
    const ey = Math.floor(offscreenEndY);

    const x = Math.min(sx, ex);
    const y = Math.min(sy, ey);
    const width = Math.abs(ex - sx);
    const height = Math.abs(ey - sy);

    if (width > 1 && height > 1) { // Require a minimum size to apply
        // Apply the actual censoring effect to the OFFSCREEN canvas
        applyCensoring(x, y, width, height);
    } else {
        // If selection was too small, just redraw visible canvas to remove selection box
        drawVisibleCanvas();
    }
}

function cancelDrawing(e) {
    if (isDrawing) {
        isDrawing = false;
        // Redraw the current state from offscreen canvas to clear selection box
        drawVisibleCanvas();
        console.log("Drawing cancelled");
    }
}

// Apply censoring to the OFFSCREEN canvas
function applyCensoring(x, y, width, height) {
    if (!currentTool || currentHistoryIndex < 0 || !offscreenCtx) return;

    // Coordinates are already in offscreen space
    // Ensure coordinates are within offscreen canvas bounds
    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(offscreenCanvas.width - x, width);
    height = Math.min(offscreenCanvas.height - y, height);

    if (width <= 0 || height <= 0) return; // Skip if area is outside canvas

    let actionName = "Unknown Edit";
    if (currentTool === 'pixelate') {
        const pixelSize = parseInt(pixelSizeInput.value, 10) || 10;
        pixelateArea(x, y, width, height, pixelSize);
        actionName = `Pixelate (Size ${pixelSize})`;
    } else if (currentTool === 'colorBar') {
        const color = barColorInput.value || '#000000';
        drawColorBar(x, y, width, height, color);
        actionName = `Color Bar (${color})`;
    }

    console.log(`Applied ${actionName} to Offscreen[${x.toFixed(0)}, ${y.toFixed(0)}, ${width.toFixed(0)}, ${height.toFixed(0)}]`);

    // Save the new state of the OFFSCREEN canvas to history
    saveHistoryState(actionName, offscreenCanvas);

    // Update the visible canvas
    drawVisibleCanvas();
}

// Operates on OFFSCREEN context
function pixelateArea(x, y, width, height, pixelSize) {
    if (!offscreenCtx) return;
    pixelSize = Math.max(2, pixelSize); // Ensure pixelSize is reasonable
    // Get the image data for the selected area FROM OFFSCREEN CANVAS
    const imageData = offscreenCtx.getImageData(x, y, width, height);
    const data = imageData.data;

    for (let j = 0; j < height; j += pixelSize) {
        for (let i = 0; i < width; i += pixelSize) {
            const blockX = i;
            const blockY = j;

            // Calculate center coordinates of the block relative to the imageData
            const centerX = Math.floor(blockX + pixelSize / 2);
            const centerY = Math.floor(blockY + pixelSize / 2);

            // Clamp coordinates to be within the imageData bounds [0, width-1] and [0, height-1]
            const sourceX = Math.min(Math.max(0, centerX), width - 1);
            const sourceY = Math.min(Math.max(0, centerY), height - 1);

            // Calculate the index for the source pixel in the imageData array
            const startIndex = (sourceY * width + sourceX) * 4; // 4 bytes per pixel (RGBA)

            const r = data[startIndex];
            const g = data[startIndex + 1];
            const b = data[startIndex + 2];
            const a = data[startIndex + 3]; // Use source alpha

            // Fill the entire block
            for (let innerY = blockY; innerY < blockY + pixelSize && innerY < height; innerY++) {
                for (let innerX = blockX; innerX < blockX + pixelSize && innerX < width; innerX++) {
                    const currentIndex = (innerY * width + innerX) * 4;
                    data[currentIndex] = r;
                    data[currentIndex + 1] = g;
                    data[currentIndex + 2] = b;
                    data[currentIndex + 3] = a; // Apply source alpha to the block
                }
            }
        }
    }
    // Put the modified data back onto the OFFSCREEN canvas
    offscreenCtx.putImageData(imageData, x, y);
}

// Operates on OFFSCREEN context
function drawColorBar(x, y, width, height, color) {
    if (!offscreenCtx) return;
    offscreenCtx.fillStyle = color;
    offscreenCtx.fillRect(x, y, width, height);
}

// --- Download Logic ---

downloadBtn.addEventListener('click', downloadImage);

function downloadImage() {
    if (currentHistoryIndex < 0 || !offscreenCanvas) return;

    // Use the current state of the OFFSCREEN canvas for download
    const dataURL = offscreenCanvas.toDataURL('image/png'); // Save as PNG
    const link = document.createElement('a');
    link.download = 'redacted-image.png'; // Updated filename
    link.href = dataURL;
    link.click(); // Trigger download
    console.log("Download initiated from offscreen canvas state.");
}

// Handler for the Load New Image button
function handleLoadNew() {
    // Confirm before discarding current work? (Optional)
    // if (!confirm("Discard current changes and load a new image?")) {
    //     return;
    // }
    resetState();
    // Programmatically click the hidden file input
    imageLoader.click();
}

// Initial setup
resetState(); // Start with a clean state
console.log("Script loaded, initial state set.");

// --- Helper Functions ---
// (getMousePos already included above) 