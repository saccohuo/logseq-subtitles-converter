# logseq-plugin-whisper-subtitles

[English](#english) | [中文](#中文)

## Acknowledgments

This project is based on the excellent work by [usoonees](https://github.com/usoonees/logseq-plugin-whisper-subtitles). Special thanks to the original author for creating this innovative Logseq plugin that integrates Whisper AI for video transcription with timestamps.

## English

### Overview

* This plugin integrates with the processing server of "Whisper" running locally on the PC to transcribe text from videos like YouTube, providing **subtitles with timestamps**.
   > The entire process, from transcription by Whisper to importing the content into Logseq, is completed locally.

### Dependencies
* OpenAI Whisper API is not used. To make it work, you must run the dedicated server for this plugin, **[logseq-whisper-subtitles-server](https://github.com/saccohuo/logseq-whisper-subtitles-server)**, every time. It receives data through this dedicated server (requests the local "Whisper" processing server).
* This plugin currently supports YouTube and local video files.
   > To use timestamp navigation for local video files, please install the [logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts) plugin.

### Usage

1. Install *Whisper subtitles* plugin from Logseq Marketplace.
   > The plugin settings include options for specifying Whisper model size, minimum segments, and endpoint.
1. Start the dedicated server for this plugin locally. Make sure it runs in the background.
1. Prepare a block with a video, such as a YouTube video.
   - For YouTube: Paste the URL into a block, and it will be embedded.
   - For local files: Copy and paste or drag them to embed as assets.
1. Right-click the bullet point (•) of that block and select "Transcribe (Whisper-Subtitles)" from the menu.
   > This will request the dedicated server to process it with Whisper. It may take a few minutes for Whisper to finish the transcription process. Once it's done, the block will have extracted timestamps and subtitles.

### Demo
#### YouTube Embedded in a Block
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/906a5678-6ee3-4eda-bbb3-7bc4e41fc633

#### Video File Embedded in a Block (Local)
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/035ac468-064c-45fb-813b-932d6502f693

#### Audio Embedded in a Block (Local)
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/992e82fc-8042-4c9a-abb1-6250fb259579

#### Chinese Demo
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/3a6da75c-4e28-46a2-b209-6c9914baf35a

### Related Repository
* [logseq-whisper-subtitles-server](https://github.com/saccohuo/logseq-whisper-subtitles-server) - The local web server running whisper, which is required to extract voice from videos and subsequently extract text from the voice.
* [logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts): A plugin generate timestamps for video, audio and Bilibili video, it takes you to the corresponding video/audio position when clicked.
* [whisper](https://github.com/openai/whisper): Robust Speech Recognition via Large-Scale Weak Supervision

---

## 中文

### 概述

* 此插件与在 PC 上本地运行的"Whisper"处理服务器集成，可以从 YouTube 等视频中转录文本，提供**带时间戳的字幕**。
   > 从 Whisper 转录到将内容导入 Logseq 的整个过程都在本地完成。

### 依赖关系

* 不使用 OpenAI Whisper API。要使其工作，您必须每次都运行此插件的专用服务器 **[logseq-whisper-subtitles-server](https://github.com/saccohuo/logseq-whisper-subtitles-server)**。它通过此专用服务器接收数据（向本地"Whisper"处理服务器发出请求）。
* 此插件目前支持 YouTube 和本地视频文件。
   > 要为本地视频文件使用时间戳导航，请安装 [logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts) 插件。

### 使用方法

1. 从 Logseq 市场安装 *Whisper subtitles* 插件。
   > 插件设置包括指定 Whisper 模型大小、最小段落和端点的选项。
2. 在本地启动此插件的专用服务器。确保它在后台运行。
3. 准备一个包含视频的块，例如 YouTube 视频。
   - 对于 YouTube：将 URL 粘贴到块中，它将被嵌入。
   - 对于本地文件：复制粘贴或拖动它们以嵌入为资产。
4. 右键单击该块的项目符号 (•)，然后从菜单中选择"转录 (Whisper-Subtitles)"。
   > 这将请求专用服务器使用 Whisper 处理它。Whisper 完成转录过程可能需要几分钟时间。完成后，该块将包含提取的时间戳和字幕。

### 演示
#### 嵌入在块中的 YouTube
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/906a5678-6ee3-4eda-bbb3-7bc4e41fc633

#### 嵌入在块中的视频文件（本地）
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/035ac468-064c-45fb-813b-932d6502f693

#### 嵌入在块中的音频（本地）
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/992e82fc-8042-4c9a-abb1-6250fb259579

#### 中文演示
https://github.com/usoonees/logseq-plugin-whisper-subtitles/assets/56818734/3a6da75c-4e28-46a2-b209-6c9914baf35a

### 相关仓库
* [logseq-whisper-subtitles-server](https://github.com/saccohuo/logseq-whisper-subtitles-server) - 运行 whisper 的本地 Web 服务器，用于从视频中提取语音并随后从语音中提取文本。
* [logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts): 为视频、音频和 Bilibili 视频生成时间戳的插件，点击时会带您到相应的视频/音频位置。
* [whisper](https://github.com/openai/whisper): 通过大规模弱监督实现的鲁棒语音识别
