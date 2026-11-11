import { UiButton } from "../../ui";
import React, { FC } from "react";

type Props = JSX.IntrinsicElements["button"] & {
  primary?: boolean;
};

const Button: FC<Props> = ({ className, children, primary, ...props }) => (
  <UiButton
    className={`button ${primary ? "button--primary" : ""} ${className}`}
    {...props}
  >
    {children}
  </UiButton>
);

export default Button;
