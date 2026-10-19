import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { generate, type GenerationKind } from './api';
import './styles.css';

type Mode = 'chat' | 'image' | 'video';
type ChatModel = 'lite' | 'pro';
type Modal = 'terms' | 'cookies' | 'ai' | null;
type Message = { id: number; role: 'user' | 'assistant'; content: string };
type Usage = { date: string; lite: number; pro: number; image: number; video: number };

const LIMITS = { lite: 30, pro: 15, image: 4, video: 1 } as const;
const MODELS = {
  lite: { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', detail: 'leve · rápido · bom para o dia a dia' },
  pro: { id: 'openai/gpt-5.4-nano', name: 'GPT-5.4 Nano', detail: 'equilibrado · velocidade + qualidade' },
  image: { id: 'openai/gpt-image-1-mini', name: 'GPT Image 1 Mini', detail: 'imagem econômica' },
  video: { id: 'alibaba/wan-2.2-fast', name: 'Wan 2.2 Fast', detail: 'vídeo econômico · 480p' },
} as const;
const STORAGE = { usage: 'shyna.usage.v1', preferences: 'shyna.preferences.v1', consent: 'shyna.consent.v1' } as const;

function today() { return new Date().toISOString().slice(0, 10); }
function blankUsage(): Usage { return { date: today(), lite: 0, pro: 0, image: 0, video: 0 }; }
function loadUsage(): Usage {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.usage) || 'null') as Usage | null;
    if (saved?.date === today()) return saved;
  } catch { /* storage can be disabled */ }
  return blankUsage();
}
function saveUsage(value: Usage) { try { localStorage.setItem(STORAGE.usage, JSON.stringify(value)); } catch { /* best effort */ } }
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    spark: <><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
    chat: <><path d="M20 11.4a7.2 7.2 0 0 1-7.5 7.1 8.5 8.5 0 0 1-3.6-.8L4 19l1.3-3.6A7 7 0 0 1 5 11.4 7.2 7.2 0 0 1 12.5 4 7.2 7.2 0 0 1 20 11.4Z"/><path d="M9 11h.01M12.5 11h.01M16 11h.01"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.2"/><path d="m4 17 4.5-4.5 3.3 3 2.4-2.2L20 18"/></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.2-2.6 7.6-7 9-4.4-1.4-7-4.8-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    download: <><path d="M12 3v11M8 10l4 4 4-4M5 20h14"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.9-3L3 11M3 6v5h5M4 13a8 8 0 0 0 14.9 3L21 13m0 5v-5h-5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Logo() { return <div className="brand-mark" aria-hidden="true"><span>S</span><i /></div>; }
function formatCount(value: number, limit: number) { return `${value}/${limit}`; }

function UsagePill({ label, used, limit, tone }: { label: string; used: number; limit: number; tone: string }) {
  const percent = Math.min(100, (used / limit) * 100);
  return <div className="usage-row"><div className="usage-label"><span>{label}</span><strong>{formatCount(used, limit)}</strong></div><div className="usage-track"><span className={tone} style={{ width: `${Math.max(percent, used ? 4 : 0)}%` }} /></div></div>;
}

function ModalView({ title, modal, onClose }: { title: string; modal: Exclude<Modal, null>; onClose: () => void }) {
  const copy = {
    terms: <><p>Shyna é uma interface experimental para conversar e criar mídia com serviços de terceiros. Ao usar a plataforma, você concorda em não enviar dados pessoais sensíveis, segredos, material ilegal ou conteúdo que viole direitos de terceiros.</p><p>As respostas e mídias são geradas por IA e podem conter erros, vieses ou conteúdo inadequado. Você é responsável por revisar e usar o resultado de forma legal e segura.</p><p>Os limites de uso são associados ao IP e a um identificador anônimo deste navegador. Eles são uma proteção média de produto, não uma garantia antifraude nem substituem um sistema de conta, cobrança ou rate limit persistente.</p></>,
    cookies: <><p>Shyna não exige cookies de rastreamento nem login. Preferências e consentimento ficam no armazenamento local. Um identificador aleatório e anônimo do navegador é enviado ao servidor somente para combinar a cota com o IP e impedir consumo acidental.</p><p>Se você limpar os dados do site, trocar de navegador ou usar outro dispositivo, a identificação do navegador muda. O IP continua sendo considerado no servidor. A Pollinations pode processar requisições conforme os próprios termos e políticas.</p><p>Você pode alterar sua escolha apagando os dados locais do site ou usando os controles de privacidade do navegador.</p></>,
    ai: <><p>Este espaço usa modelos da Pollinations para gerar texto, imagens e vídeos. O material não é uma opinião profissional e não deve ser usado sozinho em decisões médicas, jurídicas, financeiras ou de segurança.</p><p>Evite compartilhar senhas, tokens, documentos de identidade, dados de clientes e qualquer informação que você não gostaria de enviar a um provedor de IA.</p></>,
  }[modal];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button><span className="eyebrow">SHYNA · TRANSPARÊNCIA</span><h2 id="modal-title">{title}</h2><div className="modal-copy">{copy}</div><button className="button button-dark" onClick={onClose}>Entendi <Icon name="check" size={16} /></button></section></div>;
}

function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [chatModel, setChatModel] = useState<ChatModel>('lite');
  const [usage, setUsage] = useState<Usage>(loadUsage);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'assistant', content: 'Oi, eu sou a Shyna. Posso organizar uma ideia, destravar um texto ou transformar uma cena em imagem e movimento. Por onde começamos?' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultImage, setResultImage] = useState('');
  const [resultVideo, setResultVideo] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(import.meta.env.VITE_DEMO_MODE === 'true');
  const [consent, setConsent] = useState<string | null>(() => { try { return localStorage.getItem(STORAGE.consent); } catch { return null; } });

  useEffect(() => { saveUsage(usage); }, [usage]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  const remaining = useMemo(() => ({ lite: LIMITS.lite - usage.lite, pro: LIMITS.pro - usage.pro, image: LIMITS.image - usage.image, video: LIMITS.video - usage.video }), [usage]);
  const activeLimitKey = mode === 'chat' ? chatModel : mode;
  const activeRemaining = remaining[activeLimitKey];
  const modeTitle = mode === 'chat' ? 'Conversa' : mode === 'image' ? 'Imagem' : 'Vídeo';

  function changeMode(next: Mode) { setMode(next); setPrompt(''); setError(''); setMenuOpen(false); }
  function acceptConsent(value: string) { setConsent(value); try { localStorage.setItem(STORAGE.consent, value); } catch { /* best effort */ } }
  function useDemoResponse(kind: GenerationKind, text: string) {
    if (kind === 'chat') return `Modo demonstração ativo. Para uma resposta real, adicione POLLINATIONS_KEY na Vercel. Enquanto isso, entendi sua ideia: “${text}”.`;
    if (kind === 'image') return 'demo-image';
    return 'demo-video';
  }
  async function submit() {
    const clean = prompt.trim();
    if (!clean || isLoading) return;
    if (clean.length > 1200) { setError('Seu prompt passou do limite de 1.200 caracteres.'); return; }
    if (activeRemaining <= 0) { setError('Seu limite diário para esta criação já foi usado. Ele renova amanhã.'); return; }
    setError(''); setIsLoading(true);
    const kind: GenerationKind = mode;
    const model = kind === 'chat' ? MODELS[chatModel].id : MODELS[kind].id;
    if (kind === 'chat') setMessages((current) => [...current, { id: Date.now(), role: 'user', content: clean }]);
    setPrompt('');
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        const demo = useDemoResponse(kind, clean);
        setUsage((current) => ({ ...current, [kind === 'chat' ? chatModel : kind]: current[kind === 'chat' ? chatModel : kind] + 1 }));
        if (kind === 'chat') setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', content: demo }]);
        if (kind === 'image') setResultImage(`https://gen.pollinations.ai/image/${encodeURIComponent(clean)}?model=${encodeURIComponent(MODELS.image.id)}&width=1024&height=1024&nologo=true`);
        if (kind === 'video') setError('O modo demonstração não cria vídeo. Configure POLLINATIONS_KEY para testar a geração real.');
      } else {
        const response = await generate(kind, clean, model);
        setUsage((current) => ({ ...current, [kind === 'chat' ? chatModel : kind]: current[kind === 'chat' ? chatModel : kind] + 1 }));
        if (response.text && kind === 'chat') setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', content: response.text || '' }]);
        if (response.imageUrl) setResultImage(response.imageUrl);
        if (response.videoUrl) setResultVideo(response.videoUrl);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Algo saiu do eixo. Tente novamente.'); }
    finally { setIsLoading(false); }
  }

  const modes: Array<{ id: Mode; label: string; icon: string }> = [{ id: 'chat', label: 'Conversa', icon: 'chat' }, { id: 'image', label: 'Imagem', icon: 'image' }, { id: 'video', label: 'Vídeo', icon: 'video' }];
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="brand"><Logo /><div><strong>shyna</strong><span>creative studio</span></div><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><Icon name="close" size={17} /></button></div>
      <div className="side-caption">SEU ESPAÇO DE CRIAÇÃO</div>
      <nav className="side-nav" aria-label="Navegação principal">{modes.map((item) => <button key={item.id} className={`side-link ${mode === item.id ? 'active' : ''}`} onClick={() => changeMode(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{mode === item.id && <i />}</button>)}</nav>
      <div className="side-divider" />
      <button className="side-link quiet" onClick={() => setModal('ai')}><Icon name="shield" /><span>Como funciona</span></button>
      <div className="sidebar-bottom"><div className="mini-note"><span className="status-dot" /> Sem login, sem ruído<span>Limites por IP + navegador</span></div><button className="privacy-link" onClick={() => setModal('cookies')}>Privacidade local <Icon name="arrow" size={14} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Icon name="menu" /></button><div className="breadcrumb"><span>Studio</span><b>/</b><strong>{modeTitle}</strong></div><div className="top-actions"><span className="no-login"><span className="green-dot" /> sem login</span><button className="avatar" aria-label="Preferências" onClick={() => setDemoMode((value) => !value)}><span>{demoMode ? 'D' : 'S'}</span></button></div></header>
      <section className="workspace">
        <div className="workspace-main">
          <div className="welcome-line"><div><span className="eyebrow">{mode === 'chat' ? 'UM RASCUNHO DE CADA VEZ' : mode === 'image' ? 'IMAGENS PARA VER MELHOR' : 'DÊ MOVIMENTO À IDEIA'}</span><h1>{mode === 'chat' ? <>Olá, <em>criador.</em></> : mode === 'image' ? <>Uma imagem começa com <em>palavras.</em></> : <>Uma cena merece <em>movimento.</em></>}</h1><p>{mode === 'chat' ? 'A Shyna organiza o pensamento sem tirar sua voz do centro.' : mode === 'image' ? 'Descreva uma atmosfera, um detalhe ou uma cena. O resto é interpretação.' : 'Escreva uma pequena cena e deixe a Shyna montar o primeiro take.'}</p></div><div className="date-note"><span>HOJE</span><strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date()).replace('.', '')}</strong></div></div>
          {mode === 'chat' && <div className="chat-window"><div className="chat-feed">{messages.map((message) => <div className={`message ${message.role}`} key={message.id}><div className="message-badge">{message.role === 'assistant' ? <Logo /> : <span>você</span>}</div><div className="message-body">{message.role === 'assistant' && <span className="message-label">SHYNA · {chatModel === 'lite' ? 'LITE' : 'PRO'}</span>}<p>{message.content}</p></div></div>)}{isLoading && <div className="message assistant"><div className="message-badge"><Logo /></div><div className="message-body"><span className="message-label">SHYNA · PENSANDO</span><div className="thinking"><i /><i /><i /></div></div></div>}</div><Composer prompt={prompt} setPrompt={setPrompt} onSubmit={submit} loading={isLoading} mode={mode} /> </div>}
          {mode === 'image' && <CreationPanel kind="image" prompt={prompt} setPrompt={setPrompt} onSubmit={submit} loading={isLoading} error={error} result={resultImage ? <div className="media-result"><div className="result-heading"><span>RESULTADO · IMAGEM</span><a href={resultImage} target="_blank" rel="noreferrer"><Icon name="download" size={15} /> abrir</a></div><img src={resultImage} alt="Imagem gerada pela Shyna" /></div> : null} />}
          {mode === 'video' && <CreationPanel kind="video" prompt={prompt} setPrompt={setPrompt} onSubmit={submit} loading={isLoading} error={error} result={resultVideo ? <div className="media-result"><div className="result-heading"><span>RESULTADO · VÍDEO</span><a href={resultVideo} download="shyna-video.mp4"><Icon name="download" size={15} /> baixar</a></div><video src={resultVideo} controls playsInline /></div> : null} />}
          {mode === 'chat' && error && <div className="inline-error"><Icon name="info" size={16} />{error}</div>}
          <div className="below-note"><Icon name="shield" size={15} /><span>Não envie senhas, documentos ou dados sensíveis. <button onClick={() => setModal('ai')}>Saiba mais</button></span></div>
        </div>
        <aside className="insight-panel"><div className="panel-kicker"><span>SEU RITMO</span><span className="panel-live"><i /> IP + navegador</span></div><h2>Crie com <em>intenção.</em></h2><p className="panel-intro">As cotas combinam IP e navegador para manter o espaço leve e previsível.</p><div className="usage-card"><UsagePill label="Lite · mensagens" used={usage.lite} limit={LIMITS.lite} tone="tone-violet" /><UsagePill label="Pro · mensagens" used={usage.pro} limit={LIMITS.pro} tone="tone-peach" /><UsagePill label="Imagens" used={usage.image} limit={LIMITS.image} tone="tone-blue" /><UsagePill label="Vídeo" used={usage.video} limit={LIMITS.video} tone="tone-green" /><div className="renew-note"><Icon name="refresh" size={13} /> renova amanhã · IP + navegador</div></div><div className="model-card"><div className="model-card-top"><span className="tiny-label">MODELO DE CONVERSA</span><span className="model-dot" /></div><div className="model-switch"><button className={chatModel === 'lite' ? 'selected' : ''} onClick={() => setChatModel('lite')}><strong>Lite</strong><small>30 / dia</small></button><button className={chatModel === 'pro' ? 'selected' : ''} onClick={() => setChatModel('pro')}><strong>Pro</strong><small>15 / dia</small></button></div><p><b>{MODELS[chatModel].name}</b><br />{MODELS[chatModel].detail}</p></div><div className="security-card"><div className="security-icon"><Icon name="lock" size={16} /></div><div><strong>Proteção média</strong><span>Prompt validado · chave no servidor · saída segura</span></div></div><label className="demo-toggle"><span><b>Modo demonstração</b><small>testar a interface sem consumir API</small></span><input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} /><i /></label></aside>
      </section>
      <footer className="footer"><span>SHYNA STUDIO · feito para rascunhar melhor</span><div><button onClick={() => setModal('terms')}>Termos</button><button onClick={() => setModal('cookies')}>Cookies e privacidade</button><button onClick={() => setModal('ai')}>IA responsável</button></div></footer>
    </main>
    {consent === null && <div className="consent-banner"><div className="consent-copy"><div className="consent-icon"><Icon name="shield" /></div><div><strong>Uma escolha simples de privacidade.</strong><p>Usamos armazenamento local para lembrar cotas e preferências. Sem rastreamento.</p></div></div><div className="consent-actions"><button className="text-button" onClick={() => setModal('cookies')}>ler política</button><button className="button button-dark small" onClick={() => acceptConsent('essenciais')}>apenas essenciais</button><button className="button button-violet small" onClick={() => acceptConsent('aceito')}>aceitar</button></div></div>}
    {modal && <ModalView modal={modal} title={modal === 'terms' ? 'Termos de uso' : modal === 'cookies' ? 'Cookies e privacidade' : 'IA responsável'} onClose={() => setModal(null)} />}
  </div>;
}

function Composer({ prompt, setPrompt, onSubmit, loading, mode }: { prompt: string; setPrompt: (value: string) => void; onSubmit: () => void; loading: boolean; mode: Mode }) {
  return <div className="composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} placeholder="Escreva uma ideia, dúvida ou rascunho..." maxLength={1200} aria-label="Mensagem para a Shyna" /><div className="composer-bottom"><span>{prompt.length}/1.200 · Enter para enviar</span><button className="send-button" onClick={onSubmit} disabled={loading || !prompt.trim()} aria-label={loading ? 'Enviando' : 'Enviar'}>{loading ? <span className="spinner" /> : <Icon name="arrow" size={19} />}</button></div></div>;
}

function CreationPanel({ kind, prompt, setPrompt, onSubmit, loading, error, result }: { kind: 'image' | 'video'; prompt: string; setPrompt: (value: string) => void; onSubmit: () => void; loading: boolean; error: string; result: ReactNode }) {
  const isImage = kind === 'image';
  return <div className="creation-wrap"><div className="creation-card"><div className="creation-label"><span className="creation-icon"><Icon name={isImage ? 'image' : 'video'} size={19} /></span><div><strong>{isImage ? 'Laboratório de imagem' : 'Laboratório de vídeo'}</strong><small>{isImage ? 'GPT Image 1 Mini · escolha econômica' : 'Wan 2.2 Fast · take econômico de 5s'}</small></div></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={isImage ? 'Ex.: uma varanda azul depois da chuva, luz dourada, detalhe cinematográfico...' : 'Ex.: folhas dançando ao vento em uma praça vazia, câmera lenta, final de tarde...'} maxLength={1200} /><div className="creation-foot"><span>{prompt.length}/1.200</span><button className="button button-violet" onClick={onSubmit} disabled={loading || !prompt.trim()}>{loading ? <><span className="spinner light" /> criando...</> : <>{isImage ? 'Gerar imagem' : 'Gerar vídeo'} <Icon name="arrow" size={16} /></>}</button></div></div>{error && <div className="inline-error"><Icon name="info" size={16} />{error}</div>}{result || <div className="empty-media"><div className="empty-orb"><span>{isImage ? '✦' : '▶'}</span></div><strong>{isImage ? 'Seu próximo frame começa aqui.' : 'Um pequeno movimento pode mudar tudo.'}</strong><span>{isImage ? 'Descreva o clima e a cena no campo acima.' : 'Use uma descrição curta. A Shyna cuida do primeiro rascunho.'}</span></div>}</div>;
}

createRoot(document.getElementById('root')!).render(<App />);
