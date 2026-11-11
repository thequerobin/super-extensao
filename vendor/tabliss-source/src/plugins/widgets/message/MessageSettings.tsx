import { UiField, UiTextarea } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { Props, defaultData } from "./types";

const MessageSettings: FC<Props> = ({ data = defaultData, setData }) => (
  <div className="MessageSettings">
    <UiField>
      {t("Message")}<UiTextarea
        rows={3}
        value={data.messages[0]}
        onChange={(event) => setData({ messages: [event.target.value] })}
      />
    </UiField>
  </div>
);

export default MessageSettings;
