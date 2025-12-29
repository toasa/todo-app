import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
const port = 3000;

// コネクションプールの使用
//   DBへのTCP接続確立はコストが高い処理。そのため、最初に例えば10本接続を作りプールさせる設計にする。
//   リクエストが来たら、1本借りて使い、終わったら返却する。
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 5432,
});

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello Embedded Engineer! Step2: DB Connection\n');
});

app.get('/db-test', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      message: 'Database Connected!',
      time: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
