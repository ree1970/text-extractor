
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        if (!base64Data) {
          reject(new Error("ファイルのBase64エンコードに失敗しました。"));
          return;
        }
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      } else {
        reject(new Error("ファイルの読み込みに失敗しました。"));
      }
    };
    reader.onerror = () => {
      reject(new Error("ファイルリーダーでエラーが発生しました。"));
    };
  });
};


export const extractTextFromImage = async (imageFile: File): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = {
      text: "この画像からテキストを日本語で抽出してください。テキストのみを返してください。",
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    const text = response.text;

    if (!text) {
        throw new Error("AIからテキストが返されませんでした。画像が不鮮明であるか、テキストが含まれていない可能性があります。");
    }

    return text;
  } catch (error) {
    console.error("テキスト抽出エラー:", error);
    if (error instanceof Error) {
        throw new Error(`テキストの抽出に失敗しました: ${error.message}`);
    }
    throw new Error("テキストの抽出中に不明なエラーが発生しました。");
  }
};
