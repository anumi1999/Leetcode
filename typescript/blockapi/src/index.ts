// create out first http server

// import {createServer} from 'http';

// const server = createServer((req, res) => {
//     res.setHeader("Content-type", "application/json");
//     if (req.url === '/'){
//         res.writeHead(200);
//         res.end(JSON.stringify({message: "Hello World"}));
//     }
// })

// server.listen(3500, () =>{
//     console.log("Server is running and listening to 3500");
// })

import express from 'express';

const app = express();

const port = 3500;

app.get("/", (req, res) => {
    res.send("Hello World!");
})

app.listen(port, () => {
    console.log("Server running at 3500");
})