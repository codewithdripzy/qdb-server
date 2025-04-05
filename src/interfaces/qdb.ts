import { QDBServerRequestType } from "../core/enums";
import { QDBServerQuery } from "./server";

interface QDBOptions {
    username: string;
    password: string;
}

interface QDBRoute{
    path: string;
    method?: QDBServerRequestType;
}

interface QDBServerRequest{
    method: QDBServerRequestType;
    data: any;
}

export { QDBOptions, QDBRoute, QDBServerRequest };