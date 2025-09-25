
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Language, StoryScene, PromptVersion } from '../types';
import { translations } from '../translations';

export type StoryConfig = {
  idea: string;
  storyStyle: 'Fantasy' | 'Sci-Fi' | 'Realism' | 'Cyberpunk' | 'Cute Style';
  imageStyle: string; // Added new imageStyle property
  videoType: 'loop' | 'story';
  videoLength: '10s' | '30s' | '60s';
  hasReferenceImage: boolean;
  referenceImage: string | null;
};

interface StoryIdeaGeneratorProps {
  onNext: (config: StoryConfig, scenes: StoryScene[]) => void;
  language: Language;
  toggleLanguage: () => void;
  getAi: () => GoogleGenAI | null;
}

const imageStyleOptions = [
    'Default', '8-Bit', 'Botanical Art', 'Comic Book', 'Cubism', 'Cyberpunk',
    'Exploded View', 'Glitch Art', 'Isometric', 'Knolling', 'Low Poly', 'Mosaic',
    'Oil Painting', 'Pixel Art', 'Playful 3D Art', 'Pop Art', 'Photorealism',
    'Surrealism', 'Vaporwave', 'Vector Art', 'Watercolor',
];

export const StoryIdeaGenerator: React.FC<StoryIdeaGeneratorProps> = ({ onNext, language, toggleLanguage, getAi }) => {
  const [config, setConfig] = useState<StoryConfig>({
    idea: '',
    storyStyle: 'Fantasy',
    imageStyle: 'Default', // Added to initial state
    videoType: 'loop',
    videoLength: '10s',
    hasReferenceImage: false,
    referenceImage: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
      // Cleanup interval on component unmount
      return () => {
          if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
          }
      };
  }, []);

  const handleInputChange = (field: keyof StoryConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
        setError(t.errorInvalidImage);
        return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB
        setError(t.errorFileSize);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
            const imageAsDataUrl = e.target.result;
            setConfig(prev => ({ ...prev, referenceImage: imageAsDataUrl, hasReferenceImage: true }));
            setError(null);
        }
    };
    reader.onerror = () => {
        setError(t.errorFileRead);
    };
    reader.readAsDataURL(file);
  };
  
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
          handleFile(file);
      }
  }, []);

  const handleBrainstorm = async () => {
    const ai = getAi();
    if (!ai) {
        setError(t.errorAiInit);
        return;
    }

    setIsBrainstorming(true);
    setError(null);

    try {
        const hasIdea = config.idea.trim().length > 0;
        const prompt = hasIdea
            ? `You are a creative writer. Your task is to refine and enhance a story idea.
               Story Theme: ${config.storyStyle}
               Original Idea: "${config.idea}"
               Rewrite the original idea in one paragraph to be more vivid, engaging, and imaginative, while staying true to the core concept and theme. Provide only the rewritten text, without any preamble or explanation.`
            : `You are a creative writer. Your task is to brainstorm a new story idea.
               Story Theme: ${config.storyStyle}
               Generate a short, one-paragraph story idea that fits the given theme. The idea should be imaginative and provide a good starting point for a visual story. Provide only the story text, without any preamble or explanation.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const newIdea = response.text.trim();
        setConfig(prev => ({ ...prev, idea: newIdea }));

    } catch (err) {
        console.error("Brainstorming failed:", err);
        setError(t.brainstormError);
    } finally {
        setIsBrainstorming(false);
    }
  };

  const handleGenerateStoryAndPrompts = async () => {
      setIsGenerating(true);
      setProgress(0);
      setError(null);
      const ai = getAi();
      if (!ai) {
          setError(t.errorAiInit);
          setIsGenerating(false);
          return;
      }

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      const durationMap = { '10s': 15000, '30s': 25000, '60s': 35000 };
      const totalDuration = config.videoType === 'loop' ? durationMap['10s'] : durationMap[config.videoLength];
      const intervalTime = 100;
      const increment = (95 / (totalDuration / intervalTime));

      progressIntervalRef.current = window.setInterval(() => {
          setProgress(prev => {
              const nextVal = prev + increment;
              if (nextVal >= 95) {
                  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                  return 95;
              }
              return nextVal;
          });
      }, intervalTime);

      try {
          let promptCount: string;
          if (config.videoType === 'loop') {
              promptCount = '2到4';
          } else {
              switch (config.videoLength) {
                  case '10s': promptCount = '4到6'; break;
                  case '30s': promptCount = '8到12'; break;
                  case '60s': promptCount = '15到20'; break;
                  default: promptCount = '至少8';
              }
          }
          const workflowText = config.videoType === 'loop' ? '無限循環短片' : '故事性影片';
          const referenceImageInstruction = `
- **重要**: 由於提供了參考圖片，你產生的所有提示詞都必須明確指示要參考該圖片的風格。
  - **英文提示 (english_prompt)**: 必須以 "Drawing inspiration from the reference image, create a scene of..." 或類似的句子開頭。
  - **中文提示 (chinese_prompt)**: 必須以「參考範例圖的風格，描繪一個...」或類似的句子開頭。`;

          const prompt = `
              你是一位富有創意的作家和視覺化專家。請根據以下詳細設定，為一個「${workflowText}」創作一個故事。

              詳細設定:
              - 故事核心點子: "${config.idea}"
              - 整體風格: ${config.storyStyle}
              - 影片長度: ${config.videoLength}
              ${config.referenceImage ? "- 需參考附上的圖片風格與主題。" : ""}

              你的任務:
              1. 將故事分成 ${promptCount} 個獨立的場景。
              2. 對於每個場景，請提供以下內容：
                 - 該場景的故事內容 (繁體中文)。
                 - 兩種不同風格或角度的**圖像生成提示**版本（版本A和版本B）。
                 - 兩種不同風格或角度的**圖轉影片生成提示**版本（版本A和版本B）。
                 - 每個提示版本都必須同時包含繁體中文和英文。英文提示詞需針對圖像生成AI（如Midjourney, DALL-E, Sora）進行優化，使用具體的藝術家、風格、鏡頭角度和燈光描述。
                 ${config.referenceImage ? referenceImageInstruction : ""}

              你的輸出必須是一個 JSON 陣列，其中每個物件代表一個場景，並應包含以下鍵：
              - "scene_number": (數字) 場景編號。
              - "story_content": (字串) 該場景的繁體中文故事描述。
              - "image_prompts": (陣列) 包含兩個物件，代表兩種**圖像**提示版本。
              - "image_to_video_prompts": (陣列) 包含兩個物件，代表兩種**圖轉影片**提示版本。
              - 每個提示版本物件都應有 "chinese_prompt" 和 "english_prompt" 兩個鍵。
          `;
          
          const promptVersionSchema = { type: Type.OBJECT, properties: { chinese_prompt: { type: Type.STRING }, english_prompt: { type: Type.STRING } }, required: ["chinese_prompt", "english_prompt"] };
          const responseSchema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { scene_number: { type: Type.INTEGER }, story_content: { type: Type.STRING }, image_prompts: { type: Type.ARRAY, items: promptVersionSchema }, image_to_video_prompts: { type: Type.ARRAY, items: promptVersionSchema } }, required: ["scene_number", "story_content", "image_prompts", "image_to_video_prompts"] } };
          
          let contents: any = { parts: [{ text: prompt }] };
          if (config.referenceImage) {
              const [header, data] = config.referenceImage.split(',');
              const mimeType = header.match(/data:(.*);base64/)?.[1] || 'image/png';
              contents.parts.push({ inlineData: { data, mimeType } });
          }

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: contents,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: responseSchema,
                  systemInstruction: "你是一位富有創意的作家和提示詞工程師。你的任務是將故事點子轉化為結構化的場景、故事內容和多樣化的雙語圖像提示。請嚴格遵守請求的 JSON 格式。",
              }
          });

          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setProgress(100);

          const parsedScenes = JSON.parse(response.text.trim()) as any[];
          const scenesWithState: StoryScene[] = parsedScenes.map((scene: any, index: number): StoryScene => {
              const imagePrompts = Array.isArray(scene.image_prompts) ? scene.image_prompts : [];
              const videoPrompts = Array.isArray(scene.image_to_video_prompts) ? scene.image_to_video_prompts : [];
              const imagePromptVersions: [PromptVersion, PromptVersion] = [ imagePrompts[0] || { chinese_prompt: '錯誤: 缺少提示', english_prompt: 'Error: Missing prompt' }, imagePrompts[1] || { chinese_prompt: '錯誤: 缺少提示', english_prompt: 'Error: Missing prompt' } ];
              const videoPromptVersions: [PromptVersion, PromptVersion] = [ videoPrompts[0] || { chinese_prompt: '錯誤: 缺少提示', english_prompt: 'Error: Missing prompt' }, videoPrompts[1] || { chinese_prompt: '錯誤: 缺少提示', english_prompt: 'Error: Missing prompt' } ];
              return { id: Date.now() + index, scene_number: scene.scene_number, story_content: scene.story_content, image_prompts: imagePromptVersions, image_to_video_prompts: videoPromptVersions, selected_image_prompt_index: 0, selected_video_prompt_index: 0 };
          });
          
          setTimeout(() => {
            setIsGenerating(false);
            onNext(config, scenesWithState);
          }, 500);

      } catch (err) {
          console.error(err);
          setError(t.errorPromptGeneration);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setIsGenerating(false);
      }
  };

  const handleSubmit = () => {
    if (!config.idea.trim()) {
      setError(t.errorStoryDescription);
      return;
    }
    if (!config.hasReferenceImage) {
      setError(t.errorNoReferenceImage);
      return;
    }
    setError(null);
    handleGenerateStoryAndPrompts();
  };
  
  const FormLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{children}</label>
  );

  const LoadingModal = () => (
      <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-sm" aria-modal="true" role="dialog">
          <div className="bg-[var(--background)] rounded-lg shadow-xl p-8 w-full max-w-md text-center">
              <svg className="animate-spin h-10 w-10 text-[var(--primary)] mb-4 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg font-medium text-[var(--text-primary)]">{t.loadingMessage}</p>
              <p className="text-slate-500 mt-1 mb-4">{t.loadingSubMessage}</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                  <div 
                      className="bg-[var(--primary)] h-2.5 rounded-full transition-all duration-150 ease-linear" 
                      style={{ width: `${Math.round(progress)}%` }}
                  ></div>
              </div>
              <p className="text-sm font-semibold text-[var(--text-secondary)] mt-2">{Math.round(progress)}%</p>
          </div>
      </div>
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-y-auto px-4 py-10">
      {isGenerating && <LoadingModal />}
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">{t.generateStoryIdeas}</h1>
            <p className="mt-2 text-[var(--text-secondary)]">{t.craftYourNarrative}</p>
        </div>
         {error && (
            <div className="mb-4 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-md text-sm" role="alert">
                {error}
            </div>
        )}
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8 md:col-span-1">
                    <div>
                        <FormLabel htmlFor="story-description">{t.storyDescription}</FormLabel>
                        <textarea 
                          id="story-description" 
                          placeholder={t.storyDescriptionPlaceholder} 
                          rows={4}
                          value={config.idea}
                          onChange={e => handleInputChange('idea', e.target.value)}
                          className="form-textarea w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3"
                          disabled={isGenerating}
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="story-theme">{t.storyTheme}</FormLabel>
                        <select 
                          id="story-theme"
                          value={config.storyStyle}
                          onChange={e => handleInputChange('storyStyle', e.target.value)}
                          className="form-select w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] pl-4 py-3"
                          disabled={isGenerating}
                        >
                            <option>Fantasy</option>
                            <option>Sci-Fi</option>
                            <option>Realism</option>
                            <option>Cyberpunk</option>
                            <option>Cute Style</option>
                        </select>
                    </div>
                    <div>
                        <FormLabel htmlFor="image-style">{t.imageStyle}</FormLabel>
                        <select
                            id="image-style"
                            value={config.imageStyle}
                            onChange={e => handleInputChange('imageStyle', e.target.value)}
                            className="form-select w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] pl-4 py-3"
                            disabled={isGenerating}
                        >
                            {imageStyleOptions.map(style => (
                                <option key={style} value={style}>{style}</option>
                            ))}
                        </select>
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={handleBrainstorm}
                                disabled={isBrainstorming || isGenerating}
                                className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold text-white bg-[var(--primary)] hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-wait"
                            >
                               {isBrainstorming && <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {isBrainstorming ? t.brainstorming : t.brainstorm}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="space-y-8 md:col-span-1">
                    <div>
                        <FormLabel htmlFor="reference-image">{t.referenceImage}</FormLabel>
                        <div 
                          className={`flex flex-col items-center justify-center w-full h-full rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isGenerating ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-800/50' : 'cursor-pointer'} ${isDragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'border-[var(--border-color)] bg-[var(--input-bg)] hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                          onClick={() => !isGenerating && imageInputRef.current?.click()}
                          onDragEnter={!isGenerating ? handleDragEnter : undefined}
                          onDragLeave={!isGenerating ? handleDragLeave : undefined}
                          onDragOver={!isGenerating ? handleDragOver : undefined}
                          onDrop={!isGenerating ? handleDrop : undefined}
                        >
                          {config.referenceImage ? (
                             <img src={config.referenceImage} alt="Reference Preview" className="max-h-64 object-contain rounded-md" />
                          ) : (
                            <>
                              <svg aria-hidden="true" className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                              </svg>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                  <span className="font-medium text-[var(--primary)] hover:text-indigo-500">{t.uploadFile}</span> {t.dragAndDrop}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.fileTypes}</p>
                            </>
                          )}
                          <input ref={imageInputRef} className="sr-only" id="reference-image" name="reference-image" type="file" accept="image/png, image/jpeg, image/gif" onChange={handleImageUpload} disabled={isGenerating}/>
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-[var(--border-color)] pt-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <FormLabel htmlFor="video-type">{t.videoType}</FormLabel>
                        <select 
                          id="video-type"
                          value={config.videoType}
                          onChange={e => handleInputChange('videoType', e.target.value)}
                          className="form-select w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] pl-4 py-3"
                          disabled={isGenerating}
                        >
                            <option value="loop">{t.infiniteLoop}</option>
                            <option value="story">{t.storyBased}</option>
                        </select>
                    </div>
                    <div>
                        <FormLabel htmlFor="video-length">{t.videoLength}</FormLabel>
                        <select 
                          id="video-length"
                          value={config.videoLength}
                          onChange={e => handleInputChange('videoLength', e.target.value)}
                          className="form-select w-full rounded-lg border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)] pl-4 py-3"
                          disabled={isGenerating}
                        >
                            <option value="10s">{t.seconds10}</option>
                            <option value="30s">{t.seconds30}</option>
                            <option value="60s">{t.seconds60}</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => document.documentElement.classList.toggle('dark')} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            <span className="hidden sm:inline">{t.darkMode}</span>
                        </button>
                        <button onClick={toggleLanguage} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <path d="M6.22 8.35a6.04 6.04 0 0 1 8.4-1.6c1.2.9 2.1 2.2 2.5 3.7.3 1 .4 2.1.1 3.1-.3 1.2-1 2.3-1.9 3.2-1.3 1.3-3 2.1-4.8 2.2h-.2c-1.3 0-2.6-.4-3.7-1.1-1.3-.8-2.3-2-3-3.4-.6-1.1-.9-2.3-.8-3.5.1-1.3.6-2.5 1.5-3.6" />
                               <path d="m10.5 8.5-5 5" />
                               <path d="m14 8-1.5 1.5" />
                               <path d="M19 12h-2" />
                               <path d="M21.9 12h-2" />
                               <path d="m15.5 15.5-1.5 1.5" />
                               <path d="m14.5 11.5-1.5 1.5" />
                            </svg>
                            <span className="hidden sm:inline">{language === 'en' ? '中文' : 'English'}</span>
                        </button>
                    </div>
                    <button 
                      type="button"
                      onClick={handleSubmit}
                      disabled={isGenerating}
                      className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-white bg-[var(--primary)] hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating && <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isGenerating ? t.loadingMessage.replace('...', '') : t.generate}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
