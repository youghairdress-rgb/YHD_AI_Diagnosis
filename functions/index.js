    const functions = require("firebase-functions");
    const logger = require("firebase-functions/logger");
    const cors = require("cors")({origin: true});

    // 環境変数からAPIキーを取得 (デプロイ後に値がセットされる)
    // ローカルエミュレータ実行時は .runtimeconfig.json を参照する
    const llmApiKey = functions.config().llm?.apikey;
    const imageGenApiKey = functions.config().imagegen?.apikey;

    // APIキーが設定されているか起動時に確認 (ログに出力)
    if (!llmApiKey) {
      logger.warn("LLM API Key (llm.apikey) is not set in Functions config.");
    }
    if (!imageGenApiKey) {
      logger.warn("Image Generation API Key (imagegen.apikey) is not set in Functions config.");
    }

    exports.requestDiagnosis = functions.https.onRequest((req, res) => {
      cors(req, res, () => {
        if (req.method !== "POST") {
          return res.status(405).send("Method Not Allowed");
        }

        try {
          const {fileUrls, userProfile, gender} = req.body;

          logger.info("Received diagnosis request:", {
            userId: userProfile.userId,
            displayName: userProfile.displayName,
            gender: gender,
            fileCount: Object.keys(fileUrls).length,
          });

          // TODO: ここに、AI (LLM) にリクエストを送る処理を実装します
          // 例: if (llmApiKey) { /* LLM API呼び出し */ } else { logger.error("LLM API Key not configured"); /* エラー処理 */ }
          logger.info(`Using LLM API Key (first few chars): ${llmApiKey?.substring(0, 5)}...`); // 実際のキー全体をログに出さないように注意

          const dummyDiagnosisResult = {
            face: {
              nose: "丸みのある鼻",
              mouth: "ふっくらした唇",
              eyes: "丸い",
              eyebrows: "平行眉",
              forehead: "広め",
            },
            skeleton: {
              neckLength: "普通",
              faceShape: "丸顔",
              bodyLine: "ストレート",
              shoulderLine: "なだらか",
            },
            personalColor: {
              baseColor: "イエローベース",
              season: "スプリング",
              brightness: "高",
              saturation: "中",
              eyeColor: "ライトブラウン",
            },
          };

          res.status(200).json({
            message: "Diagnosis request received successfully!",
            result: dummyDiagnosisResult,
          });
        } catch (error) {
          logger.error("Error processing diagnosis request:", error);
          res.status(500).send("Internal Server Error");
        }
      });
    });

    // (ロードマップ 1-9) API疎通確認用のエンドポイントを追加
    exports.helloWorld = functions.https.onRequest((req, res) => {
      cors(req, res, () => {
        logger.info("Hello world endpoint called!");
        res.status(200).send("Hello from Firebase Functions!");
      });
    });
    
