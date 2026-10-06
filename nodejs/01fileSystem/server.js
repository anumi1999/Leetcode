const fs = require('fs');
const path = require('path');

fs.readFile('./files/starter.txt', 'utf8', (err, data) => {
    if(err) throw err;
    console.log(data);
})

process.on('uncaughtException', err =>{
    console.error(`there was an unexpected error: ${err}`)
    process.exit(1);
})

fs.writeFile('./files/newFile.txt', 'this is muskan', (err) => {
    if(err) throw err;
    console.log("Write complete");
})

fs.appendFile('./files/newAppend.txt', 'appended', (err) => {
    if(err) throw err;
    console.log("append complete");
})

// async hell!

fs.writeFile(path.join(__dirname, 'files', 'text.txt'), 'Nice to meet you!', (err) =>{
     if(err) throw err;
    console.log("Write complete in async hell");

    fs.appendFile(path.join(__dirname, 'files', 'text.txt'), 'Nice to meet you! DAVE', (err) =>{
        if(err) throw err;
        console.log("append complete in async hell");

        fs.readFile(path.join(__dirname, 'files', 'text.txt'), 'utf8', (err) =>{
            if(err) throw err;
            console.log("read complete in async hell");
        })
    })
})

//solving the async hell

const fsPromise = require('fs').promises;
const fileOps = async () => {
    try{
        const data = await fsPromise.readFile(path.join(__dirname, 'files', 'text.txt'), 'utf8');
        console.log(data);
        await fsPromise.unlink(path.join(__dirname, 'files', 'text1.txt'));
        await fsPromise.writeFile(path.join(__dirname, 'files', 'text1.txt'), data);
        await fsPromise.appendFile(path.join(__dirname, 'files', 'text1.txt'), data);
        await fsPromise.rename(path.join(__dirname, 'files', 'text1.txt'), path.join(__dirname, 'files', 'text2.txt'));
        const newData = await fsPromise.readFile(path.join(__dirname, 'files', 'text2.txt'), 'utf8');
        console.log(newData);
    } catch (err){
        console.error(err);
    }
}

// streaming

const fs = require('fs');

const rs = fs.createReadStream('./files/starter.txt', {encoding: 'utf8'})

const ws = fs.createWriteStream('./files/starter.txt');

rs.on('data', (dataChunk) => {
    ws.write(dataChunk);
})

rs.pipe(ws);

// make a directory

fs.mkdir('./new', (err) => {
    if(err) throw err;
    console.log('Directory Created!')
})

fs.rmdir('./new', (err) => {
    if(err) throw err;
    console.log('Directory Created!')
})

