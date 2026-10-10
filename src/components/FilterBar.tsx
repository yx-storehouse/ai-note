import { forwardRef } from 'react';
import { ALL_CATEGORIES, type CategoryCount, type SortBy } from '../lib/notes';
import { handleSearchKeyDown } from './Header';
import { Icons } from './Icon';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: CategoryCount[];
  category: string;
  onCategoryChange: (category: string) => void;
  tag: string | null;
  onClearTag: () => void;
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  resultCount: number;
  totalCount: number;
  filtersActive: boolean;
  onClearFilters: () => void;
}

// 手机端的搜索框与分类 chips，以及所有尺寸下的筛选状态 / 排序
export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(
  (
    {
      search,
      onSearchChange,
      categories,
      category,
      onCategoryChange,
      tag,
      onClearTag,
      sortBy,
      onSortChange,
      resultCount,
      totalCount,
      filtersActive,
      onClearFilters,
    },
    ref,
  ) => (
    <div className="mb-6 space-y-3">
      <div className="md:hidden">
        <input
          ref={ref}
          type="search"
          placeholder="搜索..."
          aria-label="搜索笔记"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => handleSearchKeyDown(e, onSearchChange)}
          className="w-full bg-surface border border-border rounded-lg py-2 px-4 text-sm text-white focus:outline-hidden focus:border-white/50"
        />
      </div>

      <div className="md:hidden flex gap-2 overflow-x-auto whitespace-nowrap -mx-4 px-4 pb-1" role="tablist" aria-label="分类">
        {categories
          .filter(c => c.count > 0 || c.name === ALL_CATEGORIES || c.name === category)
          .map(({ name, count }) => (
            <button
              key={name}
              role="tab"
              aria-selected={category === name}
              onClick={() => onCategoryChange(name)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                category === name ? 'bg-white text-black border-white' : 'bg-surface text-textMuted border-border'
              }`}
            >
              {name} <span className="opacity-60">{count}</span>
            </button>
          ))}
      </div>

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-textMuted">
          <span>{filtersActive ? `找到 ${resultCount} / ${totalCount} 条` : `共 ${totalCount} 条`}</span>
          {tag && (
            <button
              onClick={onClearTag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-white text-black text-[10px] font-semibold"
              title="取消标签筛选"
            >
              #{tag} <Icons.X className="w-3 h-3" />
            </button>
          )}
          {filtersActive && (
            <button onClick={onClearFilters} className="underline underline-offset-2 hover:text-white">
              清除筛选
            </button>
          )}
          <label className="ml-auto flex items-center gap-2">
            <span className="sr-only">排序</span>
            <select
              value={sortBy}
              onChange={e => onSortChange(e.target.value as SortBy)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs text-textMain focus:outline-hidden focus:border-white/50"
            >
              <option value="created">最近创建</option>
              <option value="updated">最近更新</option>
            </select>
          </label>
        </div>
      )}
    </div>
  ),
);
FilterBar.displayName = 'FilterBar';
