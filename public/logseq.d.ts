declare global {
  const logseq: {
    settings: {
      [key: string]: any;
      modelType?: 'whisper' | 'funasr';
      whisperModelSize?: string;
      minLength?: string;
      zhType?: string;
      funasrModelName?: string;
      funasrModelSource?: string;
      whisperLocalEndpoint?: string;
    };
    updateSettings: (settings: Partial<typeof logseq.settings>) => Promise<void>;
    useSettingsSchema: (schema: Array<{
      key: string;
      type: string;
      default: any;
      title: string;
      description: string;
      enumChoices?: string[];
      visibility?: string;
    }>) => void;
    Editor: {
      registerSlashCommand: (name: string, callback: Function) => void;
      registerBlockContextMenuItem: (name: string, callback: Function) => void;
      getBlock: (uuid: string) => Promise<any>;
      insertBatchBlock: (uuid: string, blocks: any[], options: any) => Promise<void>;
    };
    UI: {
      showMsg: (message: string, status: string) => void;
    };
    baseInfo: {
      id: string;
    };
    provideUI: (options: any) => void;
    showSettingsUI: () => void;
    ready: (callback: () => Promise<void>) => void;
    onSettingsChanged: (callback: (settings: typeof logseq.settings) => void) => void;
  };
}

declare module 'logseq-l10n' {
  export function setup(options: { builtinTranslations: { [key: string]: any } }): Promise<void>;
  export function t(key: string): string;
}

export {};