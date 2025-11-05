/**
 * 指定されたフェーズ（画面）に表示を切り替える
 * @param {string} phaseId 表示したいフェーズのID ('phase1', 'phase2', etc.)
 */
// NO export needed
function changePhase(phaseId) {
    console.log(`[changePhase] Changing to phase: ${phaseId}`);
    // Hide all phase containers first
    document.querySelectorAll('.phase-container').forEach(container => {
        if (container) container.style.display = 'none'; // Add null check
    });

    // Display the target phase container
    const targetPhase = document.getElementById(phaseId);
    if (targetPhase) {
        targetPhase.style.display = 'block';
        console.log(`[changePhase] Phase ${phaseId} displayed.`);
    } else {
        console.error(`[changePhase] Phase container with id "${phaseId}" not found.`);
        // Fallback to phase1 if target is not found
        const phase1 = document.getElementById('phase1');
        if(phase1) phase1.style.display = 'block';
    }
}
// ★ 修正済み: ファイル末尾にあった余分な閉じ括弧 '}' を削除