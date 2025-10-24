// --- グローバルアプリケーション状態 ---
const AppState = {
    firebase: null, // Firebase services (storage, remoteConfig)
    liffId: '',     // LIFF ID from Remote Config
    userProfile: { displayName: "ゲスト", userId: `guest_${Date.now()}` }, // Default guest profile
    gender: 'female', // Default gender
    uploadedFiles: {}, // key: item-id, value: File object
    uploadedFileUrls: {}, // key: item-id, value: Firebase Storage URL
    selectedProposal: { // User's selection in Phase 5
        hairstyle: null,
        haircolor: null
    },
    aiDiagnosisResult: null, // Result from Phase 4
    aiProposal: null,        // Proposal from Phase 5
    generatedImageUrl: null  // Result image URL from Phase 6
};

// --- 初期化処理 ---

// ★★★ main 関数は index.html の firebase-initialized イベントリスナーから呼ばれる ★★★
async function main(firebaseServices) {
    window.mainFunctionCalled = true; // 呼び出しフラグ (index.html用)
    console.log("[main] Function started.");
    let loadingScreenHidden = false;

    try {
        // Firebaseサービスの存在確認・格納
        console.log("[main] Checking for received Firebase services...");
        if (!firebaseServices || !firebaseServices.storage || !firebaseServices.remoteConfig) {
            console.error('[main] Received Firebase services object is invalid or incomplete.');
            throw new Error("Firebaseサービスの準備が完了していません (Invalid services passed)。");
        }
        AppState.firebase = firebaseServices; // ★★★ AppState に格納 ★★★
        console.log("[main] Firebase services stored in AppState.");

        // Remote ConfigからLIFF IDを取得
        console.log("[main] Fetching Remote Config...");
        await AppState.firebase.remoteConfig.ensureInitialized();
        console.log("[main] Remote Config ensureInitialized completed.");
        const fetched = await AppState.firebase.remoteConfig.fetchAndActivate();
        console.log("[main] Remote Config fetchAndActivate completed. Fetched:", fetched);
        AppState.liffId = AppState.firebase.remoteConfig.getString('liff_id');
        console.log("[main] Fetched LIFF ID from Remote Config:", AppState.liffId);

        if (!AppState.liffId) {
             // Remote Configから取得できなかった場合、index.html の defaultConfig を参照するが、
             // ここでは念のため直接フォールバック値を使う
             AppState.liffId = '2008345232-zq4A3Vg3';
             console.warn("[main] LIFF ID from Remote Config is empty, using hardcoded fallback:", AppState.liffId);
             if (!AppState.liffId) { // フォールバックもなければエラー
                console.error("[main] Fallback LIFF ID is also unavailable.");
                throw new Error("LIFF IDをRemote Configから取得できませんでした。");
             }
        }
        console.log("[main] Using LIFF ID:", AppState.liffId);

        // LIFF SDKの存在確認
        console.log("[main] Checking for LIFF SDK object...");
        if (typeof liff === 'undefined') {
            console.error("[main] LIFF SDK object (liff) is undefined.");
            throw new Error('LIFF SDKが見つかりません。sdk.jsの読み込みに失敗 (403 Forbidden?) している可能性があります。LINE Developers Consoleの設定、ネットワーク環境、ブラウザキャッシュを確認してください。');
        }
        console.log("[main] LIFF SDK object found.");

        // LIFFを初期化
        console.log(`[main] Initializing LIFF with ID: ${AppState.liffId}...`);
        await liff.init({ liffId: AppState.liffId });
        console.log("[main] LIFF initialized successfully.");

        // LIFFログイン状態確認とプロファイル取得
        console.log("[main] Checking LIFF login status...");
        if (liff.isLoggedIn()) {
            console.log("[main] LIFF user is logged in. Getting profile...");
            const profile = await liff.getProfile();
            console.log("[main] User profile obtained:", profile);
            // 取得したプロファイルをAppStateにマージ（ゲスト情報は上書き）
            AppState.userProfile = { ...AppState.userProfile, ...profile };
        } else {
            console.log("[main] LIFF user not logged in. Proceeding as guest.");
             // ゲスト情報はデフォルトのまま
        }

        // UI初期化（成功時）
        console.log("[main] Calling initializeAppState for UI setup.");
        initializeAppState(); // AppState は既に設定済み

        // 正常終了時にローディング画面を隠す
        hideLoadingScreen();
        loadingScreenHidden = true;

    } catch (err) {
        console.error("[main] Initialization failed inside main try block:", err);
        initializeAppFailure(`アプリの初期化に失敗しました: ${err.message || '不明なエラーが発生しました。コンソールを確認してください。'}`);

    } finally {
        console.log("[main] Entering finally block.");
        // finally ブロックで確実にローディング画面を隠す
        if (!loadingScreenHidden) {
             console.warn("[main] Hiding loading screen in finally block (might indicate an error happened before explicit hide).");
             hideLoadingScreen();
        }
    }
}

// --- 他の関数 (initializeAppState, hideLoadingScreen, initializeAppFailure, setupEventListeners, etc.) ---

// アプリケーションUIの初期化
function initializeAppState() {
    console.log("[initializeAppState] Initializing app UI state with profile:", AppState.userProfile);
    setupEventListeners();
    changePhase('phase1'); // 最初の画面表示
    document.body.style.alignItems = 'flex-start'; // bodyのスタイルを元に戻す
    console.log("[initializeAppState] UI Initialized, phase1 shown.");
}

// ローディング画面を非表示にする共通関数
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        if (loadingScreen.style.display !== 'none') {
            console.log("[hideLoadingScreen] Hiding loading screen now.");
            loadingScreen.style.display = 'none';
        } else {
            console.log("[hideLoadingScreen] Loading screen was already hidden.");
        }
    } else {
        // body がクリアされた後でもエラーを出さないようにする
        console.warn("[hideLoadingScreen] Loading screen element (#loading-screen) not found. Might be normal if error occurred.");
    }
}

// 初期化失敗時の処理
function initializeAppFailure(errorMessage) {
    console.error("[initializeAppFailure] Displaying failure message:", errorMessage);

    // まずローディング画面を確実に隠す
    hideLoadingScreen();

    const bodyElement = document.body;
    // エラーメッセージ要素がなければ作成
    let errorDiv = document.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.padding = '20px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.color = 'red';
        bodyElement.innerHTML = ''; // body をクリア
        bodyElement.appendChild(errorDiv);
        bodyElement.style.display = 'flex';
        bodyElement.style.justifyContent = 'center';
        bodyElement.style.alignItems = 'center';
        bodyElement.style.minHeight = '100vh';
    }

    // エラーメッセージを設定
    errorDiv.innerHTML = `
        <h2>アプリケーションエラー</h2>
        <p>アプリの起動に必要な処理中にエラーが発生しました。</p>
        <p>詳細: ${escapeHtml(errorMessage)}</p>
        <p>時間をおいて再度お試しいただくか、開発者にご連絡ください。</p>
        <p style="font-size: 0.8em; color: #666;">(LIFF SDKの読み込みエラーの場合、LINE Developers Consoleの設定、ネットワーク環境、ブラウザキャッシュを確認してください)</p>
    `;
}

// HTMLエスケープ関数
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
         .replace(/\//g, "&#x2F;"); // スラッシュもエスケープ
}


// --- イベントリスナー設定 ---
function setupEventListeners() {
    console.log("[setupEventListeners] Setting up event listeners.");

    // Phase 1 -> Phase 2
    document.getElementById('start-btn')?.addEventListener('click', () => {
        document.getElementById('display-name').value = AppState.userProfile.displayName || "ゲスト";
        const genderRadio = document.querySelector(`input[name="gender"][value="${AppState.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
        changePhase('phase2');
    });

    // Phase 2 -> Phase 3
    document.getElementById('next-to-upload-btn')?.addEventListener('click', () => {
        const selectedGender = document.querySelector('input[name="gender"]:checked');
        if (selectedGender) {
            AppState.gender = selectedGender.value;
        }
        console.log("[setupEventListeners] Gender selected:", AppState.gender);
        changePhase('phase3');
    });

    // Phase 3 ファイルアップロード関連
    document.querySelectorAll('.upload-item').forEach(item => {
        const button = item.querySelector('.btn-outline');
        const input = item.querySelector('.file-input');
        const itemId = item.id;

        button?.addEventListener('click', () => input.click());

        input?.addEventListener('change', (event) => {
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                AppState.uploadedFiles[itemId] = file;
                console.log(`[setupEventListeners] File added for ${itemId}:`, file.name);

                button.textContent = '✔️ 撮影済み';
                button.classList.remove('btn-outline');
                button.classList.add('btn-success');
                button.disabled = true;
                item.querySelector('.upload-icon').style.backgroundColor = '#d1fae5';

                checkAllFilesUploaded();
            }
        });
    });

    // Phase 3 -> Phase 3.5 -> Phase 4 (診断リクエスト)
    document.getElementById('request-diagnosis-btn')?.addEventListener('click', handleDiagnosisRequest);

    // Phase 4 -> Phase 5
    document.getElementById('next-to-proposal-btn')?.addEventListener('click', () => {
        changePhase('phase5');
        setupProposalCardListeners(); // Phase5が表示された後にリスナーを設定
    });

    // Phase 5 -> Phase 6
    document.getElementById('next-to-generate-btn')?.addEventListener('click', () => {
        console.log("[setupEventListeners] Selected proposal for generation:", AppState.selectedProposal);
        if (!AppState.selectedProposal.hairstyle || !AppState.selectedProposal.haircolor) {
            alert("ヘアスタイルとヘアカラーを選択してください。");
            return;
        }
        // TODO: Implement Phase 6 UI and logic
        changePhase('phase6');
        // 画像生成リクエストなど
    });
}

// Phase 5 提案カードのクリックリスナー設定 (変更なし)
function setupProposalCardListeners() {
    // ... (rest of the function is the same as before) ...
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');

    const handleCardClick = (event, type) => {
        const card = event.target.closest('.proposal-card');
        if (!card) return;

        const name = card.dataset.name;
        AppState.selectedProposal[type] = name;

        const container = type === 'hairstyle' ? hairstyleContainer : haircolorContainer;
        container.querySelectorAll('.proposal-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        console.log('[setupProposalCardListeners] Selected proposals:', AppState.selectedProposal);
        checkProposalSelection();
    };

    // Remove previous listeners if they exist to prevent duplicates
    if (hairstyleContainer?._clickHandler) {
        hairstyleContainer.removeEventListener('click', hairstyleContainer._clickHandler);
    }
     if (haircolorContainer?._clickHandler) {
        haircolorContainer.removeEventListener('click', haircolorContainer._clickHandler);
    }

    // Store handlers on the elements themselves
    hairstyleContainer._clickHandler = (event) => handleCardClick(event, 'hairstyle');
    haircolorContainer._clickHandler = (event) => handleCardClick(event, 'haircolor');

    hairstyleContainer?.addEventListener('click', hairstyleContainer._clickHandler);
    haircolorContainer?.addEventListener('click', haircolorContainer._clickHandler);

    checkProposalSelection(); // Check button state initially
}


// --- 診断リクエスト処理 ---
async function handleDiagnosisRequest() {
    const btn = document.getElementById('request-diagnosis-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'アップロード中... (0/5)';
    btn.classList.add('btn-disabled');

    try {
        const filesToUpload = Object.entries(AppState.uploadedFiles);
        const totalFiles = filesToUpload.length;

        // ファイルアップロード
        const uploadPromises = filesToUpload.map(([key, file], index) =>
            uploadFileToStorage(file, key).then(result => {
                btn.textContent = `アップロード中... (${index + 1}/${totalFiles})`;
                return result;
            })
        );
        const results = await Promise.all(uploadPromises);

        AppState.uploadedFileUrls = results.reduce((acc, result) => {
            acc[result.itemName] = result.url;
            return acc;
        }, {});
        console.log('[handleDiagnosisRequest] All files uploaded:', AppState.uploadedFileUrls);

        // 診断中画面表示
        changePhase('phase3.5');

        // AI診断リクエスト (Functions呼び出し)
        const aiResponse = await requestAiDiagnosis(
            AppState.uploadedFileUrls,
            AppState.userProfile,
            AppState.gender
        );
        console.log('[handleDiagnosisRequest] AI Response received:', aiResponse);

        // 結果をAppStateに保存
        AppState.aiDiagnosisResult = aiResponse?.result;
        AppState.aiProposal = aiResponse?.proposal;

        // 結果表示
        displayDiagnosisResult(AppState.aiDiagnosisResult);
        displayProposalResult(AppState.aiProposal);

        // 結果画面へ遷移
        changePhase('phase4');

    } catch (error) {
        console.error('[handleDiagnosisRequest] An error occurred:', error);
        initializeAppFailure(`診断リクエスト中にエラーが発生しました: ${error.message || '不明なエラー。コンソールを確認してください。'}`);
        // エラー発生時はアップロード画面に戻す (ボタンの状態はリセットしない方が良いかも)
        changePhase('phase3');
        if (btn) { // ボタンがまだ存在すれば
             btn.textContent = 'AI診断をリクエストする'; // テキストだけ戻す
             // アップロード状態に応じて disable/enable を再設定
             checkAllFilesUploaded();
        }
    }
}

// --- 結果表示関連 ---

// Phase 4: 診断結果表示 (変更なし)
function displayDiagnosisResult(result) {
    // ... (rest of the function is the same as before) ...
     const mapping = {
        face: { container: document.getElementById('face-results'), labels: { nose: '鼻', mouth: '口', eyes: '目', eyebrows: '眉', forehead: 'おでこ' } },
        skeleton: { container: document.getElementById('skeleton-results'), labels: { neckLength: '首の長さ', faceShape: '顔の形', bodyLine: 'ボディライン', shoulderLine: '肩のライン' } },
        personalColor: { container: document.getElementById('personal-color-results'), labels: { baseColor: 'ベースカラー', season: 'シーズン', brightness: '明度', saturation: '彩度', eyeColor: '瞳の色' } }
    };

    for (const category in mapping) {
        const { container, labels } = mapping[category];
        if (!container) continue;
        container.innerHTML = ''; // Clear previous results

        if (!result || !result[category]) {
            container.innerHTML = '<div class="result-item-label">診断データなし</div><div class="result-item-value">-</div>';
            continue;
        }

        let hasData = false;
        for (const key in labels) {
            if (Object.hasOwnProperty.call(result[category], key) && labels[key]) {
                const value = result[category][key];
                container.innerHTML += `
                    <div class="result-item-label">${labels[key]}</div>
                    <div class="result-item-value">${value != null ? escapeHtml(String(value)) : '-'}</div>`;
                hasData = true;
            }
        }
        if (!hasData) {
             container.innerHTML = '<div class="result-item-label">診断データなし</div><div class="result-item-value">-</div>';
        }
    }
}

// Phase 5: 提案表示 (変更なし)
function displayProposalResult(proposal) {
    // ... (rest of the function is the same as before) ...
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');
    const commentContainer = document.getElementById('top-stylist-comment-text');

    if (!hairstyleContainer || !haircolorContainer || !commentContainer) return;

    hairstyleContainer.innerHTML = '';
    haircolorContainer.innerHTML = '';

    // ★★★ ダミーデータを使うための修正 ★★★
    const effectiveProposal = proposal || { // proposalがnull/undefinedならダミーを使う
        hairstyles: [{ name: "ダミー スタイル1", description: "ふんわりボブスタイル" }, { name: "ダミー スタイル2", description: "クールなショートレイヤー" }],
        haircolors: [{ name: "ダミー カラー1", description: "明るめのアッシュブラウン" }, { name: "ダミー カラー2", description: "深みのあるカシスレッド" }],
        topStylistComment: "これはAIからのダミー提案コメントです。あなたの特徴に合わせてスタイルを考えてみました。"
    };
    // ★★★ ここまで ★★★


    if (effectiveProposal.hairstyles?.length > 0) {
        effectiveProposal.hairstyles.forEach(style => {
            if (style?.name && style?.description) {
                 hairstyleContainer.innerHTML += `
                    <div class="proposal-card" data-type="hairstyle" data-name="${escapeHtml(style.name)}">
                        <strong>${escapeHtml(style.name)}</strong>
                        <p>${escapeHtml(style.description)}</p>
                    </div>`;
            }
        });
    } else {
        hairstyleContainer.innerHTML = '<p>提案されたヘアスタイルはありません。</p>';
    }

    if (effectiveProposal.haircolors?.length > 0) {
        effectiveProposal.haircolors.forEach(color => {
            if (color?.name && color?.description) {
                haircolorContainer.innerHTML += `
                    <div class="proposal-card" data-type="haircolor" data-name="${escapeHtml(color.name)}">
                        <strong>${escapeHtml(color.name)}</strong>
                        <p>${escapeHtml(color.description)}</p>
                    </div>`;
            }
        });
    } else {
        haircolorContainer.innerHTML = '<p>提案されたヘアカラーはありません。</p>';
    }

    commentContainer.textContent = effectiveProposal.topStylistComment || 'コメントはありません。';
}

// --- ユーティリティ関数 ---

// Phase 3: 全ファイルアップロード完了確認 (変更なし)
function checkAllFilesUploaded() {
    // ... (rest of the function is the same as before) ...
    const requiredFilesCount = 5;
    const uploadedCount = Object.keys(AppState.uploadedFiles).length;
    const isReady = uploadedCount === requiredFilesCount;
    const btn = document.getElementById('request-diagnosis-btn');

    if (btn) {
        btn.disabled = !isReady;
        btn.classList.toggle('btn-disabled', !isReady);
    }
    console.log(`[checkAllFilesUploaded] ${uploadedCount}/${requiredFilesCount} files ready. Button enabled: ${isReady}`);
    return isReady;
}

// Phase 5: 提案選択完了確認 (変更なし)
function checkProposalSelection() {
    // ... (rest of the function is the same as before) ...
     const btn = document.getElementById('next-to-generate-btn');
    const isReady = !!AppState.selectedProposal.hairstyle && !!AppState.selectedProposal.haircolor;

    if (btn) {
        btn.disabled = !isReady;
        btn.classList.toggle('btn-disabled', !isReady);
    }
     console.log(`[checkProposalSelection] Hairstyle: ${AppState.selectedProposal.hairstyle}, Haircolor: ${AppState.selectedProposal.haircolor}. Button enabled: ${isReady}`);
}

// Firebase Storageへのファイルアップロード (変更なし)
async function uploadFileToStorage(file, itemName) {
    // ... (rest of the function is the same as before) ...
    if (!AppState.firebase || !AppState.firebase.storage) {
        throw new Error("Firebase Storage is not initialized.");
    }
    // Use compat syntax for storage reference
    const storageRef = AppState.firebase.storage.ref();
    const userId = AppState.userProfile.userId || `guest_${Date.now()}`;
    const filePath = `uploads/${userId}/${itemName}_${Date.now()}_${file.name}`;
    const fileRef = storageRef.child(filePath); // Use child() for subpath

    try {
        console.log(`[uploadFileToStorage] Uploading ${itemName} to ${filePath}...`);
        const snapshot = await fileRef.put(file); // Use put() to upload
        const downloadURL = await snapshot.ref.getDownloadURL(); // Use getDownloadURL()
        console.log(`[uploadFileToStorage] Upload successful for ${itemName}: ${downloadURL}`);
        return { itemName, url: downloadURL };
    } catch (error) {
        console.error(`[uploadFileToStorage] Error uploading ${itemName}:`, error);
        throw new Error(`ファイル (${escapeHtml(itemName)}) のアップロードに失敗しました。`);
    }
}

// Firebase Functions呼び出し (AI診断リクエスト) (ダミーデータ処理削除)
async function requestAiDiagnosis(fileUrls, profile, gender) {
    const functionUrl = '/requestDiagnosis'; // Use relative path for Functions rewrite
    console.log(`[requestAiDiagnosis] Sending request to ${functionUrl}`);
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrls, userProfile: profile, gender }),
        });
        console.log(`[requestAiDiagnosis] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[requestAiDiagnosis] Server error body:`, errorBody);
            throw new Error(`AI診断サーバーエラー (ステータス: ${response.status}): ${errorBody || response.statusText}`);
        }
        const data = await response.json();
        console.log('[requestAiDiagnosis] Received data:', data);
        // ★★★ ダミーデータ処理を削除 ★★★
        return data;
    } catch (error) {
         console.error('[requestAiDiagnosis] Request failed:', error);
         throw new Error(`AI診断リクエストの送信または受信に失敗しました: ${error.message}`);
    }
}
