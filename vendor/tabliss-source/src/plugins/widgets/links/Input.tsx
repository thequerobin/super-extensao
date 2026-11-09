import { t, iconLabel } from "../../../locales/ui";
import icons from "feather-icons/dist/icons.json";
import React, { FC } from "react";

import {
  IconButton,
  RemoveIcon,
  DownIcon,
  UpIcon,
} from "../../../views/shared";
import { Link } from "./types";

type Props = Link & {
  number: number;
  onChange: (values: Partial<Link>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
};

const iconList = Object.keys(icons);

const Input: FC<Props> = (props) => (
  <div className="LinkInput">
    <h5>
      <div className="title--buttons">
        <IconButton onClick={props.onRemove} title={t("Remove link")}>
          <RemoveIcon />
        </IconButton>
        {props.onMoveDown && (
          <IconButton onClick={props.onMoveDown} title={t("Move link down")}>
            <DownIcon />
          </IconButton>
        )}
        {props.onMoveUp && (
          <IconButton onClick={props.onMoveUp} title={t("Move link up")}>
            <UpIcon />
          </IconButton>
        )}
      </div>

      {props.number <= 9 ? `${t("Keyboard shortcut")} ${props.number}` : t("Shortcut")}
    </h5>

    <label>
      URL
      <input
        type="url"
        value={props.url}
        onChange={(event) => props.onChange({ url: event.target.value })}
      />
    </label>

    <label>
      {t("Name ")}<span className="text--grey">{t("(optional)")}</span>
      <input
        type="text"
        value={props.name}
        onChange={(event) => props.onChange({ name: event.target.value })}
      />
    </label>

    <label>
      {t("Icon ")}<span className="text--grey">{t("(optional)")}</span>
      <select
        value={props.icon}
        onChange={(event) => props.onChange({ icon: event.target.value })}
      >
        <option value={""}>{t("None")}</option>
        <option value="_favicon">{t("Website Icon")}</option>
        <optgroup label="Feather Icons">
          {iconList.map((key) => (
            <option key={key} value={key}>{iconLabel(key)}</option>
          ))}
        </optgroup>
      </select>
    </label>

    <hr />
  </div>
);

export default Input;
