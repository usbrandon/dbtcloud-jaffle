/* Offline field lineage. Relationships come exclusively from exported mappings. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_MODELS = 40, MAX_FIELDS = 600, MAX_EDGES = 1600;
  const CARD_W = 280, HEADER_H = 48, ROW_H = 30;
  const color = name => 'var(--lineage-' + name + ')';
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = String(text);
    if (cls) node.className = cls;
    return node;
  };
  const shape = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text != null) node.textContent = String(text);
    return node;
  };
  const route = (id, field) => '#' + encodeURIComponent(id) + (field == null ? '' : '?column=' + encodeURIComponent(field));
  const cellKey = (id, field) => JSON.stringify([id, field]);
  const short = (value, length) => value.length > length ? value.slice(0, length - 1) + '…' : value;

  function create(data, focusId, focusColumn = null) {
    const panel = el('div', null, 'doc-column-lineage');
    const byId = new Map((data.resources || []).map(node => [node.id, node]));
    const focus = byId.get(focusId);
    if (!focus) { panel.append(el('p', 'This model is not in the documentation snapshot.', 'muted')); return panel; }
    const availability = data.column_lineage || { available: false, edges: [] };
    const allEdges = (availability.edges || []).filter(edge => byId.has(edge.source) && byId.has(edge.target) && typeof edge.source_column === 'string' && typeof edge.target_column === 'string');
    const toolbar = el('div', null, 'doc-column-lineage-toolbar');
    const label = el('p', focusColumn == null ? 'Explore mapped fields across models. Select a field to trace its dependencies.' : 'Tracing ' + focus.name + '.' + focusColumn, 'muted');
    const scopes = el('div', null, 'doc-column-lineage-scopes');
    toolbar.append(label, scopes);
    const notice = el('p', null, 'doc-column-lineage-notice muted');
    notice.setAttribute('role', 'status');
    const frame = el('div', null, 'doc-column-lineage-frame');
    Object.assign(frame.style, { position: 'relative', minWidth: '0' });
    const viewport = el('div', null, 'doc-column-lineage-viewport');
    Object.assign(viewport.style, { overflow: 'auto', height: '440px', maxHeight: '65vh', minHeight: '260px', overscrollBehavior: 'contain' });
    viewport.setAttribute('tabindex', '0');
    viewport.setAttribute('aria-label', 'Scrollable column lineage graph');
    frame.append(viewport);
    const controls = el('div', null, 'doc-column-lineage-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Lineage viewport');
    Object.assign(controls.style, { position: 'absolute', bottom: '14px', left: '14px', display: 'flex', flexDirection: 'column', gap: '0' });
    frame.append(controls);
    panel.append(toolbar, notice, frame);
    if (!availability.available) {
      panel.replaceChildren(el('p', 'Column lineage is unavailable in this snapshot. Generate documentation with column lineage to explore field relationships.', 'muted'));
      return panel;
    }
    const selectedField = (focus.columns || []).find(field => field.name === focusColumn);
    if (selectedField && selectedField.transformation) {
      const expression = el('details', null, 'doc-column-lineage-expression');
      const pre = el('pre'), code = el('code');
      if (window.BNRDocumentationCode) code.append(window.BNRDocumentationCode.highlight(selectedField.transformation));
      else code.textContent = selectedField.transformation;
      pre.append(code);
      expression.append(el('summary', 'Recorded SQL expression'), pre);
      panel.append(expression);
    }
    let mode = 'full', zoom = 1, svg = null, graphWidth = 1, graphHeight = 1;
    const buttons = new Map();
    [['Full lineage', 'full'], ['Direct only', 'direct']].forEach(([text, value]) => {
      const button = el('button', text);
      button.type = 'button';
      button.onclick = () => { mode = value; render(); };
      buttons.set(value, button); scopes.append(button);
    });
    function setZoom(next) {
      if (!svg) return;
      const ratio = next / zoom;
      const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
      const centerY = viewport.scrollTop + viewport.clientHeight / 2;
      zoom = next;
      svg.setAttribute('width', graphWidth * zoom);
      svg.setAttribute('height', graphHeight * zoom);
      viewport.scrollLeft = Math.max(0, centerX * ratio - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, centerY * ratio - viewport.clientHeight / 2);
    }
    function fit() {
      setZoom(Math.min(1.5, Math.max(1, viewport.clientWidth - 8) / graphWidth, Math.max(1, viewport.clientHeight - 8) / graphHeight));
      viewport.scrollLeft = 0; viewport.scrollTop = 0;
    }
    [['Zoom in', '+', () => setZoom(Math.min(3, zoom * 1.2))], ['Zoom out', '−', () => setZoom(Math.max(.05, zoom / 1.2))], ['Fit graph', '⛶', fit]].forEach(([name, text, action]) => {
      const button = el('button', text); button.type = 'button'; button.title = name; button.setAttribute('aria-label', name); button.onclick = action; controls.append(button);
    });
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); setZoom(Math.max(.05, Math.min(3, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1))));
    }, { passive: false });

    // Traverse each direction separately: sharing a source field does not
    // make sibling derived fields dependencies of the selected field.
    function scope() {
      const fieldTrace = focusColumn != null;
      const key = (edge, side) => fieldTrace ? cellKey(edge[side], edge[side + '_column']) : edge[side];
      const start = fieldTrace ? cellKey(focusId, focusColumn) : focusId;
      const edgeIds = new Set(), nodeIds = new Set([focusId]), fields = new Set(fieldTrace ? [start] : []);
      for (const direction of ['upstream', 'downstream']) {
        const from = direction === 'upstream' ? 'target' : 'source', to = from === 'target' ? 'source' : 'target';
        const adjacency = new Map();
        allEdges.forEach((edge, index) => { const source = key(edge, from); if (!adjacency.has(source)) adjacency.set(source, []); adjacency.get(source).push(index); });
        const seen = new Set([start]), queue = [[start, 0]];
        for (let i = 0; i < queue.length; i++) {
          const [current, depth] = queue[i];
          if (mode === 'direct' && depth >= 1) continue;
          for (const index of adjacency.get(current) || []) {
            const edge = allEdges[index], next = key(edge, to);
            edgeIds.add(index); nodeIds.add(edge.source); nodeIds.add(edge.target);
            fields.add(cellKey(edge.source, edge.source_column)); fields.add(cellKey(edge.target, edge.target_column));
            if (!seen.has(next)) { seen.add(next); queue.push([next, depth + 1]); }
          }
        }
      }
      return { nodes: nodeIds, fields, edges: [...edgeIds].map(index => allEdges[index]) };
    }

    function render() {
      buttons.forEach((button, value) => button.setAttribute('aria-pressed', String(value === mode)));
      const scoped = scope();
      // Prioritize the focus and immediate neighbors before bounding the DOM.
      const near = new Set(scoped.edges.filter(edge => edge.source === focusId || edge.target === focusId).flatMap(edge => [edge.source, edge.target]));
      const ids = [...scoped.nodes].sort((a, b) => (a === focusId ? -1 : b === focusId ? 1 : Number(near.has(b)) - Number(near.has(a)))).slice(0, MAX_MODELS);
      const shown = new Set(ids), columnsById = new Map();
      const perModelLimit = Math.max(1, Math.floor(MAX_FIELDS / ids.length));
      const mappedNames = new Map();
      for (const edge of scoped.edges) for (const side of ['source', 'target']) {
        if (!mappedNames.has(edge[side])) mappedNames.set(edge[side], new Set());
        mappedNames.get(edge[side]).add(edge[side + '_column']);
      }
      let totalFields = 0;
      for (const id of scoped.nodes) {
        const declared = new Map((byId.get(id).columns || []).map(field => [field.name, field]));
        for (const name of mappedNames.get(id) || []) if (!declared.has(name)) declared.set(name, { name });
        if (id === focusId && focusColumn != null && !declared.has(focusColumn)) declared.set(focusColumn, { name: focusColumn });
        let columns = [...declared.values()].filter(field => focusColumn == null || scoped.fields.has(cellKey(id, field.name)));
        totalFields += columns.length;
        if (shown.has(id)) {
          if (columns.length > perModelLimit) columns = columns.sort((a, b) => (a.name === focusColumn ? -1 : b.name === focusColumn ? 1 : Number(scoped.fields.has(cellKey(id, b.name))) - Number(scoped.fields.has(cellKey(id, a.name))))).slice(0, perModelLimit);
          columnsById.set(id, columns);
        }
      }
      const visibleFields = new Set(ids.flatMap(id => columnsById.get(id).map(field => cellKey(id, field.name))));
      const edges = scoped.edges.filter(edge => visibleFields.has(cellKey(edge.source, edge.source_column)) && visibleFields.has(cellKey(edge.target, edge.target_column))).slice(0, MAX_EDGES);
      const limited = ids.length < scoped.nodes.size || visibleFields.size < totalFields || edges.length < scoped.edges.length;
      if (!allEdges.length) notice.textContent = 'No column mappings were recorded in this snapshot. Model and field documentation remain available below.';
      else if (!scoped.edges.length) notice.textContent = focusColumn == null ? 'No mapped column lineage connects this model.' : 'No mapped lineage was recorded for ' + focus.name + '.' + focusColumn + '.';
      else notice.textContent = (limited ? 'Showing ' : '') + ids.length + ' of ' + scoped.nodes.size + ' models · ' + visibleFields.size + ' of ' + totalFields + ' fields · ' + edges.length + ' of ' + scoped.edges.length + ' mapped connections.' + (limited ? ' This graph is limited for readability. Use Direct only or select a field to narrow it.' : '');
      if (!scoped.edges.length && focusColumn != null) notice.textContent = 'No mapped lineage was recorded for ' + focus.name + '.' + focusColumn + '.';
      if (limited && !scoped.edges.length) notice.textContent += ' Showing ' + visibleFields.size + ' of ' + totalFields + ' fields. Select a field from the documentation table to inspect it individually.';
      const parents = new Map(ids.map(id => [id, []]));
      edges.forEach(edge => { if (edge.source !== edge.target) parents.get(edge.target).push(edge.source); });
      const depths = new Map(), visiting = new Set();
      function depth(id) {
        if (depths.has(id)) return depths.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id); const result = Math.max(0, ...parents.get(id).map(parent => depth(parent) + 1)); visiting.delete(id); depths.set(id, result); return result;
      }
      ids.forEach(depth);
      const layers = new Map();
      ids.forEach(id => { const layer = depths.get(id); if (!layers.has(layer)) layers.set(layer, []); layers.get(layer).push(id); });
      const positions = new Map();
      layers.forEach((nodes, layer) => {
        let y = 24;
        nodes.forEach(id => { const columns = columnsById.get(id), height = HEADER_H + Math.max(1, columns.length) * ROW_H + 12; positions.set(id, { x: 24 + layer * 380, y, height }); y += height + 24; });
      });
      const edgeShapes = [], hullX = [0], hullY = [0];
      positions.forEach(position => { hullX.push(position.x + CARD_W + 24); hullY.push(position.y + position.height + 24); });
      edges.forEach((edge, index) => {
        const from = positions.get(edge.source), to = positions.get(edge.target);
        const rowFrom = columnsById.get(edge.source).findIndex(field => field.name === edge.source_column), rowTo = columnsById.get(edge.target).findIndex(field => field.name === edge.target_column);
        const x1 = from.x + CARD_W, x2 = to.x, y1 = from.y + HEADER_H + rowFrom * ROW_H + ROW_H / 2, y2 = to.y + HEADER_H + rowTo * ROW_H + ROW_H / 2;
        const curve = Math.max(40, Math.abs(x2 - x1) * .45);
        hullX.push(x1 + curve + 16, x2 - curve - 16);
        edgeShapes.push(shape('path', { d: `M${x1},${y1} C${x1 + curve},${y1} ${x2 - curve},${y2} ${x2},${y2}`, fill: 'none', stroke: color('edge'), 'stroke-width': focusColumn == null ? 1.5 : 2.5, opacity: focusColumn == null ? .65 : .95, 'data-column-edge': index }));
      });
      const left = Math.min(...hullX), top = Math.min(...hullY);
      graphWidth = Math.max(...hullX) - left; graphHeight = Math.max(...hullY) - top;
      svg = shape('svg', { viewBox: `${left} ${top} ${graphWidth} ${graphHeight}`, width: graphWidth, height: graphHeight, role: 'group', 'aria-label': focusColumn == null ? 'Column lineage model and field links' : 'Upstream and downstream lineage for ' + focusColumn });
      Object.assign(svg.style, { display: 'block', maxWidth: 'none', minWidth: '0', fontFamily: 'inherit' });
      svg.append(...edgeShapes);
      ids.forEach(id => {
        const node = byId.get(id), p = positions.get(id), fields = columnsById.get(id);
        const kind = id === focusId ? 'focus' : node.kind === 'source' ? 'source' : 'model';
        const group = shape('g', { 'data-model-id': id });
        group.append(shape('rect', { x: p.x, y: p.y, width: CARD_W, height: p.height, rx: 9, fill: color(kind + '-fill'), stroke: color(kind + '-stroke'), 'stroke-width': id === focusId ? 2 : 1 }));
        const header = shape('a', { href: route(id), 'data-model-link': id, tabindex: 0, 'aria-label': 'Open model ' + node.name });
        header.append(shape('title', {}, node.name), shape('rect', { x: p.x, y: p.y, width: CARD_W, height: HEADER_H, fill: 'transparent' }), shape('text', { x: p.x + 12, y: p.y + 21, fill: color('text'), 'font-size': 12, 'font-weight': 650 }, short(node.name, 34)), shape('text', { x: p.x + 12, y: p.y + 37, fill: color('muted'), 'font-size': 10 }, node.kind + ' · ' + fields.length + ' fields'));
        group.append(header);
        fields.forEach((field, index) => {
          const y = p.y + HEADER_H + index * ROW_H, selected = id === focusId && field.name === focusColumn;
          const row = shape('a', { href: route(id, field.name), 'data-column-link': field.name, tabindex: 0, 'aria-label': 'Trace ' + node.name + '.' + field.name });
          if (selected) row.setAttribute('aria-current', 'true');
          row.append(shape('title', {}, field.name + (field.data_type ? ' · ' + field.data_type : '') + (field.description ? '\n' + field.description : '') + (field.transformation ? '\nRecorded SQL expression: ' + field.transformation : '')), shape('rect', { x: p.x + 1, y, width: CARD_W - 2, height: ROW_H, fill: selected ? color('focus-fill') : 'transparent', stroke: selected ? color('focus-stroke') : 'none' }), shape('text', { x: p.x + 12, y: y + 19, fill: color('text'), 'font-size': 11, 'font-weight': selected ? 700 : 400 }, short(field.name, 24)), shape('text', { x: p.x + CARD_W - 10, y: y + 19, fill: color('muted'), 'font-size': 9, 'text-anchor': 'end' }, (field.transformation ? 'SQL · ' : '') + short(field.data_type || '—', 12)));
          group.append(row);
        });
        if (!fields.length) group.append(shape('text', { x: p.x + 12, y: p.y + HEADER_H + 20, fill: color('muted'), 'font-size': 11 }, 'No documented fields'));
        svg.append(group);
      });
      viewport.replaceChildren(svg); zoom = 1; viewport.scrollLeft = 0; viewport.scrollTop = 0;
    }
    render();
    // The caller appends the panel synchronously; fit once dimensions exist.
    window.requestAnimationFrame(() => { if (panel.isConnected && viewport.clientWidth > 0) fit(); });
    return panel;
  }
  window.BNRDocumentationLineage = { create };
})();
