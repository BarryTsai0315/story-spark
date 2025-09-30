import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { StoryIdeaGenerator, StoryConfig } from './components/StoryIdeaGenerator';
import { StoryGenerator } from './components/StoryGenerator';
import { PromptOverview, SceneOverview } from './components/PromptOverview';
import { ImageEditor } from './components/ImageEditor';
import { Language, StoryScene, GeneratedPrompt } from './types';
import { translations } from './translations';

type AppStep = 'idea' | 'generator' | 'overview';

const initialStoryConfig: StoryConfig = {
  idea: '',
  storyStyle: 'Fantasy',
  imageStyle: 'Default',
  targetAge: 'All Ages',
  targetGender: 'All Genders',
  videoType: 'loop',
  videoLength: '10s',
  hasReferenceImage: false,
  referenceImage: null,
};

const App: React.FC = () => {
  const [appStep, setAppStep] = useState<AppStep>('idea');
  const [storyConfig, setStoryConfig] = useState<StoryConfig>(initialStoryConfig);
  const [generatedScenes, setGeneratedScenes] = useState<StoryScene[] | null>(null);
  const [overviewData, setOverviewData] = useState<SceneOverview[] | null>(null);
  const [language, setLanguage] = useState<Language>('zh');
  const [isEditingImage, setIsEditingImage] = useState(false);
  
  const getAi = useCallback(() => {
    if (!process.env.API_KEY) {
        alert("API_KEY environment variable is not set.");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }, []);

  const handleIdeaSubmit = (scenes: StoryScene[]) => {
    setGeneratedScenes(scenes);
    setAppStep('generator');
  };

  const handleFinishSelection = (imagePrompts: GeneratedPrompt[], videoPrompts: GeneratedPrompt[], storyContents: string[]) => {
    const sceneData: SceneOverview[] = imagePrompts.map((prompt, index) => ({
        sceneNumber: index + 1,
        storyContent: storyContents[index],
        imagePrompt: prompt.english_prompt,
        videoPrompt: videoPrompts[index].english_prompt,
    }));
    setOverviewData(sceneData);
    setAppStep('overview');
  };
  
  const handleNewStory = () => {
    setStoryConfig(initialStoryConfig);
    setOverviewData(null);
    setGeneratedScenes(null);
    setAppStep('idea');
  }
  
  const handleReferenceImageChange = (newImage: string) => {
    setStoryConfig(prev => ({ ...prev, referenceImage: newImage, hasReferenceImage: true }));
  };
  
  const handleEditImageFinish = (newImage: string | null) => {
      if (newImage) {
          handleReferenceImageChange(newImage);
      }
      setIsEditingImage(false);
  }

  const toggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  }

  const storyIdeaGeneratorProps = {
    config: storyConfig,
    onConfigChange: setStoryConfig,
    onNext: handleIdeaSubmit,
    language,
    toggleLanguage,
    getAi,
    onEditImageStart: () => setIsEditingImage(true),
  };

  const renderContent = () => {
    if (isEditingImage && storyConfig.referenceImage) {
        return <ImageEditor 
            initialImage={storyConfig.referenceImage}
            onFinish={handleEditImageFinish}
            getAi={getAi}
            language={language}
        />
    }

    switch (appStep) {
      case 'idea':
        return <StoryIdeaGenerator {...storyIdeaGeneratorProps} />;
      case 'generator':
        if (generatedScenes) {
          return <StoryGenerator 
                    storyConfig={storyConfig}
                    initialScenes={generatedScenes}
                    onFinishSelection={handleFinishSelection} 
                    onBack={() => setAppStep('idea')}
                    language={language}
                  />;
        }
        return <StoryIdeaGenerator {...storyIdeaGeneratorProps} />;
      case 'overview':
        if (overviewData) {
            return <PromptOverview
                scenes={overviewData}
                storyConfig={storyConfig}
                onNewStory={handleNewStory}
                getAi={getAi}
                language={language}
                onReferenceImageChange={handleReferenceImageChange}
                onEditImageStart={() => setIsEditingImage(true)}
            />
        }
        return <StoryIdeaGenerator {...storyIdeaGeneratorProps} />;
      default:
        return null;
    }
  }

  return (
    <div className="w-screen min-h-screen flex flex-col">
        <header className="w-full bg-[var(--background)]/80 backdrop-blur-sm border-b border-[var(--border-color)] px-4 sm:px-6 lg:px-8 sticky top-0 z-10">
            <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
                <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="w-8 h-8 text-[var(--primary)]">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">StorySpark</h1>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                    <nav className="flex items-center space-x-4 md:space-x-6">
                        <a 
                            href="https://barrytsai0315.github.io/youtube-trend-explorer/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs md:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                        >
                            {translations[language].hotVideoFinder}
                        </a>
                        <a 
                            href="https://barrytsai0315.github.io/youtube-trend-tracker/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs md:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                        >
                            {translations[language].trendAnalysisPlatform}
                        </a>
                    </nav>
                    {appStep === 'overview' && (
                        <button onClick={handleNewStory} className="px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors whitespace-nowrap">
                            {translations[language].newStory}
                        </button>
                    )}
                </div>
            </div>
        </header>
        <main className="flex-grow w-full relative">
            {renderContent()}
        </main>
    </div>
  );
};

export default App;