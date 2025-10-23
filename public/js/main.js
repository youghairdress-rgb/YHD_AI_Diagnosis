// アプリケーションの状態管理オブジェクト
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

// ★★★ エラー表示関数とHTMLエスケープ関数をここに移動 ★★★
function initializeAppFailure(errorMessage) {
    console.error("[initializeAppFailure] Displaying failure message:", errorMessage);

    // ローディング画面を隠す試み（エラー表示前）
    hideLoadingScreen();

    const bodyElement = document.body;
    // エラーメッセージ要素がなければ作成
    if (!document.querySelector('.error-message')) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.padding = '20px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.color = 'red';
        errorDiv.innerHTML = `
            <h2>アプリケーションエラー</h2>
            <p>${escapeHtml(errorMessage)}</p>
            <p>時間をおいて再度お試しいただくか、開発者にご連絡ください。</p>
            <p style="font-size: 0.8em; color: #666;">(LIFF SDKの読み込みエラーの場合、LINE Developers Consoleの設定を確認してください)</p>
        `;

        bodyElement.innerHTML = ''; // 既存のコンテンツをクリア
        bodyElement.appendChild(errorDiv);
        // スタイルを再適用
        bodyElement.style.display = 'flex';
        bodyElement.style.justifyContent = 'center';
        bodyElement.style.alignItems = 'center';
        bodyElement.style.minHeight = '100vh';
        bodyElement.style.backgroundColor = 'var(--bg-color)'; // 背景色を戻す
    } else {
         // 既にエラーメッセージが表示されている場合は内容を更新
         const errorP = document.querySelector('.error-message p:first-of-type');
         if(errorP) errorP.innerHTML = escapeHtml(errorMessage);
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    // ★★★ 構文エラーの可能性がある正規表現を修正 ★★★
    // replace('/', '&sol;') を追加
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;")
         .replace(/\//g, "&#x2F;"); // スラッシュもエスケープ
}


// index.html から Firebase サービスを受け取って初期化を開始
async function main(firebaseServices) {
    console.log("[main] Function started.");
    let loadingScreenHidden = false;

    try {
        // 引数から Firebase サービスを AppState に格納
        console.log("[main] Receiving Firebase services...");
        if (!firebaseServices || !firebaseServices.storage || !firebaseServices.remoteConfig) {
            console.error('[main] Firebase services argument is invalid.');
            throw new Error("Firebaseサービスの準備が完了していません (Invalid argument)。");
        }
        AppState.firebase = firebaseServices;
        console.log("[main] Firebase services assigned to AppState.");

        // Remote ConfigからLIFF IDを取得
        console.log("[main] Fetching Remote Config...");
        await AppState.firebase.remoteConfig.ensureInitialized();
        console.log("[main] Remote Config ensureInitialized completed.");
        const fetched = await AppState.firebase.remoteConfig.fetchAndActivate();
        console.log("[main] Remote Config fetchAndActivate completed. Fetched:", fetched);
        AppState.liffId = AppState.firebase.remoteConfig.getString('liff_id');
        console.log("[main] Fetched LIFF ID from Remote Config:", AppState.liffId);

        if (!AppState.liffId) {
             console.warn("[main] LIFF ID from Remote Config is empty, using default from defaultConfig.");
             AppState.liffId = AppState.firebase.remoteConfig.defaultConfig['liff_id'];
             if (!AppState.liffId) {
                console.error("[main] Default LIFF ID is also unavailable.");
                throw new Error("LIFF IDをRemote Configから取得できませんでした。");
             }
        }
        console.log("[main] Using LIFF ID for init:", AppState.liffId);

        // LIFF SDKの存在確認
        console.log("[main] Checking for LIFF SDK object...");
        if (typeof liff === 'undefined') {
            console.error("[main] LIFF SDK object (liff) is undefined. Check network tab for sdk.js loading errors (e.g., 403 Forbidden).");
            throw new Error('LIFF SDKが見つかりません。sdk.jsの読み込みに失敗している可能性があります。LINE Developers Consoleの設定（Endpoint URL, Callback URL）やネットワーク接続を確認してください。');
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
            AppState.userProfile = profile;
        } else {
            console.log("[main] LIFF user not logged in. Proceeding as guest.");
             AppState.userProfile = { displayName: "ゲスト", userId: `guest_${Date.now()}` };
             // 必要であればここで liff.login() を呼び出すことも検討
        }

        // UI初期化（成功時）
        console.log("[main] Calling initializeAppState for UI setup.");
        initializeAppState();

        // 正常終了時にローディング画面を隠す
        hideLoadingScreen();
        loadingScreenHidden = true;

    } catch (err) {
        console.error("[main] Initialization failed inside main try block:", err);
        if (err.stack) {
             console.error("[main] Error stack:", err.stack);
        }
        // hideLoadingScreen(); // finallyで処理するため不要
        // loadingScreenHidden = true; // finallyで処理するため不要
        initializeAppFailure(`アプリの初期化に失敗しました: ${err.message || '不明なエラーが発生しました。コンソールを確認してください。'}`);

    } finally {
        console.log("[main] Entering finally block.");
        // finally ブロックで確実にローディング画面を隠す
        if (!loadingScreenHidden) {
             console.warn("[main] Loading screen was potentially not hidden in try/catch. Hiding now.");
             hideLoadingScreen();
        }
    }
}

// --- initializeAppState, hideLoadingScreen ... 以降の関数は変更なし ---

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
            // console.log("[hideLoadingScreen] Loading screen was already hidden."); // 冗長なのでコメントアウト
        }
    } else {
        // このエラーは initializeAppFailure で body がクリアされた場合に発生する可能性がある
        console.warn("[hideLoadingScreen] Loading screen element (#loading-screen) not found in the DOM (possibly removed by error handler).");
    }
}

// --- setupEventListeners 以降の関数は変更なし ---
// ... (previous code remains the same) ...

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

function setupProposalCardListeners() {
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

async function handleDiagnosisRequest() {
     const btn = document.getElementById('request-diagnosis-btn');
    btn.disabled = true;
    btn.textContent = 'アップロード中... (0/5)';
    btn.classList.add('btn-disabled');

    try {
        const filesToUpload = Object.entries(AppState.uploadedFiles);
        const totalFiles = filesToUpload.length;

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

        changePhase('phase3.5');

        const aiResponse = await requestAiDiagnosis(
            AppState.uploadedFileUrls,
            AppState.userProfile,
            AppState.gender
        );
        console.log('[handleDiagnosisRequest] AI Response:', aiResponse);

        // 結果をAppStateに保存（必要に応じて）
        AppState.aiDiagnosisResult = aiResponse?.result;
        AppState.aiProposal = aiResponse?.proposal;


        displayDiagnosisResult(aiResponse?.result);
        displayProposalResult(aiResponse?.proposal);

        changePhase('phase4');

    } catch (error) {
        console.error('[handleDiagnosisRequest] An error occurred:', error);
        alert(`エラーが発生しました: ${error.message || 'もう一度お試しください。'}`);
        btn.disabled = false;
        btn.textContent = 'AI診断をリクエストする';
        if(checkAllFilesUploaded()) {
            btn.classList.remove('btn-disabled');
        } else {
             btn.classList.add('btn-disabled');
        }
        changePhase('phase3'); // エラー発生時はアップロード画面に戻る
    }
}

function displayDiagnosisResult(result) {
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
            // Check if the key exists in the result object for this category
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


function displayProposalResult(proposal) {
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');
    const commentContainer = document.getElementById('top-stylist-comment-text');

    if (!hairstyleContainer || !haircolorContainer || !commentContainer) return;

    hairstyleContainer.innerHTML = '';
    haircolorContainer.innerHTML = '';

    if (!proposal) {
        hairstyleContainer.innerHTML = '<p>提案データがありません。</p>';
        haircolorContainer.innerHTML = '<p>提案データがありません。</p>';
        commentContainer.textContent = 'コメントはありません。';
        return;
    }

    if (proposal.hairstyles?.length > 0) {
        proposal.hairstyles.forEach(style => {
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

    if (proposal.haircolors?.length > 0) {
        proposal.haircolors.forEach(color => {
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

    commentContainer.textContent = proposal.topStylistComment || 'コメントはありません。';
}


function checkAllFilesUploaded() {
    const requiredFilesCount = 5;
    const uploadedCount = Object.keys(AppState.uploadedFiles).length;
    const isReady = uploadedCount === requiredFilesCount;
    const btn = document.getElementById('request-diagnosis-btn');

    if (btn) {
        btn.disabled = !isReady;
        btn.classList.toggle('btn-disabled', !isReady);
    }
    return isReady;
}

function checkProposalSelection() {
     const btn = document.getElementById('next-to-generate-btn');
    const isReady = !!AppState.selectedProposal.hairstyle && !!AppState.selectedProposal.haircolor;

    if (btn) {
        btn.disabled = !isReady;
        btn.classList.toggle('btn-disabled', !isReady);
    }
}


async function uploadFileToStorage(file, itemName) {
    if (!AppState.firebase || !AppState.firebase.storage) {
        throw new Error("Firebase Storage is not initialized.");
    }
    // Use compat syntax for storage reference
    const storageRef = AppState.firebase.storage.ref();
    const userId = AppState.userProfile.userId || `guest_${Date.now()}`;
    const filePath = `uploads/${userId}/${itemName}_${Date.now()}_${file.name}`;
    const fileRef = storageRef.child(filePath); // Use child() for subpath

    try {
        const snapshot = await fileRef.put(file); // Use put() to upload
        const downloadURL = await snapshot.ref.getDownloadURL(); // Use getDownloadURL()
        return { itemName, url: downloadURL };
    } catch (error) {
        console.error(`Error uploading ${itemName}:`, error);
        throw new Error(`ファイル (${escapeHtml(itemName)}) のアップロードに失敗しました。`);
    }
}


async function requestAiDiagnosis(fileUrls, profile, gender) {
     const functionUrl = '/requestDiagnosis'; // Use relative path for Functions rewrite
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrls, userProfile: profile, gender }),
        });
        if (!response.ok) {
            const errorBody = await response.text(); // Get more error details
            throw new Error(`AI診断サーバーエラー (ステータス: ${response.status}): ${errorBody}`);
        }
        const data = await response.json();
         // --- ダミー提案データ (バックエンド未実装時のフォールバック) ---
        if (!data.proposal) {
            console.warn("[requestAiDiagnosis] Backend did not return 'proposal', using dummy data.");
            data.proposal = {
                hairstyles: [{ name: "ダミー スタイル1", description: "ふんわりボブスタイル" }, { name: "ダミー スタイル2", description: "クールなショートレイヤー" }],
                haircolors: [{ name: "ダミー カラー1", description: "明るめのアッシュブラウン" }, { name: "ダミー カラー2", description: "深みのあるカシスレッド" }],
                topStylistComment: "これはAIからのダミー提案コメントです。あなたの特徴に合わせてスタイルを考えてみました。"
            };
        }
        // --- ここまで ---
        return data;
    } catch (error) {
         console.error('[requestAiDiagnosis] Request failed:', error);
         // Rethrow a more specific error or handle it as needed
         throw new Error(error.message || 'AI診断リクエスト中に不明なエラーが発生しました。');
    }
}

// 他の関数 (displayDiagnosisResult, displayProposalResult など) は変更なし
// ...

// ui.js で定義されている想定
// function changePhase(phaseId) { ... }

