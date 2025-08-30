/* SynapseAI — lightweight agent (client-side) */
/* NOTE: This is a compact demo-focused agent. For production, move API keys to a server proxy. */

class SynapseAI {
  constructor() {
    this.state = {
      provider: localStorage.getItem('syn_provider') || 'aipipe',
      apiKey: localStorage.getItem('syn_apikey') || '',
      model: localStorage.getItem('syn_model') || '',
      maxTokens: parseInt(localStorage.getItem('syn_maxtokens') || '1500', 10),
      conversations: new Map(),
      currentId: null,
      isProcessing: false
    };

    this.selectors();
    this.hookEvents();
    this.createConversation(); // initial
    this.hideLoading();
    console.log(`SynapseAI initialized`);
  }

  selectors(){
    this.$ = {
      loading: document.getElementById('loading'),
      newConv: document.getElementById('new-conv'),
      convList: document.getElementById('conversations'),
      messages: document.getElementById('messages'),
      composer: document.getElementById('composer'),
      input: document.getElementById('input'),
      send: document.getElementById('send'),
      settingsOpen: document.getElementById('settings-open'),
      modal: document.getElementById('modal'),
      modalClose: document.getElementById('modal-close'),
      provider: document.getElementById('provider'),
      apikey: document.getElementById('apikey'),
      model: document.getElementById('model'),
      maxtokens: document.getElementById('maxtokens'),
      saveSettings: document.getElementById('save-settings'),
      resetSettings: document.getElementById('reset-settings'),
      quicks: document.querySelectorAll('.quick-btn'),
      welcome: document.getElementById('welcome'),
      chatTitle: document.getElementById('chat-title'),
      themeToggle: document.getElementById('theme-toggle'),
      exportBtn: document.getElementById('export-btn'),
      clearBtn: document.getElementById('clear-btn'),
      newConvBtn: document.getElementById('new-conv'),
      conversationsContainer: document.getElementById('conversations')
    };
    // populate settings UI
    if(this.$.provider) this.$.provider.value = this.state.provider;
    if(this.$.apikey) this.$.apikey.value = this.state.apiKey;
    if(this.$.model) this.$.model.value = this.state.model;
    if(this.$.maxtokens) this.$.maxtokens.value = this.state.maxTokens;
  }

  hookEvents(){
    // composer
    this.$.composer?.addEventListener('submit', (e) => { e.preventDefault(); this.onSend(); });
    this.$.send?.addEventListener('click', () => this.onSend());
    this.$.input?.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); this.onSend(); }
    });

    // quick prompts
    this.$.quicks?.forEach(b => b.addEventListener('click', e => {
      const p = e.currentTarget.dataset.prompt;
      if(p){ this.$.input.value = p; this.onSend(); }
    }));

    // settings modal
    this.$.settingsOpen?.addEventListener('click', ()=> this.openModal());
    this.$.modalClose?.addEventListener('click', ()=> this.closeModal());
    this.$.saveSettings?.addEventListener('click', ()=> this.saveSettings());
    this.$.resetSettings?.addEventListener('click', ()=> this.resetSettings());

    // other buttons
    this.$.themeToggle?.addEventListener('click', ()=> this.toggleTheme());
    this.$.exportBtn?.addEventListener('click', ()=> this.exportConversation());
    this.$.clearBtn?.addEventListener('click', ()=> this.clearConversation());
    this.$.newConvBtn?.addEventListener('click', ()=> this.createConversation());
  }

  hideLoading(){
    if(this.$.loading) this.$.loading.style.display = 'none';
  }

  openModal(){
    if(!this.$.modal) return;
    this.$.modal.setAttribute('aria-hidden','false');
  }
  closeModal(){
    if(!this.$.modal) return;
    this.$.modal.setAttribute('aria-hidden','true');
  }

  saveSettings(){
    this.state.provider = this.$.provider.value;
    this.state.apiKey = this.$.apikey.value.trim();
    this.state.model = this.$.model.value.trim();
    this.state.maxTokens = parseInt(this.$.maxtokens.value || '1500',10);

    localStorage.setItem('syn_provider', this.state.provider);
    localStorage.setItem('syn_apikey', this.state.apiKey);
    localStorage.setItem('syn_model', this.state.model);
    localStorage.setItem('syn_maxtokens', String(this.state.maxTokens));
    this.closeModal();
    this.toast('Settings saved');
  }

  resetSettings(){
    localStorage.removeItem('syn_provider');
    localStorage.removeItem('syn_apikey');
    localStorage.removeItem('syn_model');
    localStorage.removeItem('syn_maxtokens');
    this.state.provider = 'aipipe';
    this.state.apiKey = '';
    this.state.model = '';
    this.state.maxTokens = 1500;
    if(this.$.provider) this.$.provider.value = this.state.provider;
    if(this.$.apikey) this.$.apikey.value = '';
    if(this.$.model) this.$.model.value = '';
    if(this.$.maxtokens) this.$.maxtokens.value = this.state.maxTokens;
    this.toast('Settings reset');
  }

  toast(text){
    // simple ephemeral message (console fallback)
    try{
      const el = document.createElement('div');
      el.textContent = text;
      el.style.position = 'fixed';
      el.style.right = '18px';
      el.style.bottom = '18px';
      el.style.background = 'rgba(15,23,42,0.9)';
      el.style.color = '#fff';
      el.style.padding = '8px 12px';
      el.style.borderRadius = '8px';
      el.style.zIndex = 9999;
      document.body.appendChild(el);
      setTimeout(()=> el.remove(),2200);
    }catch(e){ console.log(text); }
  }

  createConversation(){
    const id = `c_${Date.now()}`;
    const conv = { id, title: 'New chat', messages: [] };
    this.state.conversations.set(id, conv);
    this.state.currentId = id;
    this.renderConversations();
    this.loadConversation(id);
  }

  renderConversations(){
    const container = this.$.conversationsContainer;
    if(!container) return;
    container.innerHTML = '';
    for(const conv of Array.from(this.state.conversations.values()).reverse()){
      const el = document.createElement('div');
      el.className = 'conv';
      el.dataset.id = conv.id;
      el.innerHTML = `<div class="meta"><div class="title">${this.escape(conv.title)}</div>
        <div class="preview small">${this.escape(conv.messages.length ? conv.messages[conv.messages.length-1].content.slice(0,80) : 'No messages yet')}</div></div>`;
      el.addEventListener('click', ()=> { this.loadConversation(conv.id); });
      if(conv.id === this.state.currentId) el.classList.add('active');
      container.appendChild(el);
    }
  }

  loadConversation(id){
    this.state.currentId = id;
    const conv = this.state.conversations.get(id);
    if(!conv) return;
    this.$.messages.innerHTML = '';
    if(conv.messages.length === 0){
      if(this.$.welcome) this.$.welcome.style.display = 'block';
    } else {
      if(this.$.welcome) this.$.welcome.style.display = 'none';
      conv.messages.forEach(m => this.renderMessage(m));
    }
    this.renderConversations();
    this.$.chatTitle?.innerText = conv.title || 'SynapseAI';
  }

  appendMessage(role, content){
    const conv = this.state.conversations.get(this.state.currentId);
    if(!conv) return;
    const m = { role, content, ts: Date.now() };
    conv.messages.push(m);
    this.renderMessage(m);
    this.renderConversations();
  }

  renderMessage(m){
    const wrapper = document.createElement('div');
    wrapper.className = 'msg ' + (m.role === 'user' ? 'user' : (m.role === 'assistant' ? 'assistant' : 'assistant'));
    // simple: display code blocks if triple backticks present
    if(typeof m.content === 'string' && m.content.includes('```')){
      // render as pre with highlight
      const code = m.content.replace(/```[\s\S]*?```/g, match => {
        const inner = match.replace(/```/g,'').trim();
        return `<pre><code>${this.escape(inner)}</code></pre>`;
      });
      wrapper.innerHTML = code;
    } else {
      wrapper.textContent = m.content;
    }
    this.$.messages.appendChild(wrapper);
    this.$.messages.scrollTop = this.$.messages.scrollHeight;
  }

  escape(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async onSend(){
    const text = (this.$.input.value || '').trim();
    if(!text) return;
    this.$.input.value = '';
    // show in UI
    this.appendMessage('user', text);
    // hide welcome
    if(this.$.welcome) this.$.welcome.style.display = 'none';
    // set conversation title (first user message)
    const conv = this.state.conversations.get(this.state.currentId);
    if(conv && (!conv.title || conv.title==='New chat')) conv.title = text.slice(0,60);
    this.renderConversations();

    // run agent loop single iteration: send messages to model and handle tool calls
    try {
      await this.agentStep();
    } catch(err){
      console.error('Agent error', err);
      this.appendMessage('assistant', `Error: ${err.message || err}`);
    }
  }

  // single step: call model with conversation & return
  async agentStep(){
    if(this.state.isProcessing) return;
    this.state.isProcessing = true;

    const conv = this.state.conversations.get(this.state.currentId);
    if(!conv) { this.state.isProcessing = false; return; }

    // build messages for model (assistant/system/user roles)
    const messages = conv.messages.map(m => {
      return { role: m.role === 'user' ? 'user' : (m.role === 'assistant' ? 'assistant' : 'system'), content: m.content };
    });

    // Model call
    this.appendMessage('assistant', 'Thinking...'); // placeholder
    const response = await this.callLLM(messages);
    // remove the temporary thinking message (last assistant)
    const last = conv.messages.pop();
    if(last && last.content === 'Thinking...'){
      // remove last DOM msg
      const nodes = this.$.messages.querySelectorAll('.msg');
      if(nodes.length) nodes[nodes.length-1].remove();
    }

    if(!response || !response.content){
      this.appendMessage('assistant', 'No response from model.');
      this.state.isProcessing = false;
      return;
    }

    // If the model requests tools (tool_calls), we can simulate tool-calls handling
    // For simplicity we accept responses like: { content: "...", tool_calls: [ {name:'web_search', args:{query:'xyz'}} ] }
    const parsed = response;
    if(parsed.tool_calls && parsed.tool_calls.length){
      // announce
      this.appendMessage('assistant', parsed.content || 'Using tools...');
      for(const t of parsed.tool_calls){
        const r = await this.executeTool(t);
        this.appendMessage('assistant', `Tool result (${t.name}): ${typeof r === 'object' ? JSON.stringify(r,null,2) : String(r)}`);
      }
      // after tool outputs, append a small summary so model can continue
    } else {
      // normal content
      this.appendMessage('assistant', parsed.content);
    }

    this.state.isProcessing = false;
  }

  async callLLM(messages){
    // messages: array {role, content}
    const provider = this.state.provider;
    const apiKey = this.state.apiKey;
    const model = this.state.model || undefined;
    const maxTokens = this.state.maxTokens || 1500;

    if(!apiKey){
      // demo response
      return { content: "Demo mode — paste your AI Pipe/OpenAI key in Settings to use real models." };
    }

    try{
      if(provider === 'openai'){
        const url = 'https://api.openai.com/v1/chat/completions';
        const body = { model: model || 'gpt-4o-mini', messages: messages.map(m=>({role:m.role, content:m.content})), max_tokens: maxTokens, temperature:0.7 };
        const resp = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) });
        if(!resp.ok) throw new Error(`OpenAI error ${resp.status}`);
        const data = await resp.json();
        // support common shapes
        const msg = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
        return { content: msg };
      } else {
        // default: aipipe proxy (openrouter-style)
        const url = 'https://aipipe.org/openrouter/v1/chat/completions';
        const body = {
          model: model || 'openai/gpt-4o-mini',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: maxTokens,
          temperature: 0.7
        };
        const resp = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) });
        if(!resp.ok){
          const txt = await resp.text();
          throw new Error(`AI Pipe error ${resp.status}: ${txt}`);
        }
        const data = await resp.json();
        // handle openai-like or openrouter-like responses
        if(data.choices && data.choices.length){
          const m = data.choices[0].message || { content: data.choices[0].text || '' };
          return { content: m.content || m };
        }
        // fallback
        return { content: JSON.stringify(data) };
      }
    }catch(err){
      console.error('LLM call failed', err);
      return { content: `LLM call error: ${err.message || err}` };
    }
  }

  // Tool dispatcher
  async executeTool(toolCall){
    // toolCall: { name, args }  (we'll accept either)
    const name = toolCall.name || toolCall.function || toolCall.tool || toolCall.func;
    const args = toolCall.args || toolCall.arguments || {};
    switch((name||'').toLowerCase()){
      case 'web_search':
      case 'search':
        return this.webSearch(args.query || args.q || args);
      case 'execute_code':
      case 'run_js':
        return this.executeCode(args.code || args);
      case 'process_file':
        return { error: 'process_file not implemented in demo' };
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  // Simulated web search (replace with a real search API if you have a key)
  async webSearch(query){
    if(!query) return { items: [] };
    // Demo: return short simulated snippets
    return {
      query,
      items: [
        { title: `Result for "${query}" — demo snippet`, snippet: `This is a simulated snippet for "${query}". Replace with a real search API (Google Serper/Custom Search/Bing) for live results.` }
      ]
    };
  }

  // Simple JS execution — WARNING: not secure; demo only
  async executeCode(code){
    if(!code) return 'No code provided';
    // limit synchronous runtime by using Promise.race with timeout
    try{
      const run = () => new Promise((res, rej) => {
        try{
          // eslint-disable-next-line no-new-func
          const fn = new Function('"use strict"; return (async ()=>{ ' + code + ' })()');
          Promise.resolve(fn()).then(r => res(r)).catch(e => rej(e));
        }catch(e){
          rej(e);
        }
      });
      const result = await Promise.race([ run(), new Promise((_,r)=> setTimeout(()=> r('Execution timed out (2s)'), 2000)) ]);
      return result;
    }catch(e){
      return `Execution error: ${e.message || e}`;
    }
  }

  exportConversation(){
    const conv = this.state.conversations.get(this.state.currentId);
    if(!conv) return this.toast('No conversation to export');
    const blob = new Blob([ JSON.stringify(conv, null, 2) ], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${conv.title || 'synapse_conversation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('Exported conversation');
  }

  clearConversation(){
    const conv = this.state.conversations.get(this.state.currentId);
    if(!conv) return;
    conv.messages = [];
    this.loadConversation(this.state.currentId);
    this.toast('Cleared conversation');
  }
}

/* initialize when DOM ready */
window.addEventListener('DOMContentLoaded', () => {
  window.synapse = new SynapseAI();
});
