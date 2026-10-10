import { useEffect, useState } from 'react';

const LG = '(min-width: 1024px)';
const MD = '(min-width: 768px)';

const compute = () => (window.matchMedia(LG).matches ? 3 : window.matchMedia(MD).matches ? 2 : 1);

// 瀑布流的列数：桌面 3 列、平板 2 列、手机 1 列
export const useColumns = (): number => {
  const [columns, setColumns] = useState(compute);

  useEffect(() => {
    const queries = [window.matchMedia(LG), window.matchMedia(MD)];
    const update = () => setColumns(compute());
    queries.forEach(q => q.addEventListener('change', update));
    return () => queries.forEach(q => q.removeEventListener('change', update));
  }, []);

  return columns;
};
