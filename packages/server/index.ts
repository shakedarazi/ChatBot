import express from 'express';
import type { Request,Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req,res)=> {
    res.send('hello world!');
});

app.listen(port, () => {
    console.log(`server is running on http://localhost:${port}`)
})










