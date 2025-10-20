/**
 * 指定されたフェーズ（画面）に表示を切り替える
 * @param {string} phaseId 表示したいフェーズのID ('phase1', 'phase2', etc.)
 */
function changePhase(phaseId) {
    // すべてのフェーズコンテナを非表示にする
    document.querySelectorAll('.phase-container').forEach(container => {
        container.style.display = 'none';
    });

    // 指定されたIDのフェーズコンテナのみを表示する
    const targetPhase = document.getElementById(phaseId);
    if (targetPhase) {
        targetPhase.style.display = 'block';
    } else {
        console.error(`Phase with id "${phaseId}" not found.`);
    }
}
