(() => {
  'use strict';
  const data = window.BNR_DOCUMENTATION;
  const resources = data.resources;
  const byId = new Map(resources.map(n => [n.id, n]));
  const $ = id => document.getElementById(id);
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = String(text); if (cls) n.className = cls; return n; };
  const link = node => { const a = el('a', node.name); a.href = '#' + encodeURIComponent(node.id); return a; };
  $('project-name').textContent = data.project_name;
  document.title = data.project_name + ' documentation · Branch & Row';
  $('generated').textContent = data.generated_at ? 'Generated ' + new Date(data.generated_at).toLocaleString() : 'Documentation snapshot';
  [...new Set(resources.map(n => n.kind))].sort().forEach(kind => { const o = el('option', kind); o.value = kind; $('kind').append(o); });
  function selectedId() { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } }
  function filter() {
    const q = $('search').value.toLowerCase(), kind = $('kind').value;
    const visible = resources.filter(n => (!kind || (kind === 'primary' ? ['model','source','seed','snapshot'].includes(n.kind) : n.kind === kind)) && [n.name, n.description, n.relation, ...n.tags, ...n.columns.map(c => c.name + ' ' + c.description)].join(' ').toLowerCase().includes(q));
    $('count').textContent = visible.length + ' of ' + resources.length + ' resources';
    $('resources').replaceChildren(...visible.map(n => { const a = link(n); a.append(el('small', n.kind + (n.package_name ? ' · ' + n.package_name : ''))); if (n.id === selectedId()) a.className = 'active'; return a; }));
    if (!visible.length) $('resources').append(el('p', 'No matching documentation.', 'empty'));
  }
  function section(title) { const s = el('section'); s.append(el('h3', title)); return s; }
  function lineage(node) {
    const parents = node.parents.map(id => byId.get(id)).filter(Boolean);
    const children = resources.filter(n => n.parents.includes(node.id));
    const groups = [parents, [node], children];
    const maxRows = Math.max(1, ...groups.map(g => g.length));
    const height = maxRows * 76 + 24, width = 900;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Upstream and downstream model lineage');
    const positions = new Map();
    groups.forEach((group, col) => group.forEach((n, row) => positions.set(n.id, {x: 20 + col * 300, y: 12 + row * 76 + (maxRows - group.length) * 38})));
    const shape = (tag, attrs) => { const s = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v]) => s.setAttribute(k, v)); return s; };
    [...parents.map(p => [p, node]), ...children.map(c => [node, c])].forEach(([a,b]) => { const p = positions.get(a.id), q = positions.get(b.id); svg.append(shape('path', {d: `M${p.x+256},${p.y+26} C${p.x+282},${p.y+26} ${q.x-26},${q.y+26} ${q.x},${q.y+26}`, stroke:'#9bad87', 'stroke-width':2, fill:'none'})); });
    groups.flat().forEach(n => { const p = positions.get(n.id); const a = shape('a', {href: '#' + encodeURIComponent(n.id)}); const active = n.id === node.id; const source = n.kind === 'source'; a.append(shape('rect', {x:p.x,y:p.y,width:256,height:54,rx:7,fill:active?'#e8efd9':source?'#f7ecd7':'#eef0f7',stroke:active?'#7d9957':source?'#d4b277':'#b5bdd7','stroke-width':active?2:1})); const label = shape('text',{x:p.x+13,y:p.y+23,fill:'#31482f','font-size':12}); label.textContent=n.name.length>31?n.name.slice(0,28)+'…':n.name; const type=shape('text',{x:p.x+13,y:p.y+41,fill:'#7a866e','font-size':10}); type.textContent=n.kind; a.append(label,type); svg.append(a); });
    const wrap = el('div', null, 'lineage'); wrap.append(svg); return wrap;
  }
  function render() {
    filter();
    const node = byId.get(selectedId()) || resources.find(n => n.kind === 'model') || resources[0];
    const main = $('detail'); main.replaceChildren();
    if (!node) { main.append(el('h2','No documented resources'),el('p','Generate dbt documentation to populate this snapshot.')); return; }
    main.append(el('span', node.kind, 'badge'), el('h2', node.name));
    node.tags.forEach(t => main.append(el('span', t, 'badge')));
    main.append(el('p', node.description || 'No description has been added yet.', 'description'));
    const meta = el('details'); meta.append(el('summary','Model details')); const dl=el('dl'); [['Relation',node.relation],['File',node.path],['Materialization',node.materialized],['Tests',node.tests.join(', ')],['Loaded at',node.loaded_at_field],['Package',node.package_name]].filter(([,v])=>v).forEach(([k,v])=>dl.append(el('dt',k),el('dd',v)));meta.append(dl);main.append(meta);
    if(node.freshness && Object.keys(node.freshness).length){const fresh=section('Source freshness');Object.entries(node.freshness).forEach(([key,value])=>fresh.append(el('p',(key==='warn_after'?'Warn after: ':'Error after: ')+value.count+' '+value.period)));main.append(fresh)}
    if(node.arguments && node.arguments.length){const args=section('Macro arguments');node.arguments.forEach(a=>args.append(el('h3',a.name+(a.type?' · '+a.type:'')),el('p',a.description,'description')));main.append(args)}
    const graph=section('Lineage'); graph.append(lineage(node));main.append(graph);
    if(node.columns.length){const cols=section('Columns · '+node.columns.length),wrap=el('div',null,'table-wrap'),table=el('table'),head=el('thead'),tr=el('tr');['Column','Type','Description','Tests'].forEach(t=>tr.append(el('th',t)));head.append(tr);table.append(head);const body=el('tbody');node.columns.forEach(c=>{const row=el('tr');[c.name,c.data_type||'—',c.description||'—',c.tests.join(', ')||'—'].forEach(v=>row.append(el('td',v)));body.append(row)});table.append(body);wrap.append(table);cols.append(wrap);main.append(cols)}
    if(node.raw_sql||node.compiled_sql){const sql=section('SQL'),bar=el('div',null,'links'),pre=el('pre'),code=el('code',node.raw_sql||node.compiled_sql);pre.append(code);[['Source',node.raw_sql],['Compiled',node.compiled_sql]].filter(([,s])=>s).forEach(([label,value])=>{const b=el('button',label);b.onclick=()=>{code.textContent=value};bar.append(b)});sql.append(bar,pre);main.append(sql)}
    if(data.doc_blocks.length){const blocks=el('details');blocks.append(el('summary','Project documentation blocks · '+data.doc_blocks.length));data.doc_blocks.forEach(b=>blocks.append(el('h3',b.name),el('p',b.contents,'description')));main.append(blocks)}
  }
  $('search').addEventListener('input',filter);$('kind').addEventListener('change',filter);window.addEventListener('hashchange',render);render();
})();
