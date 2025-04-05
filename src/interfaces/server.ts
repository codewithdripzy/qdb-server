import { Server } from "http";
import { QDBServerRequestType, QDBServerType } from "../core/enums";
import { QDBTableColumn } from "./tables";
import { TableConflictOptions } from "../core/enums";

interface QDBServerOptions {
    port: number;
    server?: Server;
}

interface QDBServerQuery{
    type: QDBServerType;
    method: QDBServerRequestType;
    throwOnError?: boolean;
    interval?: number;
    timeout?: number;
    columns?: QDBTableColumn[];
    params?: any[];
    data?: Record<string, any>[];
    onConflict?: TableConflictOptions;
}

interface QDBServerResponse{
    success: boolean;
    error?: string;
    data: any;
}

export { QDBServerOptions, QDBServerQuery, QDBServerResponse };