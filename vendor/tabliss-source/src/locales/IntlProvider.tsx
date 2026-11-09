import React from "react";
import { IntlProvider as ReactIntlProvider } from "react-intl";
import { db } from "../db/state";
import { useKey } from "../lib/db/react";
import { messages } from "./locales";
import { normalizeLocale, setUiLocale } from "./ui";

const IntlProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [savedLocale, setLocale] = useKey(db, "locale");
  const locale = normalizeLocale(savedLocale);
  setUiLocale(locale);
  React.useEffect(() => {
    document.documentElement.lang = locale;
    if (savedLocale !== locale) setLocale(locale);
  }, [savedLocale, locale]);

  return (
    <ReactIntlProvider key={locale} locale={locale} messages={messages[locale]}>
      {children}
    </ReactIntlProvider>
  );
};

export default IntlProvider;
