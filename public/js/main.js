// --- Global App State ---
const AppState = {
    firebase: { app: null, auth: null, storage: null, remoteConfig: null },
    liffId: '',
    userProfile: { displayName: "ゲスト", userId: null, pictureUrl: null, statusMessage: null, firebaseUid: null },
    gender: 'female',
    uploadedFiles: {}, // Stores File objects: { 'item-front-photo': File, ... }
    uploadedFileUrls: {}, // Stores URLs after upload: { 'item-front-photo': 'https://...', ... }
    selectedProposal: { hairstyle: null, haircolor: null }, // Stores selected keys like 'style1', 'color2'
    aiDiagnosisResult: null, // Stores the 'result' object from the API
    aiProposal: null, // Stores the 'proposal' object from the API
    generatedImageUrl: null // Stores URL from image generation API
};
// window.AppState = AppState; // For debugging

// --- Helper Functions ---
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        console.log("[hideLoadingScreen] Hiding loading screen.");
        loadingScreen.style.display = 'none';
    } else if (!loadingScreen) {
        console.warn("[hideLoadingScreen] Loading screen element not found.");
    }
}

function initializeAppFailure(errorMessage) {
    console.error("[initializeAppFailure] Displaying failure message:", errorMessage);
    hideLoadingScreen();
    if (window.initializeAppFailureFallback) {
        window.initializeAppFailureFallback(errorMessage);
    } else {
        alert(`アプリケーションエラー:\n${errorMessage}`);
    }
}

const escapeHtml = window.escapeHtml || function(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\//g, "&#x2F;");
};

function setTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text || '';
    } else {
        console.warn(`[setTextContent] Element with ID "${elementId}" not found.`);
    }
}

// Helper to create diagnosis result items --- ★ ADD LOG ★ ---
function createResultItem(label, value) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'result-item-label';
    labelDiv.textContent = label;

    const valueDiv = document.createElement('div');
    valueDiv.className = 'result-item-value';
    valueDiv.textContent = escapeHtml(value || 'N/A');

    // ★ Log the created elements ★
    console.log(`[createResultItem] Created elements:`, labelDiv, valueDiv);
    return [labelDiv, valueDiv];
}


// --- UI Initialization Function ---
function initializeAppUI() {
    console.log("[initializeAppUI] Initializing UI.");
    try {
        setupEventListeners();
        changePhase('phase1');
        const bodyElement = document.body;
        if (bodyElement) {
            bodyElement.style.display = 'flex';
            bodyElement.style.justifyContent = 'center';
            bodyElement.style.alignItems = 'flex-start';
            bodyElement.style.paddingTop = '20px';
            bodyElement.style.minHeight = 'unset';
        }
        console.log("[initializeAppUI] UI Initialized, phase1 shown.");
    } catch (uiError) {
        console.error("[initializeAppUI] Error:", uiError);
        initializeAppFailure("UI初期化エラー: " + uiError.message);
    }
}

// --- Event Listener Setup ---
function setupEventListeners() {
    console.log("[setupEventListeners] Setting up...");
    // --- Phase 1 ---
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            setTextContent('display-name', AppState.userProfile.displayName || "ゲスト");
            const genderRadio = document.querySelector(`input[name="gender"][value="${AppState.gender}"]`);
            if (genderRadio) genderRadio.checked = true;
            changePhase('phase2');
        });
    } else console.warn("[setupEventListeners] start-btn not found.");
    // --- Phase 2 ---
    const nextToUploadBtn = document.getElementById('next-to-upload-btn');
    if (nextToUploadBtn) {
        nextToUploadBtn.addEventListener('click', () => {
            const selectedGender = document.querySelector('input[name="gender"]:checked');
            if (selectedGender) AppState.gender = selectedGender.value;
            console.log("Gender selected:", AppState.gender);
            changePhase('phase3');
        });
    } else console.warn("[setupEventListeners] next-to-upload-btn not found.");
    // --- Phase 3 ---
    const uploadItems = document.querySelectorAll('.upload-item');
    uploadItems.forEach(item => { /* ... (no changes needed here) ... */ });
    const requestDiagnosisBtn = document.getElementById('request-diagnosis-btn');
    if (requestDiagnosisBtn) {
        requestDiagnosisBtn.addEventListener('click', handleDiagnosisRequest);
    } else console.warn("[setupEventListeners] request-diagnosis-btn not found.");
    // --- Phase 4 ---
    const nextToProposalBtn = document.getElementById('next-to-proposal-btn');
    if (nextToProposalBtn) {
        nextToProposalBtn.addEventListener('click', () => {
             displayProposalResult(AppState.aiProposal);
             changePhase('phase5');
        });
    } else console.warn("[setupEventListeners] next-to-proposal-btn not found.");
    // --- Phase 5 ---
    const nextToGenerateBtn = document.getElementById('next-to-generate-btn');
    if (nextToGenerateBtn) {
        nextToGenerateBtn.addEventListener('click', handleImageGenerationRequest);
    } else console.warn("[setupEventListeners] next-to-generate-btn not found.");
    // --- Phase 6 ---
     const backToProposalBtn = document.getElementById('back-to-proposal-btn');
     if (backToProposalBtn) {
         backToProposalBtn.addEventListener('click', () => { changePhase('phase5'); });
     } else console.warn("[setupEventListeners] back-to-proposal-btn not found.");
    console.log("[setupEventListeners] Setup complete.");
}


// --- Diagnosis Request and Result Handling ---
async function handleDiagnosisRequest() { /* ... (no changes needed here) ... */ }

// Function to display diagnosis results in Phase 4 --- ★ ADD LOGS ★ ---
function displayDiagnosisResult(result) {
    console.log("[displayDiagnosisResult] Displaying diagnosis:", result);
    const faceResultsContainer = document.getElementById('face-results');
    const skeletonResultsContainer = document.getElementById('skeleton-results');
    const personalColorResultsContainer = document.getElementById('personal-color-results');

    // Clear previous results
    if (faceResultsContainer) faceResultsContainer.innerHTML = ''; else console.warn("faceResultsContainer not found");
    if (skeletonResultsContainer) skeletonResultsContainer.innerHTML = ''; else console.warn("skeletonResultsContainer not found");
    if (personalColorResultsContainer) personalColorResultsContainer.innerHTML = ''; else console.warn("personalColorResultsContainer not found");

    if (!result) {
        console.warn("[displayDiagnosisResult] No result data to display.");
        return;
    }

    // Populate Face Results
    if (result.face && faceResultsContainer) {
        console.log("[displayDiagnosisResult] Populating face results...");
        const faceMap = { nose: "鼻", mouth: "口", eyes: "目", eyebrows: "眉", forehead: "おでこ" };
        Object.entries(result.face).forEach(([key, value]) => {
            const items = createResultItem(faceMap[key] || key, value);
            console.log(`[displayDiagnosisResult] Appending face item for ${key}:`, items);
            faceResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Face results container after append:", faceResultsContainer.innerHTML); // ★ Log content after append
    } else {
        console.log("[displayDiagnosisResult] No face data or container not found.");
    }

    // Populate Skeleton Results
    if (result.skeleton && skeletonResultsContainer) {
        console.log("[displayDiagnosisResult] Populating skeleton results...");
        const skeletonMap = { neckLength: "首の長さ", faceShape: "顔の形", bodyLine: "ボディライン", shoulderLine: "肩のライン" };
        Object.entries(result.skeleton).forEach(([key, value]) => {
            const items = createResultItem(skeletonMap[key] || key, value);
            console.log(`[displayDiagnosisResult] Appending skeleton item for ${key}:`, items);
            skeletonResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Skeleton results container after append:", skeletonResultsContainer.innerHTML); // ★ Log content after append
    } else {
         console.log("[displayDiagnosisResult] No skeleton data or container not found.");
    }

    // Populate Personal Color Results
    if (result.personalColor && personalColorResultsContainer) {
         console.log("[displayDiagnosisResult] Populating personal color results...");
         const colorMap = { baseColor: "ベースカラー", season: "シーズン", brightness: "明度", saturation: "彩度", eyeColor: "瞳の色" };
         Object.entries(result.personalColor).forEach(([key, value]) => {
             const items = createResultItem(colorMap[key] || key, value);
             console.log(`[displayDiagnosisResult] Appending color item for ${key}:`, items);
             personalColorResultsContainer.append(...items);
         });
         console.log("[displayDiagnosisResult] Personal color results container after append:", personalColorResultsContainer.innerHTML); // ★ Log content after append
    } else {
         console.log("[displayDiagnosisResult] No personal color data or container not found.");
    }

     console.log("[displayDiagnosisResult] Finished displaying results.");
}

// Function to display proposal results in Phase 5 --- ★ ADD LOGS ★ ---
function displayProposalResult(proposal) {
    console.log("[displayProposalResult] Displaying proposal:", proposal);
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');

    // Clear previous proposals
    if (hairstyleContainer) hairstyleContainer.innerHTML = ''; else console.warn("hairstyleContainer not found");
    if (haircolorContainer) haircolorContainer.innerHTML = ''; else console.warn("haircolorContainer not found");
    setTextContent('top-stylist-comment-text', '');
    AppState.selectedProposal = { hairstyle: null, haircolor: null };
    checkProposalSelection(); // Disable button

    if (!proposal) {
        console.warn("[displayProposalResult] No proposal data to display.");
        return;
    }

    // Populate Hairstyles
    if (proposal.hairstyles && hairstyleContainer) {
        console.log("[displayProposalResult] Populating hairstyles...");
        Object.entries(proposal.hairstyles).forEach(([key, style]) => {
            const card = document.createElement('div');
            card.className = 'proposal-card';
            card.dataset.type = 'hairstyle';
            card.dataset.key = key;
            const cardHTML = `<strong>${escapeHtml(style.name)}</strong><p>${escapeHtml(style.description)}</p>`;
            console.log(`[displayProposalResult] Hairstyle card HTML for ${key}:`, cardHTML); // ★ Log card HTML
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
            hairstyleContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended hairstyle card for ${key}`); // ★ Log append success
        });
         console.log("[displayProposalResult] Hairstyle container after append:", hairstyleContainer.innerHTML); // ★ Log content after append
    } else {
         console.log("[displayProposalResult] No hairstyle data or container not found.");
    }

    // Populate Haircolors
    if (proposal.haircolors && haircolorContainer) {
        console.log("[displayProposalResult] Populating haircolors...");
        Object.entries(proposal.haircolors).forEach(([key, color]) => {
            const card = document.createElement('div');
            card.className = 'proposal-card';
            card.dataset.type = 'haircolor';
            card.dataset.key = key;
            const cardHTML = `<strong>${escapeHtml(color.name)}</strong><p>${escapeHtml(color.description)}</p>`;
            console.log(`[displayProposalResult] Haircolor card HTML for ${key}:`, cardHTML); // ★ Log card HTML
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
            haircolorContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended haircolor card for ${key}`); // ★ Log append success
        });
        console.log("[displayProposalResult] Haircolor container after append:", haircolorContainer.innerHTML); // ★ Log content after append
    } else {
        console.log("[displayProposalResult] No haircolor data or container not found.");
    }

    // Display Comment
    if (proposal.comment) {
         console.log("[displayProposalResult] Setting comment text.");
         setTextContent('top-stylist-comment-text', proposal.comment);
    } else {
         console.log("[displayProposalResult] No comment data found.");
    }
     console.log("[displayProposalResult] Finished displaying proposals.");
}

// --- Image Generation Request Handler ---
async function handleImageGenerationRequest() { /* ... (no changes needed here) ... */ }

// --- Utility Functions ---
function handleProposalSelection(event) { /* ... (no changes needed here) ... */ }
function checkAllFilesUploaded() { /* ... (no changes needed here) ... */ }
function checkProposalSelection() { /* ... (no changes needed here) ... */ }

// --- Firebase Storage Upload ---
async function uploadFileToStorage(file, itemName) { /* ... (no changes needed here) ... */ }

// --- Cloud Function Requests ---
async function requestAiDiagnosis(requestData) { /* ... (no changes needed here) ... */ }
async function requestImageGeneration(requestData) { /* ... (no changes needed here) ... */ }

// --- Main App Initialization Function ---
async function main() { /* ... (no changes needed here) ... */ }

