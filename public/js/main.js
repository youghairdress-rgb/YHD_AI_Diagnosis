// DOMが完全に読み込まれたら、アプリケーションを開始する
document.addEventListener('DOMContentLoaded', main);

async function main() {
    console.log("DOM Content Loaded. Starting application.");

    // LIFFが利用可能かチェック
    if (typeof liff === 'undefined') {
        console.error('LIFF SDK is not loaded.');
        alert('アプリの読み込みに失敗しました。LIFF SDKが見つかりません。');
        return;
    }

    try {
        // LIFFを初期化
        console.log("Initializing LIFF...");
        await liff.init({ liffId: "2008029428-DZNnAbNl" });
        console.log("LIFF initialized.");
        
        // ユーザープロファイルを取得
        const profile = await liff.getProfile();
        console.log("User profile:", profile);

        // アプリケーションの状態をセットアップ
        initializeAppState(profile);

    } catch (err) {
        console.error("LIFF initialization failed", err);
        alert(`LIFFの初期化に失敗しました: ${err}`);
        // 失敗してもゲストとして続行
        initializeAppState({ displayName: "ゲスト", userId: `guest_${Date.now()}` });
    }
}

function initializeAppState(userProfile) {
    // グローバルでアクセスできるようにセット
    window.userProfile = userProfile;
    window.uploadedFiles = {};
    window.uploadedFileUrls = {};
    window.selectedProposal = {};

    // イベントリスナーを設定
    setupEventListeners();

    // 最初の画面を表示
    changePhase('phase1');

    // ローディング画面を非表示にする
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    // bodyのalign-itemsを元に戻す
    document.body.style.alignItems = 'flex-start';
}


function setupEventListeners() {
    document.getElementById('start-btn')?.addEventListener('click', () => {
        document.getElementById('display-name').value = window.userProfile.displayName || "ゲスト";
        changePhase('phase2');
    });

    document.getElementById('next-to-upload-btn')?.addEventListener('click', () => {
        changePhase('phase3');
    });

    document.getElementById('request-diagnosis-btn')?.addEventListener('click', handleDiagnosisRequest);
    
    document.getElementById('next-to-proposal-btn')?.addEventListener('click', () => {
        changePhase('phase5');
    });

    document.getElementById('next-to-generate-btn')?.addEventListener('click', () => {
        console.log("Selected proposal:", window.selectedProposal);
        // TODO: Phase6 UI
        changePhase('phase6');
    });

    document.querySelectorAll('.upload-item').forEach(item => {
        const button = item.querySelector('.btn-outline');
        const input = item.querySelector('.file-input');
        button?.addEventListener('click', () => input.click());
        input?.addEventListener('change', (event) => {
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                window.uploadedFiles[item.id] = file;
                button.textContent = '✔️ 撮影済み';
                button.classList.add('btn-success');
                button.disabled = true;
                item.querySelector('.upload-icon').style.backgroundColor = '#d1fae5';
                checkAllFilesUploaded();
            }
        });
    });
}

async function handleDiagnosisRequest() {
    const btn = document.getElementById('request-diagnosis-btn');
    btn.disabled = true;
    btn.textContent = 'アップロード中... (0/5)';
    btn.classList.add('btn-disabled');

    try {
        const uploadPromises = Object.entries(window.uploadedFiles).map(([key, file], index) => 
            uploadFileToStorage(file, key).then(result => {
                btn.textContent = `アップロード中... (${index + 1}/5)`;
                return result;
            })
        );

        const results = await Promise.all(uploadPromises);
        results.forEach(result => { window.uploadedFileUrls[result.itemName] = result.url; });
        console.log('All files uploaded:', window.uploadedFileUrls);

        changePhase('phase3.5');
        
        const gender = document.querySelector('input[name="gender"]:checked').value;
        const aiResult = await requestAiDiagnosis(window.uploadedFileUrls, window.userProfile, gender);
        console.log('AI Result:', aiResult);
        
        displayDiagnosisResult(aiResult.result);
        displayProposalResult(aiResult.proposal);
        changePhase('phase4');

    } catch (error) {
        console.error('An error occurred during diagnosis request:', error);
        alert('エラーが発生しました。もう一度お試しください。');
        btn.disabled = false;
        btn.textContent = 'AI診断をリクエストする';
        if(checkAllFilesUploaded()) btn.classList.remove('btn-disabled');
    }
}

function displayDiagnosisResult(result) {
    if (!result) return;
    const mapping = {
        face: { container: document.getElementById('face-results'), labels: { nose: '鼻', mouth: '口', eyes: '目', eyebrows: '眉', forehead: 'おでこ' } },
        skeleton: { container: document.getElementById('skeleton-results'), labels: { neckLength: '首の長さ', faceShape: '顔の形', bodyLine: 'ボディライン', shoulderLine: '肩のライン' } },
        personalColor: { container: document.getElementById('personal-color-results'), labels: { baseColor: 'ベースカラー', season: 'シーズン', brightness: '明度', saturation: '彩度', eyeColor: '瞳の色' } }
    };
    for (const category in mapping) {
        const { container, labels } = mapping[category];
        if (!container || !result[category]) continue;
        container.innerHTML = '';
        for (const key in result[category]) {
            if (labels[key]) {
                container.innerHTML += `<div class="result-item-label">${labels[key]}</div><div class="result-item-value">${result[category][key]}</div>`;
            }
        }
    }
}

function displayProposalResult(proposal) {
    if (!proposal) return;
    const hairstyleContainer = document.getElementById('hairstyle-proposal');
    const haircolorContainer = document.getElementById('haircolor-proposal');
    const commentContainer = document.getElementById('top-stylist-comment-text');
    
    hairstyleContainer.innerHTML = '';
    haircolorContainer.innerHTML = '';
    
    proposal.hairstyles?.forEach(style => {
        hairstyleContainer.innerHTML += `<div class="proposal-card" data-type="hairstyle" data-name="${style.name}"><strong>${style.name}</strong><p>${style.description}</p></div>`;
    });
    proposal.haircolors?.forEach(color => {
        haircolorContainer.innerHTML += `<div class="proposal-card" data-type="haircolor" data-name="${color.name}"><strong>${color.name}</strong><p>${color.description}</p></div>`;
    });

    commentContainer.textContent = proposal.topStylistComment || '';

    document.querySelectorAll('.proposal-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            const name = card.dataset.name;
            window.selectedProposal[type] = name;
            document.querySelectorAll(`.proposal-card[data-type="${type}"]`).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            console.log('Selected:', window.selectedProposal);
        });
    });
}

function checkAllFilesUploaded() {
    const isReady = Object.keys(window.uploadedFiles).length === 5;
    const btn = document.getElementById('request-diagnosis-btn');
    if (isReady) {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
    }
    return isReady;
}

async function uploadFileToStorage(file, itemName) {
    const userId = window.userProfile.userId || `guest_${Date.now()}`;
    const { storage, ref, uploadBytes, getDownloadURL } = window.firebase;
    const filePath = `uploads/${userId}/${itemName}_${file.name}`;
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    return { itemName, url: await getDownloadURL(snapshot.ref) };
}

async function requestAiDiagnosis(fileUrls, profile, gender) {
    const functionUrl = 'https://us-central1-yhd-dx.cloudfunctions.net/requestDiagnosis';
    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrls, userProfile: profile, gender }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    return await response.json();
}

