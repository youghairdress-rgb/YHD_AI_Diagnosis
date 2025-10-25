// --- Global App State ---
const AppState = {
    firebase: { app: null, auth: null, storage: null, remoteConfig: null }, // Instances will be populated
    liffId: '',
    userProfile: { displayName: "ゲスト", userId: null, pictureUrl: null, statusMessage: null, firebaseUid: null },
    gender: 'female',
    uploadedFiles: {}, uploadedFileUrls: {},
    selectedProposal: { hairstyle: null, haircolor: null },
    aiDiagnosisResult: null, aiProposal: null, generatedImageUrl: null
};
// window.AppState = AppState; // For debugging (optional)

// --- Helper Functions ---
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        console.log("[hideLoadingScreen] Hiding loading screen now.");
        loadingScreen.style.display = 'none';
    } else if (loadingScreen) {
        // console.log("[hideLoadingScreen] Loading screen already hidden.");
    } else {
        console.warn("[hideLoadingScreen] Loading screen element not found.");
    }
}

// Use the globally defined fallback for displaying errors
function initializeAppFailure(errorMessage) {
    console.error("[initializeAppFailure] Displaying failure message:", errorMessage);
    hideLoadingScreen();
    // Ensure the global fallback exists before calling
    if (window.initializeAppFailureFallback) {
        window.initializeAppFailureFallback(errorMessage);
    } else {
        alert(`アプリケーションエラー:\n${errorMessage}`); // Absolute fallback
    }
}

// Use the globally defined escapeHtml or provide a fallback
const escapeHtml = window.escapeHtml || function(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\//g, "&#x2F;");
};

// --- UI Initialization Function ---
function initializeAppUI() {
    console.log("[initializeAppUI] Function started.");
    try {
        console.log("[initializeAppUI] Initializing UI state.");
        setupEventListeners(); // Setup button clicks etc.
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
    console.log("[setupEventListeners] Setting up event listeners.");
    // --- Phase 1 ---
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const displayNameInput = document.getElementById('display-name');
            if (displayNameInput) { displayNameInput.value = AppState.userProfile.displayName || "ゲスト"; }
            const genderRadio = document.querySelector(`input[name="gender"][value="${AppState.gender}"]`);
            if (genderRadio) genderRadio.checked = true;
            changePhase('phase2');
        });
        console.log("[setupEventListeners] start-btn listener added.");
    } else { console.warn("[setupEventListeners] start-btn not found."); }

    // --- Phase 2 ---
    const nextToUploadBtn = document.getElementById('next-to-upload-btn');
    if (nextToUploadBtn) {
        nextToUploadBtn.addEventListener('click', () => {
            const selectedGender = document.querySelector('input[name="gender"]:checked');
            if (selectedGender) { AppState.gender = selectedGender.value; }
            console.log("[setupEventListeners] Gender selected:", AppState.gender);
            changePhase('phase3');
        });
        console.log("[setupEventListeners] next-to-upload-btn listener added.");
    } else { console.warn("[setupEventListeners] next-to-upload-btn not found."); }

    // --- Phase 3 ---
    document.querySelectorAll('.upload-item').forEach(item => {
        const button = item.querySelector('button');
        const input = item.querySelector('.file-input');
        const itemId = item.id;
        const iconDiv = item.querySelector('.upload-icon');
        if (button && input) {
            button.addEventListener('click', (e) => { if (!button.disabled) input.click(); });
            input.addEventListener('change', (event) => {
                if (event.target.files?.[0]) {
                    const file = event.target.files[0]; AppState.uploadedFiles[itemId] = file;
                    console.log(`[setupEventListeners] File added for ${itemId}: ${file.name}`);
                    button.textContent = '✔️ 撮影済み'; button.classList.remove('btn-outline'); button.classList.add('btn-success'); button.disabled = true;
                    if (iconDiv) { iconDiv.style.backgroundColor = '#d1fae5'; }
                    checkAllFilesUploaded();
                }
            });
        } else { console.warn(`[setupEventListeners] Button or input missing for: ${itemId}`); }
    });
    console.log("[setupEventListeners] Upload item listeners added.");

    const requestDiagnosisBtn = document.getElementById('request-diagnosis-btn');
    if (requestDiagnosisBtn) {
        requestDiagnosisBtn.addEventListener('click', handleDiagnosisRequest);
        console.log("[setupEventListeners] request-diagnosis-btn listener added.");
    } else { console.warn("[setupEventListeners] request-diagnosis-btn not found."); }

    // --- Phase 4 ---
    const nextToProposalBtn = document.getElementById('next-to-proposal-btn');
    if (nextToProposalBtn) {
        nextToProposalBtn.addEventListener('click', () => { changePhase('phase5'); setupProposalCardListeners(); });
        console.log("[setupEventListeners] next-to-proposal-btn listener added.");
    } else { console.warn("[setupEventListeners] next-to-proposal-btn not found."); }

    // --- Phase 5 ---
    const nextToGenerateBtn = document.getElementById('next-to-generate-btn');
    if (nextToGenerateBtn) {
        nextToGenerateBtn.addEventListener('click', () => {
            if (!AppState.selectedProposal.hairstyle || !AppState.selectedProposal.haircolor) { alert("ヘアスタイルとヘアカラーを選択してください。"); return; }
            console.log("Proceeding to image generation with:", AppState.selectedProposal);
            changePhase('phase6'); /* TODO: Add generation call */
        });
        console.log("[setupEventListeners] next-to-generate-btn listener added.");
    } else { console.warn("[setupEventListeners] next-to-generate-btn not found."); }

    // --- Phase 6 ---
     const backToProposalBtn = document.getElementById('back-to-proposal-btn');
     if (backToProposalBtn) {
         backToProposalBtn.addEventListener('click', () => { changePhase('phase5'); });
         console.log("[setupEventListeners] back-to-proposal-btn listener added.");
     } else { console.warn("[setupEventListeners] back-to-proposal-btn not found.");}
}

// --- Other Application Logic Functions ---

function setupProposalCardListeners() { /* ... (Content unchanged from previous version) ... */ }
async function handleDiagnosisRequest() { /* ... (Content unchanged from previous version) ... */ }
function displayDiagnosisResult(result) { /* ... (Content unchanged from previous version) ... */ }
function displayProposalResult(proposal) { /* ... (Content unchanged from previous version) ... */ }
function checkAllFilesUploaded() { /* ... (Content unchanged from previous version) ... */ }
function checkProposalSelection() { /* ... (Content unchanged from previous version) ... */ }
async function uploadFileToStorage(file, itemName) { /* ... (Content unchanged, uses global firebase.storage().ref() ) ... */ }
async function requestAiDiagnosis(fileUrls, profile, gender) { /* ... (Content unchanged) ... */ }


// --- ★★★ Main App Initialization Function (called from index.html) ★★★ ---
async function main() {
    console.log("[main] Function started.");
    let loadingScreenHidden = false;

    try {
        // --- Get Firebase Instances (initialized globally via /__/firebase/init.js) ---
        if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.storage !== 'function' || typeof firebase.remoteConfig !== 'function') {
            throw new Error("Firebase Compat SDK objects not found globally.");
        }
        const auth = firebase.auth();
        const storage = firebase.storage(); // Use compat style
        const remoteConfig = firebase.remoteConfig(); // Use compat style
        AppState.firebase = { app: firebase.app(), auth, storage, remoteConfig }; // Store instances
        console.log("[main] Firebase service instances obtained (Compat style).");

        // --- Get Firebase Auth User ---
        const currentUser = auth.currentUser; // Should be available due to onAuthStateChanged in index.html
        if (!currentUser) { throw new Error("Firebase user is null unexpectedly after Auth ready."); }
        AppState.userProfile.firebaseUid = currentUser.uid;
        console.log("[main] Firebase UID:", currentUser.uid);

        // --- Remote Config ---
        remoteConfig.settings = { minimumFetchIntervalMillis: 3600000, fetchTimeoutMillis: 10000 };
        remoteConfig.defaultConfig = { 'liff_id': '2008345232-zq4A3Vg3' }; // Fallback
        await remoteConfig.ensureInitialized();
        const fetched = await remoteConfig.fetchAndActivate();
        console.log("[main] Remote Config fetched:", fetched);
        AppState.liffId = remoteConfig.getString('liff_id');
        if (!AppState.liffId) { AppState.liffId = remoteConfig.defaultConfig['liff_id']; } // Ensure fallback if getString fails
        if (!AppState.liffId) { throw new Error("LIFF ID not found in Remote Config or fallback."); }
        console.log("[main] Using LIFF ID:", AppState.liffId);

        // --- LIFF Initialization ---
        if (typeof liff === 'undefined') { throw new Error('LIFF SDK object not found.'); } // Should exist now
        console.log(`[main] Initializing LIFF with ID: ${AppState.liffId}...`);
        await liff.init({ liffId: AppState.liffId });
        console.log("[main] LIFF initialized successfully.");

        // --- Get LIFF Profile ---
        if (liff.isLoggedIn()) {
            console.log("[main] LIFF user logged in. Getting profile...");
            try {
                const profile = await liff.getProfile();
                console.log("[main] LIFF profile obtained:", profile);
                // Merge profile, keeping firebaseUid
                AppState.userProfile = { ...AppState.userProfile, ...profile };
            } catch (profileError) {
                 console.error("[main] Failed to get LIFF profile:", profileError);
                 // Proceed as guest even if logged in, but failed to get profile
                 AppState.userProfile.displayName = "ゲスト (プロファイル取得エラー)";
            }
        } else {
            console.log("[main] LIFF user not logged in.");
            AppState.userProfile.displayName = "ゲスト"; // Keep firebaseUid
        }
        // Ensure userId is set for consistency (use LIFF userId if available, otherwise firebaseUid)
        AppState.userProfile.userId = AppState.userProfile.userId || AppState.userProfile.firebaseUid;
        console.log("[main] Final User Info:", AppState.userProfile);

        // --- Initialize UI ---
        console.log("[main] Calling initializeAppUI...");
        initializeAppUI();
        console.log("[main] initializeAppUI finished.");

        console.log("[main] Hiding loading screen...");
        hideLoadingScreen();
        loadingScreenHidden = true;
        console.log("[main] Loading screen hidden successfully.");

    } catch (err) {
        console.error("[main] Initialization failed:", err);
        initializeAppFailure(err.message || '不明なエラーが発生しました。');
    } finally {
        console.log("[main] Initialization process finished.");
        // Ensure loading screen is hidden even if an error occurred after initializeAppUI started
        if (!loadingScreenHidden) {
             console.warn("[main] Hiding loading screen in finally block.");
             hideLoadingScreen();
        }
    }
}

// --- Placeholder/Dummy functions (Keep existing logic where applicable) ---
// function setupProposalCardListeners() { console.log("setupProposalCardListeners called"); }
// async function handleDiagnosisRequest() { console.log("handleDiagnosisRequest called"); }
// function displayDiagnosisResult(result) { console.log("displayDiagnosisResult called with:", result); }
// function displayProposalResult(proposal) { console.log("displayProposalResult called with:", proposal); }
// function checkAllFilesUploaded() { console.log("checkAllFilesUploaded called"); return true; /* or false based on logic */ }
// function checkProposalSelection() { console.log("checkProposalSelection called"); return true; /* or false */ }
// async function uploadFileToStorage(file, itemName) { console.log("uploadFileToStorage called for:", itemName); return { itemName: itemName, url: `https://fake.url/${itemName}`}; } // Dummy upload
// async function requestAiDiagnosis(fileUrls, profile, gender) { console.log("requestAiDiagnosis called"); return { result: { face: { nose: "dummy" }}, proposal: { hairstyles: [], haircolors: [] } }; } // Dummy response

