// /js/scenarioTable.js
console.log('[scenarioTable.js] module evaluated');

/**
 * Host must call `mountScenarioTable` ONCE and pass:
 *   tableContainer   – an empty <div> for the table
 *   jsonTextarea     – <textarea id="story-json"> (single source of truth)
 *
 * Returns { redraw } so other modules can force a refresh.
 */
export function mountScenarioTable({ tableContainer, jsonTextarea }) {
  /* ---------------------------------------------------------------- */
  /*  1.  Helper lifted from your old code                             */
  /* ---------------------------------------------------------------- */
  function generateScenarioId(name, existingIds) {
    let base = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
                                 .replace(/\s+/g, '-');
    if (!base) base = 'scenario';
    let id = base, n = 1;
    while (existingIds.includes(id)) id = `${base}-${n++}`;
    return id;
  }

  /* ---------------------------------------------------------------- */
  /*  2.  Safe wrapper for paintDrugInput (lives in another module)    */
  /* ---------------------------------------------------------------- */
  const paintDrugInputSafe =
    window.paintDrugInput ? window.paintDrugInput : () => {};

  /* ---------------------------------------------------------------- */
  /*  3.  Full drawScenarioTable implementation (pasted unchanged)     */
  /* ---------------------------------------------------------------- */
  function drawScenarioTable() {
    let data;
    try { data = JSON.parse(jsonTextarea.value); } catch { return; }

    tableContainer.innerHTML = '';

    /* ---- Add Scenario button ---- */
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Scenario';
    addBtn.className =
      'mb-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded';
    addBtn.onclick = () => {
      const name = prompt('Scenario name:');
      if (!name) return;

      const full  = JSON.parse(jsonTextarea.value);
      full.scenarios = full.scenarios || {};

      const id = generateScenarioId(name, Object.keys(full.scenarios));
      full.scenarios[id] = {
        name, text: '', options: [], pathResult: 'undetermined'
      };

      jsonTextarea.value = JSON.stringify(full, null, 2);
      drawScenarioTable();
      if (window.renderCytoscapeGraph) window.renderCytoscapeGraph(full);
      if (window.redrawMermaid)        window.redrawMermaid();
    };
    tableContainer.append(addBtn);

    /* ---- Table skeleton ---- */
    const tbl = document.createElement('table');
    tbl.className = 'table-auto w-full border-collapse';
    tbl.innerHTML = `
      <thead><tr class='bg-gray-50 text-left'>
        <th class='border px-2 py-1'>ID</th>
        <th class='border px-2 py-1'>Name</th>
        <th class='border px-2 py-1'>Text</th>
        <th class='border px-2 py-1'>Result</th>
        <th class='border px-2 py-1'>Options</th>
        <th class='border px-2 py-1'>❌</th>
      </tr></thead>`;
    const tbody = document.createElement('tbody');
    tbl.append(tbody);

    Object.entries(data.scenarios || {}).forEach(([sid, sc]) => {
      const tr = document.createElement('tr'); tr.className = 'align-top';

      /* ID cell */
      tr.append(tdPlain(sid));

      /* Name cell */
      tr.append(tdInput(sc.name || '', v => updateField(sid, 'name', v)));

      /* Text cell (auto-expanding textarea) */
      tr.append(tdTextarea(sc.text || '', v => updateField(sid, 'text', v)));

      /* pathResult cell */
      const tdRes = document.createElement('td');
      tdRes.className = 'border px-2 py-1';
      const sel = document.createElement('select');
      ['undetermined','success','failure'].forEach(r => {
        const o = new Option(r, r);
        if ((sc.pathResult||'undetermined') === r) o.selected = true;
        sel.append(o);
      });
      sel.onchange = () => updateField(sid, 'pathResult', sel.value);
      tdRes.append(sel); tr.append(tdRes);

      /* Options-count cell with “Edit …” button */
      tr.append(createOptionsCell(sid, sc.options || []));

      /* Delete row btn */
      const tdDel = document.createElement('td');
      tdDel.className = 'border px-2 py-1 text-center';
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.onclick = () => deleteScenario(sid);
      tdDel.append(delBtn); tr.append(tdDel);

      tbody.append(tr);
    });

    tableContainer.append(tbl);

    /* ---------- helpers inside drawScenarioTable ---------- */
    function tdPlain(t) {
      const td = document.createElement('td');
      td.className = 'border px-2 py-1 text-xs break-all';
      td.textContent = t;
      return td;
    }
    function tdInput(val, cb) {
      const td = document.createElement('td');
      td.className = 'border px-2 py-1';
      const inp = document.createElement('input');
      inp.value = val;
      inp.className = 'border rounded px-1 py-0.5 w-full';
      inp.oninput = () => cb(inp.value);
      td.append(inp);
      return td;
    }
    function tdTextarea(val, cb) {
      const td = document.createElement('td');
      td.className = 'border px-2 py-1';
      const ta = document.createElement('textarea');
      ta.rows = 1; ta.value = val;
      ta.className =
        'border rounded px-1 py-0.5 w-full resize-none overflow-hidden';
      ta.addEventListener('focus', () => {
        ta.rows = 4; ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px';
      });
      ta.addEventListener('blur', () => { ta.rows=1; ta.style.height='auto'; });
      ta.addEventListener('input', () => { cb(ta.value); });
      td.append(ta); return td;
    }

    function createOptionsCell(sid, optionsArr) {
      const td = document.createElement('td');
      td.className = 'border px-2 py-1 align-top';

      const btn = document.createElement('button');
      btn.textContent = 'Edit…';
      btn.className =
        'bg-gray-200 hover:bg-gray-300 text-sm px-2 py-1 rounded';
      td.append(btn);

      const panel = document.createElement('div');
      panel.className =
        'options-editor hidden mt-2 p-2 bg-gray-50 rounded shadow';
      td.append(panel);

      btn.onclick = () => {
        panel.classList.toggle('hidden');
        if (!panel._rendered) {
          renderOptionsEditor(sid, panel);
          panel._rendered = true;
        }
      };

      return td;
    }

    function renderOptionsEditor(sid, panel) {
        // 0️⃣ clear previous content
        panel.innerHTML = '';
      
        // 1️⃣ get fresh JSON object
        let full;
        try { full = JSON.parse(jsonTextarea.value); }
        catch { return; }
      
        const opts = full.scenarios[sid].options =
                     full.scenarios[sid].options || [];
      
        // 2️⃣ "Done" button
        const doneBtn = document.createElement('button');
        doneBtn.textContent = '✓ Done';
        doneBtn.className =
          'mb-2 ml-2 bg-gray-300 hover:bg-gray-400 text-xs px-2 py-1 rounded';
        doneBtn.onclick = () => {
          panel.classList.add('hidden');
        };
        panel.append(doneBtn);
      
        // 3️⃣ table skeleton
        const tbl = document.createElement('table');
        tbl.className = 'w-full mb-2';
        tbl.innerHTML = `
          <thead class="text-left text-sm text-gray-600">
            <tr>
              <th class="py-1">Text</th>
              <th class="py-1">Target</th>
              <th class="py-1">Drug</th>
              <th></th>
            </tr>
          </thead>`;
        const tbody = document.createElement('tbody');
        tbl.append(tbody);
        panel.append(tbl);
      
        // 4️⃣ renderer
        function rebuild() {
          tbody.innerHTML = '';
      
          opts.forEach((o, i) => {
            const tr = document.createElement('tr'); tr.className = 'align-top';
      
            // label
            const tdLabel = document.createElement('td'); tdLabel.className = 'py-1 pr-2';
            const inpLabel = document.createElement('input');
            inpLabel.type  = 'text'; inpLabel.value = o.text || '';
            inpLabel.className = 'border rounded px-1 py-0.5 w-full';
            inpLabel.oninput = () => { o.text = inpLabel.value; push(); };
            tdLabel.append(inpLabel); tr.append(tdLabel);
      
            // target dropdown
            const tdTarget = document.createElement('td'); tdTarget.className = 'py-1 pr-2';
            const sel = document.createElement('select');
            sel.className = 'border rounded px-1 py-0.5 w-full';
      
            Object.entries(full.scenarios).sort().forEach(([key, sc]) => {
              if (key === sid) return;               // no self-link
              const optEl = document.createElement('option');
              optEl.value = key;
              optEl.textContent = sc.name
                ? `${sc.name} (${key})` : key;
              if (o.id === key) optEl.selected = true;
              sel.append(optEl);
            });
            sel.onchange = () => { o.id = sel.value; push(); };
            tdTarget.append(sel); tr.append(tdTarget);
      
            // drug input
            const tdDrug = document.createElement('td');
            tdDrug.className = 'py-1 pr-2 relative';
            const inpDrug = document.createElement('input');
            inpDrug.type  = 'text'; inpDrug.value = o.drugName || '';
            inpDrug.className =
              'border rounded px-1 py-0.5 w-full pr-10';
            inpDrug.oninput = () => {
              o.drugName = inpDrug.value; push();
              paintDrugInputSafe(inpDrug);
            };
            inpDrug.addEventListener('blur', () => paintDrugInputSafe(inpDrug));
            tdDrug.append(inpDrug); tr.append(tdDrug);
            paintDrugInputSafe(inpDrug);
      
            // delete
            const tdDel = document.createElement('td'); tdDel.className =
              'py-1 text-center';
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.className   = 'text-red-500 hover:text-red-700';
            delBtn.onclick = () => {
              opts.splice(i, 1); push(); rebuild();
            };
            tdDel.append(delBtn); tr.append(tdDel);
      
            tbody.append(tr);
          });
        }
      
        // 5️⃣ "+ Add Option" button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Option';
        addBtn.className =
          'bg-blue-500 hover:bg-blue-600 text-white text-sm px-2 py-1 rounded';
        addBtn.onclick = () => {
          const scenarioIds = Object.keys(full.scenarios).filter(id => id !== sid);
          const firstTarget = scenarioIds.length ? scenarioIds[0] : '';
          opts.push({ text: '', id: firstTarget });
          push(); rebuild();
        };
        panel.append(addBtn);
      
        // push changes back to textarea without triggering full preview loop
        function push() {
          jsonTextarea.value = JSON.stringify(full, null, 2);
          if (window.renderCytoscapeGraph) window.renderCytoscapeGraph(full);
          if (window.redrawMermaid)        window.redrawMermaid();
        }
      
        rebuild();
      }
      

    function updateField(sid, key, value) {
      const full = JSON.parse(jsonTextarea.value);
      full.scenarios[sid][key] = value;
      jsonTextarea.value = JSON.stringify(full, null, 2);
      if (currentViewIsTable()) drawScenarioTable();
    }

    function deleteScenario(sid) {
      if (!confirm('Delete scenario?')) return;
      const full = JSON.parse(jsonTextarea.value);
      delete full.scenarios[sid];
      jsonTextarea.value = JSON.stringify(full, null, 2);
      drawScenarioTable();
      if (window.renderCytoscapeGraph) window.renderCytoscapeGraph(full);
    }

    function currentViewIsTable() {
      return !tableContainer.classList.contains('hidden');
    }
  } // end drawScenarioTable

  /* ---------------------------------------------------------------- */
  /*  4.  Initial draw + textarea sync                                */
  /* ---------------------------------------------------------------- */
  drawScenarioTable();
  jsonTextarea.addEventListener('input', () => {
    if (!tableContainer.classList.contains('hidden')) drawScenarioTable();
  });

  /* ---------------------------------------------------------------- */
  /* 5.  expose API to caller                                         */
  /* ---------------------------------------------------------------- */
  return { redraw: drawScenarioTable };
}
