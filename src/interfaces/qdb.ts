import { QdbServerRequestType } from "@/core/enums";

interface QDBOptions {
    username: string;
    password: string;
}

interface QDBRoute{
    path: string;
    method?: QdbServerRequestType;
}

interface QDBServerQuery{
    method: QdbServerRequestType;
    data: any;
}

export { QDBOptions, QDBRoute, QDBServerQuery };