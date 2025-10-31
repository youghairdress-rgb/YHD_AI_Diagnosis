const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const cors = require("cors")({origin: true});

// Firebase Admin SDK をインポート
const admin = require("firebase-admin");
admin.initializeApp();
const { getStorage } = require("firebase-admin/storage");
const bucket = getStorage().bucket(); // デフォルトバケットを取得

// --- ★ v2構文に変更 ★ ---
// v1 (functions.https.onRequest) から v2 (onRequest) に変更
const {onRequest} = require("firebase-functions/v2/https");
// v2のシークレット管理をインポート
const {defineSecret} = require("firebase-functions/params");

// --- ★ v2シークレット定義 ★ ---
// process.envからdefineSecretに変更。デプロイ前にCLIでの設定が必須
const llmApiKey = defineSecret("LLM_APIKEY");
const imageGenApiKey = defineSecret("IMAGEGEN_APIKEY");

// --- AI診断用の設定 ---
// AIに生成させるJSONのスキーマ (PDFの要件に基づく)
const AI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    result: {
      type: "OBJECT",
      properties: {
        face: {
          type: "OBJECT",
          properties: {
            nose: {type: "STRING", description: "鼻の特徴 (例: 高い, 丸い)"},
            mouth: {type: "STRING", description: "口の特徴 (例: 大きい, 薄い)"},
            eyes: {type: "STRING", description: "目の特徴 (例: 二重, つり目)"},
            eyebrows: {type: "STRING", description: "眉の特徴 (例: アーチ型, ストレート)"},
            forehead: {type: "STRING", description: "おでこの特徴 (例: 広い, 狭い)"},
          },
        },
        skeleton: {
          type: "OBJECT",
          properties: {
            neckLength: {type: "STRING", description: "首の長さ (例: 長い, 短い, 普通)"},
            faceShape: {type: "STRING", description: "顔の形 (例: 丸顔, 面長, ベース型)"},
            bodyLine: {type: "STRING", description: "ボディライン (例: ストレート, ウェーブ, ナチュラル)"},
            shoulderLine: {type: "STRING", description: "肩のライン (例: なで肩, いかり肩)"},
          },
        },
        personalColor: {
          type: "OBJECT",
          properties: {
            baseColor: {type: "STRING", description: "ベースカラー (例: イエローベース, ブルーベース)"},
            season: {type: "STRING", description: "シーズン (例: スプリング, サマー, オータム, ウィンター)"},
            brightness: {type: "STRING", description: "明度 (例: 高明度, 中明度, 低明度)"},
            saturation: {type: "STRING", description: "彩度 (例: 高彩度, 中彩度, 低彩度)"},
            eyeColor: {type: "STRING", description: "瞳の色 (例: ライトブラウン, ダークブラウン)"},
          },
        },
      },
    },
    proposal: {
      type: "OBJECT",
      properties: {
        hairstyles: {
          type: "OBJECT",
          properties: {
            style1: {
              type: "OBJECT",
              properties: {
                name: {type: "STRING", description: "提案ヘアスタイル1のネーミング (例: くびれレイヤーミディ)"},
                description: {type: "STRING", description: "スタイル1の説明 (50-100字程度)"},
              },
            },
            style2: {
              type: "OBJECT",
              properties: {
                name: {type: "STRING", description: "提案ヘアスタイル2のネーミング"},
                description: {type: "STRING", description: "スタイル2の説明 (50-100字程度)"},
              },
            },
          },
        },
        haircolors: {
          type: "OBJECT",
          properties: {
            color1: {
              type: "OBJECT",
              properties: {
                name: {type: "STRING", description: "提案ヘアカラー1のネーミング (例: ミルクティーベージュ)"},
                description: {type: "STRING", description: "カラー1の説明 (50-100字程度)"},
              },
            },
            color2: {
              type: "OBJECT",
              properties: {
                name: {type: "STRING", description: "提案ヘアカラー2のネーミング"},
                description: {type: "STRING", description: "カラー2の説明 (50-100字程度)"},
              },
            },
          },
        },
        comment: {type: "STRING", description: "トップヘアスタイリストとしての総評 (200-300字程度)"},
      },
    },
  },
  required: ["result", "proposal"],
};


// --- 診断リクエスト関数 (★ v2構文に更新 ★) ---
exports.requestDiagnosis = onRequest(
  {
    secrets: [llmApiKey], // ★ v2: 使用するシークレットを明記
  },
  async (req, res) => {
  // CORSミドルウェアを最初に使用
  cors(req, res, async () => {
    if (req.method !== "POST") {
      logger.warn(`Method Not Allowed: ${req.method}`);
      return res.status(405).json({error: "Method Not Allowed"});
    }

    // ★ v2: APIキー（シークレット）のURLと値を取得
    const currentLlmApiKey = llmApiKey.value();
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${currentLlmApiKey}`;

    try {
      const fileUrls = req.body?.fileUrls;
      const userProfile = req.body?.userProfile;
      const gender = req.body?.gender;

      if (!fileUrls || !fileUrls["item-front-photo"] || !userProfile || !gender) {
        logger.error("Bad Request: Missing data for diagnosis.", {body: req.body});
        return res.status(400).json({error: "Bad Request", message: "fileUrls(item-front-photo), userProfile, genderは必須です。"});
      }

      // ★ v2: 値（.value()）をチェック
      if (!currentLlmApiKey) {
        logger.error("LLM API Key is missing. Cannot request diagnosis.");
        return res.status(500).json({error: "Configuration Error", message: "LLM API Key not configured."});
      }

      logger.info("Received diagnosis request:", {
        gender: gender,
        userId: userProfile.userId,
        firebaseUid: userProfile.firebaseUid,
        frontPhotoUrl: fileUrls["item-front-photo"].substring(0, 70) + "...",
      });

      // 1. 正面写真の画像データを取得し、Base64に変換
      let frontImageBase64;
      let imageMimeType;

      try {
        const imageResponse = await fetch(fileUrls["item-front-photo"]);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        imageMimeType = imageResponse.headers.get("content-type") || "image/jpeg";
        // APIがサポートするMIMEタイプ: "image/png", "image/jpeg"
        if (imageMimeType !== "image/png" && imageMimeType !== "image/jpeg") {
            logger.warn(`Unsupported image MIME type: ${imageMimeType}. Forcing image/jpeg.`);
            imageMimeType = "image/jpeg";
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        frontImageBase64 = Buffer.from(imageBuffer).toString("base64");
        logger.info(`Image fetched and encoded (MIME: ${imageMimeType}, Base64 length: ${frontImageBase64.length})`);
      } catch (fetchError) {
        logger.error("Failed to fetch or encode image for diagnosis:", fetchError);
        return res.status(500).json({error: "Image Fetch Error", message: "診断用画像の取得に失敗しました。"});
      }

      // 2. Gemini APIへのリクエストペイロードを作成
      const systemPrompt = `
あなたは日本のトップヘアスタイリストAIです。
美容室のお客様（${gender === "female" ? "女性" : "男性"}）から提供された写真をもとに、顔、骨格、パーソナルカラーをプロの視点で分析・診断し、最適なヘアスタイルとヘアカラーを提案してください。
診断結果と提案は、親しみやすく、プロフェッショナルなトーンで記述してください。
ホットペッパービューティーやオズモールのカタログ（ https://beauty.hotpepper.jp/catalog/ , https://www.ozmall.co.jp/hairsalon/catalog/ ）に掲載されているような、現代的で魅力的なスタイルを参考にしてください。
全てのレスポンスは、必ず指定されたJSONスキーマに従ってください。
`;

      const payload = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType,
                data: frontImageBase64,
              },
            },
            {text: `この写真のお客様（${gender === "female" ? "女性" : "男性"}）を診断し、提案してください。`},
          ],
        }],
        systemInstruction: {
          parts: [
            {text: systemPrompt},
          ],
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          // temperature: 0.7, // 創造性を持たせる
        },
      };

      // 3. Gemini APIを実行
      logger.info("Sending request to Gemini API (Diagnosis)...");
      let geminiResponse;
      let attempts = 0;
      const maxAttempts = 3; // 最大3回リトライ
      const initialDelay = 1000; // 1秒

      while (attempts < maxAttempts) {
        try {
          geminiResponse = await fetch(GEMINI_API_URL, { // ★ v2: 関数内で定義したURLを使用
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
          });

          if (geminiResponse.ok) {
            break; // 成功
          }

          if (geminiResponse.status === 429 || geminiResponse.status >= 500) {
            // リトライ対象のエラー
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error(`Gemini API failed after ${maxAttempts} attempts with status ${geminiResponse.status}`);
            }
            const delay = initialDelay * Math.pow(2, attempts - 1);
            logger.warn(`Gemini API returned ${geminiResponse.status}. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // リトライ対象外のエラー (400 Bad Requestなど)
            const errorBody = await geminiResponse.text();
            logger.error(`Gemini API non-retriable error ${geminiResponse.status}:`, errorBody);
            throw new Error(`Gemini API failed with status ${geminiResponse.status}: ${errorBody}`);
          }
        } catch (fetchError) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`Gemini API fetch failed after ${maxAttempts} attempts: ${fetchError.message}`);
          }
          const delay = initialDelay * Math.pow(2, attempts - 1);
          logger.warn(`Gemini API fetch error. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`, fetchError);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      
      if (!geminiResponse || !geminiResponse.ok) {
         const errorBody = geminiResponse ? await geminiResponse.text() : "No response from Gemini API";
         logger.error(`Gemini API Error ${geminiResponse?.status}:`, errorBody);
         return res.status(500).json({error: "AI API Error", message: `AI診断サーバーでエラーが発生しました: ${errorBody}`});
      }

      const geminiResult = await geminiResponse.json();
      const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
          logger.error("Gemini API Error: No text in response.", geminiResult);
          return res.status(500).json({error: "AI API Error", message: "AIからのレスポンスが空です。"});
      }
      
      // 4. JSONをパースしてフロントエンドに返す
      let parsedJson;
      try {
         parsedJson = JSON.parse(responseText);
      } catch (parseError) {
         logger.error("Gemini API Error: Failed to parse JSON response.", {error: parseError, text: responseText});
         return res.status(500).json({error: "AI API Error", message: "AIが不正なJSON形式を返しました。"});
      }

      if (!parsedJson.result || !parsedJson.proposal) {
           logger.error("Gemini API Error: Invalid JSON structure.", parsedJson);
           return res.status(500).json({error: "AI API Error", message: "AIが期待されたJSON構造を返しませんでした。"});
      }

      logger.info("Diagnosis and proposal generated successfully.");
      
      // フロントエンドが期待する { result: {...}, proposal: {...} } の形式で返す
      res.status(200).json(parsedJson);

    } catch (error) {
      logger.error("Error processing diagnosis request:", error);
      res.status(500).json({error: "Internal Server Error", message: error.message || "An unexpected error occurred."});
    }
  });
});

// --- ★ 画像生成リクエスト (★ v2構文に更新 ★) ---
exports.generateHairstyleImage = onRequest(
  {
    timeoutSeconds: 300, // ★ v2: タイムアウト設定
    secrets: [imageGenApiKey], // ★ v2: 使用するシークレットを明記
  },
  async (req, res) => {
  // CORSミドルウェアを最初に使用
  cors(req, res, async () => {
    if (req.method !== "POST") {
      logger.warn(`[generateHairstyleImage] Method Not Allowed: ${req.method}`);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ★ v2: APIキー（シークレット）のURLと値を取得
    const currentImageGenApiKey = imageGenApiKey.value();
    const IMAGE_GEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${currentImageGenApiKey}`;

    try {
      // ★ v2: 値（.value()）をチェック
      if (!currentImageGenApiKey) {
        logger.error("Image Generation API Key is missing. Cannot generate image.");
        return res.status(500).json({ error: "Configuration Error", message: "Image Generation API Key not configured." });
      }

      // フロントエンドから送信されたデータを取得
      const {
        originalImageUrl,
        hairstyleName,
        hairstyleDesc,
        haircolorName,
        haircolorDesc
      } = req.body;
      
      // ユーザーIDも取得 (Storageのパス作成用)
      const firebaseUid = req.body?.firebaseUid || "unknown_user";


      // 必須データのチェック
      if (!originalImageUrl || !hairstyleName || !haircolorName) {
         logger.error("Bad Request: Missing data for image generation.", { body: req.body });
         return res.status(400).json({ error: "Bad Request", message: "Missing required data (originalImageUrl, hairstyleName, haircolorName)." });
      }

      logger.info("Received image generation request:", {
        userId: firebaseUid,
        originalImageUrl: originalImageUrl.substring(0, 70) + '...',
        style: hairstyleName,
        color: haircolorName,
      });

      // 1. 画像データをフェッチしてBase64にエンコード
      let originalImageBase64;
      let imageMimeType;
      try {
        const imageResponse = await fetch(originalImageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        imageMimeType = imageResponse.headers.get("content-type") || "image/jpeg";
        // APIがサポートするMIMEタイプ: "image/png", "image/jpeg"
        if (imageMimeType !== "image/png" && imageMimeType !== "image/jpeg") {
            logger.warn(`Unsupported image MIME type: ${imageMimeType}. Forcing image/jpeg.`);
            imageMimeType = "image/jpeg";
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        originalImageBase64 = Buffer.from(imageBuffer).toString("base64");
        logger.info(`Original image fetched and encoded (MIME: ${imageMimeType})`);
      } catch (fetchError) {
        logger.error("Failed to fetch or encode image:", fetchError);
        return res.status(500).json({error: "Image Fetch Error", message: "生成元画像の取得に失敗しました。"});
      }

      // 2. Nano-banana (gemini-2.5-flash-image-preview) へのプロンプトを構築
      // PDFの指示書に基づき、インペインティングを指示
      const imageGenPrompt = `
以下の指示書に基づき、提供された画像（元画像）のヘアスタイルを自然に変更してください。

### 指示書 (Inpainting) ###
1.  **目的**: 元画像の「顔部分は変えずに」、指定されたヘアスタイルを「極めて自然に合成」する。
2.  **基本方針**: 顔の輪郭、目、鼻、口、肌の質感は「絶対に保護」する。
3.  **最優先事項**: 生成する髪が元画像の「上に乗っている」ように見せず、自然な「なじみ」と「照明の一貫性」を追求する。
4.  **ネガティブ**: wig (ウィッグ), helmet-like (ヘルメットのよう), hat, hair accessories, blurry, deformed

### 適用するスタイル ###
* **ヘアスタイル**: ${hairstyleName} (${hairstyleDesc || ''})
* **ヘアカラー**: ${haircolorName} (${haircolorDesc || ''})

### 品質キーワード ###
masterpiece, best quality, photorealistic hair, ultra realistic, lifelike hair texture, individual hair strands visible, (元画像の照明に合わせて: soft natural lighting)
`;

      const payload = {
        contents: [{
            parts: [
              { text: imageGenPrompt },
              {
                inlineData: {
                  mimeType: imageMimeType,
                  data: originalImageBase64
                }
              }
            ]
        }],
        generationConfig: {
            responseModalities: ['IMAGE'] // 画像のみをレスポンス
        },
      };

      // 3. 画像生成AI APIを実行 (リトライ処理付き)
      logger.info("Sending request to Image Generation API (Nano-banana)...");
      let genApiResponse;
      let attempts = 0;
      const maxAttempts = 3;
      const initialDelay = 2000; // 画像生成は時間がかかるため長め

      while (attempts < maxAttempts) {
        try {
          genApiResponse = await fetch(IMAGE_GEN_API_URL, { // ★ v2: 関数内で定義したURLを使用
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (genApiResponse.ok) {
            break; // 成功
          }

          if (genApiResponse.status === 429 || genApiResponse.status >= 500) {
            // リトライ対象のエラー
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error(`Image Gen API failed after ${maxAttempts} attempts with status ${genApiResponse.status}`);
            }
            const delay = initialDelay * Math.pow(2, attempts - 1);
            logger.warn(`Image Gen API returned ${genApiResponse.status}. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // リトライ対象外のエラー
             const errorBody = await genApiResponse.text();
             logger.error(`Image Gen API non-retriable error ${genApiResponse.status}:`, errorBody);
            throw new Error(`Image Gen API failed with status ${genApiResponse.status}: ${errorBody}`);
          }
        } catch (fetchError) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`Image Gen API fetch failed after ${maxAttempts} attempts: ${fetchError.message}`);
          }
          const delay = initialDelay * Math.pow(2, attempts - 1);
          logger.warn(`Image Gen API fetch error. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`, fetchError);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!genApiResponse || !genApiResponse.ok) {
         const errorBody = genApiResponse ? await genApiResponse.text() : "No response from Image Gen API";
         logger.error(`Image Gen API Error ${genApiResponse?.status}:`, errorBody);
         return res.status(500).json({error: "AI API Error", message: `画像生成サーバーでエラーが発生しました: ${errorBody}`});
      }

      const genApiResult = await genApiResponse.json();
      const generatedBase64 = genApiResult?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      const generatedMimeType = genApiResult?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.mimeType || "image/png";

      if (!generatedBase64) {
          logger.error("Image Gen API Error: No image data in response.", genApiResult);
          return res.status(500).json({error: "AI API Error", message: "AIからの画像データが空です。"});
      }

      logger.info(`Image generated successfully (MIME: ${generatedMimeType}). Uploading to Storage...`);

      // 4. 生成されたBase64画像をStorageにアップロード
      const imageBuffer = Buffer.from(generatedBase64, "base64");
      const timestamp = Date.now();
      const fileExtension = generatedMimeType === "image/png" ? "png" : "jpg";
      // ファイルパスにユーザーIDを含める
      const filePath = `generated/${firebaseUid}/${timestamp}_${hairstyleName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
      
      const file = bucket.file(filePath);
      await file.save(imageBuffer, {
        metadata: {
          contentType: generatedMimeType,
          cacheControl: 'public, max-age=3600', // 1時間キャッシュ
        },
      });

      // 5. 署名付きURL (Signed URL) を取得
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60, // 1時間有効
      });

      logger.info(`Generated image uploaded to Storage: ${filePath}`);

      // 6. フロントエンドにURLを返す
      res.status(200).json({
        message: "Image generated and uploaded successfully.",
        imageUrl: signedUrl // Storageの署名付きURL
      });

    } catch (error) {
      logger.error("Error processing image generation request:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message || "An unexpected error occurred during image generation." });
    }
  });
});


// --- 疎通確認用エンドポイント (★ v2構文に更新 ★) ---
exports.helloWorld = onRequest((req, res) => {
  cors(req, res, () => {
    logger.info("Hello world endpoint called!");
    res.status(200).send("Hello from Firebase Functions!");
  });
});

