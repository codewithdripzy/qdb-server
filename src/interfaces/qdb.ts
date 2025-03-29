import { QDBServerRequestType } from "@/core/enums";

interface QDBOptions {
    username: string;
    password: string;
}

interface QDBRoute{
    path: string;
    method?: QDBServerRequestType;
}

interface QDBServerQuery{
    method: QDBServerRequestType;
    data: any;
}

export { QDBOptions, QDBRoute, QDBServerQuery };