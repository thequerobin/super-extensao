import { UiButton } from "../../../ui";
import React, { FC } from "react";

interface Props {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  title?: string;
}

const IconButton: FC<Props> = ({ children, primary, ...props }) => (
  <UiButton
    className={`ui-button-icon button--icon ${primary ? "button--primary" : ""}`}
    {...props}
  >
    {children}
  </UiButton>
);

export default IconButton;
