import { useSettingsStore } from "../store/settingsStore";
import { dictionaries, DictKey } from "../lib/i18n";

export function useTranslation() {
  const { language } = useSettingsStore();

  const t = (key: DictKey): string => {
    return dictionaries[language][key] || key;
  };

  return { t, language };
}
