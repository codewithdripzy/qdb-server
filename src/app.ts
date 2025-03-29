// create a new QDB server
import QDB from "@/services/qdb";
import QDBServer from "@/server";

const server = new QDBServer("DroneQ", {
    port: 3000,
});

const db = new QDB("droneq", {
    username: "root",
    password: "",
});

// add the db to the server
server.mountDb(db);

// listen to the server
server.listen();