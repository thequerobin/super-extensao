import { triggerPromise } from "../../tools/triggerPromise";
import { accountProfile } from "./getUser";
import { pmAccountProfile } from "./getPmUser";

export const forgetUser = () =>
	triggerPromise(
		Promise.all([accountProfile.forget(), pmAccountProfile.forget()]),
	);
