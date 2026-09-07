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
  let lineageMode = 'model';
  function route() {
    const [id, query = ''] = location.hash.slice(1).split('?');
    try { return { id: decodeURIComponent(id), column: new URLSearchParams(query).get('column') }; }
    catch { return { id: '', column: null }; }
  }
  function selectedId() { return route().id; }
  function fieldHref(id, column) { return '#' + encodeURIComponent(id) + '?column=' + encodeURIComponent(column); }
  function fieldLinks(node, column) {
    const wrap = el('div', null, 'field-references');
    const edges = data.column_lineage?.edges || [];
    const incoming = edges.filter(e => e.target === node.id && e.target_column === column.name);
    const outgoing = edges.filter(e => e.source === node.id && e.source_column === column.name);
    [['Calculated or referenced from', incoming, 'source', 'source_column'], ['Referenced by', outgoing, 'target', 'target_column']].forEach(([title, relationships, idKey, columnKey]) => {
      if (!relationships.length) return;
      const group = el('div'); group.append(el('strong', title + ': '));
      relationships.forEach((edge, index) => {
        const owner = byId.get(edge[idKey]); if (!owner) return;
        if (index) group.append(document.createTextNode(', '));
        const a = el('a', owner.name + '.' + edge[columnKey]); a.href = fieldHref(owner.id, edge[columnKey]); group.append(a);
      }); wrap.append(group);
    });
    if (!incoming.length && !outgoing.length) wrap.append(el('p', 'No field relationships were recorded for this column.', 'muted'));
    return wrap;
  }
  function lineageSection(node, column) {
    const graph = section('Lineage'), toolbar = el('div', null, 'lineage-tabs'), content = el('div');
    const modes = [];
    if (column) lineageMode = 'column';
    const draw = () => {
      modes.forEach(([mode, button]) => button.setAttribute('aria-pressed', String(mode === lineageMode)));
      content.replaceChildren(lineageMode === 'column' ? window.BNRDocumentationLineage.create(data, node.id, column) : lineage(node));
    };
    [['model', 'Model graph'], ['column', 'Column lineage']].forEach(([mode, label]) => {
      const b = el('button', label); b.type = 'button'; b.onclick = () => { lineageMode = mode; draw(); }; modes.push([mode,b]); toolbar.append(b);
    });
    graph.append(toolbar);
    if (column) {
      const focused = el('p', 'Tracing ' + column + ' · ', 'muted');
      const clear = el('a', 'Show all fields'); clear.href = '#' + encodeURIComponent(node.id); focused.append(clear); graph.append(focused);
    }
    if (node.lineage_partial) graph.append(el('p', 'Relationships are derived from available column lineage and may be incomplete.', 'muted'));
    graph.append(content); draw(); return graph;
  }
  function columnTable(node, selectedColumn) {
    const cols = section('Columns · ' + node.columns.length), wrap = el('div', null, 'table-wrap'), table = el('table'), head = el('thead'), tr = el('tr');
    ['Column','Type','Description','Tests'].forEach(t => tr.append(el('th',t))); head.append(tr); table.append(head);
    const body = el('tbody');
    node.columns.forEach(c => {
      const row = el('tr'); row.id = 'column-' + encodeURIComponent(c.name); row.tabIndex = -1;
      const nameCell = el('td'), name = el('a', c.name, 'column-link'); name.href = fieldHref(node.id,c.name); nameCell.append(name); row.append(nameCell);
      [c.data_type || '—', c.description || '—', c.tests.join(', ') || '—'].forEach(v => row.append(el('td', v)));
      body.append(row);
      if (c.name === selectedColumn) {
        row.classList.add('selected-field'); row.setAttribute('aria-label', 'Selected field ' + c.name);
        const detail = el('tr',null,'column-expression'), cell = el('td'); cell.colSpan = 4;
        if (c.transformation) {
          cell.append(el('strong','Recorded SQL expression'));
          const pre = el('pre'), code = el('code'); code.append(window.BNRDocumentationCode.highlight(c.transformation)); pre.append(code); cell.append(pre);
        } else cell.append(el('p','No calculated expression was recorded for this column.','muted'));
        cell.append(fieldLinks(node,c)); detail.append(cell); body.append(detail);
      }
    });
    table.append(body); wrap.append(table); cols.append(wrap); return cols;
  }
  function filter() {
    const q = $('search').value.toLowerCase(), kind = $('kind').value;
    const visible = resources.filter(n => (!kind || (kind === 'primary' ? ['model','source','seed','snapshot'].includes(n.kind) : n.kind === kind)) && [n.name, n.description, n.relation, ...n.tags, ...n.columns.map(c => c.name + ' ' + c.description)].join(' ').toLowerCase().includes(q));
    $('count').textContent = visible.length + ' of ' + resources.length + ' resources';
    $('resources').replaceChildren(...visible.map(n => { const a = link(n); a.append(el('small', n.kind + (n.package_name ? ' · ' + n.package_name : ''))); if (n.id === selectedId()) a.className = 'active'; return a; }));
    if (!visible.length) $('resources').append(el('p', 'No matching documentation.', 'empty'));
  }
  function section(title) { const s = el('section'); s.append(el('h3', title)); return s; }
  function definitionPanel(definition) {
    const labels = {type:'Type',label:'Label',maturity:'Maturity',expression:'Expression',
      input_metrics:'Input metrics',input_measures:'Input measures',numerator:'Numerator',denominator:'Denominator',
      metrics:'Metrics',group_by:'Group by',entities:'Entities',dimensions:'Dimensions',measures:'Measures',
      name:'Name',description:'Description',expr:'Expression',agg:'Aggregation'};
    const panel = section('Definition');
    const properties = el('dl');
    Object.entries(definition).forEach(([key,value]) => {
      if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
        panel.append(el('h3',labels[key] || key));
        const wrap = el('div',null,'table-wrap'), table = el('table'), head = el('thead'), header = el('tr');
        const fields = ['name','type','description','expr','agg'].filter(field => value.some(row => row[field]));
        fields.forEach(field => header.append(el('th',labels[field] || field)));
        head.append(header); table.append(head);
        const body = el('tbody');
        value.forEach(row => {const tr = el('tr');fields.forEach(field => tr.append(el('td',row[field] || '—')));body.append(tr)});
        table.append(body);wrap.append(table);panel.append(wrap);
      } else {
        properties.append(el('dt',labels[key] || key),el('dd',Array.isArray(value) ? value.join(', ') : value));
      }
    });
    if (properties.childNodes.length) panel.insertBefore(properties,panel.children[1] || null);
    return panel;
  }
  function lineage(node) {
    const parents = node.parents.map(id => byId.get(id)).filter(Boolean);
    const children = resources.filter(n => n.parents.includes(node.id));
    const groups = [parents, [node], children];
    const maxRows = Math.max(1, ...groups.map(g => g.length));
    const height = maxRows * 76 + 24, width = 900;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Upstream and downstream model lineage');
    const positions = new Map();
    groups.forEach((group, col) => group.forEach((n, row) => positions.set(n.id, {x: 20 + col * 300, y: 12 + row * 76 + (maxRows - group.length) * 38})));
    const shape = (tag, attrs) => { const s = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v]) => s.setAttribute(k, v)); return s; };
    [...parents.map(p => [p, node]), ...children.map(c => [node, c])].forEach(([a,b]) => { const p = positions.get(a.id), q = positions.get(b.id); svg.append(shape('path', {d: `M${p.x+256},${p.y+26} C${p.x+282},${p.y+26} ${q.x-26},${q.y+26} ${q.x},${q.y+26}`, stroke:'#7c9570', 'stroke-width':2, fill:'none'})); });
    groups.flat().forEach(n => { const p = positions.get(n.id); const a = shape('a', {href: '#' + encodeURIComponent(n.id)}); const active = n.id === node.id; const source = n.kind === 'source'; a.append(shape('rect', {x:p.x,y:p.y,width:256,height:54,rx:7,fill:active?'#e8efd9':source?'#e3f2e9':'#eef0f7',stroke:active?'#638343':source?'#348368':'#8c9dbe','stroke-width':active?2:1})); const label = shape('text',{x:p.x+13,y:p.y+23,fill:'#24362e','font-size':12}); label.textContent=n.name.length>31?n.name.slice(0,28)+'…':n.name; const type=shape('text',{x:p.x+13,y:p.y+41,fill:'#52634f','font-size':10}); type.textContent=n.kind; a.append(label,type); svg.append(a); });
    const wrap = el('div', null, 'lineage'); wrap.append(svg); return wrap;
  }
  function render() {
    filter();
    const currentRoute = route();
    const node = byId.get(currentRoute.id) || resources.find(n => n.kind === 'model') || resources[0];
    const main = $('detail'); main.replaceChildren();
    if (!node) { main.append(el('h2','No documented resources'),el('p','Generate dbt documentation to populate this snapshot.')); return; }
    main.append(el('span', node.kind, 'badge'), el('h2', node.name));
    node.tags.forEach(t => main.append(el('span', t, 'badge')));
    main.append(el('p', node.description || 'No description has been added yet.', 'description'));
    const meta = el('details'); meta.append(el('summary','Model details')); const dl=el('dl'); [['Relation',node.relation],['File',node.path],['Materialization',node.materialized],['Tests',node.tests.join(', ')],['Loaded at',node.loaded_at_field],['Package',node.package_name]].filter(([,v])=>v).forEach(([k,v])=>dl.append(el('dt',k),el('dd',v)));meta.append(dl);main.append(meta);
    if(node.freshness && Object.keys(node.freshness).length){const fresh=section('Source freshness');Object.entries(node.freshness).forEach(([key,value])=>fresh.append(el('p',(key==='warn_after'?'Warn after: ':'Error after: ')+value.count+' '+value.period)));main.append(fresh)}
    if(node.arguments && node.arguments.length){const args=section('Macro arguments');node.arguments.forEach(a=>args.append(el('h3',a.name+(a.type?' · '+a.type:'')),el('p',a.description,'description')));main.append(args)}
    if(node.definition && Object.keys(node.definition).length) main.append(definitionPanel(node.definition));
    const selectedColumn = node.columns.find(c => c.name === currentRoute.column)?.name || null;
    main.append(lineageSection(node, selectedColumn));
    if (currentRoute.column && !selectedColumn) main.append(el('p', 'That field is not present in this documentation snapshot.', 'muted'));
    if (node.columns.length) main.append(columnTable(node, selectedColumn));
    if (node.raw_sql || node.compiled_sql) main.append(window.BNRDocumentationCode.create(node.raw_sql, node.compiled_sql));
    if(data.doc_blocks.length){const blocks=el('details');blocks.append(el('summary','Project documentation blocks · '+data.doc_blocks.length));data.doc_blocks.forEach(b=>blocks.append(el('h3',b.name),el('p',b.contents,'description')));main.append(blocks)}
    if (selectedColumn) { const row = document.getElementById('column-' + encodeURIComponent(selectedColumn)); row?.scrollIntoView?.({block:'center'}); row?.focus?.({preventScroll:true}); }
  }
  $('search').addEventListener('input',filter);$('kind').addEventListener('change',filter);window.addEventListener('hashchange',render);render();
})();
