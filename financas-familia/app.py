"""
Finanças da Família — Servidor local
Rodar: python app.py
Acessar: http://localhost:5000
"""

import sqlite3
import os
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, g

app = Flask(__name__, static_folder='public', static_url_path='')
DB_PATH = os.path.join(os.path.dirname(__file__), 'financas.db')

# ── Banco de dados ───────────────────────────────────────────

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


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
    agora = datetime.now()
    ano = int(request.args.get('ano', agora.year))
    mes = int(request.args.get('mes', agora.month))
    with get_db() as db:
        rows = db.execute(
            'SELECT * FROM transacoes WHERE ano=? AND mes=? ORDER BY criado_em DESC',
            (ano, mes)
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/transacoes', methods=['POST'])
def add_transacao():
    try:
        d = request.get_json()
        required = ('descricao', 'valor', 'tipo', 'categoria', 'ano', 'mes')
        if not all(d.get(k) is not None for k in required):
            return jsonify({'erro': 'Campos obrigatórios faltando'}), 400
        
        db = get_db()
        cur = db.execute(
            'INSERT INTO transacoes (descricao,valor,tipo,categoria,ano,mes) VALUES (?,?,?,?,?,?)',
            (d['descricao'], float(d['valor']), d['tipo'], d['categoria'], int(d['ano']), int(d['mes']))
        )
        db.commit()
        nova = db.execute('SELECT * FROM transacoes WHERE id=?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(nova)), 201
    except (ValueError, TypeError):
        return jsonify({'erro': 'Dados inválidos'}), 400

@app.route('/api/transacoes/<int:tx_id>', methods=['DELETE'])
def del_transacao(tx_id):
    db = get_db()
    db.execute('DELETE FROM transacoes WHERE id=?', (tx_id,))
    db.commit()
    return jsonify({'ok': True})

# ── Histórico ────────────────────────────────────────────────

@app.route('/api/historico', methods=['GET'])
def get_historico():
    agora = datetime.now()
    ano = int(request.args.get('ano', agora.year))
    mes = int(request.args.get('mes', agora.month))
    
    # Calcula o limite inferior (6 meses atrás)
    limite_inferior = (ano * 12 + mes) - 5
    
    with get_db() as db:
        # Query otimizada: Agrupa tudo em uma única chamada ao banco
        query = """
            SELECT ano, mes,
                   SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as receitas,
                   SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as despesas
            FROM transacoes 
            WHERE (ano * 12 + mes) BETWEEN ? AND ?
            GROUP BY ano, mes
            ORDER BY ano ASC, mes ASC
        """
        rows = db.execute(query, (limite_inferior, ano * 12 + mes)).fetchall()
    
    return jsonify([dict(r) for r in rows])


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
    try:
        d = request.get_json()
        db = get_db()
        db.execute("""
            INSERT INTO orcamentos (categoria,limite,ano,mes) VALUES (?,?,?,?)
            ON CONFLICT(categoria,ano,mes) DO UPDATE SET limite=excluded.limite
        """, (d['categoria'], float(d['limite']), int(d['ano']), int(d['mes'])))
        db.commit()
        return jsonify({'ok': True})
    except (ValueError, TypeError, KeyError):
        return jsonify({'erro': 'Dados inválidos'}), 400


@app.route('/api/orcamentos/<int:orc_id>', methods=['DELETE'])
def del_orcamento(orc_id):
    db = get_db()
    db.execute('DELETE FROM orcamentos WHERE id=?', (orc_id,))
    db.commit()
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
    db = get_db()
    try:
        cur = db.execute('INSERT INTO membros (nome) VALUES (?)', (nome,))
        db.commit()
        return jsonify({'id': cur.lastrowid, 'nome': nome}), 201
    except sqlite3.IntegrityError:
        return jsonify({'erro': 'Membro já existe'}), 409


@app.route('/api/membros/<int:m_id>', methods=['DELETE'])
def del_membro(m_id):
    db = get_db()
    db.execute('DELETE FROM membros WHERE id=?', (m_id,))
    db.commit()
    return jsonify({'ok': True})

# ── Main ─────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print('\n✅  Finanças da Família rodando em http://localhost:5000\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
