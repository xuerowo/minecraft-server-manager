import { useI18nContext } from '../components/I18nProvider';

export const useI18n = () => {
  const context = useI18nContext();
  return context;
};