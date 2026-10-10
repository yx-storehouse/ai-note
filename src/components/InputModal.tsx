import { Icons } from './Icon';
import { Kbd, Modal, MOD_KEY } from './Modal';

interface InputModalProps {
  text: string;
  onTextChange: (text: string) => void;
  isProcessing: boolean;
  errorMsg: string | null;
  onAnalyze: () => void;
  onClose: () => void;
}

export const MAX_INPUT_LENGTH = 20_000;

export const InputModal: React.FC<InputModalProps> = ({ text, onTextChange, isProcessing, errorMsg, onAnalyze, onClose }) => {
  const tooLong = text.length > MAX_INPUT_LENGTH;
  const canSubmit = !isProcessing && text.trim().length > 0 && !tooLong;

  return (
    <Modal
      title="数据输入终端"
      subtitle="粘贴原始文本，AI 将自动识别并分类"
      onClose={onClose}
      onSubmit={canSubmit ? onAnalyze : undefined}
      widthClass="max-w-3xl"
      bodyClass="p-0 relative flex flex-col"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <span className={`text-[10px] font-mono hidden sm:inline ${tooLong ? 'text-red-400' : 'text-textMuted/60'}`}>
            {text.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
            <span className="ml-3 text-textMuted/60">
              <Kbd>{MOD_KEY}</Kbd> + <Kbd>Enter</Kbd> 开始分析
            </span>
          </span>
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-5 py-2.5 text-textMuted hover:text-white text-sm transition-colors">
              取消
            </button>
            <button
              onClick={onAnalyze}
              disabled={!canSubmit}
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded font-bold transition-all flex items-center gap-2 text-sm"
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  正在处理...
                </>
              ) : (
                <>
                  <Icons.Sparkles className="w-4 h-4" />
                  开始分析
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder="> 在此粘贴内容..."
        aria-label="原始文本"
        className="w-full flex-1 min-h-[300px] md:min-h-[400px] bg-background p-6 text-textMain font-mono text-sm focus:outline-hidden resize-none placeholder:text-textMuted/30 leading-relaxed"
      ></textarea>

      {(errorMsg || tooLong) && (
        <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded backdrop-blur-xs whitespace-pre-line">
          ⚠️ {tooLong ? `文本过长，最多 ${MAX_INPUT_LENGTH.toLocaleString()} 个字符` : errorMsg}
        </div>
      )}
    </Modal>
  );
};
