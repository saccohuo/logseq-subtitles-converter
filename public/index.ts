/// <reference path="./logseq.d.ts" />

import "@logseq/libs";
import { setup as l10nSetup, t } from "logseq-l10n"; //https://github.com/sethyuan/logseq-l10n
import ja from "./translations/ja.json";
import { IBatchBlock, IHookEvent } from "@logseq/libs/dist/LSPlugin.user";

// 定义转录选项接口
interface TranscriptionOptions {
  modelType: 'whisper' | 'funasr';  // 模型类型：whisper 或 funasr
  whisperModelSize?: string;        // Whisper 模型大小
  minLength?: string;               // 最小段落长度
  zhType?: string;                  // 中文类型（简体或繁体）
  funasrModelName?: string;         // FunASR 模型名称
  funasrModelSource?: string;       // FunASR 模型源
  ollamaModel?: string;
  ollamaEndpoint?: string;
  segmentModel?: string;
  openaiPriority?: string;
  enableOpenaiRotation?: boolean;
  useSharedOpenAIApiKey?: boolean;
  sharedOpenAIApiKey?: string;
  useSharedOpenAIApiEndpoint?: boolean;
  sharedOpenAIApiEndpoint?: string;
  openaiSettings?: Array<{
    apiKey: string;
    model: string;
    apiEndpoint: string;
    maxSegmentLength: number;
  }>;
  performSegmentation?: boolean;
  defaultMaxSegmentLength?: number;
  segmentationTolerance?: number;
  segmentationToleranceUnit?: string;
  summarizeBlockContent?: string;
  summarizeOpenAISettingPriority?: string;
}

// 定义转录段落接口
interface TranscriptionSegment {
  segment: string;  // 转录文本
  startTime: number;  // 开始时间
  endTime?: number;  // 结束时间（可选，因为 Whisper 可能不提供）
}

// 定义转录响应接口
interface TranscriptionResponse {
  segments: {
    start: number;
    text: string;
  }[];
  source?: string;
  error?: string;
}

// 新增的通用 formData 处理函数
function appendCommonFormData(formData: FormData, options: TranscriptionOptions) {
  formData.append('model_type', options.modelType);
  formData.append('perform_segmentation', options.performSegmentation ? 'true' : 'false');
  formData.append('segment_model', options.segmentModel || 'ollama');
  formData.append('max_length', (options.defaultMaxSegmentLength || 1500).toString());
  formData.append('segmentation_tolerance', (options.segmentationTolerance || 5).toString());
  formData.append('segmentation_tolerance_unit', options.segmentationToleranceUnit || 'percent');

  if (options.segmentModel === 'openai') {
    formData.append('enable_openai_rotation', options.enableOpenaiRotation ? 'true' : 'false');
    formData.append('use_shared_openai_api_key', options.useSharedOpenAIApiKey ? 'true' : 'false');
    formData.append('use_shared_openai_api_endpoint', options.useSharedOpenAIApiEndpoint ? 'true' : 'false');
    
    if (options.useSharedOpenAIApiKey) {
      formData.append('shared_openai_api_key', options.sharedOpenAIApiKey || '');
    }
    if (options.useSharedOpenAIApiEndpoint) {
      formData.append('shared_openai_api_endpoint', options.sharedOpenAIApiEndpoint || '');
    }
    
    for (let i = 1; i <= 5; i++) {
      const apiKey = options.useSharedOpenAIApiKey ? options.sharedOpenAIApiKey : options.openaiSettings?.[i-1]?.apiKey;
      const endpoint = options.useSharedOpenAIApiEndpoint ? options.sharedOpenAIApiEndpoint : options.openaiSettings?.[i-1]?.apiEndpoint;
      const model = options.openaiSettings?.[i-1]?.model;
      const maxSegmentLength = options.openaiSettings?.[i-1]?.maxSegmentLength;
      
      if (apiKey && endpoint) {
        formData.append(`openai_api_key${i}`, apiKey);
        formData.append(`openai_api_endpoint${i}`, endpoint);
        formData.append(`openai_models${i}`, model || '');
      }
      formData.append(`openai_max_segment_length${i}`, (maxSegmentLength || 0).toString());
    }
    
    formData.append('openai_priority', options.openaiPriority || '1,2,3,4,5');
  } else if (options.segmentModel === 'ollama') {
    formData.append('ollama_model', options.ollamaModel || logseq.settings?.ollamaModel || "qwen2.5:3b");
    formData.append('ollama_endpoint', options.ollamaEndpoint || logseq.settings?.ollamaEndpoint || "http://localhost:11434");
    formData.append('ollama_max_segment_length', (logseq.settings?.ollamaMaxSegmentLength || 0).toString());
  }
}

// 获取转录设置
export function getTranscriptionSettings(): TranscriptionOptions {
  const modelType = (logseq.settings?.["modelType"] as 'whisper' | 'funasr') || "whisper";
  const whisperModelSize = logseq.settings?.["whisperModelSize"] as string;
  const minLength = logseq.settings?.["minLength"] as string;
  const zhType = logseq.settings?.["zhType"] as string;
  const funasrModelName = logseq.settings?.["funasrModelName"] as string;
  const funasrModelSource = logseq.settings?.["funasrModelSource"] as string;
  const ollamaModel = logseq.settings?.["ollamaModel"] as string;
  const ollamaEndpoint = logseq.settings?.["ollamaEndpoint"] as string;
  const segmentModel = logseq.settings?.["segmentModel"] as string;
  const openaiPriority = logseq.settings?.["openaiPriority"] as string;
  const enableOpenaiRotation = logseq.settings?.["enableOpenaiRotation"] as boolean;
  const useSharedOpenAIApiKey = logseq.settings?.["useSharedOpenAIApiKey"] as boolean;
  const sharedOpenAIApiKey = logseq.settings?.["sharedOpenAIApiKey"] as string;
  const useSharedOpenAIApiEndpoint = logseq.settings?.["useSharedOpenAIApiEndpoint"] as boolean;
  const sharedOpenAIApiEndpoint = logseq.settings?.["sharedOpenAIApiEndpoint"] as string;
  const performSegmentation = logseq.settings?.["performSegmentation"] as boolean;
  const defaultMaxSegmentLength = logseq.settings?.["defaultMaxSegmentLength"] as number;
  const segmentationTolerance = logseq.settings?.["segmentationTolerance"] as number;
  const segmentationToleranceUnit = logseq.settings?.["segmentationToleranceUnit"] as string;
  const summarizeBlockContent = logseq.settings?.["summarizeBlockContent"] as string;
  const summarizeOpenAISettingPriority = logseq.settings?.["summarizeOpenAISettingPriority"] as string;

  const openaiSettings = [];
  for (let i = 1; i <= 5; i++) {
    openaiSettings.push({
      apiKey: logseq.settings?.[`openaiApiKey${i}`] as string,
      model: logseq.settings?.[`openaiModel${i}`] as string,
      apiEndpoint: logseq.settings?.[`openaiApiEndpoint${i}`] as string,
      maxSegmentLength: logseq.settings?.[`openaiMaxSegmentLength${i}`] as number,
    });
  }

  return {
    modelType,
    whisperModelSize,
    minLength,
    zhType,
    funasrModelName,
    funasrModelSource,
    ollamaModel,
    ollamaEndpoint,
    segmentModel,
    openaiPriority,
    enableOpenaiRotation,
    useSharedOpenAIApiKey,
    sharedOpenAIApiKey,
    useSharedOpenAIApiEndpoint,
    sharedOpenAIApiEndpoint,
    openaiSettings,
    performSegmentation,
    defaultMaxSegmentLength,
    segmentationTolerance,
    segmentationToleranceUnit,
    summarizeBlockContent,
    summarizeOpenAISettingPriority,
  };
}

console.log("Plugin script started loading");

// 在文件顶部添加这行
// let globalWhisperLocalEndpoint: string | undefined;

// 在文件顶部添加这个声明
declare global {
  interface Window {
    whisperSubtitlesPlugin: {
      getSetting: (key: string) => any;
      getAllSettings: () => any;
    };
  }
}

// 在 main 函数中或 logseq.ready 回调中添加
window.whisperSubtitlesPlugin = {
  getSetting: (key: string) => logseq.settings?.[key],
  getAllSettings: () => logseq.settings
};

// 将 getSetting 函数定义为全局函数
function getSetting(key: string): any {
  return logseq.settings?.[key];
}

// 主函数
async function main() {
  console.log("Main function started");
  
  await l10nSetup({ builtinTranslations: { ja } });
  console.log("l10n setup completed");
  
  registerSettings();
  
  registerCommands();
  console.log("Plugin initialization completed");

  // 删除 Ollama 模型获取相关的代码

  logseq.onSettingsChanged((newSettings, oldSettings) => {
    // 删除 Ollama 相关的设置变更处理
  });

  // 删除 logseq.provideModel 调用

  // 获取并设置图谱路径
  const graph = await logseq.App.getCurrentGraph();
  if (graph) {
    await logseq.updateSettings({ graphPath: graph.path });
  }
}

function registerSettings() {
  console.log("Registering plugin settings");
  
  const openaiSettingsGroup = [
    {
      key: "openaiPriority",
      type: "string",
      default: "1,2,3,4,5",
      title: t("OpenAI API Priority"),
      description: t("Set the priority for OpenAI API settings (1-5, separated by comma, priority from high to low)"),
    },
    {
      key: "enableOpenaiRotation",
      type: "boolean",
      default: false,
      title: t("Enable OpenAI API Rotation"),
      description: t("Rotate through OpenAI API settings if text segmentation fails"),
    },
    {
      key: "useSharedOpenAIApiKey",
      type: "boolean",
      default: false,
      title: t("Use Shared OpenAI API Key"),
      description: t("Use shared OpenAI API Key for all configurations"),
    },
    {
      key: "sharedOpenAIApiKey",
      type: "string",
      default: "",
      title: t("Shared OpenAI API Key"),
      description: t("Shared API key for all OpenAI configurations"),
      visibility: "useSharedOpenAIApiKey === true",
    },
    {
      key: "useSharedOpenAIApiEndpoint",
      type: "boolean",
      default: false,
      title: t("Use Shared OpenAI API Endpoint"),
      description: t("Use shared OpenAI API Endpoint for all configurations"),
    },
    {
      key: "sharedOpenAIApiEndpoint",
      type: "string",
      default: "https://api.openai.com/v1",
      title: t("Shared OpenAI API Endpoint"),
      description: t("Shared API endpoint for all OpenAI configurations"),
      visibility: "useSharedOpenAIApiEndpoint === true",
    },
  ];

  // 为每组 OpenAI 设置添加 maxSegmentLength
  for (let i = 1; i <= 5; i++) {
    openaiSettingsGroup.push(
      {
        key: `openaiApiKey${i}`,
        type: "string",
        default: "",
        title: t(`OpenAI API Key ${i}`),
        description: t(`API key for OpenAI setting ${i}`),
        visibility: "useSharedOpenAIApiKey === false",
      },
      {
        key: `openaiApiEndpoint${i}`,
        type: "string",
        default: "https://api.openai.com/v1",
        title: t(`OpenAI API Endpoint ${i}`),
        description: t(`API endpoint for OpenAI setting ${i}`),
        visibility: "useSharedOpenAIApiEndpoint === false",
      },
      {
        key: `openaiModel${i}`,
        type: "string",
        default: "gpt-3.5-turbo",
        title: t(`OpenAI Model ${i}`),
        description: t(`Model to use for OpenAI setting ${i}`),
      },
      {
        key: `openaiMaxSegmentLength${i}`,
        type: "number",
        default: 0,
        title: t(`OpenAI Max Segment Length ${i}`),
        description: t(`Maximum segment length for OpenAI setting ${i} (0 to use default)`),
      }
    );
  }

  logseq.useSettingsSchema([
    {
      key: 'group_general',
      title: "🎛️ General Settings",
      description: "",
      type: "heading",
      default: null,
    },
    {
      key: "modelType",
      type: "enum",
      default: "whisper",
      enumChoices: ["whisper", "funasr"],
      title: t("Speech recognition model"),
      description: t("Choose between Whisper and FunASR models"),
    },
    {
      key: "whisperLocalEndpoint",
      type: "string",
      default: "http://127.0.0.1:5014",
      title: t("End point of logseq-whisper-subtitles-server"),
      description: t("default: http://127.0.0.1:5014"),
    },
    {
      key: "youtubeOutputFormat",
      type: "string",
      default: "{{youtube-timestamp <start>}} <text>",
      title: t("YouTube Output Format"),
      description: t("Format for YouTube transcription output. Use <start> for timestamp and <text> for transcribed text"),
    },
    {
      key: "otherVideoOutputFormat",
      type: "string",
      default: "{{renderer :media-timestamp, <start>}} <text>",
      title: t("Other Video Output Format"),
      description: t("Format for non-YouTube video transcription output. Need logseq-media-ts plugin. Use <start> for timestamp and <text> for transcribed text"),
    },
    {
      key: "grandparentBlockTitle",
      type: "string",
      default: "",
      title: t("Grandparent Block Title"),
      description: t("Title for the grandparent block of transcription. Leave empty to skip creating this block."),
    },
    {
      key: "parentBlockTitle",
      type: "string",
      default: "",
      title: t("Parent Block Title"),
      description: t("Title for the parent block of transcription. Leave empty to skip creating this block."),
    },
    {
      key: 'group_whisper',
      title: "🗣️ Whisper Settings",
      description: "",
      type: "heading",
      default: null,
    },
    {
      key: "whisperModelSize",
      type: "enum",
      default: "base",
      enumChoices: ["tiny", "base", "small", "medium", "large"],
      title: t("Whisper model size"),
      description: t("Only applicable for Whisper model"),
      visibility: "modelType === 'whisper'",
    },
    {
      key: "minLength",
      type: "number",
      default: 100,
      title: t("Minimum length of a segment"),
      description: t("if set to zero, segments will be split by .?!, otherwise, segments less than minLength will be merged"),
      visibility: "modelType === 'whisper'",
    },
    {
      key: "zhType",
      type: "enum",
      default: "zh-cn",
      enumChoices: ["zh-cn", "zh-tw"],
      title: t("Chinese language type"),
      description: "zh-cn and zh-tw",
      visibility: "modelType === 'whisper'",
    },
    {
      key: 'group_funasr',
      title: "🎙️ FunASR Settings",
      description: "",
      type: "heading",
      default: null,
    },
    {
      key: "funasrModelName",
      type: "enum",
      default: "SenseVoiceSmall",
      enumChoices: ["paraformer-zh", "paraformer-en", "Qwen-Audio", "Qwen-Audio-Chat", "emotion2vec+large"],
      title: t("FunASR model"),
      description: t("Choose FunASR model"),
      visibility: "modelType === 'funasr'",
    },
    {
      key: "funasrModelSource",
      type: "enum",
      default: "modelscope",
      enumChoices: ["modelscope", "huggingface"],
      title: t("FunASR model source"),
      description: t("Choose FunASR model source"),
      visibility: "modelType === 'funasr'",
    },
    {
      key: "hotwordFilePath",
      type: "string",
      default: "",
      title: t("Hotword File Path"),
      description: t("Path to the hotword file (optional)"),
      visibility: "modelType === 'funasr'",
    },
    {
      key: 'group_segmentation',
      title: "✂️ Text Segmentation Settings",
      description: "",
      type: "heading",
      default: null,
    },
    {
      key: "performSegmentation",
      type: "boolean",
      default: false,
      title: t("Perform text segmentation"),
      description: t("Choose whether to perform text segmentation after transcription"),
    },
    {
      key: "segmentModel",
      type: "enum",
      default: "ollama",
      enumChoices: ["ollama", "openai"],
      title: t("Text Segmentation Model"),
      description: t("Choose the model for text segmentation"),
      visibility: "performSegmentation === true",
    },
    {
      key: "defaultMaxSegmentLength",
      type: "number",
      default: 1500,
      title: t("Default maximum segment length"),
      description: t("Default maximum number of characters per segment"),
    },
    {
      key: "segmentationToleranceUnit",
      type: "enum",
      default: "percent",
      enumChoices: ["percent", "characters"],
      title: t("Segmentation tolerance unit"),
      description: t("Unit for segmentation tolerance (percentage or characters)"),
    },
    {
      key: "segmentationTolerance",
      type: "number",
      default: 5,
      title: t("Segmentation tolerance"),
      description: t("Acceptable difference in text length after segmentation (percentage)"),
    },
    {
      key: 'group_ollama',
      title: "🤖 Ollama Settings",
      description: "",
      type: "heading",
      default: null,
      visibility: "segmentModel === 'ollama'",
    },
    {
      key: "ollamaEndpoint",
      type: "string",
      default: "http://localhost:11434",
      title: t("Ollama API Endpoint"),
      description: t("Endpoint for Ollama API"),
      visibility: "segmentModel === 'ollama'",
    },
    {
      key: "ollamaModel",
      type: "string",
      default: "qwen2.5:3b",
      title: t("Ollama Model"),
      description: t("Model to use for text segmentation. Enter the model name manually."),
      visibility: "segmentModel === 'ollama'",
    },
    {
      key: "ollamaMaxSegmentLength",
      type: "number",
      default: 0,
      title: t("Ollama maximum segment length"),
      description: t("Maximum number of characters per segment for Ollama (0 to use default)"),
      visibility: "segmentModel === 'ollama'",
    },
    {
      key: 'group_openai',
      title: "🧠 OpenAI API Settings",
      description: "",
      type: "heading",
      default: null,
      visibility: "segmentModel === 'openai'",
    },
    ...openaiSettingsGroup,
    {
      key: 'group_summarize',
      title: "🗂️ Summarize Settings",
      type: "heading",
      default: null,
    },
    {
      key: "summarizeBlockContent",
      type: "string",
      default: "#视频总结",
      title: t("Summarize Block Content"),
      description: t("Content of the block to insert before the summary"),
    },
    {
      key: "summarizeOpenAISettingPriority",
      type: "string",
      default: "1,2,3,4,5",
      title: t("OpenAI API Setting Priority for Summarization"),
      description: t("Choose the priority of OpenAI API settings to use for summarization (comma-separated, e.g., 1,2,3,4,5). Note: This does not use segment_length information."),
    },
  ]);

  console.log("Plugin settings registered");
  console.log("Settings immediately after registration:", logseq.settings);
}

function registerCommands() {
  console.log("Registering plugin commands");
  
  logseq.Editor.registerSlashCommand(t("transcribe-subtitle"), runTranscription);
  logseq.Editor.registerBlockContextMenuItem(t("transcribe-subtitle"), runTranscription);
  
  // 注册新的命令
  logseq.Editor.registerBlockContextMenuItem(t("transcribe from subtitle file(Youtube)"), (e) => transcribeFromSubtitleFile(e, false, 'youtube'));
  logseq.Editor.registerBlockContextMenuItem(t("transcribe from subtitle file(other video)"), (e) => transcribeFromSubtitleFile(e, false, 'other'));
  logseq.Editor.registerBlockContextMenuItem(t("transcribe from subtitle file after segment(Youtube)"), (e) => transcribeFromSubtitleFile(e, true, 'youtube'));
  logseq.Editor.registerBlockContextMenuItem(t("transcribe from subtitle file after segment(other video)"), (e) => transcribeFromSubtitleFile(e, true, 'other'));
  
  // 添加新的 "summarize subtitle" 命令
  logseq.Editor.registerBlockContextMenuItem(t("summarize subtitle"), summarizeSubtitle);
  
  console.log("Plugin commands registered");
}

// 运行转录
export async function runTranscription(b: IHookEvent) {
  const currentBlock = await logseq.Editor.getBlock(b.uuid);
  if (currentBlock) {
    const settings = getTranscriptionSettings();
    
    // 显示处理中的 UI
    showProcessingUI(currentBlock.uuid);

    try {
      let hotwords = '';
      // 只有在 FunASR 模式下才显示热词弹窗
      if (settings.modelType === 'funasr') {
        hotwords = await showHotwordsInputDialog();
        console.log("Hotwords:", hotwords);
      }

      // 执行转录
      const transcription = await transcribeContent(currentBlock.content, settings, hotwords);
      if (transcription.error) {
        logseq.UI.showMsg(transcription.error, "error");
        return;
      }

      // 插入转录结果
      await insertTranscription(currentBlock, transcription);
      logseq.UI.showMsg(t("Transcription completed and inserted"), "success");
    } catch (e: any) {
      logseq.UI.showMsg(t("Transcription failed: ") + e.message, "error");
    } finally {
      // 隐藏处理中的 UI
      hideProcessingUI();
    }
  }
}

// 转录内容
async function transcribeContent(content: string, options: TranscriptionOptions, hotwords: string): Promise<TranscriptionResponse> {
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/transcribe`;
  
  const formData = new FormData();
  formData.append('text', content);
  formData.append('hotwords', hotwords);  // 添加热词到表单数据
  appendCommonFormData(formData, options);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error("Server response:", response.status, response.statusText);
      const responseText = await response.text();
      console.error("Response body:", responseText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // 处理 OpenAI API 轮询通知
    if (result.openai_rotation_message) {
      handleOpenAIRotationNotification(result.openai_rotation_message);
    }

    console.log("Perform segmentation:", logseq.settings?.performSegmentation || "No");
    console.log("Transcription source:", result.source);
    console.log("Hotwords used:", hotwords);  // 记录使用的热词

    return {
      segments: result.segments,
      source: result.source,
    };
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

// 插入转录结果
async function insertTranscription(block: any, transcription: TranscriptionResponse) {
  console.log("Inserting transcription:", transcription);
  const youtubeOutputFormat = logseq.settings?.youtubeOutputFormat || "{{youtube-timestamp <start>}} <text>";
  const otherVideoOutputFormat = logseq.settings?.otherVideoOutputFormat || "{{renderer :media-timestamp, <start>}} <text>";
  const parentBlockTitle = logseq.settings?.parentBlockTitle || "";
  const grandparentBlockTitle = logseq.settings?.grandparentBlockTitle || "";
  
  let insertionBlock = block;
  
  if (grandparentBlockTitle && parentBlockTitle) {
    // 1. 创建祖父块（与视频块同级
    let grandparentBlock = await logseq.Editor.insertBlock(block.uuid, grandparentBlockTitle, { sibling: true });
    if (!grandparentBlock) {
      throw new Error("Failed to create grandparent block");
    }
    
    // 2. 创建父块（作为祖父块的子块）
    let parentBlock = await logseq.Editor.insertBlock(grandparentBlock.uuid, parentBlockTitle, { sibling: false });
    if (!parentBlock) {
      throw new Error("Failed to create parent block");
    }
    insertionBlock = parentBlock;
  } else if (grandparentBlockTitle || parentBlockTitle) {
    // 如果只有一个非空，创建一个块（与视频块同级）
    const blockTitle = grandparentBlockTitle || parentBlockTitle;
    let newBlock = await logseq.Editor.insertBlock(block.uuid, blockTitle, { sibling: true });
    if (!newBlock) {
      throw new Error("Failed to create block");
    }
    insertionBlock = newBlock;
  }
  // 如果两个都为空，insertionBlock 保持为原始的 block

  // 3. 插入转录内容
  const outputFormat = transcription.source === "youtube" ? youtubeOutputFormat : otherVideoOutputFormat;
  const blocks: IBatchBlock[] = transcription.segments.map(segment => ({
    content: outputFormat
      .replace('<start>', formatTime(segment.start))
      .replace('<text>', segment.text),
  }));
  console.log("Blocks:", blocks);
  await logseq.Editor.insertBatchBlock(insertionBlock.uuid, blocks, { sibling: false });
}


// 格式化时间
function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    console.warn("Invalid time value:", seconds);
    return "00:00:00";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

//---- 弹 UI 相关函数 ----

const keyNamePopup = "whisper--popup"; // 弹出窗的 key 名称

// 更新消息
// 当弹出窗口显示时，如果想中途更改消息，可以使用此函数
const updatePopupUI = (messageHTML: string) => {
  const messageEl = parent.document.getElementById("whisperSubtitles--message") as HTMLDivElement | null;
  if (messageEl) messageEl.innerHTML = messageHTML; // 如果弹出窗口已显更新消息
  else popupUI(messageHTML); // 如果弹出窗口未示，创建带有消息的弹出窗口
};

// 创建弹出窗口
const popupUI = (printMain: string, targetBlockUuid?: string) => {
  // dot select
  const dotSelect = targetBlockUuid ? `
  &#root>div {
    &.light-theme>main>div span#dot-${targetBlockUuid}{
        outline: 2px solid var(--ls-link-ref-text-color);
    }
    &.dark-theme>main>div span#dot-${targetBlockUuid}{
        outline: 2px solid aliceblue;
    }
  }
  ` : "";
  logseq.provideUI({
    attrs: {
      title: "Whisper subtitles plugin",
    },
    key: keyNamePopup,
    reset: true,
    style: {
      width: "330px", // width
      minHeight: "220px", // min-height
      maxHeight: "400px", // max-height
      overflowY: "auto",
      left: "unset",
      bottom: "unset",
      right: "1em",
      top: "4em",
      paddingLeft: "2em",
      paddingTop: "2em",
      backgroundColor: 'var(--ls-primary-background-color)',
      color: 'var(--ls-primary-text-color)',
      boxShadow: '1px 2px 5px var(--ls-secondary-background-color)',
    },
    template: `
        <div title="">
            <p>Whisper subtitles ${t("plugin")} <button class="button" id="whisperSubtitles--showSettingsUI" title="${t("plugin settings")}">⚙️</button></p>
            <div id="whisperSubtitles--message">
            ${printMain}
            </div>
        </div>
        <style>
      body>div {
        ${dotSelect}
        &#${logseq.baseInfo.id}--${keyNamePopup} {
          & button.button#whisperSubtitles--showSettingsUI {
            display: unset;
          }
          & div#whisperSubtitles--message {
            &>div#whisper-subtitles-loader-container {
              display: flex;
              justify-content: center;
              align-items: center;
              flex-direction: column;
              width: 100px;
              height: 100px;
              &>div#whisper-subtitles-loader {
                border: 15px solid #39d4ff;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                animation: spin 2s linear infinite;
              }
              &>p[data-message="processing"] {
                font-size: 1.2em;
                line-height: 1.5em;
              }
            }
          }
        }
      }
        @keyframes spin{
          0%{
            transform: rotate(0deg);
          }
          50%{
            transform: rotate(180deg);
            border-radius: 0%;
            width: 20px;
            height: 20px;
            border: 5px double #061fd5;
          }
          100%{
            transform: rotate(360deg);
          }
        }
        </style>
        `,
  });
  setTimeout(() => {
    //plugin settings button
    const showSettingsUI = parent.document.getElementById("whisperSubtitles--showSettingsUI") as HTMLButtonElement | null;
    if (showSettingsUI) showSettingsUI.addEventListener("click", () => logseq.showSettingsUI(), { once: true });
  }, 50);
};

// 显示处理的 UI
const showProcessingUI = (blockUuid: string) => {
  popupUI(`
    <div id="whisper-subtitles-loader-container">
      <div id="whisper-subtitles-loader"></div>
      <p data-message="processing">${t("Processing...")}</p>
    </div>
    <p>${t("It will take a few minutes.")}</p>
  `, blockUuid);
};

// 隐藏处理中的 UI
const hideProcessingUI = () => {
  removePopupUI();
};

// 从 DOM 中除弹出窗口
const removePopupUI = () => parent.document.getElementById(logseq.baseInfo.id + "--" + keyNamePopup)?.remove();

//---- 弹出 UI 相关函数结束 ----

// 添加一个新函数来处理 OpenAI API 轮询的提示
function handleOpenAIRotationNotification(message: string) {
  const regex = /Using OpenAI API setting (\d+)/;
  const match = message.match(regex);
  if (match) {
    const number = match[1];
    logseq.UI.showMsg(`Using OpenAI API setting ${number}`, 'info');
  }
}

console.log("Plugin script finished loading, calling logseq.ready");
logseq.ready(main).catch(console.error);

logseq.provideModel({
  getSetting(key: string) {
    return logseq.settings[key];
  },
  getAllSettings() {
    return logseq.settings;
  }
});

function showHotwordsInputDialog(): Promise<string> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;

    logseq.provideUI({
      key: 'hotwords-input',
      reset: true,
      template: `
        <div class="hotwords-input-container">
          <h3>Enter Hotwords</h3>
          <p>Please enter hotwords separated by commas(auto close after 3 minutes):</p>
          <textarea id="hotwords-input" rows="4" cols="50"></textarea>
          <div class="button-container">
            <button id="submit-hotwords">Submit</button>
            <button id="cancel-hotwords">Cancel</button>
          </div>
        </div>
      `,
      style: {
        width: '400px',
        height: 'auto',
        backgroundColor: 'var(--ls-primary-background-color)',
        color: 'var(--ls-primary-text-color)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
    });

    const submitHotwords = () => {
      clearTimeout(timeoutId);
      const textarea = parent.document.getElementById('hotwords-input') as HTMLTextAreaElement;
      const hotwords = textarea.value.trim();
      logseq.provideUI({
        key: 'hotwords-input',
        reset: true,
      });
      resolve(hotwords);
    };

    setTimeout(() => {
      const submitButton = parent.document.getElementById('submit-hotwords');
      const cancelButton = parent.document.getElementById('cancel-hotwords');
      const textarea = parent.document.getElementById('hotwords-input') as HTMLTextAreaElement;

      if (submitButton && cancelButton && textarea) {
        submitButton.addEventListener('click', submitHotwords);

        cancelButton.addEventListener('click', () => {
          clearTimeout(timeoutId);
          logseq.provideUI({
            key: 'hotwords-input',
            reset: true,
          });
          resolve('');
        });

        // 设置5分钟后自动提交
        timeoutId = setTimeout(submitHotwords, 3 * 60* 1000);
      }
    }, 100);
  });
}

async function transcribeFromSubtitleFile(b: IHookEvent, performSegmentation: boolean = false, outputFormat: 'youtube' | 'other' = 'other') {
  const currentBlock = await logseq.Editor.getBlock(b.uuid);
  if (currentBlock) {
    try {
      console.log("Block content:", currentBlock.content);
      
      showProcessingUI(currentBlock.uuid);

      const subtitleFilePath = extractSubtitleFilePath(currentBlock.content);
      console.log("Extracted subtitle file path:", subtitleFilePath);
      
      if (!subtitleFilePath) {
        throw new Error("No subtitle file path found in the block content");
      }

      const settings = getTranscriptionSettings();

      const transcription = await convertSubtitleToTranscription(subtitleFilePath);

      transcription.source = outputFormat;
      console.log("Transcription:", transcription);

      let result = transcription.segments;

      if (performSegmentation) {
        const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
        const endpoint = `${baseEndpoint}/segment`;
        
        const formData = new FormData();
        formData.append('text', transcription.segments.map(seg => `{{timestamp ${seg.start}}} ${seg.text}`).join('\n'));
        appendCommonFormData(formData, settings);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const segmentationResult = await response.json();
        result = segmentationResult.segments;
      }

      console.log("Final result:", result);

      await insertTranscription(currentBlock, { segments: result, source: outputFormat });

      logseq.UI.showMsg(t("Transcription from subtitle file completed and inserted"), "success");
    } catch (e: any) {
      console.error("Error in transcribeFromSubtitleFile:", e);
      logseq.UI.showMsg(t("Transcription from subtitle file failed: ") + e.message, "error");
    } finally {
      hideProcessingUI();
    }
  }
}

function extractSubtitleFilePath(content: string): string | null {
  // 匹配 orgmode 链接格式
  const logseqLinkMatch = content.match(/\[\[(.*?\.(?:srt|ass))\]\[.*?\]\]/);
  if (logseqLinkMatch) {
    return logseqLinkMatch[1];
  }

  // 匹配普通的 Markdown 链接格式（保留原有的匹配逻辑）
  const markdownLinkMatch = content.match(/\[(.*?)\]\((.*?\.(?:srt|ass))\)/);
  if (markdownLinkMatch) {
    return markdownLinkMatch[2];
  }

  return null;
}

async function convertSubtitleToTranscription(filePath: string): Promise<TranscriptionResponse> {
  console.log("Converting subtitle file to transcription:", filePath);
  
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/convert_subtitle`;
  
  const formData = new FormData();
  formData.append('subtitle_path', filePath);
  formData.append('graph_path', logseq.settings?.graphPath || '');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    console.log("Conversion result:", result);

    return result;
  } catch (error) {
    console.error("Error converting subtitle file:", error);
    throw error;
  }
}

async function segmentTranscription(transcription: TranscriptionResponse, settings: TranscriptionOptions): Promise<TranscriptionResponse> {
  const fullText = transcription.segments.map(seg => `{{timestamp ${seg.start}}} ${seg.text}`).join('\n');
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/segment`;
  
  const formData = new FormData();
  formData.append('text', fullText);
  appendCommonFormData(formData, settings);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error("Server response:", response.status, response.statusText);
      const responseText = await response.text();
      console.error("Response body:", responseText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // 处理 OpenAI API 轮询通知
    if (result.openai_rotation_message) {
      handleOpenAIRotationNotification(result.openai_rotation_message);
    }

    console.log("Segmentation result:", result);

    // 将分段后的文本转换回 TranscriptionResponse 格式
    const segmentedTranscription: TranscriptionResponse = {
      segments: result.segments.map((segment: string) => {
        const match = segment.match(/^\{\{timestamp (\d+)\}\} (.+)$/);
        if (match) {
          return {
            start: parseInt(match[1]),
            text: match[2]
          };
        }
        return null;
      }).filter((segment: any) => segment !== null)
    };

    return segmentedTranscription;
  } catch (error) {
    console.error("Segmentation error:", error);
    throw error;
  }
}

async function segment_text_with_openai(text: string, settings: TranscriptionOptions): Promise<string[]> {
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/segment`;
  
  const formData = new FormData();
  formData.append('text', text);
  appendCommonFormData(formData, settings);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.segments;
  } catch (error) {
    console.error("Segmentation error:", error);
    throw error;
  }
}

async function summarizeSubtitle(e: IHookEvent) {
  console.log("Starting summarizeSubtitle function");
  console.log("Event:", e);

  try {
    const block = await logseq.Editor.getBlock(e.uuid);
    console.log("Retrieved block:", block);

    if (!block) {
      throw new Error("Failed to retrieve block");
    }

    const settings = getTranscriptionSettings();
    const summarizeBlockContent = settings.summarizeBlockContent || "#视频总结";
    const summarizeOpenAISettingPriority = settings.summarizeOpenAISettingPriority || "1,2,3,4,5";

    console.log("Settings:", {
      summarizeBlockContent,
      summarizeOpenAISettingPriority
    });

    // 显示处理中的 UI
    showProcessingUI(block.uuid);

    // 获取块内容（包括子块）
    const content = await getBlockContentRecursively(block);
    console.log("Retrieved content:", content);

    // 调用后端 API 进行总结
    const summary = await summarizeContent(content, summarizeOpenAISettingPriority);
    console.log("Generated summary:", summary);

    // 创建总结块
    const summaryBlock = await logseq.Editor.insertBlock(block.uuid, summarizeBlockContent, { sibling: true });
    console.log("Created summary block:", summaryBlock);

    if (summaryBlock) {
      await logseq.Editor.insertBlock(summaryBlock.uuid, summary);
      console.log("Inserted summary content");
    } else {
      throw new Error("Failed to create summary block");
    }

    logseq.UI.showMsg(t("Summary created successfully"), "success");
  } catch (error) {
    console.error("Error in summarizeSubtitle:", error);
    logseq.UI.showMsg(t("Failed to create summary: ") + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
    // 隐藏处理中的 UI
    hideProcessingUI();
  }
}

async function getBlockContentRecursively(block: any): Promise<string> {
  console.log("Starting getBlockContentRecursively for block:", block);
  let content = block.content.replace(/\{\{.*?\}\}/g, ''); // 移除时间戳
  if (block.children) {
    for (const childId of block.children) {
      try {
        console.log("Attempting to retrieve child block with ID:", childId);
        // 检查 childId 是否是数组，如果是，取第二个元素（实际的 UUID）
        const actualChildId = Array.isArray(childId) ? childId[1] : childId;
        
        // 检查 actualChildId 是否是有效的 UUID
        if (typeof actualChildId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actualChildId)) {
          const childBlock = await logseq.Editor.getBlock(actualChildId);
          if (childBlock) {
            console.log("Successfully retrieved child block:", childBlock);
            content += '\n' + await getBlockContentRecursively(childBlock);
          } else {
            console.warn("Child block not found for ID:", actualChildId);
          }
        } else {
          console.warn("Invalid child block ID:", actualChildId);
        }
      } catch (error) {
        console.error("Error retrieving child block:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        // 继续处理下一个子块，而不是中断整个过程
      }
    }
  }
  console.log("Finished getBlockContentRecursively, content length:", content.length);
  return content;
}

async function summarizeContent(content: string, apiSettingPriority: string): Promise<string> {
  console.log("Starting summarizeContent, content length:", content.length, "apiSettingPriority:", apiSettingPriority);
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/summarize`;
  
  const settings = getTranscriptionSettings();
  const formData = new FormData();
  formData.append('text', content);
  formData.append('api_setting_priority', apiSettingPriority);
  appendCommonFormData(formData, settings);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Summarization result:", result);
    return result.summary;
  } catch (error) {
    console.error("Error in summarizeContent:", error);
    throw error;
  }
}