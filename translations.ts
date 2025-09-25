import { Language } from './types';

type Translation = {
    [key: string]: string;
}

type Translations = {
    en: Translation;
    zh: Translation;
}

export const translations: Translations = {
    en: {
        // StoryIdeaGenerator
        generateStoryIdeas: "Generate Story Ideas",
        craftYourNarrative: "Craft your narrative by providing a few key details.",
        storyDescription: "Story Description",
        storyDescriptionPlaceholder: "e.g., A robot detective in a noir-style city...",
        storyTheme: "Story Theme",
        imageStyle: "Image Style",
        referenceImage: "Reference Image",
        uploadFile: "Upload a file",
        dragAndDrop: "or drag and drop",
        fileTypes: "PNG, JPG, GIF up to 10MB",
        videoType: "Video Type",
        infiniteLoop: "Infinite Loop",
        storyBased: "Story-based",
        videoLength: "Video Length",
        seconds10: "10 seconds",
        seconds30: "30 seconds",
        seconds60: "60 seconds",
        imageGenerationAI: "Image Generation AI",
        darkMode: "Dark Mode",
        generate: "Generate",
        errorStoryDescription: "Please provide a story description.",
        errorInvalidImage: "Please upload a valid image file (PNG, JPG, GIF).",
        errorFileSize: "File size should not exceed 10MB.",
        errorFileRead: "Failed to read the image file.",
        brainstorm: "Brainstorm",
        brainstorming: "Brainstorming...",
        brainstormError: "Failed to get suggestions. Please try again.",
        errorAiInit: "Failed to initialize AI service.",
        errorNoReferenceImage: "Please upload a reference image to continue.",


        // StoryGenerator
        promptSelectionTitle: "Prompt Selection",
        scene: "Scene",
        storyContent: "Story Content",
        imagePrompt: "Image Prompt",
        imageToVideoPrompt: "Image-to-Video Prompt",
        version: "Version",
        backToIdea: "Back to Idea",
        previous: "Previous",
        next: "Next",
        viewOverview: "View Overview",
        loadingMessage: "Generating for you, please wait...",
        loadingSubMessage: "This might take a moment.",
        errorTitle: "Error",
        goBack: "Go Back",
        errorStoryIdeaEmpty: "Story idea is empty, please go back to the previous step.",
        errorPromptGeneration: "Failed to generate story and prompts, please check the format or try again later.",
        errorNoScenes: "No story scenes were generated. Please go back and try again.",


        // PromptOverview
        newStory: "New Story",
        promptOverview: "Prompt Overview",
        imageGenerationModel: "Image Editing Model",
        generateAll: "Generate All",
        generating: "Generating...",
        allGenerated: "All Generated",
        downloadAll: "Download All",
        videoPrompt: "Video Prompt",
        actions: "Actions",
        regenerate: "Regenerate",
        changeImage: "Change Image",

        // Header Links
        hotVideoFinder: "Hot Video Finder",
        trendAnalysisPlatform: "Trend Analysis Platform",
    },
    zh: {
        // StoryIdeaGenerator
        generateStoryIdeas: "產生故事點子",
        craftYourNarrative: "請提供一些關鍵細節來塑造您的故事。",
        storyDescription: "故事描述",
        storyDescriptionPlaceholder: "例如：一個在黑色風格城市中的機器人偵探...",
        storyTheme: "故事主題",
        imageStyle: "圖片風格",
        referenceImage: "原始參考圖",
        uploadFile: "上傳檔案",
        dragAndDrop: "或拖放檔案",
        fileTypes: "PNG, JPG, GIF (最大 10MB)",
        videoType: "影片類型",
        infiniteLoop: "無限循環",
        storyBased: "故事性",
        videoLength: "影片長度",
        seconds10: "10 秒",
        seconds30: "30 秒",
        seconds60: "60 秒",
        imageGenerationAI: "圖片生成 AI",
        darkMode: "深色模式",
        generate: "產生",
        errorStoryDescription: "請提供故事描述。",
        errorInvalidImage: "請上傳有效的圖片檔案 (PNG, JPG, GIF)。",
        errorFileSize: "檔案大小不應超過 10MB。",
        errorFileRead: "讀取圖片檔案失敗。",
        brainstorm: "腦力激盪",
        brainstorming: "腦力激盪中...",
        brainstormError: "無法獲取建議，請重試。",
        errorAiInit: "無法初始化 AI 服務。",
        errorNoReferenceImage: "請上傳參考圖片以繼續。",

        // StoryGenerator
        promptSelectionTitle: "Prompt 選擇",
        scene: "場景",
        storyContent: "故事內容",
        imagePrompt: "圖片 Prompt",
        imageToVideoPrompt: "圖轉影 Prompt",
        version: "版本",
        backToIdea: "返回點子頁",
        previous: "上一步",
        next: "下一步",
        viewOverview: "查看總覽",
        loadingMessage: "正在為您生成，請稍候...",
        loadingSubMessage: "這可能需要一點時間。",
        errorTitle: "錯誤",
        goBack: "返回",
        errorStoryIdeaEmpty: "故事點子為空，請返回上一步。",
        errorPromptGeneration: "故事與提示生成失敗，請檢查格式或稍後再試。",
        errorNoScenes: "未能生成任何故事場景，請返回重試。",

        // PromptOverview
        newStory: "新故事",
        promptOverview: "Prompt 總覽",
        imageGenerationModel: "圖片編輯模型",
        generateAll: "全部生成",
        generating: "生成中...",
        allGenerated: "已全部生成",
        downloadAll: "全部下載",
        videoPrompt: "影片 Prompt",
        actions: "操作",
        regenerate: "重新產生",
        changeImage: "更換圖片",

        // Header Links
        hotVideoFinder: "熱門影片搜尋器",
        trendAnalysisPlatform: "趨勢追蹤分析平台",
    }
};