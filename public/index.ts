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
  }>;
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

  const openaiSettings = [];
  for (let i = 1; i <= 5; i++) {
    openaiSettings.push({
      apiKey: logseq.settings?.[`openaiApiKey${i}`] as string,
      model: logseq.settings?.[`openaiModel${i}`] as string,
      apiEndpoint: logseq.settings?.[`openaiApiEndpoint${i}`] as string,
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

// 在 main 函数中或 logseq.ready 回调中添加段代码
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

  // 为每组 OpenAI 设置添加输入框
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
      key: "outputFormat",
      type: "string",
      default: "{{youtube-timestamp <start>}} <text>",
      title: t("Output Format"),
      description: t("Format for the transcription output. Use <start> for timestamp and <text> for transcribed text"),
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
      key: 'group_segmentation',
      title: "✂ Text Segmentation Settings",
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
      key: 'group_openai',
      title: "🧠 OpenAI API Settings",
      description: "",
      type: "heading",
      default: null,
      visibility: "segmentModel === 'openai'",
    },
    ...openaiSettingsGroup,
  ]);

  console.log("Plugin settings registered");
  console.log("Settings immediately after registration:", logseq.settings);
}

function registerCommands() {
  console.log("Registering plugin commands");
  
  logseq.Editor.registerSlashCommand(t("whisper-subtitles"), runTranscription);
  logseq.Editor.registerBlockContextMenuItem(t("whisper-subtitles"), runTranscription);
  
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
      // 执行转录
      const transcription = await transcribeContent(currentBlock.content, settings);
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
async function transcribeContent(content: string, options: TranscriptionOptions): Promise<TranscriptionResponse> {
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/transcribe`;
  
  const formData = new FormData();
  formData.append('text', content);
  formData.append('model_type', options.modelType);
  if (options.modelType === 'whisper' && options.whisperModelSize) {
    formData.append('model_size', options.whisperModelSize);
  }
  if (options.minLength) {
    formData.append('min_length', options.minLength);
  }
  if (options.zhType) {
    formData.append('zh_type', options.zhType);
  }
  if (options.modelType === 'funasr') {
    if (options.funasrModelName) {
      formData.append('funasr_model_name', options.funasrModelName);
    }
    if (options.funasrModelSource) {
      formData.append('funasr_model_source', options.funasrModelSource);
    }
  }
  formData.append('segment_model', options.segmentModel || logseq.settings?.segmentModel || "ollama");
  
  if (options.segmentModel === 'ollama') {
    formData.append('ollama_model', options.ollamaModel || logseq.settings?.ollamaModel || "qwen2.5:3b");
    formData.append('ollama_endpoint', options.ollamaEndpoint || logseq.settings?.ollamaEndpoint || "http://localhost:11434");
  } else if (options.segmentModel === 'openai') {
    const priority = (logseq.settings?.openaiPriority || "1,2,3,4,5").split(/[,，]/).map(Number);
    formData.append('enable_openai_rotation', (logseq.settings?.enableOpenaiRotation || false).toString());
    formData.append('use_shared_openai_api_key', (logseq.settings?.useSharedOpenAIApiKey || false).toString());
    formData.append('use_shared_openai_api_endpoint', (logseq.settings?.useSharedOpenAIApiEndpoint || false).toString());
    
    formData.append('openai_priority', priority.join(','));

    if (logseq.settings?.useSharedOpenAIApiKey) {
      formData.append('shared_openai_api_key', logseq.settings?.sharedOpenAIApiKey || "");
    }
    if (logseq.settings?.useSharedOpenAIApiEndpoint) {
      formData.append('shared_openai_api_endpoint', logseq.settings?.sharedOpenAIApiEndpoint || "https://api.openai.com/v1");
    }

    // 修改这部分以传递 openaiModel1 到 openaiModel5
    for (let i = 1; i <= 5; i++) {
      const apiKey = logseq.settings?.useSharedOpenAIApiKey ? logseq.settings?.sharedOpenAIApiKey : logseq.settings?.[`openaiApiKey${i}`];
      const endpoint = logseq.settings?.useSharedOpenAIApiEndpoint ? logseq.settings?.sharedOpenAIApiEndpoint : logseq.settings?.[`openaiApiEndpoint${i}`];
      const model = logseq.settings?.[`openaiModel${i}`];

      if (apiKey && endpoint) {
        formData.append(`openai_api_key${i}`, apiKey);
        formData.append(`openai_api_endpoint${i}`, endpoint);
        formData.append(`openai_model${i}`, model || ''); // 即使模型为空，也发送一个空字符串
      }
    }
  }

  formData.append('perform_segmentation', logseq.settings?.performSegmentation ? 'true' : 'false');
  
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

    return result;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

// 插入转录结果
async function insertTranscription(block: any, transcription: TranscriptionResponse) {
  console.log("Inserting transcription:", transcription);
  const outputFormat = logseq.settings?.outputFormat || "{{youtube-timestamp <start>}} <text>";
  const parentBlockTitle = logseq.settings?.parentBlockTitle || "";
  const grandparentBlockTitle = logseq.settings?.grandparentBlockTitle || "";
  
  let insertionBlock = block;
  
  if (grandparentBlockTitle && parentBlockTitle) {
    // 1. 创建祖父块（与视频块同级）
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
  const blocks: IBatchBlock[] = transcription.segments.map(segment => ({
    content: outputFormat
      .replace('<start>', formatTime(segment.start))
      .replace('<text>', segment.text),
  }));

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
  if (messageEl) messageEl.innerHTML = messageHTML; // 如果弹出窗口已显示更新消息
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

// 显示处理中的 UI
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

// 从 DOM 中移除弹出窗口
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