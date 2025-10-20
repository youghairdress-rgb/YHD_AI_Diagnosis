let userProfile = {}; // ユーザー情報を保存するグローバル変数

window.onload = function() {
    const myLiffId = "2008029428-DZNnAbNl";
    initializeLiff(myLiffId);
};

/**
 * LIFFを初期化する
 * @param {string} myLiffId
 */
function initializeLiff(myLiffId) {
    liff
        .init({
            liffId: myLiffId
        })
        .then(() => {
            // ... (existing code) ...
            console.log(userProfile);

            // 準備ができたので、オープニング画面を表示する
            changePhase('phase1');
            // イベントリスナーを設定する
            setupEventListeners();
        })
        .catch((err) => {
            // ... (existing code) ...
            changePhase('phase1');
            // エラーが発生してもイベントリスナーは設定する
            setupEventListeners();
        });
}

/**
 * アプリ内のボタンなどにイベントリスナーを設定する
 */
function setupEventListeners() {
    // 「診断を始める」ボタン
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('Start button clicked.');
            changePhase('phase2'); // フェーズ2へ遷移
        });
    }

    // (今後、他のボタンのイベントリスナーもここに追加していく)
}

