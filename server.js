const express = require('express');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());

const db = new Database('banco.db');
db.pragma('foreign_keys = ON'); // ativa a regra de chave estrangeira

db.exec(`
  CREATE TABLE IF NOT EXISTS aula (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    componente TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS horario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia TEXT NOT NULL,
    hora TEXT NOT NULL,
    aula_id INTEGER NOT NULL,
    FOREIGN KEY (aula_id) REFERENCES aula(id)
  );
`);

// dados de exemplo (só insere se a tabela estiver vazia)
if (db.prepare('SELECT COUNT(*) AS n FROM aula').get().n === 0) {
  db.prepare('INSERT INTO aula (componente) VALUES (?)').run('Matemática');
  db.prepare('INSERT INTO aula (componente) VALUES (?)').run('Português');
}

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

// DELETE /aula/:id
app.delete('/aula/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  try {
    const resultado = db.prepare('DELETE FROM aula WHERE id = ?').run(id);
    if (resultado.changes === 0) {
      return res.status(404).json({ erro: `Aula ${id} não encontrada.` });
    }
    res.json({ mensagem: `Aula ${id} removida com sucesso.` });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(409).json({
        erro: 'Não é possível remover a aula: existem horários vinculados a ela. Remova os horários primeiro.'
      });
    }
    res.status(500).json({ erro: 'Erro interno.', detalhe: err.message });
  }
});

// POST /horario   body: { "dia": "segunda", "hora": "07:20", "aula_id": 1 }
app.post('/horario', (req, res) => {
  const { dia, hora, aula_id } = req.body;

  if (!dia || !hora || aula_id === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatórios: dia, hora e aula_id.' });
  }
  if (!DIAS.includes(String(dia).toLowerCase())) {
    return res.status(400).json({ erro: `Dia inválido. Use: ${DIAS.join(', ')}.` });
  }

  const aula = db.prepare('SELECT id FROM aula WHERE id = ?').get(aula_id);
  if (!aula) {
    return res.status(404).json({ erro: `A aula ${aula_id} não existe na tabela "aula".` });
  }

  try {
    const resultado = db
      .prepare('INSERT INTO horario (dia, hora, aula_id) VALUES (?, ?, ?)')
      .run(String(dia).toLowerCase(), hora, aula_id);

    res.status(201).json({
      id: resultado.lastInsertRowid,
      dia: String(dia).toLowerCase(),
      hora,
      aula_id
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(409).json({ erro: 'Violação de chave estrangeira: aula inexistente.' });
    }
    res.status(500).json({ erro: 'Erro interno.', detalhe: err.message });
  }
});

// GET /horario/:dia
app.get('/horario/:dia', (req, res) => {
  const dia = req.params.dia.toLowerCase();
  if (!DIAS.includes(dia)) {
    return res.status(400).json({ erro: `Dia inválido. Use: ${DIAS.join(', ')}.` });
  }

  const linhas = db.prepare(`
    SELECT h.id, h.dia, h.hora, h.aula_id, a.componente
    FROM horario h
    JOIN aula a ON a.id = h.aula_id
    WHERE h.dia = ?
    ORDER BY h.hora
  `).all(dia);

  res.json(linhas);
});

// DELETE /horario/:id
app.delete('/horario/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'ID inválido.' });
  }

  const resultado = db.prepare('DELETE FROM horario WHERE id = ?').run(id);
  if (resultado.changes === 0) {
    return res.status(404).json({ erro: `Horário ${id} não encontrado.` });
  }
  res.json({ mensagem: `Horário ${id} removido com sucesso.` });
});

app.listen(3000, () => console.log('API rodando em http://localhost:3000'));