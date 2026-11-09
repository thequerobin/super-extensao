import { t } from "../../../locales/ui";
import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { Game } from "./types";

export function getPeriod(game: Game, timeZone: string | null) {
  const period = game.period;
  let periodDate = new Date(game.startTimeUTC);

  if (timeZone) {
    periodDate = utcToZonedTime(new Date(game.startTimeUTC), timeZone);
  }

  let periodStr = format(periodDate, "hh:mm a");

  if (game.isGameActivated || period.current > 0) {
    if (period.isHalftime) {
      periodStr = t("Halftime");
    } else if (period.current === period.maxRegular && !game.clock) {
      periodStr = t("Final");
    } else if (period.isEndOfPeriod) {
      periodStr = `${t("End of")} ${period.current}${t("Q")}`;
    } else if (period.current <= 4) {
      periodStr = `${period.current}${t("Q")} ${game.clock} `;
    } else {
      periodStr = `${t("OT")} ${game.clock}`;
    }
  }

  return periodStr;
}
