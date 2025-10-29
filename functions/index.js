const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const cors = require("cors")({origin: true});

// 環境変数からAPIキーを取得 (v2方式)
const llmApiKey = process.env.LLM_APIKEY;
const imageGenApiKey = process.env.IMAGEGEN_APIKEY;

// APIキーが設定されているか起動時に確認 (ログに出力)
if (!llmApiKey) {
  logger.warn("LLM_APIKEY environment variable is not set.");
}
if (!imageGenApiKey) {
  logger.warn("IMAGEGEN_APIKEY environment variable is not set.");
}

// --- 診断リクエスト関数 (変更なし) ---
exports.requestDiagnosis = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== "POST") {
      logger.warn(`Method Not Allowed: ${req.method}`);
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    try {
      // (中略 ... 既存の診断処理)
      const fileUrls = req.body?.fileUrls;
      const userProfile = req.body?.userProfile;
      const gender = req.body?.gender;
      if (!fileUrls || !userProfile || !gender) {
        // ... (エラーハンドリング)
      }
      logger.info("Received diagnosis request:", { /* ... */ });
      if (!llmApiKey) {
        // ... (エラーハンドリング)
      }

      const dummyDiagnosisResult = { /* ... */ };
      const dummyProposal = { /* ... */ };

      res.status(200).json({
        message: "Diagnosis request received successfully!",
        result: dummyDiagnosisResult,
        proposal: dummyProposal
      });
    } catch (error) {
      logger.error("Error processing diagnosis request:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message || "An unexpected error occurred." });
    }
  });
});

// --- ★ 新しい関数: 画像生成リクエスト ★ ---
exports.generateHairstyleImage = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== "POST") {
      logger.warn(`[generateHairstyleImage] Method Not Allowed: ${req.method}`);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
      // APIキーの存在チェック
      if (!imageGenApiKey) {
        logger.error("Image Generation API Key is missing. Cannot generate image.");
        return res.status(500).json({ error: "Configuration Error", message: "Image Generation API Key not configured." });
      }

      // フロントエンドから送信されたデータを取得
      const originalImageUrl = req.body?.originalImageUrl; // 例: 正面写真のURL
      const selectedHairstyleKey = req.body?.hairstyle; // 例: 'style1'
      const selectedHaircolorKey = req.body?.haircolor; // 例: 'color2'
      // TODO: 将来的には、診断結果全体や生成用Jsonを受け取るように変更する可能性あり

      // 必須データのチェック
      if (!originalImageUrl || !selectedHairstyleKey || !selectedHaircolorKey) {
         logger.error("Bad Request: Missing data for image generation.", { body: req.body });
         return res.status(400).json({ error: "Bad Request", message: "Missing required data (originalImageUrl, hairstyle, haircolor)." });
      }

      logger.info("Received image generation request:", {
        originalImageUrl: originalImageUrl.substring(0, 50) + '...', // URLが長いので一部だけログに
        hairstyle: selectedHairstyleKey,
        haircolor: selectedHaircolorKey,
      });

      // --- TODO: 画像生成AI API連携 (Task 4-2) ---
      // ここで imageGenApiKey を使ってAI APIを呼び出す
      // 例: const generatedUrl = await callImageGenerationAPI(imageGenApiKey, originalImageUrl, selectedHairstyleKey, selectedHaircolorKey);
      logger.info(`(Dummy) Using ImageGen API Key (first few chars): ${imageGenApiKey?.substring(0, 5)}...`);

      // ★ 現時点ではダミーの画像URLを返す ★
      // Placehold.coを使って、選択されたスタイルがわかるような画像を返す
      const dummyGeneratedUrl = `https://placehold.co/400x400/afeeee/777777?text=Generated\\n${selectedHairstyleKey}\\n${selectedHaircolorKey}`;

      // 成功レスポンス
      res.status(200).json({
        message: "Image generation request processed (dummy).",
        imageUrl: dummyGeneratedUrl
      });

    } catch (error) {
      logger.error("Error processing image generation request:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message || "An unexpected error occurred during image generation." });
    }
  });
});


// --- 疎通確認用エンドポイント (変更なし) ---
exports.helloWorld = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    logger.info("Hello world endpoint called!");
    res.status(200).send("Hello from Firebase Functions!");
  });
});

