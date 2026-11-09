import { t } from "../../../locales/ui";
import { API } from "../../types";

type Data = { messages: string[] };

export type Props = API<Data>;

export const defaultData: Data = { messages: [t("Write something fun")] };
