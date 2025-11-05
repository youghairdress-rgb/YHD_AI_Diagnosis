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
    
    // ★ 修正: 生成画像のURL (Data URL) と、アップロード用のBase64データを保持
    generatedImageUrl: null, // 'data:image/png;base64,....'
    generatedImageDataBase64: null, // '....' (Base64文字列のみ)
    generatedImageMimeType: null, // 'image/png'
};
// window.AppState = AppState; // For debugging

// --- Helper Functions ---
function hideLoadingScreen() {
// ... 既存コード ...
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
        console.log("[hideLoadingScreen] Hiding loading screen.");
        loadingScreen.style.display = 'none';
    } else if (!loadingScreen) {
        console.warn("[hideLoadingScreen] Loading screen element not found.");
    }
}

function initializeAppFailure(errorMessage) {
// ... 既存コード ...
    console.error("[initializeAppFailure] Displaying failure message:", errorMessage);
    hideLoadingScreen();
    if (window.initializeAppFailureFallback) {
        window.initializeAppFailureFallback(errorMessage);
    } else {
        alert(`アプリケーションエラー:\n${errorMessage}`);
    }
}

const escapeHtml = window.escapeHtml || function(unsafe) {
// ... 既存コード ...
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\//g, "&#x2F;");
};

function setTextContent(elementId, text) {
// ... 既存コード ...
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text || '';
    } else {
        console.warn(`[setTextContent] Element with ID "${elementId}" not found.`);
    }
}

// Helper to create diagnosis result items
function createResultItem(label, value) {
// ... 既存コード ...
    const labelDiv = document.createElement('div');
    labelDiv.className = 'result-item-label'; // デフォルトクラス
    labelDiv.textContent = label;
    const valueDiv = document.createElement('div');
    valueDiv.className = 'result-item-value'; // デフォルトクラス
    valueDiv.textContent = escapeHtml(value || 'N/A');
    console.log(`[createResultItem] Created elements:`, labelDiv, valueDiv); // Debug log
    return [labelDiv, valueDiv];
}

// ★★★ 追加: Base64データURLをBlobに変換するヘルパー ★★★
function base64ToBlob(base64, mimeType) {
    console.log(`[base64ToBlob] Converting ${mimeType}`);
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (e) {
        console.error("[base64ToBlob] Error converting base64:", e);
        return null;
    }
}


// --- UI Initialization Function ---
function initializeAppUI() {
// ... 既存コード ...
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
// ... 既存コード ...
    console.log("[setupEventListeners] Setting up...");

    // Phase 1: Start Button
    const startBtn = document.getElementById('start-btn');
// ... 既存コード ...
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
// ... 既存コード ...
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
// ... 既存コード ...
    uploadItems.forEach(item => {
        const button = item.querySelector('button');
        const input = item.querySelector('.file-input');
// ... 既存コード ...
        const itemId = item.id;
        const iconDiv = item.querySelector('.upload-icon');

        if (button && input) {
// ... 既存コード ...
            button.addEventListener('click', (e) => {
                if (!button.disabled) input.click();
            });
            input.addEventListener('change', (event) => {
// ... 既存コード ...
                const file = event.target.files?.[0];
                if (file) {
                    AppState.uploadedFiles[itemId] = file;
// ... 既存コード ...
                    console.log(`[FileSelected] ${itemId}: ${file.name}`);
                    button.textContent = '✔️ 撮影済み';
                    button.classList.remove('btn-outline');
// ... 既存コード ...
                    button.classList.add('btn-success');
                    button.disabled = true;
                    if (iconDiv) iconDiv.classList.add('completed');
// ... 既存コード ...
                    checkAllFilesUploaded();
                }
            });
        } else console.warn(`[setupEventListeners] Button or input missing for: ${itemId}`);
    });

    const requestDiagnosisBtn = document.getElementById('request-diagnosis-btn');
// ... 既存コード ...
    if (requestDiagnosisBtn) {
        requestDiagnosisBtn.addEventListener('click', handleDiagnosisRequest);
    } else console.warn("[setupEventListeners] request-diagnosis-btn not found.");

    // Phase 4: Next Button
    const nextToProposalBtn = document.getElementById('next-to-proposal-btn');
// ... 既存コード ...
    if (nextToProposalBtn) {
        nextToProposalBtn.addEventListener('click', () => {
             displayProposalResult(AppState.aiProposal);
             changePhase('phase5');
        });
    } else console.warn("[setupEventListeners] next-to-proposal-btn not found.");

    // Phase 4 Save Button
    const savePhase4Btn = document.getElementById('save-phase4-btn');
// ... 既存コード ...
    if (savePhase4Btn) {
        savePhase4Btn.addEventListener('click', () => captureAndShareImage('phase4', 'AI診断結果.png'));
    } else console.warn("[setupEventListeners] save-phase4-btn not found.");

    // Phase 5: Generate Button
    const nextToGenerateBtn = document.getElementById('next-to-generate-btn');
// ... 既存コード ...
    if (nextToGenerateBtn) {
        nextToGenerateBtn.addEventListener('click', handleImageGenerationRequest);
    } else console.warn("[setupEventListeners] next-to-generate-btn not found.");

    // Phase 5 Save Button
    const savePhase5Btn = document.getElementById('save-phase5-btn');
// ... 既存コード ...
    if (savePhase5Btn) {
        savePhase5Btn.addEventListener('click', () => captureAndShareImage('phase5', 'AIパーソナル提案.png'));
    } else console.warn("[setupEventListeners] save-phase5-btn not found.");

    // Phase 5 Back Button
    const backToDiagnosisBtn = document.getElementById('back-to-diagnosis-btn');
// ... 既存コード ...
    if (backToDiagnosisBtn) {
        backToDiagnosisBtn.addEventListener('click', () => {
            changePhase('phase4'); // フェーズ4（診断結果）に戻る
        });
    } else console.warn("[setupEventListeners] back-to-diagnosis-btn not found.");

    // Phase 6: Back Button
     const backToProposalBtn = document.getElementById('back-to-proposal-btn');
// ... 既存コード ...
     if (backToProposalBtn) {
         backToProposalBtn.addEventListener('click', () => {
             const input = document.getElementById('refinement-prompt-input');
// ... 既存コード ...
             if (input) input.value = '';
             changePhase('phase5');
         });
     } else console.warn("[setupEventListeners] back-to-proposal-btn not found.");
     
    // Phase 6 Refine Button
    const refineImageBtn = document.getElementById('refine-image-btn');
// ... 既存コード ...
    if (refineImageBtn) {
        refineImageBtn.addEventListener('click', handleImageRefinementRequest);
    } else console.warn("[setupEventListeners] refine-image-btn not found.");
    
    // ★ 修正: Phase 6 全体キャプチャ(共有)ボタン
    const sharePhase6Btn = document.getElementById('share-phase6-btn');
    if (sharePhase6Btn) {
        sharePhase6Btn.addEventListener('click', () => captureAndShareImage('phase6', 'AI合成画像.png'));
    } else console.warn("[setupEventListeners] share-phase6-btn not found.");

    // ★★★ 追加: Phase 6 合成画像「保存」ボタン ★★★
    const saveGeneratedImageBtn = document.getElementById('save-generated-image-to-db-btn');
    if (saveGeneratedImageBtn) {
        saveGeneratedImageBtn.addEventListener('click', handleSaveGeneratedImage);
    } else console.warn("[setupEventListeners] save-generated-image-to-db-btn not found.");

    console.log("[setupEventListeners] Setup complete.");
}


// --- Diagnosis Request and Result Handling ---
async function handleDiagnosisRequest() {
// ... 既存コード ...
    console.log("[handleDiagnosisRequest] Starting diagnosis process.");
    const requestBtn = document.getElementById('request-diagnosis-btn');
// ... 既存コード ...
    const statusTextElement = document.getElementById('diagnosis-status-text');

    const updateStatusText = (text) => {
// ... 既存コード ...
        if (statusTextElement) statusTextElement.textContent = text;
        console.log(`[StatusUpdate] ${text}`);
    };

    try {
// ... 既存コード ...
        if (requestBtn) requestBtn.disabled = true;
        changePhase('phase3.5');
// ... 既存コード ...
        updateStatusText('ファイルをアップロード中... (0/5)');

        const uploadPromises = [];
// ... 既存コード ...
        const fileKeys = Object.keys(AppState.uploadedFiles);
        let uploadedCount = 0;

        fileKeys.forEach(key => {
// ... 既存コード ...
            const file = AppState.uploadedFiles[key];
            const promise = uploadFileToStorage(file, key)
                .then(result => {
// ... 既存コード ...
                    uploadedCount++;
                    updateStatusText(`ファイルをアップロード中... (${uploadedCount}/${fileKeys.length})`);
// ... 既存コード ...
                    AppState.uploadedFileUrls[key] = result.url;
                    return result;
                });
            uploadPromises.push(promise);
        });

        await Promise.all(uploadPromises);
// ... 既存コード ...
        console.log("[handleDiagnosisRequest] All files uploaded:", AppState.uploadedFileUrls);
        updateStatusText('AIに診断をリクエスト中...');

        const requestData = {
// ... 既存コード ...
            fileUrls: AppState.uploadedFileUrls,
            userProfile: {
                 userId: AppState.userProfile.userId,
// ... 既存コード ...
                 displayName: AppState.userProfile.displayName,
                 firebaseUid: AppState.userProfile.firebaseUid
            },
            gender: AppState.gender
        };

        const responseData = await requestAiDiagnosis(requestData);
// ... 既存コード ...
        console.log("[handleDiagnosisRequest] Diagnosis response received:", responseData);

        AppState.aiDiagnosisResult = responseData.result;
// ... 既存コード ...
        AppState.aiProposal = responseData.proposal;

        displayDiagnosisResult(AppState.aiDiagnosisResult);
// ... 既存コード ...
        changePhase('phase4');

    } catch (error) {
// ... 既存コード ...
        console.error("[handleDiagnosisRequest] Error:", error);
        alert(`診断リクエストの処理中にエラーが発生しました。\n詳細: ${error.message}`);
// ... 既存コード ...
        changePhase('phase3'); // Go back on error
        document.querySelectorAll('.upload-item').forEach(item => {
// ... 既存コード ...
            const button = item.querySelector('button');
            const iconDiv = item.querySelector('.upload-icon');
// ... 既存コード ...
            if (button && !AppState.uploadedFileUrls[item.id]) { // Only reset if not successfully uploaded
                button.textContent = '撮影';
// ... 既存コード ...
                button.classList.add('btn-outline');
                button.classList.remove('btn-success');
// ... 既存コード ...
                button.disabled = false;
                if (iconDiv) iconDiv.classList.remove('completed');
// ... 既存コード ...
                delete AppState.uploadedFiles[item.id]; // Clear file from state
            }
        });
        checkAllFilesUploaded(); // Re-check button state

    } finally {
// ... 既存コード ...
        // Re-enable diagnosis button only if user is back on phase 3
        const currentPhase3 = document.getElementById('phase3');
        if (requestBtn && currentPhase3 && currentPhase3.style.display === 'block') {
// ... 既存コード ...
             checkAllFilesUploaded();
        }
    }
}

// Function to display diagnosis results in Phase 4
function displayDiagnosisResult(result) {
// ... 既存コード ...
    console.log("[displayDiagnosisResult] Displaying diagnosis:", result); // Debug log
    const faceResultsContainer = document.getElementById('face-results');
// ... 既存コード ...
    const skeletonResultsContainer = document.getElementById('skeleton-results');
    const personalColorResultsContainer = document.getElementById('personal-color-results');

    // Clear previous results
// ... 既存コード ...
    if (faceResultsContainer) faceResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] faceResultsContainer not found");
    if (skeletonResultsContainer) skeletonResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] skeletonResultsContainer not found");
// ... 既存コード ...
    if (personalColorResultsContainer) personalColorResultsContainer.innerHTML = ''; else console.warn("[displayDiagnosisResult] personalColorResultsContainer not found");

    if (!result) {
// ... 既存コード ...
        console.warn("[displayDiagnosisResult] No result data to display.");
        return;
    }

    // Populate Face Results
// ... 既存コード ...
    if (result.face && faceResultsContainer) {
        console.log("[displayDiagnosisResult] Populating face results...");
// ... 既存コード ...
        const faceMap = { nose: "鼻", mouth: "口", eyes: "目", eyebrows: "眉", forehead: "おでこ" };
        Object.entries(result.face).forEach(([key, value]) => {
            const items = createResultItem(faceMap[key] || key, value);
// ... 既存コード ...
            console.log(`[displayDiagnosisResult] Appending face item for ${key}:`, items); // Debug log
            faceResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Face results container after append:", faceResultsContainer.innerHTML); // Debug log
    } else {
        console.log("[displayDiagnosisResult] No face data or container not found."); // Debug log
    }

    // Populate Skeleton Results
    if (result.skeleton && skeletonResultsContainer) {
// ... 既存コード ...
        console.log("[displayDiagnosisResult] Populating skeleton results...");
        const skeletonMap = { neckLength: "首の長さ", faceShape: "顔の形", bodyLine: "ボディライン", shoulderLine: "肩のライン" };
// ... 既存コード ...
        Object.entries(result.skeleton).forEach(([key, value]) => {
            const items = createResultItem(skeletonMap[key] || key, value);
// ... 既存コード ...
            console.log(`[displayDiagnosisResult] Appending skeleton item for ${key}:`, items); // Debug log
            skeletonResultsContainer.append(...items);
        });
        console.log("[displayDiagnosisResult] Skeleton results container after append:", skeletonResultsContainer.innerHTML); // Debug log
    } else {
         console.log("[displayDiagnosisResult] No skeleton data or container not found."); // Debug log
    }

    // Populate Personal Color Results
    if (result.personalColor && personalColorResultsContainer) {
// ... 既存コード ...
         console.log("[displayDiagnosisResult] Populating personal color results...");
         const colorMap = { baseColor: "ベースカラー", season: "シーズン", brightness: "明度", saturation: "彩度", eyeColor: "瞳の色" };
// ... 既存コード ...
         Object.entries(result.personalColor).forEach(([key, value]) => {
             const items = createResultItem(colorMap[key] || key, value);
// ... 既存コード ...
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
// ... 既存コード ...
    console.log("[displayProposalResult] Displaying proposal:", proposal); // Debug log
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
// ... 既存コード ...
    const haircolorContainer = document.getElementById('haircolor-proposal');
    const bestColorsContainer = document.getElementById('best-colors-proposal');
// ... 既存コード ...
    const makeupContainer = document.getElementById('makeup-proposal');

    // Clear previous proposals
    if (hairstyleContainer) hairstyleContainer.innerHTML = ''; else console.warn("[displayProposalResult] hairstyleContainer not found");
// ... 既存コード ...
    if (haircolorContainer) haircolorContainer.innerHTML = ''; else console.warn("[displayProposalResult] haircolorContainer not found");
    if (bestColorsContainer) bestColorsContainer.innerHTML = ''; else console.warn("[displayProposalResult] bestColorsContainer not found");
// ... 既存コード ...
    if (makeupContainer) makeupContainer.innerHTML = ''; else console.warn("[displayProposalResult] makeupContainer not found");
    setTextContent('top-stylist-comment-text', '');
// ... 既存コード ...
    AppState.selectedProposal = { hairstyle: null, haircolor: null };
    checkProposalSelection(); // Disable button

    if (!proposal) {
// ... 既存コード ...
        console.warn("[displayProposalResult] No proposal data to display.");
        return;
    }

    // Populate Hairstyles
// ... 既存コード ...
    if (proposal.hairstyles && hairstyleContainer) {
        console.log("[displayProposalResult] Populating hairstyles...");
// ... 既存コード ...
        Object.entries(proposal.hairstyles).forEach(([key, style]) => {
            const card = document.createElement('div');
// ... 既存コード ...
            card.className = 'proposal-card';
            card.dataset.type = 'hairstyle';
// ... 既存コード ...
            card.dataset.key = key;
            const cardHTML = `<strong>${escapeHtml(style.name)}</strong><p>${escapeHtml(style.description)}</p>`;
// ... 既存コード ...
            console.log(`[displayProposalResult] Hairstyle card HTML for ${key}:`, cardHTML); // Debug log
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
// ... 既存コード ...
            hairstyleContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended hairstyle card for ${key}`); // Debug log
        });
         console.log("[displayProposalResult] Hairstyle container after append:", hairstyleContainer.innerHTML); // Debug log
    } else {
         console.log("[displayProposalResult] No hairstyle data or container not found."); // Debug log
    }

    // Populate Haircolors
    if (proposal.haircolors && haircolorContainer) {
// ... 既存コード ...
        console.log("[displayProposalResult] Populating haircolors...");
        Object.entries(proposal.haircolors).forEach(([key, color]) => {
// ... 既存コード ...
            const card = document.createElement('div');
            card.className = 'proposal-card';
// ... 既存コード ...
            card.dataset.type = 'haircolor';
            card.dataset.key = key;
// ... 既存コード ...
            const cardHTML = `<strong>${escapeHtml(color.name)}</strong><p>${escapeHtml(color.description)}</p>`;
            console.log(`[displayProposalResult] Haircolor card HTML for ${key}:`, cardHTML); // Debug log
// ... 既存コード ...
            card.innerHTML = cardHTML;
            card.addEventListener('click', handleProposalSelection);
// ... 既存コード ...
            haircolorContainer.appendChild(card);
            console.log(`[displayProposalResult] Appended haircolor card for ${key}`); // Debug log
        });
        console.log("[displayProposalResult] Haircolor container after append:", haircolorContainer.innerHTML); // Debug log
    } else {
        console.log("[displayProposalResult] No haircolor data or container not found."); // Debug log
    }

    // Populate Best Colors
    if (proposal.bestColors && bestColorsContainer) {
// ... 既存コード ...
        console.log("[displayProposalResult] Populating best colors...");
        Object.values(proposal.bestColors).forEach(color => {
// ... 既存コード ...
            if (!color || !color.name || !color.hex) {
                 console.warn("[displayProposalResult] Invalid bestColor item:", color);
// ... 既存コード ...
                 return; // スキップ
            }
            const item = document.createElement('div');
// ... 既存コード ...
            item.className = 'color-swatch-item';
            
            const circle = document.createElement('div');
// ... 既存コード ...
            circle.className = 'color-swatch-circle';
            // HEXコードを検証（簡易的）
            circle.style.backgroundColor = color.hex.match(/^#[0-9a-fA-F]{6}$/) ? color.hex : '#ccc';
            
            const name = document.createElement('span');
// ... 既存コード ...
            name.className = 'color-swatch-name';
            name.textContent = escapeHtml(color.name);
            
            item.appendChild(circle);
// ... 既存コード ...
            item.appendChild(name);
            bestColorsContainer.appendChild(item);
        });
         console.log("[displayProposalResult] Best colors container after append:", bestColorsContainer.innerHTML);
    } else {
         console.log("[displayProposalResult] No bestColors data or container not found.");
    }

    // Populate Makeup
    if (proposal.makeup && makeupContainer) {
// ... 既存コード ...
        console.log("[displayProposalResult] Populating makeup...");
        const makeupMap = { eyeshadow: "アイシャドウ", cheek: "チーク", lip: "リップ" };
// ... 既存コード ...
        Object.entries(proposal.makeup).forEach(([key, value]) => {
            const items = createResultItem(makeupMap[key] || key, value); 
// ... 既存コード ...
            items[0].className = 'makeup-item-label'; 
            items[1].className = 'makeup-item-value';
            makeupContainer.append(...items);
        });
         console.log("[displayProposalResult] Makeup container after append:", makeupContainer.innerHTML);
    } else {
         console.log("[displayProposalResult] No makeup data or container not found.");
    }

    // Display Comment
    if (proposal.comment) {
// ... 既存コード ...
         console.log("[displayProposalResult] Setting comment text."); // Debug log
         setTextContent('top-stylist-comment-text', proposal.comment);
    } else {
         console.log("[displayProposalResult] No comment data found."); // Debug log
    }
     console.log("[displayProposalResult] Finished displaying proposals."); // Debug log
}


// --- Image Generation Request Handler ---
async function handleImageGenerationRequest() {
// ... 既存コード ...
    console.log("[handleImageGenerationRequest] Starting image generation process.");
    const generateBtn = document.getElementById('next-to-generate-btn');
// ... 既存コード ...
    const generatedImageElement = document.getElementById('generated-image');
    const refinementSpinner = document.getElementById('refinement-spinner');
    
    // ★★★ 追加: 保存ボタンをリセット ★★★
    const saveBtn = document.getElementById('save-generated-image-to-db-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'この合成画像を保存する';
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-primary');
    }

    // Ensure selections are made
    if (!AppState.selectedProposal.hairstyle || !AppState.selectedProposal.haircolor) {
// ... 既存コード ...
        console.warn("[handleImageGenerationRequest] Hairstyle or haircolor not selected.");
        alert("ヘアスタイルとヘアカラーを選択してください。"); // Use alert for now
        return;
    }

    // Ensure the original front photo URL exists
    const originalImageUrl = AppState.uploadedFileUrls['item-front-photo'];
// ... 既存コード ...
    if (!originalImageUrl) {
        console.error("[handleImageGenerationRequest] Original front photo URL not found.");
        alert("画像生成に必要な正面写真のURLが見つかりません。");
        return;
    }

    const selectedHairstyleKey = AppState.selectedProposal.hairstyle;
// ... 既存コード ...
    const selectedHaircolorKey = AppState.selectedProposal.haircolor;
    
    const hairstyle = AppState.aiProposal?.hairstyles?.[selectedHairstyleKey];
// ... 既存コード ...
    const haircolor = AppState.aiProposal?.haircolors?.[selectedHaircolorKey];

    if (!hairstyle || !haircolor) {
// ... 既存コード ...
         console.error("[handleImageGenerationRequest] Failed to retrieve proposal details from AppState.");
         alert("選択された提案の詳細の取得に失敗しました。");
         return;
    }

    try {
// ... 既存コード ...
        if (generateBtn) generateBtn.disabled = true; // Disable button during process
        if (generatedImageElement) {
            generatedImageElement.style.opacity = '0.5'; // ★ 修正: 画像を半透明に
        }
        if (refinementSpinner) refinementSpinner.style.display = 'block'; // ★ 修正: スピナー表示
        
        changePhase('phase6'); // Go to phase 6 immediately to show loading

        console.log("[handleImageGenerationRequest] Sending request with:", {
// ... 既存コード ...
            originalImageUrl: originalImageUrl,
            hairstyleName: hairstyle.name,
// ... 既存コード ...
            haircolorName: haircolor.name,
        });

        const requestData = {
// ... 既存コード ...
            originalImageUrl: originalImageUrl,
            firebaseUid: AppState.userProfile.firebaseUid, // ユーザー識別のためにUIDを送信
            hairstyleName: hairstyle.name,
// ... 既存コード ...
            hairstyleDesc: hairstyle.description,
            haircolorName: haircolor.name,
// ... 既存コード ...
            haircolorDesc: haircolor.description,
        };

        // ★ 修正: Cloud Function (requestImageGeneration) を呼び出す
        const responseData = await requestImageGeneration(requestData);

        console.log("[handleImageGenerationRequest] Image generation response received:", responseData);

        // ★ 修正: レスポンスからBase64とMIMEタイプを抽出し、Data URLを作成
        const { imageBase64, mimeType } = responseData;
        if (!imageBase64 || !mimeType) {
            throw new Error("Invalid response from generation function: missing imageBase64 or mimeType.");
        }
        
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;

        // ★ 修正: AppState に Base64データと Data URL の両方を保存
        AppState.generatedImageDataBase64 = imageBase64;
        AppState.generatedImageMimeType = mimeType;
        AppState.generatedImageUrl = dataUrl; // Data URLを保存

        if (generatedImageElement) {
            generatedImageElement.src = AppState.generatedImageUrl; // Data URL を img の src に設定
            generatedImageElement.onerror = () => { // Basic error handling for image loading
// ... 既存コード ...
                console.error("Failed to load generated image:", AppState.generatedImageUrl.substring(0, 50) + "...");
                generatedImageElement.src = 'https://placehold.co/300x300/fecaca/991b1b?text=Error+Loading';
            };
        } else {
            console.warn("[handleImageGenerationRequest] Generated image element not found.");
        }

    } catch (error) {
// ... 既存コード ...
        console.error("[handleImageGenerationRequest] Error:", error);
        alert(`画像生成中にエラーが発生しました。\n詳細: ${error.message}`);
// ... 既存コード ...
        changePhase('phase5'); // Go back to proposal phase on error
        if (generatedImageElement) generatedImageElement.src = 'https://placehold.co/300x300/fecaca/991b1b?text=Generation+Failed'; // Show error placeholder
    } finally {
// ... 既存コード ...
        // ★ 修正: スピナーを非表示、画像を元に戻す
        if (refinementSpinner) refinementSpinner.style.display = 'none';
        if (generatedImageElement) generatedImageElement.style.opacity = '1';
        
        // Re-enable button if user goes back to phase 5
         if (generateBtn && document.getElementById('phase5').style.display === 'block') {
            checkProposalSelection(); // Re-check selection state
        }
    }
}

// ★ 修正: 画像微調整リクエストハンドラ ★
async function handleImageRefinementRequest() {
// ... 既存コード ...
    console.log("[handleImageRefinementRequest] Starting image refinement process.");
    const refineBtn = document.getElementById('refine-image-btn');
// ... 既存コード ...
    const input = document.getElementById('refinement-prompt-input');
    const generatedImageElement = document.getElementById('generated-image');
// ... 既存コード ...
    const refinementSpinner = document.getElementById('refinement-spinner');
    
    // ★★★ 追加: 保存ボタンをリセット ★★★
    const saveBtn = document.getElementById('save-generated-image-to-db-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'この合成画像を保存する';
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-primary');
    }

    const refinementText = input.value;

    // 1. 入力チェック
// ... 既存コード ...
    if (!refinementText || refinementText.trim() === '') {
        alert("微調整したい内容を入力してください。（例：もう少し明るく）");
// ... 既存コード ...
        return;
    }
    // 2. 現在の画像URLチェック (Data URL)
    if (!AppState.generatedImageUrl || !AppState.generatedImageUrl.startsWith('data:image')) {
        alert("微調整の元になる画像データが見つかりません。");
// ... 既存コード ...
        return;
    }
    // 3. ユーザーUIDチェック
// ... 既存コード ...
    if (!AppState.userProfile.firebaseUid) {
        alert("ユーザー情報が取得できていません。");
// ... 既存コード ...
        return;
    }

    try {
// ... 既存コード ...
        // 4. ローディング表示
        if (refineBtn) {
// ... 既存コード ...
            refineBtn.disabled = true;
            refineBtn.textContent = '修正中...';
        }
        if (generatedImageElement) generatedImageElement.style.opacity = '0.5';
// ... 既存コード ...
        if (refinementSpinner) refinementSpinner.style.display = 'block';

        // 5. リクエストデータ準備
        const requestData = {
            generatedImageUrl: AppState.generatedImageUrl, // ★重要: 現在の Data URL を送る
            firebaseUid: AppState.userProfile.firebaseUid,
            refinementText: refinementText
        };
        
        console.log("[handleImageRefinementRequest] Sending request:", requestData);

        // 6. 新しいCloud Function (requestRefinement) を呼び出す
        const responseData = await requestRefinement(requestData);
        
        console.log("[handleImageRefinementRequest] Refinement response received:", responseData);

        // ★ 修正: レスポンスからBase64とMIMEタイプを抽出し、Data URLを作成
        const { imageBase64, mimeType } = responseData;
        if (!imageBase64 || !mimeType) {
            throw new Error("Invalid response from refinement function: missing imageBase64 or mimeType.");
        }
        
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;

        // ★ 修正: AppState に Base64データと Data URL の両方を保存
        AppState.generatedImageDataBase64 = imageBase64;
        AppState.generatedImageMimeType = mimeType;
        AppState.generatedImageUrl = dataUrl; // Data URLを保存
        
        // 8. 画像を新しいものに差し替える
        if (generatedImageElement) {
            generatedImageElement.src = AppState.generatedImageUrl; // 新しい Data URL を設定
        }
        if (input) input.value = ''; // 入力欄をクリア

    } catch (error) {
// ... 既存コード ...
        console.error("[handleImageRefinementRequest] Error:", error);
        alert(`画像の修正に失敗しました。\n詳細: ${error.message}`);
    } finally {
// ... 既存コード ...
        // 9. ローディング解除
        if (refineBtn) {
// ... 既存コード ...
            refineBtn.disabled = false;
            refineBtn.textContent = '変更を反映する';
        }
        if (generatedImageElement) generatedImageElement.style.opacity = '1';
// ... 既存コード ...
        if (refinementSpinner) refinementSpinner.style.display = 'none';
    }
}

// ★★★ 追加: 生成された合成画像（お気に入り）をStorageに保存する ★★★
async function handleSaveGeneratedImage() {
    console.log("[handleSaveGeneratedImage] Attempting to save generated image to DB.");
    const saveBtn = document.getElementById('save-generated-image-to-db-btn');

    // 1. 必要なデータ（Base64, MimeType, UID）があるかチェック
    if (!AppState.generatedImageDataBase64 || !AppState.generatedImageMimeType) {
        console.error("[handleSaveGeneratedImage] No image data (Base64/MimeType) in AppState.");
        alert("保存対象の画像データが見つかりません。");
        return;
    }
    if (!AppState.userProfile.firebaseUid) {
        alert("ユーザー情報が取得できていません。");
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
        }

        // 2. Base64をBlobに変換
        const imageBlob = base64ToBlob(AppState.generatedImageDataBase64, AppState.generatedImageMimeType);
        if (!imageBlob) {
            throw new Error("Failed to convert Base64 to Blob.");
        }
        
        const fileExtension = AppState.generatedImageMimeType.split('/')[1] || 'png';
        const fileName = `favorite_generated.${fileExtension}`;

        // 3. BlobをFileオブジェクトに変換（uploadFileToStorageがFileを期待するため）
        const imageFile = new File([imageBlob], fileName, { type: AppState.generatedImageMimeType });

        // 4. Firebase Storageにアップロード
        console.log("[handleSaveGeneratedImage] Uploading favorite image to Storage...");
        const uploadResult = await uploadFileToStorage(imageFile, `favorite_generated_${Date.now()}`);
        
        console.log("[handleSaveGeneratedImage] Upload successful:", uploadResult.url);

        // 5. 成功表示
        if (saveBtn) {
            saveBtn.textContent = '✔️ 保存済み';
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-success');
            // 'disabled' は外しておく（再度保存できるようにするか、設計による）
            // saveBtn.disabled = true; // 再度押せないようにする場合
        }

        alert("お気に入りの画像を保存しました！");

    } catch (error) {
        console.error("[handleSaveGeneratedImage] Error saving image:", error);
        alert(`画像の保存に失敗しました: ${error.message}`);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'この合成画像を保存する';
        }
    }
}


// --- 画像キャプチャ＆共有（保存）機能 ---

/**
// ... 既存コード ...
 * ローディングテキストを更新するヘルパー
 * @param {HTMLElement} element ローディング表示用のDOM要素
 * @param {string} text 表示するテキスト
 */
function updateCaptureLoadingText(element, text) {
// ... 既存コード ...
    if (element) element.textContent = text;
    console.log(`[CaptureStatus] ${text}`);
}

/**
// ... 既存コード ...
 * 指定された要素をキャプチャし、LINEで共有（保存）する
 * @param {string} phaseId キャプチャ対象のフェーズID (例: 'phase4')
 * @param {string} fileName 提案されるファイル名
 */
async function captureAndShareImage(phaseId, fileName) {
// ... 既存コード ...
    // 1. 必要な機能のチェック
    if (typeof html2canvas === 'undefined') {
// ... 既存コード ...
        console.error("html2canvas library is not loaded.");
        alert("画像保存機能の読み込みに失敗しました。");
// ... 既存コード ...
        return;
    }
    if (!liff.isApiAvailable('shareTargetPicker')) {
// ... 既存コード ...
         alert("LINEの共有機能（画像保存）が利用できません。");
         return;
    }
    if (!AppState.firebase.storage || !AppState.userProfile.firebaseUid) {
// ... 既存コード ...
        alert("画像保存機能を利用するには、Firebaseへの接続が必要です。");
        return;
    }

    // 2. 対象要素の取得
// ... 既存コード ...
    const targetElement = document.getElementById(phaseId)?.querySelector('.card');
    if (!targetElement) {
// ... 既存コード ...
        console.error(`Target element not found for capturing: ${phaseId} .card`);
        alert("キャプチャ対象の要素が見つかりません。");
// ... 既存コード ...
        return;
    }

    // 3. ローディング表示とボタン非表示
// ... 既存コード ...
    const buttonsToHide = targetElement.querySelectorAll('.no-print');
    buttonsToHide.forEach(btn => btn.style.visibility = 'hidden'); // display:none だとレイアウトが崩れるため visibility を使用

    const loadingText = document.createElement('p');
// ... 既存コード ...
    loadingText.textContent = '画像を生成中...';
    loadingText.className = 'capture-loading-text no-print'; // 自身もキャプチャ対象外にする
// ... 既存コード ...
    targetElement.appendChild(loadingText);

    try {
// ... 既存コード ...
        // 4. html2canvasの実行
        const canvas = await html2canvas(targetElement, {
            scale: 2, // 高解像度でキャプチャ
// ... 既存コード ...
            useCORS: true, // 外部画像（アイコン）が含まれる場合は必須
            onclone: (clonedDoc) => {
// ... 既存コード ...
                // クローンされたDOMで非表示を確実にする
                const clonedTarget = clonedDoc.getElementById(phaseId)?.querySelector('.card');
                if (clonedTarget) {
// ... 既存コード ...
                    clonedTarget.querySelectorAll('.no-print').forEach(btn => btn.style.visibility = 'hidden');
                }
            }
        });

        // 5. CanvasをBlobに変換
// ... 既存コード ...
        updateCaptureLoadingText(loadingText, '画像をアップロード中...');
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        // 6. BlobをFileオブジェクトに変換
// ... 既存コード ...
        const generatedFile = new File([blob], fileName, { type: 'image/png' });

        // 7. Firebase Storageにアップロード (uploadFileToStorageを流用)
// ... 既存コード ...
        // uploadFileToStorage は { url: '...' } を返す
        const uploadResult = await uploadFileToStorage(generatedFile, `capture_${phaseId}`);
// ... 既存コード ...
        const generatedUrl = uploadResult.url;

        if (!generatedUrl) {
// ... 既存コード ...
            throw new Error("Storageへのアップロード後、URLの取得に失敗しました。");
        }

        // 8. LIFFのshareTargetPickerで画像を送信（これが実質的な保存になる）
// ... 既存コード ...
        updateCaptureLoadingText(loadingText, 'LINEで共有（保存）...');
        await liff.shareTargetPicker([
// ... 既存コード ...
            {
                type: 'image',
// ... 既存コード ...
                originalContentUrl: generatedUrl, // StorageのURL
                previewImageUrl: generatedUrl     // StorageのURL
            }
        ], {
             isMultiple: false // 単一のターゲット（例：「自分」や「Keep」）
        });

    } catch (error) {
// ... 既存コード ...
        console.error("Error capturing or sharing image:", error);
        alert(`画像の保存に失敗しました: ${error.message}`);
    } finally {
// ... 既存コード ...
        // 9. ボタンとローディング表示を元に戻す
        buttonsToHide.forEach(btn => btn.style.visibility = 'visible');
        if (loadingText.parentNode === targetElement) {
// ... 既存コード ...
             targetElement.removeChild(loadingText);
        }
    }
}


// --- Utility Functions ---
function handleProposalSelection(event) {
// ... 既存コード ...
    const selectedCard = event.currentTarget;
    const type = selectedCard.dataset.type;
// ... 既存コード ...
    const key = selectedCard.dataset.key;

    if (!type || !key) return;

    console.log(`[ProposalSelected] Type: ${type}, Key: ${key}`);

    // Deselect other cards of the same type
// ... 既存コード ...
    document.querySelectorAll(`.proposal-card[data-type="${type}"]`).forEach(card => {
        card.classList.remove('selected');
    });
    // Select the clicked card
// ... 既存コード ...
    selectedCard.classList.add('selected');
    // Update state
// ... 既存コード ...
    AppState.selectedProposal[type] = key;
    // Check if button should be enabled
    checkProposalSelection();
}

function checkAllFilesUploaded() {
// ... 既存コード ...
    const requiredItems = ['item-front-photo', 'item-side-photo', 'item-back-photo', 'item-front-video', 'item-back-video'];
    const allUploaded = requiredItems.every(item => AppState.uploadedFiles[item]);
// ... 既存コード ...
    const requestBtn = document.getElementById('request-diagnosis-btn');

    if (requestBtn) {
// ... 既存コード ...
        requestBtn.disabled = !allUploaded;
        requestBtn.classList.toggle('btn-disabled', !allUploaded);
// ... 既存コード ...
        if (allUploaded) console.log("[checkAllFilesUploaded] All files ready, button enabled.");
    }
}

function checkProposalSelection() {
// ... 既存コード ...
    const hairstyleSelected = !!AppState.selectedProposal.hairstyle;
    const haircolorSelected = !!AppState.selectedProposal.haircolor;
// ... 既存コード ...
    const generateBtn = document.getElementById('next-to-generate-btn');

    if (generateBtn) {
// ... 既存コード ...
        const bothSelected = hairstyleSelected && haircolorSelected;
        generateBtn.disabled = !bothSelected;
// ... 既存コード ...
        generateBtn.classList.toggle('btn-disabled', !bothSelected);
         if (bothSelected) console.log("[checkProposalSelection] Both selected, button enabled.");
    }
}


// --- Firebase Storage Upload ---
async function uploadFileToStorage(file, itemName) {
// ... 既存コード ...
    if (!AppState.firebase.storage || !AppState.userProfile.firebaseUid) {
        throw new Error("Firebase Storage or User UID not initialized.");
    }
    const timestamp = Date.now();
// ... 既存コード ...
    const safeFileName = (file.name || 'generated_image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `users/${AppState.userProfile.firebaseUid}/${timestamp}_${itemName}_${safeFileName}`;
// ... 既存コード ...
    const storageRef = AppState.firebase.storage.ref(filePath);

    console.log(`[uploadFileToStorage] Uploading ${itemName} to path: ${filePath}`);

    try {
        const snapshot = await storageRef.put(file);
// ... 既存コード ...
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log(`[uploadFileToStorage] Upload successful for ${itemName}. URL: ${downloadURL}`);
// ... 既存コード ...
        return { itemName: itemName, url: downloadURL, path: filePath };
    } catch (error) {
        console.error(`[uploadFileToStorage] Error uploading ${itemName}:`, error);
// ... 既存コード ...
        throw new Error(`ファイル (${itemName}) のアップロードに失敗しました (Path: ${filePath}): ${error.message}`);
    }
}

// --- Cloud Function Requests ---
async function requestAiDiagnosis(requestData) {
// ... 既存コード ...
    const functionUrl = '/requestDiagnosis';
    console.log(`[requestAiDiagnosis] Sending request to: ${functionUrl}`);
// ... 既存コード ...
    try {
        const response = await fetch(functionUrl, {
// ... 既存コード ...
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
// ... 既存コード ...
            body: JSON.stringify(requestData)
        });
        console.log(`[requestAiDiagnosis] Response status: ${response.status}`);
// ... 既存コード ...
        if (!response.ok) {
            let errorBody = await response.text();
// ... 既存コード ...
            try {
                 const errorJson = JSON.parse(errorBody);
// ... 既存コード ...
                 errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Keep as text */ }
            throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
// ... 既存コード ...
        if (!data || !data.result || !data.proposal || !data.proposal.bestColors || !data.proposal.makeup) {
             throw new Error("Invalid response structure received from diagnosis function (missing keys).");
        }
        console.log("[requestAiDiagnosis] Request successful.");
// ... 既存コード ...
        return data;
    } catch (error) {
        console.error("[requestAiDiagnosis] Fetch error:", error);
// ... 既存コード ...
        throw new Error(`AI診断リクエストの送信に失敗しました。\n詳細: ${error.message}`);
    }
}

// ★ 修正: 戻り値が Base64 になります
async function requestImageGeneration(requestData) {
    const functionUrl = '/generateHairstyleImage';
// ... 既存コード ...
    console.log(`[requestImageGeneration] Sending request to: ${functionUrl}`);
    try {
        const response = await fetch(functionUrl, {
// ... 既存コード ...
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
// ... 既存コード ...
            body: JSON.stringify(requestData)
        });
        console.log(`[requestImageGeneration] Response status: ${response.status}`);
// ... 既存コード ...
        if (!response.ok) {
            let errorBody = await response.text();
// ... 既存コード ...
            try {
                 const errorJson = JSON.parse(errorBody);
// ... 既存コード ...
                 errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Keep as text */ }
            throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        // ★ 修正: imageBase64 と mimeType を期待
        if (!data || !data.imageBase64 || !data.mimeType) {
             throw new Error("Invalid response structure received from image generation function.");
        }
        console.log("[requestImageGeneration] Request successful.");
// ... 既存コード ...
        return data;
    } catch (error) {
        console.error("[requestImageGeneration] Fetch error:", error);
// ... 既存コード ...
        throw new Error(`画像生成リクエストの送信に失敗しました。\n詳細: ${error.message}`);
    }
}

// ★ 修正: 戻り値が Base64 になります
async function requestRefinement(requestData) {
    const functionUrl = '/refineHairstyleImage'; // 新しいエンドポイント
// ... 既存コード ...
    console.log(`[requestRefinement] Sending request to: ${functionUrl}`);
    try {
        const response = await fetch(functionUrl, {
// ... 既存コード ...
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
// ... 既存コード ...
            body: JSON.stringify(requestData)
        });
        console.log(`[requestRefinement] Response status: ${response.status}`);
// ... 既存コード ...
        if (!response.ok) {
            let errorBody = await response.text();
// ... 既存コード ...
            try {
                 const errorJson = JSON.parse(errorBody);
// ... 既存コード ...
                 errorBody = errorJson.message || errorJson.error || JSON.stringify(errorJson);
            } catch (e) { /* Keep as text */ }
            throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
         // ★ 修正: imageBase64 と mimeType を期待
         if (!data || !data.imageBase64 || !data.mimeType) {
             throw new Error("Invalid response structure received from image refinement function.");
        }
        console.log("[requestRefinement] Request successful.");
// ... 既存コード ...
        return data;
    } catch (error) {
        console.error("[requestRefinement] Fetch error:", error);
// ... 既存コード ...
        throw new Error(`画像修正リクエストの送信に失敗しました。\n詳細: ${error.message}`);
    }
}


// --- ★★★ Main App Initialization Function (デバッグログ付き) ★★★ ---
async function main() {
// ... 既存コード ...
    // Log entry point immediately
    console.log("[main] >>> Function execution started.");
// ... 既存コード ...
    let loadingScreenHidden = false;

    try {
// ... 既存コード ...
        console.log("[main] Entering try block...");

        // --- Get Firebase Instances ---
// ... 既存コード ...
        console.log("[main] Getting Firebase Auth instance...");
        const auth = firebase.auth();
// ... 既存コード ...
        console.log("[main] Getting Firebase Storage instance...");
        const storage = firebase.storage();
// ... 既存コード ...
        console.log("[main] Getting Firebase Remote Config instance...");
        const remoteConfig = firebase.remoteConfig();
// ... 既存コード ...
        console.log("[main] Getting Firebase App instance...");
        const app = firebase.app(); // Ensure app instance is available

        AppState.firebase = { app, auth, storage, remoteConfig };
// ... 既存コード ...
        console.log("[main] Firebase service instances obtained (Compat style).");

        // --- Get Firebase Auth User ---
// ... 既存コード ...
        console.log("[main] Checking current Firebase user...");
        const currentUser = auth.currentUser;
// ... 既存コード ...
        if (!currentUser) {
             console.error("[main] Firebase user is null even after onAuthStateChanged!");
// ... 既存コード ...
             throw new Error("Firebase user is null unexpectedly after Auth ready.");
        }
        AppState.userProfile.firebaseUid = currentUser.uid;
// ... 既存コード ...
        console.log("[main] Firebase UID:", currentUser.uid);

        // --- Remote Config ---
// ... 既存コード ...
        console.log("[main] Configuring Remote Config...");
        remoteConfig.settings = { minimumFetchIntervalMillis: 3600000, fetchTimeoutMillis: 10000 };
// ... 既存コード ...
        remoteConfig.defaultConfig = { 'liff_id': '2008345232-zq4A3Vg3' }; // Ensure correct ID
        console.log("[main] Calling remoteConfig.ensureInitialized()...");
// ... 既存コード ...
        await remoteConfig.ensureInitialized();
        console.log("[main] remoteConfig.ensureInitialized() completed.");
// ... 既存コード ...
        console.log("[main] Calling remoteConfig.fetchAndActivate()...");
        const fetched = await remoteConfig.fetchAndActivate();
// ... 既存コード ...
        console.log("[main] remoteConfig.fetchAndActivate() completed. Fetched:", fetched);

        AppState.liffId = remoteConfig.getString('liff_id');
// ... 既存コード ...
        if (!AppState.liffId) {
            console.warn("[main] LIFF ID not found in fetched config, using default.");
// ... 既存コード ...
            AppState.liffId = remoteConfig.defaultConfig['liff_id'];
        }
        if (!AppState.liffId) {
// ... 既存コード ...
             console.error("[main] LIFF ID is still missing!");
             throw new Error("LIFF ID not found.");
        }
        console.log("[main] Using LIFF ID:", AppState.liffId);

        // --- LIFF Initialization ---
// ... 既存コード ...
        console.log(`[main] Initializing LIFF with ID: ${AppState.liffId}...`);
        await liff.init({ liffId: AppState.liffId });
// ... 既存コード ...
        console.log("[main] LIFF initialized successfully.");

        // --- Get LIFF Profile ---
// ... 既存コード ...
        console.log("[main] Checking LIFF login status...");
        if (liff.isLoggedIn()) {
// ... 既存コード ...
            console.log("[main] LIFF user logged in. Getting profile...");
            try {
// ... 既存コード ...
                const profile = await liff.getProfile();
                console.log("[main] LIFF profile obtained:", profile);
// ... 既存コード ...
                AppState.userProfile = { ...AppState.userProfile, ...profile };
            } catch (profileError) {
// ... 既存コード ...
                 console.error("[main] Failed to get LIFF profile:", profileError);
                 AppState.userProfile.displayName = "ゲスト (プロファイル取得エラー)";
            }
        } else {
// ... 既存コード ...
            console.log("[main] LIFF user not logged in.");
            AppState.userProfile.displayName = "ゲスト";
        }
        AppState.userProfile.userId = AppState.userProfile.userId || AppState.userProfile.firebaseUid;
// ... 既存コード ...
        console.log("[main] Final User Info:", AppState.userProfile);

        // --- Initialize UI ---
// ... 既存コード ...
        console.log("[main] Calling initializeAppUI()...");
        initializeAppUI();
// ... 既存コード ...
        console.log("[main] initializeAppUI() finished.");

        // --- Hide Loading Screen ---
// ... 既存コード ...
        console.log("[main] Attempting to hide loading screen...");
        hideLoadingScreen();
// ... 既存コード ...
        loadingScreenHidden = true;
        console.log("[main] Loading screen hidden successfully.");

    } catch (err) {
// ... 既存コード ...
        console.error("[main] Initialization failed inside main try block:", err);
        initializeAppFailure(err.message || '不明な初期化エラーが発生しました。');
    } finally {
// ... 既存コード ...
        console.log("[main] <<< Function execution finished (finally block).");
        if (!loadingScreenHidden) {
// ... 既存コード ...
             console.warn("[main] Hiding loading screen in finally block.");
             hideLoadingScreen();
        }
    }
}