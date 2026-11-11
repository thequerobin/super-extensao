import { UiButton, UiCheck, UiField, UiInput } from "../../../ui";
import { t } from "../../../locales/ui";
import React, { FC } from "react";

import { useSavedReducer } from "../../../hooks";
import Input from "./Input";
import { addLink, removeLink, reorderLink, updateLink } from "./actions";
import { reducer } from "./reducer";
import { Link, Props, defaultData } from "./types";

const LinksSettings: FC<Props> = ({ data = defaultData, setData }) => {
  const saveLinks = (links: Link[]) => setData({ ...data, links });
  const dispatch = useSavedReducer(reducer, data.links, saveLinks);

  return (
    <div className="LinksSettings">
      <UiField>
        {t("Number of columns")}<UiInput
          type="number"
          value={data.columns}
          onChange={(event) =>
            setData({ ...data, columns: Number(event.target.value) })
          }
          min={1}
        />
      </UiField>

      <UiCheck>
        <UiInput
          type="checkbox"
          checked={data.visible}
          onChange={() => setData({ ...data, visible: !data.visible })}
        />
        {t("Links are always visible")}</UiCheck>

      <UiCheck>
        <UiInput
          type="checkbox"
          checked={data.linkOpenStyle}
          onChange={() =>
            setData({ ...data, linkOpenStyle: !data.linkOpenStyle })
          }
        />
        {t("Links open in a new tab")}</UiCheck>

      <hr />

      {data.links.map((link, index) => (
        <Input
          {...link}
          key={index}
          number={index + 1}
          onChange={(values) =>
            dispatch(updateLink(index, { ...link, ...values }))
          }
          onMoveUp={
            index !== 0
              ? () => dispatch(reorderLink(index, index - 1))
              : undefined
          }
          onMoveDown={
            index !== data.links.length - 1
              ? () => dispatch(reorderLink(index, index + 1))
              : undefined
          }
          onRemove={() => dispatch(removeLink(index))}
        />
      ))}

      <p style={{ marginTop: "0.5rem" }}>
        <UiButton
          className="button button--primary"
          onClick={() => dispatch(addLink())}
        >
          {t("Add link")}</UiButton>
      </p>
    </div>
  );
};

export default LinksSettings;
