
import React, { useState, useRef, useCallback, DragEvent } from 'react';
import { AppStatus } from './types';
import { extractTextFromImage } from './services/geminiService';
import { CameraIcon, UploadIcon, WandIcon, SaveIcon, ShutterIcon, CancelIcon } from './components/Icons';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'];

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupImage = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageFile(null);
    setImageUrl(null);
  }, [imageUrl]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setStatus(AppStatus.IDLE);
  }, []);
  
  const handleFile = (file: File) => {
    if (status === AppStatus.CAMERA_ACTIVE) {
        stopCamera();
    }
    setError(null);
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      setError(`非対応のファイル形式です。対応形式: JPEG, PNG, BMP, WEBP`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`ファイルサイズが大きすぎます。10MBまで対応しています。`);
      return;
    }
    
    cleanupImage();
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setStatus(AppStatus.IDLE);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset file input to allow selecting the same file again
    event.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleExtractText = async () => {
    if (!imageFile) {
      setError('画像が選択されていません。');
      return;
    }
    setStatus(AppStatus.LOADING);
    setError(null);
    setExtractedText('');
    try {
        const result = await extractTextFromImage(imageFile);
        setExtractedText(result);
        setStatus(AppStatus.SUCCESS);
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("不明なエラーが発生しました。");
        }
        setStatus(AppStatus.ERROR);
    }
  };

  const handleSave = () => {
    if (!extractedText) {
        alert('保存するテキストがありません。');
        return;
    }
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    a.download = `extracted_text_${formattedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startCamera = async () => {
    cleanupImage();
    setError(null);
    setStatus(AppStatus.CAMERA_ACTIVE);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
    } catch (err) {
        console.error("Camera error:", err);
        setError("カメラにアクセスできませんでした。ブラウザの権限設定を確認してください。");
        setStatus(AppStatus.ERROR);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
                handleFile(file);
            }
        }, 'image/png');
    }
    stopCamera();
  };

  const renderUploadArea = () => {
    if (status === AppStatus.CAMERA_ACTIVE) {
        return (
            <div className="w-full h-full relative bg-black rounded-lg overflow-hidden flex flex-col justify-center items-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain"></video>
                <div className="absolute bottom-4 flex space-x-4">
                    <button onClick={capturePhoto} className="p-4 rounded-full bg-white text-dark-gray hover:bg-gray-200 transition-all duration-200 shadow-lg" aria-label="シャッター">
                        <ShutterIcon className="w-8 h-8"/>
                    </button>
                    <button onClick={stopCamera} className="p-4 rounded-full bg-accent-red text-white hover:bg-accent-red-dark transition-all duration-200 shadow-lg" aria-label="キャンセル">
                        <CancelIcon className="w-8 h-8"/>
                    </button>
                </div>
            </div>
        );
    }

    if (imageUrl) {
        return (
            <div className="w-full h-full relative group bg-cream/50">
              <img src={imageUrl} alt="アップロードされた画像" className="max-h-full max-w-full h-full w-full object-contain rounded-lg" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-opacity duration-300 flex flex-col justify-center items-center gap-4 opacity-0 group-hover:opacity-100 rounded-lg">
                <div className="text-center">
                  <p className="text-white font-bold text-lg drop-shadow-md">画像を差し替える</p>
                  <div className="mt-4 flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="px-6 py-2 bg-white/90 backdrop-blur-sm border border-transparent rounded-md text-dark-gray hover:bg-white transition-colors duration-200 shadow-md font-semibold"
                      >
                          ファイルを選択
                      </button>
                      <button 
                        onClick={startCamera} 
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-white/90 backdrop-blur-sm border border-transparent rounded-md text-dark-gray hover:bg-white transition-colors duration-200 shadow-md font-semibold"
                      >
                          <CameraIcon className="w-5 h-5" />
                          <span>再撮影する</span>
                      </button>
                  </div>
                </div>
              </div>
            </div>
          );
    }

    return (
      <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
        <UploadIcon className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-dark-gray font-semibold mb-2">ここに画像をドラッグ＆ドロップ</p>
        <p className="text-gray-500 text-sm mb-4">または</p>
        <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-white border border-gray-300 rounded-md text-dark-gray hover:bg-gray-100 transition-colors duration-200 shadow-sm">
                ファイルを選択
            </button>
            <button onClick={startCamera} className="flex items-center justify-center gap-2 px-6 py-2 bg-white border border-gray-300 rounded-md text-dark-gray hover:bg-gray-100 transition-colors duration-200 shadow-sm">
                <CameraIcon className="w-5 h-5" />
                <span>撮影する</span>
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-dark-gray flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-4xl bg-white/70 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 ring-1 ring-black ring-opacity-5">
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-dark-gray">テキスト抽出ツール</h1>
          <p className="text-gray-500 mt-2">画像から文字を読み取り、編集可能なテキストに変換します。</p>
        </header>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p>{error}</p></div>}

        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept={SUPPORTED_FORMATS.join(',')} className="hidden" />

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`w-full h-64 md:h-80 flex justify-center items-center bg-cream/50 rounded-xl border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-accent-green scale-105' : 'border-gray-300'}`}
        >
          {renderUploadArea()}
        </div>
        
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <button onClick={handleExtractText} disabled={!imageFile || status === AppStatus.LOADING} className="flex items-center gap-2 px-6 py-3 bg-accent-green text-white font-bold rounded-lg shadow-md hover:bg-accent-green-dark transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-green-dark disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100">
            {status === AppStatus.LOADING ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : <WandIcon className="w-5 h-5" />}
            <span>{status === AppStatus.LOADING ? '読み込み中...' : '画像読み込み'}</span>
          </button>
          <button onClick={handleSave} disabled={!extractedText} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-colors duration-200 disabled:bg-gray-200 disabled:cursor-not-allowed">
            <SaveIcon className="w-5 h-5 text-gray-600"/>
            <span className="font-medium">保存</span>
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="extracted-text" className="font-semibold text-lg">抽出テキストエリア</label>
          <textarea
            id="extracted-text"
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            placeholder="ここに抽出されたテキストが表示されます..."
            className="w-full h-64 p-4 bg-cream/50 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent-green focus:border-accent-green transition-colors duration-200 resize-y"
            aria-live="polite"
          ></textarea>
           <p className="text-xs text-gray-500 text-center">※ 手書き文字や不鮮明な画像の場合、認識精度が低下することがあります。</p>
        </div>
      </main>
    </div>
  );
};

export default App;
