import { UiField, UiSelect, UiStack } from "../../ui";
import { t } from "../../locales/ui";
import React from "react";
import { FormattedMessage } from "react-intl";
import { db } from "../../db/state";
import { useKey } from "../../lib/db/react";
import TimeZoneInput from "../shared/timeZone/TimeZoneInput";

const System: React.FC = () => {
  const [locale, setLocale] = useKey(db, "locale");
  const [timeZone, setTimeZone] = useKey(db, "timeZone");

  return (
    <div>
      <h2>
        <FormattedMessage
          id="settings"
          defaultMessage="Settings"
          description="Settings title"
        />
      </h2>

      <UiStack className="system-fields">
        <UiField className="system-field">
          <span>{t("Language")}</span>
          <UiSelect
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="pt-BR">Português do Brasil</option>
            <option value="en">English</option>
          </UiSelect>
        </UiField>

        <UiField className="system-field">
          {t("Time Zone")}<TimeZoneInput timeZone={timeZone} onChange={setTimeZone} />
        </UiField>
      </UiStack>
    </div>
  );
};

export default System;
