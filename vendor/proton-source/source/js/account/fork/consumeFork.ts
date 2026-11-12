import { loginFlow } from "../loginFlow";
export const consumeFork = (input: {
	state: string;
	selector: string;
	persistent?: boolean;
}) => loginFlow.complete(input);
