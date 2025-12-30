import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3000;
const JWT_SECRET = 'my-secret-key-change-this-in-production';

// DB接続設定
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 5432,
});

app.use(express.json());

// --- 型定義 ---

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string };
    }
  }
}

// --- 認証ミドルウェア ---

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Header形式: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    // トークンが正しければ、解読したユーザ情報をreqオブジェクトに付加して次へ
    req.user = user as { id: number; username: string };
    next();
  });
};

// --- 認証系API（公開） ---

// ユーザー登録
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ログイン
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // ユーザー検索
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];

    // パスワード照合
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // JWT発行（署名）
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- ToDo API（要認証）---

// authenticateToken を通ったリクエストだけが以下の関数を実行できる

app.get('/', (req: Request, res: Response) => {
  res.send('Hello Embedded Engineer! Step4: User authentication\n');
});

// ToDo 一覧の取得 (Read)
app.get('/todos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query('SELECT * FROM todos WHERE user_id = $1 ORDER BY id ASC', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の作成 (Create)
app.post('/todos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const userId = req.user?.id;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO todos (title, user_id) VALUES ($1, $2) RETURNING *',
      [title, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の更新 (Update)
//   :id は URLパラメータ (e.g. /todos/1)
app.put('/todos/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, is_completed } = req.body;
    const userId = req.user?.id;

    const result = await pool.query(
      'UPDATE todos SET title = $1, is_completed = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [title, is_completed, id, userId]
    );

    if (result.rowCount == 0) {
      res.status(404).json({ error: 'Todo not found or not authorized' });
      return
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ToDo の削除 (Delete)
app.delete('/todos/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;

    const result = await pool.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [id, userId]);

    if (result.rowCount == 0) {
      res.status(404).json({ error: 'Todo not found or not authorized' });
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
