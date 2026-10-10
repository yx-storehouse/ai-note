import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard';
import { Icons } from './Icon';

export const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (await copyText(text)) setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-textMuted hover:text-white transition-colors p-1 ${className}`}
      title="复制到剪贴板"
      aria-label="复制到剪贴板"
    >
      {copied ? <Icons.Check className="w-3.5 h-3.5 text-white" /> : <Icons.Copy className="w-3.5 h-3.5" />}
    </button>
  );
};
