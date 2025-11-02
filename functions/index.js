/**
 * Firebase Functions v2
 *
 * このファイルは、v2構文（onTaskDispatched, onRequest, defineSecret）を使用しています。
 * v1構文（functions.https.onCall, functions.config()）は使用しません。
 */

// Firebase SDK
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// CORSを有効にする（v2のonRequestではオプションとして渡す）
const corsOptions = {
  cors: {
    origin: true, // すべてのオリジンを許可（本番環境ではドメインを指定）
    methods: ["POST", "GET", "OPTIONS"],
  },
};

// --- Firebase Admin SDKの初期化 ---
// 署名付きURLを生成するために、ここで初期化します。
try {
  admin.initializeApp();
  logger.info("Firebase Admin SDK initialized.");
} catch (e) {
  logger.warn("Firebase Admin SDK already initialized.");
}

// --- ストレージサービスの取得 ---
let storage;
try {
  storage = admin.storage();
  logger.info("Firebase Storage service retrieved.");
} catch (e) {
  logger.error("Failed to get Firebase Storage service:", e);
}

// --- シークレットの定義 ---
// firebase functions:secrets:set LLM_APIKEY で設定したシークレットを定義
const llmApiKey = defineSecret("LLM_APIKEY");
// firebase functions:secrets:set IMAGEGEN_APIKEY で設定したシークレットを定義
const imageGenApiKey = defineSecret("IMAGEGEN_APIKEY");


// --- AIレスポンスのJSONスキーマ定義 ---
// PDF（フェーズ4, 5）に基づき、AIにこの構造で返すよう強制する
const AI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    "result": {
      "type": "OBJECT",
      "properties": {
        "face": {
          "type": "OBJECT",
          "properties": {
            "nose": {"type": "STRING", "description": "鼻の特徴 (例: 高い, 丸い)"},
            "mouth": {"type": "STRING", "description": "口の特徴 (例: 大きい, 薄い)"},
            "eyes": {"type": "STRING", "description": "目の特徴 (例: 二重, つり目)"},
            "eyebrows": {"type": "STRING", "description": "眉の特徴 (例: アーチ型, 平行)"},
            "forehead": {"type": "STRING", "description": "おでこの特徴 (例: 広い, 狭い)"},
          },
          "required": ["nose", "mouth", "eyes", "eyebrows", "forehead"],
        },
        "skeleton": {
          "type": "OBJECT",
          "properties": {
            "neckLength": {"type": "STRING", "description": "首の長さ (例: 長い, 短い, 標準)"},
            "faceShape": {"type": "STRING", "description": "顔の形 (例: 丸顔, 面長, ベース顔, 卵型)"},
            "bodyLine": {"type": "STRING", "description": "ボディライン (例: ストレート, ウェーブ, ナチュラル)"},
            "shoulderLine": {"type": "STRING", "description": "肩のライン (例: なで肩, いかり肩, 標準)"},
          },
          "required": ["neckLength", "faceShape", "bodyLine", "shoulderLine"],
        },
        "personalColor": {
          "type": "OBJECT",
          "properties": {
            "baseColor": {"type": "STRING", "description": "ベースカラー (例: イエローベース, ブルーベース)"},
            "season": {"type": "STRING", "description": "シーズン (例: スプリング, サマー, オータム, ウィンター)"},
            "brightness": {"type": "STRING", "description": "明度 (例: 高明度, 中明度, 低明度)"},
            "saturation": {"type": "STRING", "description": "彩度 (例: 高彩度, 中彩度, 低彩度)"},
            "eyeColor": {"type": "STRING", "description": "瞳の色 (例: 明るい茶色, 黒に近い焦げ茶)"},
          },
          "required": ["baseColor", "season", "brightness", "saturation", "eyeColor"],
        },
      },
      "required": ["face", "skeleton", "personalColor"],
    },
    "proposal": {
      "type": "OBJECT",
      "properties": {
        "hairstyles": {
          "type": "OBJECT",
          "description": "提案するヘアスタイル2種。キーは 'style1', 'style2' とする。",
          "properties": {
            "style1": {
              "type": "OBJECT",
              "properties": {
                "name": {"type": "STRING", "description": "ヘアスタイルの名前 (例: くびれレイヤーミディ)"},
                "description": {"type": "STRING", "description": "スタイルの説明 (50-100文字程度)"},
              },
              "required": ["name", "description"],
            },
            "style2": {
              "type": "OBJECT",
              "properties": {
                "name": {"type": "STRING", "description": "ヘアスタイルの名前 (例: シースルーバングショート)"},
                "description": {"type": "STRING", "description": "スタイルの説明 (50-100文字程度)"},
              },
              "required": ["name", "description"],
            },
          },
          "required": ["style1", "style2"],
        },
        "haircolors": {
          "type": "OBJECT",
          "description": "提案するヘアカラー2種。キーは 'color1', 'color2' とする。",
          "properties": {
            "color1": {
              "type": "OBJECT",
              "properties": {
                "name": {"type": "STRING", "description": "ヘアカラーの名前 (例: ミルクティーベージュ)"},
                "description": {"type": "STRING", "description": "カラーの説明 (50-100文字程度)"},
              },
              "required": ["name", "description"],
            },
            "color2": {
              "type": "OBJECT",
              "properties": {
                "name": {"type": "STRING", "description": "ヘアカラーの名前 (例: コーラルピンク)"},
                "description": {"type": "STRING", "description": "カラーの説明 (50-100文字程度)"},
              },
              "required": ["name", "description"],
            },
          },
          "required": ["color1", "color2"],
        },
        "comment": {"type": "STRING", "description": "AIトップヘアスタイリストによる総評 (200-300文字程度)"},
      },
      "required": ["hairstyles", "haircolors", "comment"],
    },
  },
  "required": ["result", "proposal"],
};


// --- 診断リクエスト関数 (v2) ---
exports.requestDiagnosis = onRequest(
    {...corsOptions, secrets: [llmApiKey], timeoutSeconds: 120},
    async (req, res) => {
      // 1. メソッドとAPIキーのチェック
      if (req.method !== "POST") {
        logger.warn(`[requestDiagnosis] Method Not Allowed: ${req.method}`);
        res.status(405).json({error: "Method Not Allowed"});
        return;
      }

      const apiKey = llmApiKey.value();
      if (!apiKey) {
        logger.error("[requestDiagnosis] LLM_APIKEY is missing.");
        res.status(500).json({error: "Configuration Error", message: "API Key not configured."});
        return;
      }

      // 2. リクエストデータの取得
      const {fileUrls, userProfile, gender} = req.body;
      if (!fileUrls || !fileUrls["item-front-photo"] || !userProfile || !gender) {
        logger.error("[requestDiagnosis] Bad Request: Missing data.", {body: req.body});
        res.status(400).json({error: "Bad Request", message: "Missing required data (fileUrls[item-front-photo], userProfile, gender)."});
        return;
      }

      logger.info(`[requestDiagnosis] Received request for user: ${userProfile.firebaseUid || userProfile.userId}`);

      // 3. 画像データの取得 (正面写真のみ)
      let imageBase64;
      let imageMimeType;
      try {
        const imageUrl = fileUrls["item-front-photo"];
        logger.info(`[requestDiagnosis] Fetching image from: ${imageUrl.substring(0, 50)}...`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        const contentType = imageResponse.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) {
          throw new Error(`Invalid content-type: ${contentType}`);
        }
        imageMimeType = contentType;
        const imageBuffer = await imageResponse.arrayBuffer();
        imageBase64 = Buffer.from(imageBuffer).toString("base64");
        logger.info(`[requestDiagnosis] Image fetched successfully. MimeType: ${imageMimeType}, Base64 Length: ${imageBase64.length}`);
      } catch (fetchError) {
        logger.error("[requestDiagnosis] Failed to fetch or process image:", fetchError);
        res.status(500).json({error: "Image Fetch Error", message: `画像の取得に失敗しました: ${fetchError.message}`});
        return;
      }

      // 4. Gemini API リクエストペイロードの作成
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = `
あなたは日本の高名なトップヘアスタイリストAIです。
顧客から提供された写真（正面）と性別（${gender}）に基づき、以下のタスクを実行してください。

1.  **診断 (result)**: 写真から顧客の顔、骨格、パーソナルカラーの特徴を詳細に分析し、指定されたJSONスキーマの'result'フィールドに入力してください。
2.  **提案 (proposal)**: 診断結果に基づき、顧客に似合うヘアスタイルとヘアカラーをそれぞれ2つ提案し、'proposal'フィールドに入力してください。提案は具体的で、なぜそれが似合うのかの短い説明（50-100文字）を含めてください。
3.  **総評 (comment)**: 診断結果と提案を基に、顧客の魅力的な特徴を称え、全体的なアドバイスを総評（200-300文字）として'comment'フィールドに入力してください。

回答は必ず指定されたJSONスキーマに従い、JSONオブジェクトのみを返してください。前置きやマークダウン（'''json ... '''）は一切含めないでください。
`;

      const payload = {
        systemInstruction: {
          parts: [{text: systemPrompt}],
        },
        contents: [
          {
            role: "user",
            parts: [
              {text: `この顧客（性別: ${gender}）を診断し、提案してください。`},
              {
                inlineData: {
                  mimeType: imageMimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          // temperature: 0.7, // 必要に応じて調整
        },
      };

      // 5. API呼び出し（リトライ処理付き）
      try {
        // ★★★ 修正点: `callGeminiApiWithRetry` は応答オブジェクト全体を返す ★★★
        const aiResponse = await callGeminiApiWithRetry(apiUrl, payload, 3);
        if (!aiResponse) {
           throw new Error("AI response was null or undefined after retries.");
        }

        logger.info("[requestDiagnosis] Gemini API request successful.");

        // ★★★ 修正点: aiResponseオブジェクトから「text」部分を抽出する ★★★
        const responseText = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText || typeof responseText !== "string") {
          logger.error("[requestDiagnosis] No valid JSON text found in AI response.", {response: aiResponse});
          throw new Error("AIの応答にJSONテキストが含まれていません。");
        }

        // ★★★ 修正点: 抽出した「responseText」(文字列)に対してパース処理を行う ★★★
        const jsonMatch = responseText.match(/{[\s\S]*}/);
        if (!jsonMatch || jsonMatch.length === 0) {
          logger.error("[requestDiagnosis] AI response text did not contain valid JSON.", {responseText});
          throw new Error("AIが不正な形式を返しました。応答にJSONオブジェクトが含まれていません。");
        }

        const parsedJson = JSON.parse(jsonMatch[0]); // マッチした文字列をパース

        // パースしたJSONをチェック
        if (!parsedJson.result || !parsedJson.proposal) {
           logger.error("[requestDiagnosis] Parsed JSON missing required keys (result/proposal).", {parsed: parsedJson});
           throw new Error("AIの応答に必要なキー（result, proposal）が欠けています。");
        }

        res.status(200).json(parsedJson); // パースしたJSONを返す
      } catch (apiError) {
        logger.error("[requestDiagnosis] Gemini API call failed:", apiError);
        res.status(500).json({error: "Gemini API Error", message: `AI診断リクエストの送信に失敗しました。\n詳細: ${apiError.message}`});
      }
    });


// --- 画像生成リクエスト関数 (v2) ---
exports.generateHairstyleImage = onRequest(
    // 画像生成は時間がかかるためタイムアウトを5分(300秒)に延長
    {...corsOptions, secrets: [imageGenApiKey], timeoutSeconds: 300},
    async (req, res) => {
      // 1. メソッドとAPIキーのチェック
      if (req.method !== "POST") {
        logger.warn(`[generateHairstyleImage] Method Not Allowed: ${req.method}`);
        res.status(405).json({error: "Method Not Allowed"});
        return;
      }

      const apiKey = imageGenApiKey.value();
      if (!apiKey || !storage) {
        logger.error("[generateHairstyleImage] API Key or Storage service is missing.");
        res.status(500).json({error: "Configuration Error", message: "API Key or Storage not configured."});
        return;
      }

      // 2. リクエストデータの取得
      const {
        originalImageUrl,
        firebaseUid,
        hairstyleName,
        hairstyleDesc,
        haircolorName,
        haircolorDesc,
      } = req.body;

      if (!originalImageUrl || !firebaseUid || !hairstyleName || !haircolorName) {
        logger.error("[generateHairstyleImage] Bad Request: Missing data.", {body: req.body});
        res.status(400).json({error: "Bad Request", message: "Missing required data (originalImageUrl, firebaseUid, hairstyleName, haircolorName)."});
        return;
      }

      logger.info(`[generateHairstyleImage] Received request for user: ${firebaseUid}`);

      // 3. 画像データの取得
      let imageBase64;
      let imageMimeType;
      try {
        const imageUrl = originalImageUrl;
        logger.info(`[generateHairstyleImage] Fetching image from: ${imageUrl.substring(0, 50)}...`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        const contentType = imageResponse.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) {
          throw new Error(`Invalid content-type: ${contentType}`);
        }
        imageMimeType = contentType;
        const imageBuffer = await imageResponse.arrayBuffer();
        imageBase64 = Buffer.from(imageBuffer).toString("base64");
        logger.info(`[generateHairstyleImage] Image fetched successfully. MimeType: ${imageMimeType}`);
      } catch (fetchError) {
        logger.error("[generateHairstyleImage] Failed to fetch or process image:", fetchError);
        res.status(500).json({error: "Image Fetch Error", message: `画像の取得に失敗しました: ${fetchError.message}`});
        return;
      }

      // 4. Gemini API リクエストペイロードの作成 (Nano-banana / Inpainting)
      // PDFの指示書に基づき、顔を変えずに髪型を合成するプロンプトを構築
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

      const prompt = `
（指示書: PDF 2-5ページ）
**目的:** 元画像の顔の特徴（顔の輪郭、目、鼻、口、肌の質感）を一切変更せず、指定されたヘアスタイルを極めて自然に合成（インペインティング）する。
**元画像:** [添付された元画像]
**マスク:** [添付されたマスク画像]
**指示:**
1.  **品質:** masterpiece, best quality, photorealistic hair, ultra realistic, lifelike hair texture, individual hair strands visible
2.  **スタイル:** ${hairstyleName} (${hairstyleDesc})
3.  **カラー:** ${haircolorName} (${haircolorDesc})
4.  **光:** 元画像の照明（soft natural daylight, bright studio lightingなど）と一致させること。
5.  **質感:** soft and airy texture, glossy and sleek など、スタイルに合わせた自然な質感。

**ネガティブプロンプト:**
unnatural color, flat, dull, lifeless hair, helmet-like, wig, hat, hair accessories, blurry, deformed, worst quality, (face changed), (skin texture changed), (different person)
`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {text: prompt},
              {
                inlineData: { // 元画像
                  mimeType: imageMimeType,
                  data: imageBase64,
                },
              },
              {
                inlineData: { // マスク画像 (顔全体をマスク)
                  mimeType: imageMimeType,
                  data: imageBase64, // TODO: 本来は顔領域をマスクした画像を使う
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          // temperature: 0.7, // 必要に応じて調整
        },
      };

      // 5. API呼び出し（リトライ処理付き）
      try {
        const aiResponse = await callGeminiApiWithRetry(apiUrl, payload, 3);
        const generatedBase64 = aiResponse?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;

        if (!generatedBase64) {
          logger.error("[generateHairstyleImage] No image data found in Gemini response.", {response: aiResponse});
          throw new Error("AIからの応答に画像データが含まれていませんでした。");
        }

        logger.info("[generateHairstyleImage] Gemini API request successful. Image generated.");

        // 6. Firebase Storageへのアップロード
        const bucket = storage.bucket(); // デフォルトバケットを取得
        const fileName = `generated/${firebaseUid}/${Date.now()}_${hairstyleName.replace(/ /g, "_")}.png`;
        const file = bucket.file(fileName);
        const buffer = Buffer.from(generatedBase64, "base64");

        logger.info(`[generateHairstyleImage] Uploading generated image to Storage: ${fileName}`);
        await file.save(buffer, {
          metadata: {
            contentType: "image/png",
            metadata: {
              firebaseUid: firebaseUid,
              hairstyle: hairstyleName,
              haircolor: haircolorName,
            },
          },
        });

        // 7. 署名付きURL（1時間有効）の生成
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        logger.info(`[generateHairstyleImage] Signed URL generated successfully.`);

        // 8. 成功レスポンス
        res.status(200).json({
          message: "Image generated and uploaded successfully.",
          imageUrl: signedUrl,
        });
      } catch (apiError) {
        logger.error("[generateHairstyleImage] Gemini API call or Storage upload failed:", apiError);
        res.status(500).json({error: "Image Generation Error", message: `画像生成または保存に失敗しました。\n詳細: ${apiError.message}`});
      }
    });


// --- 疎通確認用エンドポイント (v2) ---
exports.helloWorld = onRequest(corsOptions, (req, res) => {
  logger.info("[helloWorld] Hello world endpoint called!");
  res.status(200).send("Hello from Firebase Functions v2!");
});


// --- ユーティリティ: リトライ付きAPI呼び出し ---
/**
 * 指数バックオフ（Exponential Backoff）リトライ付きでGemini APIを呼び出す
 * @param {string} url - APIエンドポイントURL
 * @param {object} payload - 送信するペイロード
 * @param {number} maxRetries - 最大リトライ回数
 * @return {Promise<object>} - APIからのレスポンス（JSONパース済み）
 */
async function callGeminiApiWithRetry(url, payload, maxRetries = 3) {
  let attempt = 0;
  let delay = 1000; // 1秒から開始

  while (attempt < maxRetries) {
    attempt++;
    logger.info(`[callGeminiApiWithRetry] Attempt ${attempt}/${maxRetries} to call: ${url.split("?")[0]}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        // ★★★ 修正点: AIの応答オブジェクト全体をそのまま返す ★★★
        return data;
      }

      // リトライ対象のエラー (429: レート制限, 500/503: サーバーエラー)
      if (response.status === 429 || response.status === 500 || response.status === 503) {
        logger.warn(`[callGeminiApiWithRetry] Received status ${response.status}. Retrying in ${delay}ms...`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // バックオフ時間を2倍に
        } else {
          throw new Error(`Gemini API failed with status ${response.status} after ${maxRetries} attempts.`);
        }
      } else {
        // 400 (Bad Request) など、リトライしても無駄なエラー
        const errorBody = await response.json();
        logger.error(`[callGeminiApiWithRetry] Received non-retriable status ${response.status}:`, errorBody);
        throw new Error(`Gemini API failed with status ${response.status}: ${JSON.stringify(errorBody)}`);
      }
    } catch (fetchError) {
      logger.error(`[callGeminiApiWithRetry] Fetch attempt ${attempt} failed:`, fetchError);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw new Error(`Gemini API fetch failed after ${maxRetries} attempts: ${fetchError.message}`);
      }
    }
  }
  // ループが完了しても成功しなかった場合（理論上到達しないが）
  throw new Error(`Gemini API call failed exhaustively after ${maxRetries} retries.`);
}

