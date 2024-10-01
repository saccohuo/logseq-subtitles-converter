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
}

// 定义转录段落接口
interface TranscriptionSegment {
  segment: string;  // 转录文本
  startTime: number;  // 开始时间
  endTime?: number;  // 结束时间（可选，因为 Whisper 可能不提供）
}

// 定义转录响应接口
interface TranscriptionResponse {
  segments: TranscriptionSegment[];  // 转录段落数组
  source: string;  // 源类型（如 YouTube、本地文件等）
  error: string;   // 错误信息（如果有）
}

// 获取转录设置
export function getTranscriptionSettings(): TranscriptionOptions {
  const modelType = (logseq.settings?.["modelType"] as 'whisper' | 'funasr') || "whisper";  // 默认使用 whisper
  const whisperModelSize = logseq.settings?.["whisperModelSize"] as string;
  const minLength = logseq.settings?.["minLength"] as string;
  const zhType = logseq.settings?.["zhType"] as string;
  const funasrModelName = logseq.settings?.["funasrModelName"] as string;
  const funasrModelSource = logseq.settings?.["funasrModelSource"] as string;
  return {
    modelType,
    whisperModelSize,
    minLength,
    zhType,
    funasrModelName,
    funasrModelSource,
  };
}

console.log("Plugin script started loading");

// 主函数
function main() {
  console.log("Main function started");
  
  l10nSetup({ builtinTranslations: { ja } })
    .then(() => {
      console.log("l10n setup completed");
      registerSettings();
      registerCommands();
      console.log("Plugin initialization completed");
    })
    .catch(error => {
      console.error("Error in l10n setup:", error);
    });
}

function registerSettings() {
  console.log("Registering plugin settings");
  
  const funasrModels = [
    "SenseVoiceSmall", "paraformer-zh", "paraformer-zh-streaming", "paraformer-en",
    "conformer-en", "ct-punc", "fsmn-vad", "fsmn-kws", "fa-zh", "cam++",
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
      visibility: (settings) => settings.modelType === "whisper",
    },
    {
      key: "funasrModelName",
      type: "enum",
      default: "SenseVoiceSmall",
      enumChoices: funasrModels,
      title: t("FunASR model"),
      description: t("Choose FunASR model"),
      visibility: (settings) => settings.modelType === "funasr",
    },
    {
      key: "funasrModelSource",
      type: "enum",
      default: "modelscope",
      enumChoices: ["modelscope", "huggingface"],
      title: t("FunASR model source"),
      description: t("Choose FunASR model source"),
      visibility: (settings) => settings.modelType === "funasr",
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
  ]);

  console.log("Plugin settings registered");
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
  // 实现将取决于我们如何处理转录过程
  // 这可能涉及向本地服务器发送请求，或使用 Web Worker 运行轻量级模型
  // 这里是一个示例实现，实际使用时需要根据实际情况修改
  const response = await fetch(logseq.settings?.whisperLocalEndpoint || "http://127.0.0.1:5014/transcribe", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, ...options }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 插入转录结果
async function insertTranscription(block: any, transcription: TranscriptionResponse) {
  const blocks: IBatchBlock[] = transcription.segments.map(segment => ({
    content: `${formatTime(segment.startTime)}${segment.endTime ? ' - ' + formatTime(segment.endTime) : ''} ${segment.segment}`,
  }));

  await logseq.Editor.insertBatchBlock(block.uuid, blocks, { sibling: false });
}

// 格式化时间
function formatTime(seconds: number): string {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

//---- 弹出 UI 相关函数 ----

const keyNamePopup = "whisper--popup"; // 弹出窗口的 key 名称

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
logseq.ready(main);