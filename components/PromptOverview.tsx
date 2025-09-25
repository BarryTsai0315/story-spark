import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { StoryConfig } from './StoryIdeaGenerator';
import { Language } from '../types';
import { translations } from '../translations';


export interface SceneOverview {
  sceneNumber: number;
  imagePrompt: string;
  videoPrompt: string;
}

interface PromptOverviewProps {
  scenes: SceneOverview[];
  storyConfig: StoryConfig;
  onNewStory: () => void;
  getAi: () => GoogleGenAI | null;
  language: Language;
  onReferenceImageChange: (newImage: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full">
        <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

export const PromptOverview: React.FC<PromptOverviewProps> = ({ scenes, storyConfig, onNewStory, getAi, language, onReferenceImageChange }) => {
  const [generatedImages, setGeneratedImages] = useState<Record<number, string[]>>({});
  const [selectedImages, setSelectedImages] = useState<Record<number, string>>({});
  const [loadingScenes, setLoadingScenes] = useState<Record<number, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
    // When the reference image changes, clear all generated and selected images
    // to prompt the user to regenerate with the new style.
    setGeneratedImages({});
    setSelectedImages({});
  }, [storyConfig.referenceImage]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
          alert(t.errorInvalidImage);
          return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
          alert(t.errorFileSize);
          return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          if (typeof e.target?.result === 'string') {
              onReferenceImageChange(e.target.result);
          }
      };
      reader.onerror = () => {
          alert(t.errorFileRead);
      };
      reader.readAsDataURL(file);
  };

  const generateSingleImage = async (prompt: string): Promise<string | null> => {
      const ai = getAi();
      if (!ai) return null;
  
      try {
        // Since a reference image is now required, we always use the image editing flow with 'gemini-2.5-flash-image-preview'.
        if (!storyConfig.referenceImage) {
            console.error("Reference image is required but was not found.");
            return null;
        }

        const [header, data] = storyConfig.referenceImage.split(',');
        const inputImageData = data;
        const inputImageMimeType = header.match(/data:(.*);base64/)?.[1] || 'image/png';

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: inputImageData,
                            mimeType: inputImageMimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes = part.inlineData.data as string;
                return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            }
        }
        return null;
  
      } catch (err) {
          console.error("Error during image generation:", err);
          return null;
      }
  };

  const handleGenerate = async (sceneNumber: number, prompt: string) => {
    setLoadingScenes(prev => ({ ...prev, [sceneNumber]: true }));
    // Clear previous selection for this scene upon regeneration
    setSelectedImages(prev => {
        const newState = { ...prev };
        delete newState[sceneNumber];
        return newState;
    });

    try {
      // Call twice to get two options, as this model generates one at a time
      const image1 = await generateSingleImage(prompt);
      const image2 = await generateSingleImage(prompt);

      const urls = [image1, image2].filter((url): url is string => url !== null);
      
      if (urls.length > 0) {
          setGeneratedImages(prev => ({...prev, [sceneNumber]: urls}));
      } else {
           throw new Error("Image generation returned no images.");
      }

    } catch (error) {
      console.error(`Error generating image for scene ${sceneNumber}:`, error);
      alert(`Failed to generate image for Scene ${sceneNumber}. Please check the console.`);
    } finally {
      setLoadingScenes(prev => ({ ...prev, [sceneNumber]: false }));
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    for (const scene of scenes) {
        if (!generatedImages[scene.sceneNumber]) {
            await handleGenerate(scene.sceneNumber, scene.imagePrompt);
        }
    }
    setIsGeneratingAll(false);
  };

  const handleSelectImage = (sceneNumber: number, imageSrc: string) => {
    setSelectedImages(prev => ({ ...prev, [sceneNumber]: imageSrc }));
  };

  const handleDownloadAll = () => {
    Object.entries(selectedImages).forEach(([sceneNumber, src]) => {
        const link = document.createElement('a');
        // FIX: The error on line 169 indicates `src` is of type `unknown`. Assuming the line number was off by one and referred to this line, explicitly cast `src` to a string to resolve the type error.
        link.href = src as string;
        link.download = `StorySpark-Scene-${sceneNumber}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
  };

  const allImagesGenerated = scenes.every(s => generatedImages[s.sceneNumber]?.length > 0);
  const allImagesSelected = allImagesGenerated && Object.keys(selectedImages).length === scenes.length;

  return (
    <div className="w-full min-h-screen">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-8">
                {/* Left Sidebar */}
                <aside className="lg:col-span-4 xl:col-span-3 mb-8 lg:mb-0">
                    <div className="sticky top-28 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t.referenceImage}</h3>
                            {storyConfig.referenceImage && (
                                <img src={storyConfig.referenceImage} alt="Reference" className="rounded-lg shadow-md w-full object-cover aspect-square" />
                            )}
                            <input
                                type="file"
                                ref={imageInputRef}
                                onChange={handleFileChange}
                                className="sr-only"
                                accept="image/png, image/jpeg, image/gif"
                            />
                            <button
                                onClick={() => imageInputRef.current?.click()}
                                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                               {t.changeImage}
                            </button>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t.promptOverview}</h3>
                             <p className="text-sm text-slate-500 mt-1">{t.imageGenerationModel}: <span className="font-mono bg-slate-100 dark:bg-slate-800 dark:text-slate-300 p-1 rounded-md text-xs">Gemini 2.5 Flash Image (Nano Banana)</span></p>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="lg:col-span-8 xl:col-span-9">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                         <h2 className="text-4xl font-bold text-[var(--text-primary)]">{t.promptOverview}</h2>
                        <div className="flex gap-3 flex-shrink-0">
                            <button 
                              onClick={handleGenerateAll} 
                              disabled={isGeneratingAll || allImagesGenerated}
                              className="inline-flex items-center gap-2 justify-center rounded-lg px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c.3 0 .5.1.8.3l6.4 3.7c.3.2.5.5.5.8v7.4c0 .3-.2.6-.5.8l-6.4 3.7c-.3.2-.5.3-.8.3s-.5-.1-.8-.3L4.8 16c-.3-.2-.5-.5-.5-.8V8.6c0-.3.2-.6.5-.8L11.2 3.3c.3-.2.5-.3.8-.3zM12 5.1L6.4 8.2 12 11.3l5.6-3.1L12 5.1zM4 9.4v6l7 4.1v-8.2L4 9.4zM19 15.4v-6L13 13.5v8.2l6-4.1z"/></svg>
                                {isGeneratingAll ? t.generating : (allImagesGenerated ? t.allGenerated : t.generateAll)}
                            </button>
                            <button 
                              onClick={handleDownloadAll} 
                              disabled={!allImagesSelected}
                              className="inline-flex items-center gap-2 justify-center rounded-lg px-5 py-3 text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                {t.downloadAll}
                            </button>
                        </div>
                    </div>
                    
                    <div className="bg-[var(--input-bg)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
                        <div className="grid grid-cols-12 gap-x-6 px-6 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="col-span-1">{t.scene}</div>
                            <div className="col-span-4">{t.imagePrompt}</div>
                            <div className="col-span-4">{t.videoPrompt}</div>
                            <div className="col-span-3 text-center">{t.actions}</div>
                        </div>
                        <div className="divide-y divide-[var(--border-color)]">
                        {scenes.map(scene => (
                            <div key={scene.sceneNumber} className="grid grid-cols-12 gap-x-6 px-6 py-4 items-center">
                                <div className="col-span-1 text-sm font-bold text-[var(--text-primary)]">{t.scene} {scene.sceneNumber}</div>
                                <div className="col-span-4 text-sm text-[var(--text-secondary)] leading-relaxed">{scene.imagePrompt}</div>
                                <div className="col-span-4 text-sm text-[var(--text-secondary)] leading-relaxed">{scene.videoPrompt}</div>
                                <div className="col-span-3">
                                    {loadingScenes[scene.sceneNumber] ? <LoadingSpinner /> : 
                                     generatedImages[scene.sceneNumber] ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex gap-2 justify-center">
                                                {generatedImages[scene.sceneNumber].map((src, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${selectedImages[scene.sceneNumber] === src ? 'ring-4 ring-offset-1 ring-indigo-500' : 'ring-1 ring-gray-300 hover:ring-indigo-400'}`}
                                                        onClick={() => handleSelectImage(scene.sceneNumber, src)}
                                                    >
                                                        <img src={src} alt={`Scene ${scene.sceneNumber} option ${idx + 1}`} className="w-28 h-28 object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                            <button 
                                                onClick={() => handleGenerate(scene.sceneNumber, scene.imagePrompt)}
                                                disabled={loadingScenes[scene.sceneNumber]}
                                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                                {t.regenerate}
                                            </button>
                                        </div>
                                     ) : (
                                        <div className="text-center">
                                            <button 
                                                onClick={() => handleGenerate(scene.sceneNumber, scene.imagePrompt)}
                                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 1.9a3 3 0 0 0 0 4.2L12 11l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m16.5 7.5-1.9 1.9a3 3 0 0 0 0 4.2L16.5 15l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m7.5 16.5-1.9 1.9a3 3 0 0 0 0 4.2L7.5 21l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m3 12 1.9 1.9a3 3 0 0 0 4.2 0L11 12l-1.9-1.9a3 3 0 0 0-4.2 0Z"/><path d="m21 12-1.9-1.9a3 3 0 0 0-4.2 0L13.1 12l1.9 1.9a3 3 0 0 0 4.2 0Z"/></svg>
                                                {t.generate}
                                            </button>
                                        </div>
                                     )}
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>
  );
};
