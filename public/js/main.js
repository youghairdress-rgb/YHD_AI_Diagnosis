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

// Helper to create diagnosis result items
function createResultItem(label, value) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'result-item-label';
    labelDiv.textContent = label;
    const valueDiv = document.createElement('div');
    valueDiv.className = 'result-item-value';
    valueDiv.textContent = escapeHtml(value || 'N/A');
    console.log(`[createResultItem] Created elements:`, labelDiv, valueDiv); // Debug log
    return [labelDiv, valueDiv];
}

// --- UI Initialization Function ---
function initializeAppUI() {
    console.log("[initializeAppUI] Initializing UI.");
    try {
        setupEventListeners();
        console.log("[initializeAppUI] setupEventListeners completed.");
        changePhase('phase1'); // Show the first screen
        console.log("[initializeAppUI] changePhase('phase1') completed.");

        // Adjust body style for app view
        const bodyElement = document.body;
        if (bodyElement) {
            console.log("[initializeAppUI] Setting body styles...");
            bodyElement.style.display = 'flex';
            bodyElement.style.justifyContent = 'center';
            bodyElement.style.alignItems = 'flex-start';
            bodyElement.style.paddingTop = '20px'; // Add some padding at the top
            bodyElement.style.minHeight = 'unset'; // Remove height used for centering loading
            console.log("[initializeAppUI] Body styles applied.");
        } else {
            console.warn("[initializeAppUI] document.body not found when setting styles.");
        }
        console.log("[initializeAppUI] UI Initialized, phase1 shown.");
    } catch (uiError) {
        console.error("[initializeAppUI] Error during UI initialization:", uiError);
        initializeAppFailure("UIの初期化中にエラーが発生しました: " + uiError.message);
    }
}

// --- Event Listener Setup ---
function setupEventListeners() {
    console.log("[setupEventListeners] Setting up...");

    // Phase 1: Start Button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            setTextContent('display-name', AppState.userProfile.displayName || "ゲスト");
            const genderRadio = document.querySelector(`input[name="gender"][value="${AppState.gender}"]`);
            if (genderRadio) genderRadio.checked = true;
            changePhase('phase2');
        });
    } else console.warn("[setupEventListeners] start-btn not found.");

    // Phase 2: Next Button
    const nextToUploadBtn = document.getElementById('next-to-upload-btn');
    if (nextToUploadBtn) {
        nextToUploadBtn.addEventListener('click', () => {
            const selectedGender = document.querySelector('input[name="gender"]:checked');
            if (selectedGender) AppState.gender = selectedGender.value;
            console.log("Gender selected:", AppState.gender);
            changePhase('phase3');
        });
    } else console.warn("[setupEventListeners] next-to-upload-btn not found.");

    // Phase 3: File Inputs & Upload Trigger
    const uploadItems = document.querySelectorAll('.upload-item');
    uploadItems.forEach(item => {
        const button = item.querySelector('button');
        const input = item.querySelector('.file-input');
        const itemId = item.id;
        const iconDiv = item.querySelector('.upload-icon');

        if (button && input) {
            button.addEventListener('click', (e) => {
                if (!button.disabled) input.click();
            });
            input.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    AppState.uploadedFiles[itemId] = file;
                    console.log(`[FileSelected] ${itemId}: ${file.name}`);
                    button.textContent = '✔️ 撮影済み';
                    button.classList.remove('btn-outline');
                    button.classList.add('btn-success');
                    button.disabled = true;
                    if (iconDiv) iconDiv.classList.add('completed');
                    checkAllFilesUploaded();
                }
            });
        } else console.warn(`[setupEventListeners] Button or input missing for: ${itemId}`);
    });

    const requestDiagnosisBtn = document.getElementById('request-diagnosis-btn');
    if (requestDiagnosisBtn) {
        requestDiagnosisBtn.addEventListener('click', handleDiagnosisRequest);
    } else console.warn("[setupEventListeners] request-diagnosis-btn not found.");

    // Phase 4: Next Button
    const nextToProposalBtn = document.getElementById('next-to-proposal-btn');
    if (nextToProposalBtn) {
        nextToProposalBtn.addEventListener('click', () => {
             displayProposalResult(AppState.aiProposal);
             changePhase('phase5');
        });
    } else console.warn("[setupEventListeners] next-to-proposal-btn not found.");

    // Phase 5: Generate Button
    const nextToGenerateBtn = document.getElementById('next-to-generate-btn');
    if (nextToGenerateBtn) {
        nextToGenerateBtn.addEventListener('click', handleImageGenerationRequest);
    } else console.warn("[setupEventListeners] next-to-generate-btn not found.");

    // Phase 6: Back Button
     const backToProposalBtn = document.getElementById('back-to-proposal-btn');
     if (backToProposalBtn) {
         backToProposalBtn.addEventListener('click', () => {
             changePhase('phase5');
         });
     } else console.warn("[setupEventListeners] back-to-proposal-btn not found.");

    console.log("[setupEventListeners] Setup complete.");
}


// --- Diagnosis Request and Result Handling ---
async function handleDiagnosisRequest() {
    console.log("[handleDiagnosisRequest] Starting diagnosis process.");
    const requestBtn = document.getElementById('request-diagnosis-btn');
    const statusTextElement = document.getElementById('diagnosis-status-text');

    const updateStatusText = (text) => {
        if (statusTextElement) statusTextElement.textContent = text;
        console.log(`[StatusUpdate] ${text}`);
    };

    try {
        if (requestBtn) requestBtn.disabled = true;
        changePhase('phase3.5');
        updateStatusText('ファイルをアップロード中... (0/5)');

        const uploadPromises = [];
        const fileKeys = Object.keys(AppState.uploadedFiles);
        let uploadedCount = 0;

        fileKeys.forEach(key => {
            const file = AppState.uploadedFiles[key];
            const promise = uploadFileToStorage(file, key)
                .then(result => {
                    uploadedCount++;
                    updateStatusText(`ファイルをアップロード中... (${uploadedCount}/${fileKeys.length})`);
                    AppState.uploadedFileUrls[key] = result.url;
                    return result;
                });
            uploadPromises.push(promise);
        });

        await Promise.all(uploadPromises);
        console.log("[handleDiagnosisRequest] All files uploaded:", AppState.uploadedFileUrls);
        updateStatusText('AIに診断をリクエスト中...');

        const requestData = {
            fileUrls: AppState.uploadedFileUrls,
            userProfile: {
                 userId: AppState.userProfile.userId,
                 displayName: AppState.userProfile.displayName,
                 firebaseUid: AppState.userProfile.firebaseUid
            },
            gender: AppState.gender
        };

        const responseData = await requestAiDiagnosis(requestData);
        console.log("[handleDiagnosisRequest] Diagnosis response received:", responseData);

        AppState.aiDiagnosisResult = responseData.result;
        AppState.aiProposal = responseData.proposal;

        displayDiagnosisResult(AppState.aiDiagnosisResult);
        changePhase('phase4');

    } catch (error) {
        console.error("[handleDiagnosisRequest] Error:", error);
        alert(`診断リクエストの処理中にエラーが発生しました。\n詳細: ${error.message}`);
        changePhase('phase3'); // Go back on error
        document.querySelectorAll('.upload-item').forEach(item => {
            const button = item.querySelector('button');
            const iconDiv = item.querySelector('.upload-icon');
            if (button && !AppState.uploadedFileUrls[item.id]) { // Only reset if not successfully uploaded
                button.textContent = '撮影';
                button.classList.add('btn-outline');
                button.classList.remove('btn-success');
                button.disabled = false;
                if (iconDiv) iconDiv.classList.remove('completed');
                delete AppState.uploadedFiles[item.id]; // Clear file from state
            }
        });
        checkAllFilesUploaded(); // Re-check button state

    } finally {
        // Re-enable diagnosis button only if user is back on phase 3
        const currentPhase3 = document.getElementById('phase3');
        if (requestBtn && currentPhase3 && currentPhase3.style.display === 'block') {
             checkAllFilesUploaded();
        }
    }
}

// Function to display diagnosis results in Phase 4
function displayDiagnosisResult(result) {
    console.log("[displayDiagnosisResult] Displaying diagnosis:", result); // Debug log
    const faceResultsContainer = document.getElementById('face-results');
    const skeletonResultsContainer = document.getElementById('skeleton-results');
    const personalColorResultsContainer = document.getElementById('personal-color-results');

    // Clear previous results
    if (faceResultsContainer) faceResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] faceResultsContainer not found");
    if (skeletonResultsContainer) skeletonResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] skeletonResultsContainer not found");
    if (personalColorResultsContainer) personalColorResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] personalColorResultsContainer not found");

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
            console.log(`[displayDiagnosisResult] Appending face item for ${key}:`, items); // Debug log
            faceResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Face results container after append:", faceResultsContainer.innerHTML); // Debug log
    } else {
        console.log("[displayDiagnosisResult] No face data or container not found."); // Debug log
    }

    // Populate Skeleton Results
    if (result.skeleton && skeletonResultsContainer) {
        console.log("[displayDiagnosisResult] Populating skeleton results...");
        const skeletonMap = { neckLength: "首の長さ", faceShape: "顔の形", bodyLine: "ボディライン", shoulderLine: "肩のライン" };
        Object.entries(result.skeleton).forEach(([key, value]) => {
            const items = createResultItem(skeletonMap[key] || key, value);
            console.log(`[displayDiagnosisResult] Appending skeleton item for ${key}:`, items); // Debug log
            skeletonResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Skeleton results container after append:", skeletonResultsContainer.innerHTML); // Debug log
    } else {
         console.log("[displayDiagnosisResult] No skeleton data or container not found."); // Debug log
    }

    // Populate Personal Color Results
    if (result.personalColor && personalColorResultsContainer) {
         console.log("[displayDiagnosisResult] Populating personal color results...");
         const colorMap = { baseColor: "ベースカラー", season: "シーズン", brightness: "明度", saturation: "彩度", eyeColor: "瞳の色" };
         Object.entries(result.personalColor).forEach(([key, value]) => {
             const items = createResultItem(colorMap[key] || key, value);
             console.log(`[displayDiagnosisResult] Appending color item for ${key}:`, items); // Debug log
             personalColorResultsContainer.append(...items);
         });
         console.log("[displayDiagnosisResult] Personal color results container after append:", personalColorResultsContainer.innerHTML); // Debug log
    } else {
         console.log("[displayDiagnosisResult] No personal color data or container not found."); // Debug log
    }

     console.log("[displayDiagnosisResult] Finished displaying results."); // Debug log
}

// Function to display proposal results in Phase 5
function displayProposalResult(proposal) {
    console.log("[displayProposalResult] Displaying proposal:", proposal); // Debug log
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');

    // Clear previous proposals
    if (hairstyleContainer) hairstyleContainer.innerHTML = ''; else console.warn("[displayProposalResult] hairstyleContainer not found");
    if (haircolorContainer) haircolorContainer.innerHTML = ''; else console.warn("[displayProposalResult] haircolorContainer not found");
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
            console.log(`[displayProposalResult] Hairstyle card HTML for ${key}:`, cardHTML); // Debug log
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
            hairstyleContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended hairstyle card for ${key}`); // Debug log
        });
         console.log("[displayProposalResult] Hairstyle container after append:", hairstyleContainer.innerHTML); // Debug log
    } else {
         console.log("[displayProposalResult] No hairstyle data or container not found."); // Debug log
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
            console.log(`[displayProposalResult] Haircolor card HTML for ${key}:`, cardHTML); // Debug log
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
            haircolorContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended haircolor card for ${key}`); // Debug log
        });
        console.log("[displayProposalResult] Haircolor container after append:", haircolorContainer.innerHTML); // Debug log
    } else {
        console.log("[displayProposalResult] No haircolor data or container not found."); // Debug log
    }

    // Display Comment
    if (proposal.comment) {
         console.log("[displayProposalResult] Setting comment text."); // Debug log
         setTextContent('top-stylist-comment-text', proposal.comment);
    } else {
         console.log("[displayProposalResult] No comment data found."); // Debug log
    }
     console.log("[displayProposalResult] Finished displaying proposals."); // Debug log
}


// --- Image Generation Request Handler ---
async function handleImageGenerationRequest() {
    console.log("[handleImageGenerationRequest] Starting image generation process.");
    const generateBtn = document.getElementById('next-to-generate-btn');
    const generatedImageElement = document.getElementById('generated-image');
    const loadingPlaceholder = 'https://placehold.co/300x300/e2e8f0/cbd5e1?text=Generating...';

    // Ensure selections are made
    if (!AppState.selectedProposal.hairstyle || !AppState.selectedProposal.haircolor) {
        console.warn("[handleImageGenerationRequest] Hairstyle or haircolor not selected.");
        alert("ヘアスタイルとヘアカラーを選択してください。"); // Use alert for now
        return;
    }

    // Ensure the original front photo URL exists
    const originalImageUrl = AppState.uploadedFileUrls['item-front-photo'];
    if (!originalImageUrl) {
        console.error("[handleImageGenerationRequest] Original front photo URL not found.");
        alert("画像生成に必要な正面写真のURLが見つかりません。");
        return;
    }

    try {
        if (generateBtn) generateBtn.disabled = true; // Disable button during process
        if (generatedImageElement) generatedImageElement.src = loadingPlaceholder; // Show loading placeholder
        changePhase('phase6'); // Go to phase 6 immediately to show loading

        console.log("[handleImageGenerationRequest] Sending request with:", {
            originalImageUrl: originalImageUrl,
            hairstyle: AppState.selectedProposal.hairstyle,
            haircolor: AppState.selectedProposal.haircolor
        });

        // Prepare data for the new Cloud Function
        const requestData = {
            originalImageUrl: originalImageUrl,
            hairstyle: AppState.selectedProposal.hairstyle,
            haircolor: AppState.selectedProposal.haircolor
        };

        // Call the new image generation Cloud Function
        const responseData = await requestImageGeneration(requestData);

        console.log("[handleImageGenerationRequest] Image generation response received:", responseData);

        // Store and display the generated image URL
        AppState.generatedImageUrl = responseData.imageUrl;
        if (generatedImageElement) {
            generatedImageElement.src = AppState.generatedImageUrl;
            generatedImageElement.onerror = () => { // Basic error handling for image loading
                console.error("Failed to load generated image:", AppState.generatedImageUrl);
                generatedImageElement.src = 'https://placehold.co/300x300/fecaca/991b1b?text=Error+Loading';
            };
        } else {
            console.warn("[handleImageGenerationRequest] Generated image element not found.");
        }

    } catch (error) {
        console.error("[handleImageGenerationRequest] Error:", error);
        alert(`画像生成中にエラーが発生しました。\n詳細: ${error.message}`);
        changePhase('phase5'); // Go back to proposal phase on error
        if (generatedImageElement) generatedImageElement.src = 'https://placehold.co/300x300/fecaca/991b1b?text=Generation+Failed'; // Show error placeholder
    } finally {
        // Re-enable button if user goes back to phase 5
         if (generateBtn && document.getElementById('phase5').style.display === 'block') {
            checkProposalSelection(); // Re-check selection state
        }
    }
}


// --- Utility Functions ---
function handleProposalSelection(event) {
    const selectedCard = event.currentTarget;
    const type = selectedCard.dataset.type;
    const key = selectedCard.dataset.key;

    if (!type || !key) return;

    console.log(`[ProposalSelected] Type: ${type}, Key: ${key}`);

    // Deselect other cards of the same type
    document.querySelectorAll(`.proposal-card[data-type="${type}"]`).forEach(card => {
        card.classList.remove('selected');
    });
    // Select the clicked card
    selectedCard.classList.add('selected');
    // Update state
    AppState.selectedProposal[type] = key;
    // Check if button should be enabled
    checkProposalSelection();
}

function checkAllFilesUploaded() {
    const requiredItems = ['item-front-photo', 'item-side-photo', 'item-back-photo', 'item-front-video', 'item-back-video'];
    const allUploaded = requiredItems.every(item => AppState.uploadedFiles[item]);
    const requestBtn = document.getElementById('request-diagnosis-btn');

    if (requestBtn) {
        requestBtn.disabled = !allUploaded;
        requestBtn.classList.toggle('btn-disabled', !allUploaded);
        if (allUploaded) console.log("[checkAllFilesUploaded] All files ready, button enabled.");
    }
}

function checkProposalSelection() {
    const hairstyleSelected = !!AppState.selectedProposal.hairstyle;
    const haircolorSelected = !!AppState.selectedProposal.haircolor;
    const generateBtn = document.getElementById('next-to-generate-btn');

    if (generateBtn) {
        const bothSelected = hairstyleSelected && haircolorSelected;
        generateBtn.disabled = !bothSelected;
        generateBtn.classList.toggle('btn-disabled', !bothSelected);
         if (bothSelected) console.log("[checkProposalSelection] Both selected, button enabled.");
    }
}


// --- Firebase Storage Upload ---
async function uploadFileToStorage(file, itemName) {
    if (!AppState.firebase.storage || !AppState.userProfile.firebaseUid) {
        throw new Error("Firebase Storage or User UID not initialized.");
    }
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `users/${AppState.userProfile.firebaseUid}/${timestamp}_${itemName}_${safeFileName}`;
    const storageRef = AppState.firebase.storage.ref(filePath);

    console.log(`[uploadFileToStorage] Uploading ${itemName} to path: ${filePath}`);

    try {
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log(`[uploadFileToStorage] Upload successful for ${itemName}. URL: ${downloadURL}`);
        return { itemName: itemName, url: downloadURL, path: filePath };
    } catch (error) {
        console.error(`[uploadFileToStorage] Error uploading ${itemName}:`, error);
        throw new Error(`ファイル (${itemName}) のアップロードに失敗しました (Path: ${filePath}): ${error.message}`);
    }
}

// --- Cloud Function Requests ---
async function requestAiDiagnosis(requestData) {
    const functionUrl = '/requestDiagnosis';
    console.log(`[requestAiDiagnosis] Sending request to: ${functionUrl}`);
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        console.log(`[requestAiDiagnosis] Response status: ${response.status}`);
        if (!response.ok) {
            let errorBody = await response.text();
            try {
                 const errorJson = JSON.parse(errorBody);
                 errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Keep as text */ }
            throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        if (!data || !data.result || !data.proposal) {
             throw new Error("Invalid response structure received from diagnosis function.");
        }
        console.log("[requestAiDiagnosis] Request successful.");
        return data;
    } catch (error) {
        console.error("[requestAiDiagnosis] Fetch error:", error);
        throw new Error(`AI診断リクエストの送信に失敗しました。\n詳細: ${error.message}`);
    }
}

async function requestImageGeneration(requestData) {
    const functionUrl = '/generateHairstyleImage'; // New endpoint
    console.log(`[requestImageGeneration] Sending request to: ${functionUrl}`);
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        console.log(`[requestImageGeneration] Response status: ${response.status}`);
        if (!response.ok) {
            let errorBody = await response.text();
            try {
                 const errorJson = JSON.parse(errorBody);
                 errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Keep as text */ }
            throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        if (!data || !data.imageUrl) { // Expecting { message, imageUrl }
             throw new Error("Invalid response structure received from image generation function.");
        }
        console.log("[requestImageGeneration] Request successful.");
        return data;
    } catch (error) {
        console.error("[requestImageGeneration] Fetch error:", error);
        throw new Error(`画像生成リクエストの送信に失敗しました。\n詳細: ${error.message}`);
    }
}


// --- ★★★ Main App Initialization Function (デバッグログ付き) ★★★ ---
async function main() {
    // Log entry point immediately
    console.log("[main] >>> Function execution started.");
    let loadingScreenHidden = false;

    try {
        console.log("[main] Entering try block...");

        // --- Get Firebase Instances ---
        console.log("[main] Getting Firebase Auth instance...");
        const auth = firebase.auth();
        console.log("[main] Getting Firebase Storage instance...");
        const storage = firebase.storage();
        console.log("[main] Getting Firebase Remote Config instance...");
        const remoteConfig = firebase.remoteConfig();
        console.log("[main] Getting Firebase App instance...");
        const app = firebase.app(); // Ensure app instance is available

        AppState.firebase = { app, auth, storage, remoteConfig };
        console.log("[main] Firebase service instances obtained (Compat style).");

        // --- Get Firebase Auth User ---
        console.log("[main] Checking current Firebase user...");
        const currentUser = auth.currentUser;
        if (!currentUser) {
             console.error("[main] Firebase user is null even after onAuthStateChanged!");
             throw new Error("Firebase user is null unexpectedly after Auth ready.");
        }
        AppState.userProfile.firebaseUid = currentUser.uid;
        console.log("[main] Firebase UID:", currentUser.uid);

        // --- Remote Config ---
        console.log("[main] Configuring Remote Config...");
        remoteConfig.settings = { minimumFetchIntervalMillis: 3600000, fetchTimeoutMillis: 10000 };
        remoteConfig.defaultConfig = { 'liff_id': '2008345232-zq4A3Vg3' }; // Ensure correct ID
        console.log("[main] Calling remoteConfig.ensureInitialized()...");
        await remoteConfig.ensureInitialized();
        console.log("[main] remoteConfig.ensureInitialized() completed.");
        console.log("[main] Calling remoteConfig.fetchAndActivate()...");
        const fetched = await remoteConfig.fetchAndActivate();
        console.log("[main] remoteConfig.fetchAndActivate() completed. Fetched:", fetched);

        AppState.liffId = remoteConfig.getString('liff_id');
        if (!AppState.liffId) {
            console.warn("[main] LIFF ID not found in fetched config, using default.");
            AppState.liffId = remoteConfig.defaultConfig['liff_id'];
        }
        if (!AppState.liffId) {
             console.error("[main] LIFF ID is still missing!");
             throw new Error("LIFF ID not found.");
        }
        console.log("[main] Using LIFF ID:", AppState.liffId);

        // --- LIFF Initialization ---
        console.log(`[main] Initializing LIFF with ID: ${AppState.liffId}...`);
        await liff.init({ liffId: AppState.liffId });
        console.log("[main] LIFF initialized successfully.");

        // --- Get LIFF Profile ---
        console.log("[main] Checking LIFF login status...");
        if (liff.isLoggedIn()) {
            console.log("[main] LIFF user logged in. Getting profile...");
            try {
                const profile = await liff.getProfile();
                console.log("[main] LIFF profile obtained:", profile);
                AppState.userProfile = { ...AppState.userProfile, ...profile };
            } catch (profileError) {
                 console.error("[main] Failed to get LIFF profile:", profileError);
                 AppState.userProfile.displayName = "ゲスト (プロファイル取得エラー)";
            }
        } else {
            console.log("[main] LIFF user not logged in.");
            AppState.userProfile.displayName = "ゲスト";
        }
        AppState.userProfile.userId = AppState.userProfile.userId || AppState.userProfile.firebaseUid;
        console.log("[main] Final User Info:", AppState.userProfile);

        // --- Initialize UI ---
        console.log("[main] Calling initializeAppUI()...");
        initializeAppUI();
        console.log("[main] initializeAppUI() finished.");

        // --- Hide Loading Screen ---
        console.log("[main] Attempting to hide loading screen...");
        hideLoadingScreen();
        loadingScreenHidden = true;
        console.log("[main] Loading screen hidden successfully.");

    } catch (err) {
        console.error("[main] Initialization failed inside main try block:", err);
        initializeAppFailure(err.message || '不明な初期化エラーが発生しました。');
    } finally {
        console.log("[main] <<< Function execution finished (finally block).");
        if (!loadingScreenHidden) {
             console.warn("[main] Hiding loading screen in finally block.");
             hideLoadingScreen();
        }
    }
}

