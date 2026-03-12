import { Search } from "lucide-react";
import { Input } from "./Input";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/useTranslation";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, className }: SearchBarProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <Input
        placeholder={placeholder ?? t("common.search")}
        className="pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
