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
  onEditImageStart: () => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full">
        <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

export const PromptOverview: React.FC<PromptOverviewProps> = ({ scenes, storyConfig, onNewStory, getAi, language, onReferenceImageChange, onEditImageStart }) => {
  const [generatedImages, setGeneratedImages] = useState<Record<number, string[]>>({});
  const [selectedImages, setSelectedImages] = useState<Record<number, string>>({});
  const [loadingScenes, setLoadingScenes] = useState<Record<number, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  // State for sequential generation
  const [isSequentialGenerating, setIsSequentialGenerating] = useState(false);
  const [currentSequentialScene, setCurrentSequentialScene] = useState<number | null>(null);
  const [sequentialImages, setSequentialImages] = useState<string[]>([]);
  const [tempSelectedImage, setTempSelectedImage] = useState<string | null>(null);
  const [isSequentialSceneLoading, setIsSequentialSceneLoading] = useState(false);


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

  const generateImageForScene = async (prompt: string, referenceImage: string, previousImage?: string): Promise<string | null> => {
      const ai = getAi();
      if (!ai) return null;
  
      try {
          const parts: any[] = [];
          let enhancedPrompt = '';

          const [refHeader, refData] = referenceImage.split(',');
          parts.push({
              inlineData: {
                  data: refData,
                  mimeType: refHeader.match(/data:(.*);base64/)?.[1] || 'image/png',
              }
          });

          if (previousImage) {
              const [prevHeader, prevData] = previousImage.split(',');
              parts.push({
                  inlineData: {
                      data: prevData,
                      mimeType: prevHeader.match(/data:(.*);base64/)?.[1] || 'image/png',
                  }
              });
              enhancedPrompt = `You are given two images. The first is the ORIGINAL reference image that defines the character and style. The second is the image from the PREVIOUS scene. 
              Your task is to generate a new image. 
              1. You MUST STRICTLY adhere to the character design, art style, color palette, and overall aesthetic from the FIRST (original) reference image.
              2. Use the SECOND (previous scene) image for compositional and narrative continuity.
              3. The new scene should be based on this prompt: "${prompt}"`;
          } else {
              enhancedPrompt = `Your task is to generate an image based on the text prompt. You MUST STRICTLY adhere to the character design, art style, color palette, and overall aesthetic of the provided reference image. DO NOT deviate from the reference image's style. The character's appearance MUST remain identical. The text prompt is: "${prompt}"`;
          }

          parts.push({ text: enhancedPrompt });

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image-preview',
              contents: { parts },
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
    setSelectedImages(prev => {
        const newState = { ...prev };
        delete newState[sceneNumber];
        return newState;
    });

    try {
      const image1 = await generateImageForScene(prompt, storyConfig.referenceImage!);
      const image2 = await generateImageForScene(prompt, storyConfig.referenceImage!);
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
        link.href = src as string;
        link.download = `StorySpark-Scene-${sceneNumber}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
  };
  
  const handleSequentialRegenerate = async () => {
    if (currentSequentialScene === null || isSequentialSceneLoading) return;

    setIsSequentialSceneLoading(true);
    setTempSelectedImage(null);
    setSequentialImages([]);

    const currentIndex = scenes.findIndex(s => s.sceneNumber === currentSequentialScene);
    const scene = scenes[currentIndex];
    
    let previousImage: string | undefined = undefined;
    if (currentIndex > 0) {
        const previousScene = scenes[currentIndex - 1];
        previousImage = selectedImages[previousScene.sceneNumber];
    }
    
    const [image1, image2] = await Promise.all([
        generateImageForScene(scene.imagePrompt, storyConfig.referenceImage!, previousImage),
        generateImageForScene(scene.imagePrompt, storyConfig.referenceImage!, previousImage)
    ]);
    
    setSequentialImages([image1, image2].filter(Boolean) as string[]);
    setIsSequentialSceneLoading(false);
  }

  const handleStartSequential = async () => {
    if (!storyConfig.referenceImage) {
      alert(t.errorNoReferenceImage);
      return;
    }
    setGeneratedImages({});
    setSelectedImages({});
    setTempSelectedImage(null);
    setIsSequentialGenerating(true);
    setCurrentSequentialScene(scenes[0].sceneNumber);
    setIsSequentialSceneLoading(true);

    const scene = scenes[0];
    const [image1, image2] = await Promise.all([
        generateImageForScene(scene.imagePrompt, storyConfig.referenceImage),
        generateImageForScene(scene.imagePrompt, storyConfig.referenceImage)
    ]);
    
    setSequentialImages([image1, image2].filter(Boolean) as string[]);
    setIsSequentialSceneLoading(false);
  };

  const handleConfirmAndNext = async () => {
    if (!tempSelectedImage || currentSequentialScene === null) return;

    const newSelectedImages = { ...selectedImages, [currentSequentialScene]: tempSelectedImage };
    setSelectedImages(newSelectedImages);
    setGeneratedImages(prev => ({ ...prev, [currentSequentialScene]: [tempSelectedImage] }));

    const currentIndex = scenes.findIndex(s => s.sceneNumber === currentSequentialScene);
    if (currentIndex === scenes.length - 1) {
        setIsSequentialGenerating(false);
        setCurrentSequentialScene(null);
    } else {
        const nextScene = scenes[currentIndex + 1];
        setCurrentSequentialScene(nextScene.sceneNumber);
        setTempSelectedImage(null);
        setIsSequentialSceneLoading(true);

        const [image1, image2] = await Promise.all([
            generateImageForScene(nextScene.imagePrompt, storyConfig.referenceImage!, tempSelectedImage),
            generateImageForScene(nextScene.imagePrompt, storyConfig.referenceImage!, tempSelectedImage)
        ]);
        
        setSequentialImages([image1, image2].filter(Boolean) as string[]);
        setIsSequentialSceneLoading(false);
    }
  };

  const handleCancelSequential = () => {
    setIsSequentialGenerating(false);
    setCurrentSequentialScene(null);
    setGeneratedImages({});
    setSelectedImages({});
  };


  const allImagesGenerated = scenes.every(s => generatedImages[s.sceneNumber]?.length > 0);
  const allImagesSelected = allImagesGenerated && Object.keys(selectedImages).length === scenes.length;

  const SequentialGenerationModal = () => {
    if (!isSequentialGenerating || currentSequentialScene === null) return null;

    const scene = scenes.find(s => s.sceneNumber === currentSequentialScene)!;
    const sceneIndex = scenes.findIndex(s => s.sceneNumber === currentSequentialScene);
    const isLastScene = sceneIndex === scenes.length - 1;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-md p-4" aria-modal="true" role="dialog">
            <div className="bg-[var(--background)] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex-shrink-0 p-6 pb-4 border-b border-[var(--border-color)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t.sequentialGenerateTitle}</h2>
                            <p className="text-[var(--text-secondary)] font-semibold">{t.sceneProgress.replace('{current}', String(sceneIndex + 1)).replace('{total}', String(scenes.length))}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleSequentialRegenerate}
                                disabled={isSequentialSceneLoading}
                                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                {t.regenerate}
                            </button>
                            <button onClick={handleCancelSequential} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main scrollable content area */}
                <div className="flex-grow overflow-y-auto p-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm text-[var(--text-secondary)] mb-4 border border-[var(--border-color)]">
                        <strong>Prompt:</strong> {scene.imagePrompt}
                    </div>
                    <div className="flex items-center justify-center min-h-[300px]">
                        {isSequentialSceneLoading ? <LoadingSpinner /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {sequentialImages.map((src, idx) => (
                                    <div key={idx} className="relative w-full aspect-square cursor-pointer group" onClick={() => setTempSelectedImage(src)}>
                                        <img src={src} alt={`Option ${idx+1}`} className="w-full h-full object-contain rounded-lg bg-slate-100 dark:bg-slate-800" />
                                        <div className={`absolute inset-0 rounded-lg transition-all ${tempSelectedImage === src ? 'ring-4 ring-offset-2 ring-indigo-500' : 'ring-1 ring-transparent group-hover:ring-indigo-400'}`}></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {sequentialImages.length === 0 && !isSequentialSceneLoading && <p className="text-center text-red-500 mt-4">Failed to generate images. Please try again.</p>}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-6 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex justify-end items-center gap-4">
                        {!tempSelectedImage && <p className="text-sm text-amber-600 dark:text-amber-400 font-medium animate-pulse">{t.selectAnImage}</p>}
                        <button onClick={handleConfirmAndNext} disabled={!tempSelectedImage || isSequentialSceneLoading} className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed">
                            {isLastScene ? t.confirmSelectionLast : t.confirmSelection}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="w-full min-h-screen">
        <SequentialGenerationModal />
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
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={onEditImageStart}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5.22c-1.25 0-2.5 1.06-4 1.06-1.5 0-2.75-1.06-4-1.06-3 0-6 8-6 12.22A4.91 4.91 0 0 0 7 19.78c1.25 0 2.5-1.06 4-1.06z"/><path d="M12 2.06c-1.5 0-2.75-1.06-4-1.06C5 1 2 9 2 13.22A4.91 4.91 0 0 0 7 18.78c1.25 0 2.5-1.06 4-1.06 1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 6.22c-1.25 0-2.5-1.06-4-1.06z"/></svg>
                                   {t.editImage}
                                </button>
                                <button
                                    onClick={() => imageInputRef.current?.click()}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                   {t.changeImage}
                                </button>
                            </div>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t.promptOverview}</h3>
                             <p className="text-sm text-slate-500 mt-1">{t.imageGenerationModel}: <span className="font-mono bg-slate-100 dark:bg-slate-800 dark:text-slate-300 p-1 rounded-md text-xs">gemini-2.5-flash-image-preview</span></p>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="lg:col-span-8 xl:col-span-9">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                         <h2 className="text-4xl font-bold text-[var(--text-primary)]">{t.promptOverview}</h2>
                        <div className="flex gap-3 flex-shrink-0">
                            <button
                                onClick={handleStartSequential}
                                disabled={isGeneratingAll || isSequentialGenerating}
                                className="inline-flex items-center gap-2 justify-center rounded-lg px-5 py-3 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L12 22"/><path d="M17 5L12 10 7 5"/><path d="M17 12L12 17 7 12"/><path d="M17 19L12 24 7 19"/></svg>
                                {t.sequentialGenerate}
                            </button>
                            <button 
                              onClick={handleGenerateAll} 
                              disabled={isGeneratingAll || allImagesGenerated || isSequentialGenerating}
                              className="inline-flex items-center gap-2 justify-center rounded-lg px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 1.9a3 3 0 0 0 0 4.2L12 11l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m16.5 7.5-1.9 1.9a3 3 0 0 0 0 4.2L16.5 15l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m7.5 16.5-1.9 1.9a3 3 0 0 0 0 4.2L7.5 21l1.9-1.9a3 3 0 0 0 0-4.2Z"/><path d="m3 12 1.9 1.9a3 3 0 0 0 4.2 0L11 12l-1.9-1.9a3 3 0 0 0-4.2 0Z"/><path d="m21 12-1.9-1.9a3 3 0 0 0-4.2 0L13.1 12l1.9 1.9a3 3 0 0 0 4.2 0Z"/></svg>
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
                                            {generatedImages[scene.sceneNumber].length > 1 && (
                                                <button 
                                                    onClick={() => handleGenerate(scene.sceneNumber, scene.imagePrompt)}
                                                    disabled={loadingScenes[scene.sceneNumber]}
                                                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                                    {t.regenerate}
                                                </button>
                                            )}
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