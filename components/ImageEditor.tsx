import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Language } from '../types';
import { translations } from '../translations';

interface ImageEditorProps {
    initialImage: string;
    onFinish: (newImage: string | null) => void;
    getAi: () => GoogleGenAI | null;
    language: Language;
}

const LoadingModal: React.FC<{ message: string }> = ({ message }) => (
    <div className="absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-sm" aria-modal="true" role="dialog">
        <div className="bg-[var(--background)] rounded-lg shadow-xl p-8 w-full max-w-sm text-center">
            <svg className="animate-spin h-8 w-8 text-[var(--primary)] mb-4 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium text-[var(--text-primary)]">{message}</p>
        </div>
    </div>
);


export const ImageEditor: React.FC<ImageEditorProps> = ({ initialImage, onFinish, getAi, language }) => {
    const [currentImage, setCurrentImage] = useState(initialImage);
    const [prompt, setPrompt] = useState('');
    const [brushSize, setBrushSize] = useState(30);
    const [mode, setMode] = useState<'draw' | 'erase'>('draw');
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const t = translations[language];

    const resizeCanvas = useCallback(() => {
        const image = imageRef.current;
        const canvas = canvasRef.current;
        if (image && canvas) {
            canvas.width = image.clientWidth;
            canvas.height = image.clientHeight;
        }
    }, []);

    useEffect(() => {
        const image = imageRef.current;
        if (!image) return;

        image.onload = resizeCanvas;
        window.addEventListener('resize', resizeCanvas);
        
        return () => {
            if(image) image.onload = null;
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [currentImage, resizeCanvas]);

    const getCoords = (e: React.MouseEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'; // Red, 30% transparent
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out';
        ctx.stroke();
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        isDrawing.current = true;
        lastPos.current = getCoords(e);
    }
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing.current) return;
        const newPos = getCoords(e);
        drawLine(lastPos.current.x, lastPos.current.y, newPos.x, newPos.y);
        lastPos.current = newPos;
    }
    const handleMouseUp = () => { isDrawing.current = false; }
    
    const clearMask = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if(canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            alert('Please enter a prompt to describe your edit.');
            return;
        }
        const ai = getAi();
        if (!ai) {
            alert(t.errorAiInit);
            return;
        }

        setIsGenerating(true);
        setResults([]);
        
        try {
            // Create a composite image of the original + mask
            const tempCanvas = document.createElement('canvas');
            const image = imageRef.current;
            const mask = canvasRef.current;

            if (!image || !mask) throw new Error("Image or mask canvas not found");
            
            tempCanvas.width = image.naturalWidth;
            tempCanvas.height = image.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not get 2d context for temp canvas");
            
            ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
            ctx.drawImage(mask, 0, 0, image.naturalWidth, image.naturalHeight);

            const compositeImage = tempCanvas.toDataURL('image/png');
            const [header, data] = compositeImage.split(',');
            const mimeType = header.match(/data:(.*);base64/)?.[1] || 'image/png';
            
            const fullPrompt = `${prompt}. ${t.promptPlaceholder}`;
            
            const generate = async () => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: {
                        parts: [
                            { inlineData: { data, mimeType } },
                            { text: fullPrompt },
                        ],
                    },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
                return null;
            }

            // Generate two images
            const [res1, res2] = await Promise.all([generate(), generate()]);
            const validResults = [res1, res2].filter((res): res is string => res !== null);
            
            if (validResults.length === 0) throw new Error("AI failed to generate images.");
            
            setResults(validResults);

        } catch (error) {
            console.error(error);
            alert(`Error generating edits: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGenerating(false);
        }
    }

    const handleSelectResult = (image: string, finish: boolean) => {
        if(finish) {
            onFinish(image);
        } else {
            setCurrentImage(image);
            clearMask();
            setResults([]);
        }
    }

    return (
        <div className="w-full h-full flex flex-col bg-[var(--background)]">
            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-center p-3 border-b border-[var(--border-color)]">
                 <button onClick={() => onFinish(null)} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    {t.backToOverview}
                </button>
                <h2 className="text-lg font-bold">{t.imageEditor}</h2>
                <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || !prompt.trim()}
                    className="inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-bold text-white bg-[var(--primary)] hover:bg-indigo-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t.generate}
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-72 flex-shrink-0 bg-[var(--background)] border-r border-[var(--border-color)] p-4 space-y-6 overflow-y-auto">
                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t.addPrompt}</h3>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={5}
                            placeholder={t.promptPlaceholder}
                            className="form-textarea w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold mb-2">{t.maskTools}</h3>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="brush-size" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t.brushSize}: {brushSize}px</label>
                                <input id="brush-size" type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setMode('draw')} className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${mode === 'draw' ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900'}`}>{t.draw}</button>
                                <button onClick={() => setMode('erase')} className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${mode === 'erase' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900'}`}>{t.erase}</button>
                            </div>
                            <button onClick={clearMask} className="w-full px-3 py-2 text-xs font-semibold rounded-md transition-colors bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900">{t.clearMask}</button>
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-grow flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900/50 overflow-auto">
                     <div className="relative w-full h-full flex items-center justify-center">
                        <img ref={imageRef} src={currentImage} crossOrigin="anonymous" alt="Editable image" className="max-w-full max-h-full object-contain block" onLoad={resizeCanvas} />
                        <canvas ref={canvasRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
                          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                        />
                         {isGenerating && <LoadingModal message={t.generatingEdits} />}
                    </div>
                </div>
            </div>

            {/* Results Modal */}
            {results.length > 0 && (
                <div className="absolute inset-0 bg-black/60 z-40 flex items-center justify-center p-4 backdrop-blur-sm" aria-modal="true" role="dialog">
                    <div className="bg-[var(--background)] rounded-xl shadow-2xl p-6 w-full max-w-4xl text-center">
                         <h2 className="text-2xl font-bold mb-2">{t.editResults}</h2>
                         <p className="text-[var(--text-secondary)] mb-6">{t.selectOne}</p>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {results.map((src, idx) => (
                                <div key={idx} className="space-y-3">
                                    <img src={src} alt={`Result ${idx + 1}`} className="rounded-lg w-full object-contain aspect-square bg-slate-100 dark:bg-slate-800" />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSelectResult(src, false)} className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300">{t.useAndContinue}</button>
                                        <button onClick={() => handleSelectResult(src, true)} className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700">{t.useAndFinish}</button>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};