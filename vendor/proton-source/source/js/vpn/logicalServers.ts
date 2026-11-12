import { Storage, storage } from "../tools/storage";
import type { Logical } from "./Logical";

export type LogicalServersCache =
	import("../../../../../vpn/engine/catalog").CatalogCache<Logical>;

export const logicalServers = storage.item<LogicalServersCache>(
	"logicals-servers",
	Storage.LOCAL,
);
