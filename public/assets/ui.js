// Shared UI behavior: builds model tabs and a basic filepicker whitelist validator.
(function(){
  const allowedExtensions = ['txt','md','json','js','jsx','ts','tsx','py','csv','html','css','xml','yaml','yml','sql','sh','bash'];

  function extFromName(name){
    return (name || '').split('.').pop().toLowerCase();
  }

  function validateFile(file){
    if (!file) return { ok: true, message: 'No file selected.' };
    const ext = extFromName(file.name);
    const mime = (file.type||'').toLowerCase();
    const ok = allowedExtensions.includes(ext) || mime.startsWith('text/');
    return { ok, message: ok ? `Selected ${file.name}` : `${file.name} is not allowed` };
  }

  function buildTabsFromModels(modelSelectId, tabsContainerId){
    const select = document.getElementById(modelSelectId);
    const container = document.getElementById(tabsContainerId);
    if (!select || !container) return;

    // Ensure we have models; if none, try to fetch directly.
    function fetchModels(){
      return fetch('/api/chat?list=models').then(r=>r.json()).then(d=>d.models||[]).catch(()=>[]);
    }

    Promise.resolve().then(async ()=>{
      let models = Array.from(select.options).map(o=>o.value).filter(Boolean);
      if (models.length === 0) models = await fetchModels();

      container.innerHTML = '';
      models.forEach((m)=>{
        const btn = document.createElement('button');
        btn.className = 'model-tab';
        btn.type = 'button';
        btn.textContent = m;
        btn.dataset.model = m;
        btn.addEventListener('click', ()=>{
          const previouslyActive = container.querySelector('.model-tab.active');
          if (previouslyActive) previouslyActive.classList.remove('active');
          btn.classList.add('active');
          // set select if present
          if (select) {
            select.value = m;
            select.dispatchEvent(new Event('change'));
            localStorage.setItem('selectedModel', m);
          }
        });
        container.appendChild(btn);
      });

      // restore previously selected
      const saved = localStorage.getItem('selectedModel');
      const first = container.querySelector(`.model-tab[data-model="${saved}"]`) || container.querySelector('.model-tab');
      if (first) first.classList.add('active');
      if (select && saved) select.value = saved;
    });
  }

  // Map model names (or substrings) to launcher output types
  function mapModelToOutput(model) {
    if (!model) return null;
    const m = model.toLowerCase();
    if (m.includes('code') || m.includes('codex') || m.includes('github')) return 'github';
    if (m.includes('excel') || m.includes('sheet') || m.includes('table')) return 'excel';
    if (m.includes('csv')) return 'csv';
    if (m.includes('ppt') || m.includes('presentation') || m.includes('slides')) return 'ppt';
    if (m.includes('doc') || m.includes('word')) return 'doc';
    if (m.includes('pdf')) return 'pdf';
    // fallback: no mapping
    return null;
  }

  function applyModelToLauncher() {
    // If this page has an outputType select, try to preselect based on saved model
    const outputEl = document.getElementById('outputType');
    const msgEl = document.getElementById('message');
    if (!outputEl) return;
    const saved = localStorage.getItem('selectedModel');
    if (!saved) return;
    const mapped = mapModelToOutput(saved);
    if (mapped) {
      // only set if option exists
      const opt = Array.from(outputEl.options).find(o=>o.value===mapped);
      if (opt) {
        outputEl.value = mapped;
        if (msgEl) msgEl.textContent = `Preset to ${mapped} based on selected model: ${saved}`;
      }
    }
  }

  function wireFilepickers(){
    document.querySelectorAll('.filepicker').forEach(fp => {
      const input = fp.querySelector('input[type=file]');
      const btn = fp.querySelector('.btn');
      const nameEl = fp.querySelector('.filename');
      if (!input || !btn || !nameEl) return;

      btn.addEventListener('click', ()=> input.click());

      input.addEventListener('change', ()=>{
        const file = input.files[0];
        const res = validateFile(file);
        nameEl.textContent = res.message;
        nameEl.classList.toggle('error', !res.ok);
      });
    });
  }

  // Expose initializer for pages to call
  window.NIM_UI = {
    buildModelTabs: buildTabsFromModels,
    wireFilepickers,
    validateFile,
    allowedExtensions,
    mapModelToOutput,
    applyModelToLauncher,
  };

  // Auto-run on DOM ready for common ids
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.getElementById('modelTabs')) buildTabsFromModels('modelSelect','modelTabs');
    wireFilepickers();
    // apply mapping if on launcher page
    if (document.getElementById('outputType')) applyModelToLauncher();
  });
})();
