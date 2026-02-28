import { Badge } from "./Badge";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagFilter({ tags, selectedTags, onChange, className }: TagFilterProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {selectedTags.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-800/50 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
              isSelected
                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                : "border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
