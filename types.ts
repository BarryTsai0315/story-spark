
export type Language = 'en' | 'zh';

export interface GeneratedPrompt {
    chinese_prompt: string;
    english_prompt: string;
}

export interface PromptVersion {
    chinese_prompt: string;
    english_prompt: string;
}

export interface StoryScene {
    id: number;
    scene_number: number;
    story_content: string;
    image_prompts: [PromptVersion, PromptVersion];
    image_to_video_prompts: [PromptVersion, PromptVersion];
    selected_image_prompt_index: 0 | 1;
    selected_video_prompt_index: 0 | 1;
}
