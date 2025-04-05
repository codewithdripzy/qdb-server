import "module-alias/register";
import QDB from "./services/qdb";
import QDBServer from "./server";

// export the QDB Types
export * from "./interfaces/server";
export * from "./interfaces/tables";
export * from "./interfaces/qdb";

export { QDB, QDBServer };
export default { QDB, QDBServer }; 