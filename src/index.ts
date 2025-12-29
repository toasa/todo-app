import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
const port = 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 5432,
});

app.use(express.json());

interface Todo {
  id: number;
  title: string;
  is_completed: boolean;
  created_at: Date;
}

app.get('/', (req: Request, res: Response) => {
  res.send('Hello Embedded Engineer! Step3: ToDo API implementation\n');
});

// ToDo 一覧の取得 (Read)
app.get('/todos', async (req: Request, res: Response) => {
  try {
    const result = await pool.query<Todo>('SELECT * FROM todos ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の作成 (Create)
app.post('/todos', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    // $1 はプレースホルダ
    // RETURNING * は、INSERTした結果を返す PostgreSQL の機能
    const result = await pool.query<Todo>(
      'INSERT INTO todos (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の更新 (Update)
//   :id は URLパラメータ (e.g. /todos/1)
app.put('/todos/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, is_completed } = req.body;

    const result = await pool.query<Todo>(
      'UPDATE todos SET title = $1, is_completed = $2 WHERE id = $3 RETURNING *',
      [title, is_completed, id]
    );

    if (result.rowCount == 0) {
      res.status(404).json({ error: 'Todo not found' });
      return
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の削除 (Delete)
app.delete('/todos/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query('DELETE FROM todos WHERE id = $1', [id]);

    if (result.rowCount == 0) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    res.status(204).send(); // 204 No Content (成功したが中身はない)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
