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
  openaiApiKey?: string;
  openaiModel?: string;
  openaiApiEndpoint?: string;
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
  const modelType = (logseq.settings?.["modelType"] as 'whisper' | 'funasr') || "whisper";  // 默认使用 whisper
  const whisperModelSize = logseq.settings?.["whisperModelSize"] as string;
  const minLength = logseq.settings?.["minLength"] as string;
  const zhType = logseq.settings?.["zhType"] as string;
  const funasrModelName = logseq.settings?.["funasrModelName"] as string;
  const funasrModelSource = logseq.settings?.["funasrModelSource"] as string;
  const ollamaModel = logseq.settings?.["ollamaModel"] as string;
  const ollamaEndpoint = logseq.settings?.["ollamaEndpoint"] as string;
  const segmentModel = logseq.settings?.["segmentModel"] as string;
  const openaiApiKey = logseq.settings?.["openaiApiKey"] as string;
  const openaiModel = logseq.settings?.["openaiModel"] as string;
  const openaiApiEndpoint = logseq.settings?.["openaiApiEndpoint"] as string;
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
    openaiApiKey,
    openaiModel,
    openaiApiEndpoint,
  };
}

console.log("Plugin script started loading");

// 在文件顶部添加这行
let globalWhisperLocalEndpoint: string | undefined;

// 在文件顶部添加这个声明
declare global {
  interface Window {
    whisperSubtitlesPlugin: {
      getSetting: (key: string) => any;
      getAllSettings: () => any;
    };
  }
}

// 在 main 函数中或 logseq.ready 回调中添加这段代码
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
  console.log("Initial settings:", logseq.settings);
  
  await l10nSetup({ builtinTranslations: { ja } });
  console.log("l10n setup completed");
  
  registerSettings();
  console.log("Settings after registration:", logseq.settings);
  
  // 添加延迟检查
  setTimeout(() => {
    console.log("Delayed settings check:", logseq.settings);
    console.log("whisperLocalEndpoint:", logseq.settings?.whisperLocalEndpoint);
    registerCommands();
    console.log("Plugin initialization completed");

    // 添加这个新的检查
    setTimeout(() => {
      console.log("Final whisperLocalEndpoint check:", logseq.settings?.whisperLocalEndpoint);
      if (typeof logseq.settings?.whisperLocalEndpoint === 'undefined') {
        console.warn("whisperLocalEndpoint is still undefined, setting default value");
        logseq.updateSettings({
          whisperLocalEndpoint: "http://127.0.0.1:5014"
        });
      }
    }, 2000);
  }, 1000);

  // 在 main 函数中，添加这行
  globalWhisperLocalEndpoint = logseq.settings?.whisperLocalEndpoint;

  const whisperLocalEndpoint = getSetting('whisperLocalEndpoint');
  console.log("Safely retrieved whisperLocalEndpoint:", whisperLocalEndpoint);
}

function registerSettings() {
  console.log("Registering plugin settings");
  
  // const funasrModels = [
  //   "SenseVoiceSmall", "paraformer-zh", "paraformer-zh-streaming", "paraformer-en",
  //   "conformer-en", "ct-punc", "fsmn-vad", "fsmn-kws", "fa-zh", "cam++",
  //   "Qwen-Audio", "Qwen-Audio-Chat", "emotion2vec+large"
  // ];
  const funasrModels = [
    "paraformer-zh", "paraformer-en",
    "Qwen-Audio", "Qwen-Audio-Chat", "emotion2vec+large"
  ];

  logseq.useSettingsSchema([
    {
      key: "modelType",
      type: "enum",
      default: "whisper",
      enumChoices: ["whisper", "funasr"],
      title: t("Speech recognition model"),
      description: t("Choose between Whisper and FunASR models"),
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
      key: "funasrModelName",
      type: "enum",
      default: "SenseVoiceSmall",
      enumChoices: funasrModels,
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
      key: "minLength",
      type: "number",
      default: 100,
      title: t("Minimum length of a segment"),
      description: t("if set to zero, segments will be split by .?!, otherwise, segments less than minLength will be merged"),
    },
    {
      key: "whisperLocalEndpoint",
      type: "string",
      default: "http://127.0.0.1:5014",
      title: t("End point of logseq-whisper-subtitles-server"),
      description: t("default: http://127.0.0.1:5014"),
    },
    {
      key: "zhType",
      type: "enum",
      default: "zh-cn",
      enumChoices: ["zh-cn", "zh-tw"],
      title: t("Chinese language type"),
      description: "zh-cn and zh-tw",
    },
    {
      key: "ollamaEndpoint",
      type: "string",
      default: "http://localhost:11434",
      title: t("Ollama API Endpoint"),
      description: t("Endpoint for Ollama API"),
    },
    {
      key: "ollamaModel",
      type: "string",
      default: "qwen2.5:3b",
      title: t("Ollama Model"),
      description: t("Model to use for text segmentation"),
    },
    {
      key: "segmentModel",
      type: "enum",
      default: "ollama",
      enumChoices: ["ollama", "openai"],
      title: t("Text Segmentation Model"),
      description: t("Choose the model for text segmentation"),
    },
    {
      key: "openaiApiKey",
      type: "string",
      default: "",
      title: t("OpenAI API Key"),
      description: t("Required for OpenAI text segmentation"),
      visibility: "segmentModel === 'openai'",
    },
    {
      key: "openaiApiEndpoint",
      type: "string",
      default: "https://api.openai.com/v1",
      title: t("OpenAI API Endpoint"),
      description: t("Endpoint for OpenAI API"),
      visibility: "segmentModel === 'openai'",
    },
    {
      key: "openaiModel",
      type: "string",
      default: "gpt-3.5-turbo",
      title: t("OpenAI Model"),
      description: t("Model to use for text segmentation with OpenAI"),
      visibility: "segmentModel === 'openai'",
    },
    {
      key: "outputFormat",
      type: "string",
      default: "{{youtube-timestamp <start>}} <text>",
      title: t("Custom output format"),
      description: t("Use <start> for timestamp and <text> for transcribed text"),
    },
    {
      key: "grandparentBlockTitle",
      type: "string",
      default: "#字幕合集",
      title: t("Grandparent block title"),
      description: t("Title for the grandparent block of transcription. Leave empty to skip creating this block."),
    },
    {
      key: "parentBlockTitle",
      type: "string",
      default: "#字幕时间轴",
      title: t("Parent block title"),
      description: t("Title for the parent block of transcription. Leave empty to skip creating this block."),
    },
  ]);

  console.log("Plugin settings registered");
  console.log("Settings immediately after registration:", logseq.settings);

  // 获取可用的 Ollama 模型
  fetchOllamaModels();
}

async function fetchOllamaModels() {
  const endpoint = logseq.settings?.ollamaEndpoint || "http://localhost:11434";
  try {
    const response = await fetch(`${logseq.settings?.whisperLocalEndpoint}/ollama_models?endpoint=${endpoint}`);
    if (response.ok) {
      const models = await response.json();
      logseq.updateSettings({
        ollamaModelChoices: models
      });
    }
  } catch (error) {
    console.error("Failed to fetch Ollama models:", error);
  }
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
  console.log("Current settings in transcribeContent:", logseq.settings);
  console.log("whisperLocalEndpoint in transcribeContent:", logseq.settings?.whisperLocalEndpoint);
  console.log("Full settings object:", JSON.stringify(logseq.settings, null, 2));
  
  const baseEndpoint = logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014";
  const endpoint = `${baseEndpoint}/transcribe`;
  console.log("Using endpoint:", endpoint);
  
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
    formData.append('openai_api_key', options.openaiApiKey || logseq.settings?.openaiApiKey || "");
    formData.append('openai_model', options.openaiModel || logseq.settings?.openaiModel || "gpt-3.5-turbo");
    formData.append('openai_api_endpoint', options.openaiApiEndpoint || logseq.settings?.openaiApiEndpoint || "https://api.openai.com/v1");
  }
  
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
    console.log("Server response:", result);
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

//---- 弹出 UI 相关函数 ----

const keyNamePopup = "whisper--popup"; // 弹出窗的 key 名称

// 更新消息
// 当弹出窗口显示时，如果想中途更改消息，可以使用此函数
const updatePopupUI = (messageHTML: string) => {
  const messageEl = parent.document.getElementById("whisperSubtitles--message") as HTMLDivElement | null;
  if (messageEl) messageEl.innerHTML = messageHTML; // 如果弹出窗口已显示，更新消息
  else popupUI(messageHTML); // 如果弹出窗口未显示，创建带有消息的弹出窗口
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

console.log("Plugin script finished loading, calling logseq.ready");
logseq.ready(async () => {
  console.log("Logseq is ready");
  await initializeSettings();
  console.log("Settings initialized");
  await main();
  console.log("Main function completed");
  console.log("Final settings check:", logseq.settings);
  console.log("Final whisperLocalEndpoint check:", logseq.settings?.whisperLocalEndpoint);

  // 添加这些行来确保全局函数已经被正确添加
  console.log("getSetting function:", window.getSetting);
  console.log("getAllSettings function:", window.getAllSettings);

  // 添加定期检查
  setInterval(() => {
    console.log("Periodic settings check:", logseq.settings);
    console.log("Periodic whisperLocalEndpoint check:", logseq.settings?.whisperLocalEndpoint);
  }, 10000); // 每10秒检一次

  logseq.onSettingsChanged((newSettings) => {
    console.log("Settings changed:", newSettings);
    console.log("New whisperLocalEndpoint:", newSettings.whisperLocalEndpoint);
  });
}).catch(console.error);

async function initializeSettings() {
  return new Promise<void>((resolve) => {
    const checkSettings = () => {
      console.log("Checking settings:", logseq.settings);
      if (logseq.settings && Object.keys(logseq.settings).length > 0) {
        console.log("Settings initialized:", logseq.settings);
        if (!logseq.settings.whisperLocalEndpoint) {
          console.log("Setting default whisperLocalEndpoint");
          logseq.updateSettings({
            whisperLocalEndpoint: "http://127.0.0.1:5014"
          });
        }
        resolve();
      } else {
        console.log("Waiting for settings to initialize...");
        setTimeout(checkSettings, 100);
      }
    };
    checkSettings();
  });
}

logseq.provideModel({
  getSetting(key: string) {
    return logseq.settings[key];
  },
  getAllSettings() {
    return logseq.settings;
  }
});