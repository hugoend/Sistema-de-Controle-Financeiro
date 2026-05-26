"""
Finanças da Família — Servidor local
Rodar: python app.py
Acessar: http://localhost:5000
"""

import sqlite3
import os
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='public', static_url_path='')

DB_PATH = os.path.join(os.path.dirname(__file__), 'financas.db')


# ── Banco de dados ───────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS transacoes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                descricao  TEXT    NOT NULL,
                valor      REAL    NOT NULL,
                tipo       TEXT    NOT NULL CHECK(tipo IN ('receita','despesa')),
                categoria  TEXT    NOT NULL,
                ano        INTEGER NOT NULL,
                mes        INTEGER NOT NULL,
                criado_em  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS orcamentos (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                categoria TEXT    NOT NULL,
                limite    REAL    NOT NULL,
                ano       INTEGER NOT NULL,
                mes       INTEGER NOT NULL,
                UNIQUE(categoria, ano, mes)
            );

            CREATE TABLE IF NOT EXISTS membros (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE
            );
        """)


# ── Frontend ─────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


# ── Transações ───────────────────────────────────────────────

@app.route('/api/transacoes', methods=['GET'])
def get_transacoes():
    ano = int(request.args.get('ano', 0))
    mes = int(request.args.get('mes', 0))
    with get_db() as db:
        rows = db.execute(
            'SELECT * FROM transacoes WHERE ano=? AND mes=? ORDER BY criado_em DESC',
            (ano, mes)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/transacoes', methods=['POST'])
def add_transacao():
    d = request.get_json()
    required = ('descricao', 'valor', 'tipo', 'categoria', 'ano', 'mes')
    if not all(d.get(k) is not None for k in required):
        return jsonify({'erro': 'Campos obrigatórios faltando'}), 400
    with get_db() as db:
        cur = db.execute(
            'INSERT INTO transacoes (descricao,valor,tipo,categoria,ano,mes) VALUES (?,?,?,?,?,?)',
            (d['descricao'], float(d['valor']), d['tipo'], d['categoria'], int(d['ano']), int(d['mes']))
        )
        nova = db.execute('SELECT * FROM transacoes WHERE id=?', (cur.lastrowid,)).fetchone()
    return jsonify(dict(nova)), 201


@app.route('/api/transacoes/<int:tx_id>', methods=['DELETE'])
def del_transacao(tx_id):
    with get_db() as db:
        db.execute('DELETE FROM transacoes WHERE id=?', (tx_id,))
    return jsonify({'ok': True})


# ── Histórico ────────────────────────────────────────────────

@app.route('/api/historico', methods=['GET'])
def get_historico():
    ano = int(request.args.get('ano', 0))
    mes = int(request.args.get('mes', 0))
    resultado = []
    for i in range(5, -1, -1):
        m = mes - i
        a = ano
        while m < 1:
            m += 12
            a -= 1
        with get_db() as db:
            rows = db.execute(
                'SELECT tipo, valor FROM transacoes WHERE ano=? AND mes=?', (a, m)
            ).fetchall()
        receitas = sum(r['valor'] for r in rows if r['tipo'] == 'receita')
        despesas = sum(r['valor'] for r in rows if r['tipo'] == 'despesa')
        resultado.append({'ano': a, 'mes': m, 'receitas': receitas, 'despesas': despesas})
    return jsonify(resultado)


# ── Orçamentos ───────────────────────────────────────────────

@app.route('/api/orcamentos', methods=['GET'])
def get_orcamentos():
    ano = int(request.args.get('ano', 0))
    mes = int(request.args.get('mes', 0))
    with get_db() as db:
        rows = db.execute('SELECT * FROM orcamentos WHERE ano=? AND mes=?', (ano, mes)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/orcamentos', methods=['POST'])
def upsert_orcamento():
    d = request.get_json()
    with get_db() as db:
        db.execute("""
            INSERT INTO orcamentos (categoria,limite,ano,mes) VALUES (?,?,?,?)
            ON CONFLICT(categoria,ano,mes) DO UPDATE SET limite=excluded.limite
        """, (d['categoria'], float(d['limite']), int(d['ano']), int(d['mes'])))
    return jsonify({'ok': True})


@app.route('/api/orcamentos/<int:orc_id>', methods=['DELETE'])
def del_orcamento(orc_id):
    with get_db() as db:
        db.execute('DELETE FROM orcamentos WHERE id=?', (orc_id,))
    return jsonify({'ok': True})


# ── Membros ──────────────────────────────────────────────────

@app.route('/api/membros', methods=['GET'])
def get_membros():
    with get_db() as db:
        rows = db.execute('SELECT * FROM membros ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/membros', methods=['POST'])
def add_membro():
    d = request.get_json()
    nome = d.get('nome', '').strip()
    if not nome:
        return jsonify({'erro': 'Nome obrigatório'}), 400
    with get_db() as db:
        try:
            cur = db.execute('INSERT INTO membros (nome) VALUES (?)', (nome,))
            return jsonify({'id': cur.lastrowid, 'nome': nome}), 201
        except sqlite3.IntegrityError:
            return jsonify({'erro': 'Membro já existe'}), 409


@app.route('/api/membros/<int:m_id>', methods=['DELETE'])
def del_membro(m_id):
    with get_db() as db:
        db.execute('DELETE FROM membros WHERE id=?', (m_id,))
    return jsonify({'ok': True})


# ── Main ─────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print('\n✅  Finanças da Família rodando em http://localhost:5000\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
