import { t } from "../../../locales/ui";
import React, { FC } from "react";

import categories from "./categories";
import { Props, defaultData } from "./types";

const QuoteSettings: React.FC<Props> = ({ data = defaultData, setData }) => (
  <div className="QuoteSettings">
    <h5>{t("Daily Quotes")}</h5>
    {categories.map((category) => (
      <label key={category.key}>
        <input
          type="radio"
          checked={data.category === category.key}
          onChange={() => setData({ category: category.key })}
        />{" "}
        {category.name}
      </label>
    ))}
    <p>
      {t("Powered by")}{" "}
      <a
        href="https://theysaidso.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        They Said So
      </a>
    </p>
    <h5>{t("Hourly Quotes")}</h5>
    <label>
      <input
        type="radio"
        checked={data.category === "developerexcuses"}
        onChange={() => setData({ category: "developerexcuses" })}
      />{" "}
      {t("Developer Excuses")}</label>
    <p>
      {t("Powered by")}{" "}
      <a
        href="http://www.developerexcuses.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("Developer Excuses")}</a>
    </p>
  </div>
);

export default QuoteSettings;
