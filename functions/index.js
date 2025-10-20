const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const cors = require("cors")({origin: true});

// この関数が、フロントエンドから呼び出されるAPIの本体です
exports.requestDiagnosis = functions.https.onRequest((req, res) => {
  // CORSミドルウェアを使用して、異なるドメインからのリクエストを許可します
  cors(req, res, () => {
    // POSTリクエスト以外は受け付けないようにします
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      // フロントエンドから送信されたデータを取得します
      const {fileUrls, userProfile, gender} = req.body;

      // ログに受信したデータを記録します（デバッグ用）
      logger.info("Received diagnosis request:", {
        userId: userProfile.userId,
        displayName: userProfile.displayName,
        gender: gender,
        fileCount: Object.keys(fileUrls).length,
      });

      // TODO: ここに、AI (LLM) にリクエストを送る処理を実装します
      // 今は、AIからのダミーの診断結果を返します
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

      // 成功したことをフロントエンドに伝えます
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

