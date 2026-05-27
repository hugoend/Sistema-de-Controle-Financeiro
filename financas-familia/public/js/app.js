// ── Configuração ────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const CATS = {
  despesa: [
    { n: 'Alimentação', c: '#1D9E75' },
    { n: 'Moradia',     c: '#185FA5' },
    { n: 'Transporte',  c: '#BA7517' },
    { n: 'Saúde',       c: '#D85A30' },
    { n: 'Educação',    c: '#534AB7' },
    { n: 'Lazer',       c: '#D4537E' },
    { n: 'Vestuário',   c: '#5F5E5A' },
    { n: 'Assinaturas', c: '#0F6E56' },
    { n: 'Outros',      c: '#888780' },
  ],
  receita: [
    { n: 'Salário',       c: '#0F6E56' },
    { n: 'Freelance',     c: '#185FA5' },
    { n: 'Investimentos', c: '#534AB7' },
    { n: 'Pensão/Aluguéis', c: '#BA7517' },
    { n: 'Outros',        c: '#888780' },
  ],
};

function catColor(tipo, nome) {
  return (CATS[tipo] || []).find(c => c.n === nome)?.c || '#888780';
}

let curAno  = new Date().getFullYear();
let curMes  = new Date().getMonth() + 1;
let tipoAtivo = 'despesa';
let txs = [], orcamentos = [], membros = [];
let histChartInst = null, catChartInst = null;
let curSection = 'dashboard';

// ── Navegação ────────────────────────────────────────────────
function navTo(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(n => n.classList.remove('active'));

  document.getElementById('sec-' + sec).classList.add('active');
  
  // Encontra o botão clicado para marcar como ativo
  navItems.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${sec}'`)) {
      btn.classList.add('active');
    }
  });

  curSection = sec;
  if (sec === 'historico') renderHistorico();
  if (sec === 'membros')   carregarMembros();
  if (sec === 'orcamentos') renderOrcamentos();
  if (sec === 'gastos-fixos') loadGastosFixos();
}

// ── Mês ─────────────────────────────────────────────────────
function mudarMes(delta) {
  curMes += delta;
  if (curMes > 12) { curMes = 1; curAno++; }
  if (curMes < 1)  { curMes = 12; curAno--; }
  atualizarLabel();
  carregar();
}

function atualizarLabel() {
  document.getElementById('monthLabel').textContent =
    MESES[curMes - 1].slice(0, 3) + ' ' + curAno;
  document.getElementById('dashSubtitle').textContent =
    'Visão geral de ' + MESES[curMes - 1] + ' de ' + curAno;
}

// ── API helpers ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return r.json();
}

// ── Carregar dados ───────────────────────────────────────────
async function carregar() {
  txs = await api(`/api/transacoes?ano=${curAno}&mes=${curMes}`);
  orcamentos = await api(`/api/orcamentos?ano=${curAno}&mes=${curMes}`);
  renderTudo();
}

function renderTudo() {
  const rec = txs.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const des = txs.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const sal = rec - des;

  document.getElementById('totalRec').textContent = fmt(rec);
  document.getElementById('totalDes').textContent = fmt(des);
  const salEl = document.getElementById('totalSal');
  salEl.textContent = fmt(sal);
  salEl.style.color = sal >= 0 ? 'var(--green)' : 'var(--red)';

  renderTxList();
  renderRecentTxs();
  renderCatGrid(des);
  renderCatChart(des);
}

// ── Tipo (despesa/receita) ───────────────────────────────────
function setTipo(tipo) {
  tipoAtivo = tipo;
  const des = document.getElementById('tipoDes');
  const rec = document.getElementById('tipoRec');
  if (tipo === 'despesa') {
    des.className = 'tipo-tab active-des';
    rec.className = 'tipo-tab';
  } else {
    rec.className = 'tipo-tab active-rec';
    des.className = 'tipo-tab';
  }
  atualizarSelectCat();
}

function atualizarSelectCat() {
  const sel = document.getElementById('fCat');
  sel.innerHTML = CATS[tipoAtivo].map(c => `<option>${c.n}</option>`).join('');
}

// ── Lançamentos ──────────────────────────────────────────────
async function addTx() {
  const desc = document.getElementById('fDesc').value.trim();
  const valor = parseFloat(document.getElementById('fValor').value);
  const cat = document.getElementById('fCat').value;
  if (!desc || isNaN(valor) || valor <= 0) { toast('Preencha descrição e valor.'); return; }
  await api('/api/transacoes', {
    method: 'POST',
    body: { descricao: desc, valor, tipo: tipoAtivo, categoria: cat, ano: curAno, mes: curMes }
  });
  document.getElementById('fDesc').value = '';
  document.getElementById('fValor').value = '';
  toast('Lançamento adicionado!');
  await carregar();
}

async function delTx(id) {
  if (!confirm('Excluir este lançamento?')) return;
  await api(`/api/transacoes/${id}`, { method: 'DELETE' });
  await carregar();
}

function renderTxList() {
  const el = document.getElementById('txList');
  if (!txs.length) { el.innerHTML = emptyState('Nenhum lançamento neste mês.'); return; }
  el.innerHTML = txs.map(txCard).join('');
}

function renderRecentTxs() {
  const el = document.getElementById('recentTxList');
  const recent = txs.slice(0, 5);
  if (!recent.length) { el.innerHTML = emptyState('Nenhum lançamento neste mês.'); return; }
  el.innerHTML = recent.map(txCard).join('');
}

function txCard(t) {
  const color = catColor(t.tipo, t.categoria);
  const sinal = t.tipo === 'receita' ? '+' : '-';
  return `<div class="tx-item">
    <span class="tx-dot" style="background:${color}"></span>
    <div class="tx-info">
      <div class="tx-desc">${esc(t.descricao)}</div>
      <div class="tx-meta">${t.categoria} · ${t.tipo === 'receita' ? 'Receita' : 'Despesa'}</div>
    </div>
    <span class="tx-val ${t.tipo}">${sinal}${fmt(t.valor)}</span>
    <button class="tx-del" onclick="delTx(${t.id})" title="Excluir">×</button>
  </div>`;
}

// ── Categorias ───────────────────────────────────────────────
function renderCatGrid(totalDes) {
  const el = document.getElementById('catGrid');
  const desTxs = txs.filter(t => t.tipo === 'despesa');
  const map = {};
  desTxs.forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + t.valor; });
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { el.innerHTML = emptyState('Nenhuma despesa lançada.'); return; }

  el.innerHTML = entries.map(([nome, val]) => {
    const color  = catColor('despesa', nome);
    const pct    = totalDes > 0 ? Math.round(val / totalDes * 100) : 0;
    const orc    = orcamentos.find(o => o.categoria === nome);
    const orcTxt = orc
      ? `<span>Limite: ${fmt(orc.limite)}</span><span class="${val > orc.limite ? 'over' : ''}">${val > orc.limite ? '⚠ Excedeu ' + fmt(val - orc.limite) : 'OK'}</span>`
      : '<span>Sem limite definido</span><span></span>';
    return `<div class="cat-card">
      <div class="cat-card-top">
        <div class="cat-name-row"><span class="cat-dot" style="background:${color}"></span><span class="cat-name">${nome}</span></div>
        <span class="cat-pct">${pct}%</span>
      </div>
      <div class="cat-amount">${fmt(val)}</div>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>
      <div class="cat-limit">${orcTxt}</div>
    </div>`;
  }).join('');
}

function renderCatChart(totalDes) {
  const desTxs = txs.filter(t => t.tipo === 'despesa');
  const map = {};
  desTxs.forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + t.valor; });
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([n]) => n);
  const data   = entries.map(([, v]) => parseFloat(v.toFixed(2)));
  const colors = labels.map(n => catColor('despesa', n));

  if (catChartInst) catChartInst.destroy();
  if (!entries.length) return;

  catChartInst = new Chart(document.getElementById('catChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      }
    }
  });
}

// ── Orçamentos ───────────────────────────────────────────────
function renderOrcamentos() {
  const sel = document.getElementById('oCat');
  sel.innerHTML = CATS.despesa.map(c => `<option>${c.n}</option>`).join('');
  const el = document.getElementById('orcList');
  if (!orcamentos.length) { el.innerHTML = emptyState('Nenhum orçamento definido para este mês.'); return; }
  el.innerHTML = orcamentos.map(o => `
    <div class="orc-item">
      <span class="cat-dot" style="background:${catColor('despesa', o.categoria)}"></span>
      <span class="orc-name">${o.categoria}</span>
      <span class="orc-val">Limite: ${fmt(o.limite)}</span>
      <button class="btn btn-danger" onclick="delOrc(${o.id})">Remover</button>
    </div>
  `).join('');
}

async function addOrc() {
  const cat    = document.getElementById('oCat').value;
  const limite = parseFloat(document.getElementById('oLimite').value);
  if (!limite || limite <= 0) { toast('Informe um limite válido.'); return; }
  await api('/api/orcamentos', { method: 'POST', body: { categoria: cat, limite, ano: curAno, mes: curMes } });
  document.getElementById('oLimite').value = '';
  toast('Orçamento salvo!');
  orcamentos = await api(`/api/orcamentos?ano=${curAno}&mes=${curMes}`);
  renderOrcamentos();
}

async function delOrc(id) {
  await api(`/api/orcamentos/${id}`, { method: 'DELETE' });
  orcamentos = await api(`/api/orcamentos?ano=${curAno}&mes=${curMes}`);
  renderOrcamentos();
}

// ── Histórico ────────────────────────────────────────────────
async function renderHistorico() {
  const hist = await api(`/api/historico?ano=${curAno}&mes=${curMes}`);
  const labels = hist.map(h => MESES[h.mes - 1].slice(0, 3) + '/' + String(h.ano).slice(2));
  const recs   = hist.map(h => parseFloat(h.receitas.toFixed(2)));
  const dess   = hist.map(h => parseFloat(h.despesas.toFixed(2)));

  if (histChartInst) histChartInst.destroy();
  histChartInst = new Chart(document.getElementById('histChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receitas', data: recs, backgroundColor: '#1D9E75', borderRadius: 4, borderSkipped: false },
        { label: 'Despesas', data: dess, backgroundColor: '#D85A30', borderRadius: 4, borderSkipped: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 11 }, callback: v => 'R$' + v.toLocaleString('pt-BR') } }
      }
    }
  });
}

// ── Membros ──────────────────────────────────────────────────
async function carregarMembros() {
  membros = await api('/api/membros');
  renderMembros();
}

function renderMembros() {
  const el = document.getElementById('membrosGrid');
  if (!membros.length) { el.innerHTML = emptyState('Nenhum membro cadastrado.'); return; }
  el.innerHTML = membros.map(m => {
    const ini = m.nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="membro-card">
      <div class="membro-avatar">${ini}</div>
      <div class="membro-name">${esc(m.nome)}</div>
      <button class="membro-del" onclick="delMembro(${m.id})">Remover</button>
    </div>`;
  }).join('');
}

async function addMembro() {
  const nome = document.getElementById('mNome').value.trim();
  if (!nome) { toast('Informe o nome.'); return; }
  await api('/api/membros', { method: 'POST', body: { nome } });
  document.getElementById('mNome').value = '';
  toast('Membro adicionado!');
  await carregarMembros();
}

async function delMembro(id) {
  if (!confirm('Remover este membro?')) return;
  await api(`/api/membros/${id}`, { method: 'DELETE' });
  await carregarMembros();
}

// ── Utilidades ───────────────────────────────────────────────
function fmt(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Init ─────────────────────────────────────────────────────
atualizarLabel();
atualizarSelectCat();
carregar();

// ── Gastos Fixos ─────────────────────────────────────────────
async function loadGastosFixos() {
  atualizarSelectCatFixo();

  const dados = await api('/api/recorrencias');
  const el = document.getElementById('gfList');
  if (!dados.length) { el.innerHTML = emptyState('Nenhuma recorrência cadastrada.'); return; }
  
  el.innerHTML = dados.map(g => `
    <div class="tx-item">
      <span class="tx-dot" style="background:${catColor(g.tipo, g.categoria)}"></span>
      <div class="tx-info">
        <div class="tx-desc">${esc(g.descricao)}</div>
        <div class="tx-meta">${g.categoria} · ${g.tipo === 'receita' ? 'Receita' : 'Despesa'}</div>
      </div>
      <span class="tx-val ${g.tipo}">${g.tipo === 'receita' ? '+' : '-'}${fmt(g.valor)}</span>
      <button class="tx-del" onclick="delGastoFixo(${g.id})" title="Excluir">×</button>
    </div>
  `).join('');
}

function atualizarSelectCatFixo() {
  const tipo = document.getElementById('gfTipo').value;
  const sel = document.getElementById('gfCat');
  if (sel) sel.innerHTML = CATS[tipo].map(c => `<option>${c.n}</option>`).join('');
}

async function addGastoFixo() {
  const desc = document.getElementById('gfDesc').value.trim();
  const valor = parseFloat(document.getElementById('gfValor').value);
  const cat = document.getElementById('gfCat').value;
  const tipo = document.getElementById('gfTipo').value;

  if (!desc || isNaN(valor) || valor <= 0) { toast('Preencha descrição e valor corretamente.'); return; }
  
  await api('/api/recorrencias', { 
    method: 'POST', 
    body: { descricao: desc, valor, categoria: cat, tipo: tipo } 
  });
  
  document.getElementById('gfDesc').value = '';
  document.getElementById('gfValor').value = '';
  toast('Recorrência salva!');
  loadGastosFixos();
}

async function delGastoFixo(id) {
  if (!confirm('Excluir esta recorrência?')) return;
  await api(`/api/recorrencias/${id}`, { method: 'DELETE' });
  toast('Removido com sucesso!');
  loadGastosFixos();
}
