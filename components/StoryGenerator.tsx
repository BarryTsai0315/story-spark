import React, { useState } from 'react';
import type { StoryConfig } from './StoryIdeaGenerator';
import { Language, StoryScene, GeneratedPrompt } from '../types';
import { translations } from '../translations';

interface StoryGeneratorProps {
    storyConfig: StoryConfig;
    initialScenes: StoryScene[];
    onFinishSelection: (imagePrompts: GeneratedPrompt[], videoPrompts: GeneratedPrompt[], storyContents: string[]) => void;
    onBack: () => void;
    language: Language;
}

const PromptCard: React.FC<{ title: string; chinesePrompt: string; englishPrompt: string; isSelected: boolean; onSelect: () => void; }> = 
({ title, chinesePrompt, englishPrompt, isSelected, onSelect }) => {
    return (
        <div 
            onClick={onSelect} 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 h-full
                ${isSelected 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                    : 'border-[var(--border-color)] bg-[var(--input-bg)] hover:border-indigo-400 dark:hover:border-indigo-500'}`
            }
        >
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">{title}</h4>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-400 bg-transparent'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
            </div>
            <div className="space-y-2 text-sm">
                <p className="text-[var(--text-secondary)] leading-relaxed">{chinesePrompt}</p>
                <p className="text-slate-400 dark:text-slate-500 font-mono text-xs leading-relaxed break-words">{englishPrompt}</p>
            </div>
        </div>
    );
};


export const StoryGenerator: React.FC<StoryGeneratorProps> = ({ storyConfig, initialScenes, onFinishSelection, onBack, language }) => {
    const [storyScenes, setStoryScenes] = useState<StoryScene[]>(initialScenes);
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const t = translations[language];

    const changeScene = (newIndex: number) => {
        if (newIndex >= 0 && newIndex < storyScenes.length) {
            setCurrentSceneIndex(newIndex);
        }
    }
    
    const handleSelectionChange = (type: 'image' | 'video', index: 0 | 1) => {
        setStoryScenes(scenes => scenes.map((s, i) => {
            if (i === currentSceneIndex) {
                if (type === 'image') {
                    return { ...s, selected_image_prompt_index: index };
                } else {
                    return { ...s, selected_video_prompt_index: index };
                }
            }
            return s;
        }));
    };

    const handleFinishSelectionClick = () => {
        const finalImagePrompts: GeneratedPrompt[] = storyScenes.map(scene => 
            scene.image_prompts[scene.selected_image_prompt_index]
        );
        const finalVideoPrompts: GeneratedPrompt[] = storyScenes.map(scene =>
            scene.image_to_video_prompts[scene.selected_video_prompt_index]
        );
        const finalStoryContents: string[] = storyScenes.map(scene => scene.story_content);
        onFinishSelection(finalImagePrompts, finalVideoPrompts, finalStoryContents);
    };

    const renderContent = () => {
        if (!storyScenes || storyScenes.length === 0) {
            return (
                 <div className="w-full max-w-5xl mx-auto bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md mb-4 text-center" role="alert">
                    <strong className="font-bold">{t.errorTitle}: </strong>
                    <span className="block sm:inline">{t.errorNoScenes}</span>
                    <button onClick={onBack} className="mt-4 sm:mt-0 sm:ml-4 px-4 py-2 bg-red-200 rounded text-sm font-semibold">{t.goBack}</button>
                </div>
            )
        }

        const currentScene = storyScenes[currentSceneIndex];
        const isLastScene = currentSceneIndex === storyScenes.length - 1;

        return (
            <div className="w-full h-full flex flex-col">
                {/* Header and Progress */}
                <div className="mb-6 text-center flex-shrink-0">
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{t.promptSelectionTitle}</h1>
                    <p className="mt-1 text-[var(--text-secondary)] font-medium">
                        {t.scene} {currentScene.scene_number} / {storyScenes.length}
                    </p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                        <div className="bg-[var(--primary)] h-2 rounded-full" style={{ width: `${((currentSceneIndex + 1) / storyScenes.length) * 100}%` }}></div>
                    </div>
                </div>

                {/* Story Content */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-[var(--border-color)] flex-shrink-0">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t.storyContent} - {t.scene} {currentScene.scene_number}</h2>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{currentScene.story_content}</p>
                </div>

                {/* Content Area */}
                <div className="flex-grow overflow-y-auto -mx-4 px-4 py-4">
                    {/* Prompt Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Headers */}
                        <h3 className="text-lg font-bold text-[var(--text-primary)] text-center">{t.imagePrompt}</h3>
                        <h3 className="text-lg font-bold text-[var(--text-primary)] text-center">{t.videoPrompt}</h3>
                        
                        {/* Row 1: Version A */}
                        <PromptCard 
                            title={`${t.version} A`}
                            chinesePrompt={currentScene.image_prompts[0].chinese_prompt}
                            englishPrompt={currentScene.image_prompts[0].english_prompt}
                            isSelected={currentScene.selected_image_prompt_index === 0}
                            onSelect={() => handleSelectionChange('image', 0)}
                        />
                        <PromptCard 
                            title={`${t.version} A`}
                            chinesePrompt={currentScene.image_to_video_prompts[0].chinese_prompt}
                            englishPrompt={currentScene.image_to_video_prompts[0].english_prompt}
                            isSelected={currentScene.selected_video_prompt_index === 0}
                            onSelect={() => handleSelectionChange('video', 0)}
                        />

                        {/* Row 2: Version B */}
                        <PromptCard 
                            title={`${t.version} B`}
                            chinesePrompt={currentScene.image_prompts[1].chinese_prompt}
                            englishPrompt={currentScene.image_prompts[1].english_prompt}
                            isSelected={currentScene.selected_image_prompt_index === 1}
                            onSelect={() => handleSelectionChange('image', 1)}
                        />
                        <PromptCard 
                            title={`${t.version} B`}
                            chinesePrompt={currentScene.image_to_video_prompts[1].chinese_prompt}
                            englishPrompt={currentScene.image_to_video_prompts[1].english_prompt}
                            isSelected={currentScene.selected_video_prompt_index === 1}
                            onSelect={() => handleSelectionChange('video', 1)}
                        />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center w-full pt-6 flex-shrink-0 border-t border-[var(--border-color)]">
                    <button
                        onClick={onBack}
                        className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
                    >
                        {t.backToIdea}
                    </button>
                    <div className="flex items-center gap-4">
                         <button
                            onClick={() => changeScene(currentSceneIndex - 1)}
                            disabled={currentSceneIndex === 0}
                            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t.previous}
                        </button>
                        {isLastScene ? (
                            <button
                                onClick={handleFinishSelectionClick}
                                className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                            >
                                {t.viewOverview}
                            </button>
                        ) : (
                            <button
                                onClick={() => changeScene(currentSceneIndex + 1)}
                                className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold text-white bg-[var(--primary)] hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                            >
                                {t.next}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="bg-transparent w-full h-full flex flex-col items-center relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {renderContent()}
            </div>
        </div>
    );
};