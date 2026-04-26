/**
 * ChatSidebar.jsx — Chat Pro fonctionnel
 *
 * CORRECTIONS vs version précédente :
 *  ✅ Inputs file créés via DOM (hors JSX) → jamais de ref null
 *  ✅ Transfert simplifié : base64 complet en 1 seul emit (pas de race condition)
 *  ✅ Fallback events si FILE_TRANSFER_* absent de events.js
 *  ✅ Drag & drop, Ctrl+V, réactions, reply, téléchargement
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { useUI }     from '../../context/UIContext.jsx';
import { EVENTS }    from '../../utils/events.js';
import { platform }  from '../../services/platform/index.js';

const EV_CHAT     = EVENTS.CHAT          ?? 'chat-message';
const EV_REACT    = EVENTS.CHAT_REACTION ?? 'chat-reaction';

const MAX_MB    = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const QUICK     = ['👍','❤️','😂','😮','🎉','👏','🔥','✅'];
const EMOJIS    = ['😀','😂','😍','🥰','😎','🤔','😢','😮','🙏','👍','👎','❤️','🔥','🎉','⭐','💡','✅','❌','🚀','📌','👀','💪','🤝','🎯'];

const fmtSz  = b => b<1024?b+'o':b<1048576?Math.round(b/1024)+'Ko':(b/1048576).toFixed(1)+'Mo';
const fmtT   = iso => new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fIcon  = (t='') => t.startsWith('image/')?'🖼️':t.includes('pdf')?'📄':t.includes('word')||t.includes('document')?'📝':t.includes('excel')||t.includes('sheet')?'📊':t.includes('zip')?'🗜️':'📎';
const fExt   = (n='') => n.split('.').pop()?.toUpperCase()||'FILE';
const genId  = () => Math.random().toString(36).slice(2)+Date.now().toString(36);
const AVC    = [['#1e3a5f','#60a5fa'],['#14532d','#4ade80'],['#4c1d95','#a78bfa'],['#831843','#f472b6'],['#1c1917','#e2e8f0'],['#7c2d12','#fb923c']];
const avc    = n => AVC[(n||'').charCodeAt(0)%AVC.length];

/* ── Icons ── */
const ISend  = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IClip  = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
const IImg   = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IEmoji = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
const IX     = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IDown  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IReply = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>;
const ICopy  = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IClose = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

/* ── Avatar ── */
function Av({name,size=26}){
  const[bg,color]=avc(name);
  return<div style={{width:size,height:size,borderRadius:'50%',background:bg,color,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*.38),fontWeight:700,fontFamily:'monospace'}}>{name?.[0]?.toUpperCase()||'?'}</div>;
}

/* ── Bulle message ── */
function Bubble({msg,isMine,onReply,onReact,reactions=[]}){
  const[hover,setHover]=useState(false);
  const[copied,setCopied]=useState(false);
  const groups={};
  reactions.forEach(r=>{if(!groups[r.emoji])groups[r.emoji]=[];groups[r.emoji].push(r.userName);});

  const dl=()=>{
    if(!msg.data)return;
    const a=document.createElement('a');
    a.href=`data:${msg.fileType};base64,${msg.data}`;
    a.download=msg.fileName||'fichier';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };
  const cp=()=>{navigator.clipboard.writeText(msg.message||'');setCopied(true);setTimeout(()=>setCopied(false),1500);};

  return(
      <div style={{display:'flex',gap:7,flexDirection:isMine?'row-reverse':'row',marginBottom:6,position:'relative'}}
           onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>

        {!isMine&&<Av name={msg.userName} size={26}/>}

        <div style={{maxWidth:'78%'}}>
          {!isMine&&(
              <div style={{display:'flex',alignItems:'baseline',gap:5,marginBottom:3}}>
                <span style={{fontSize:11,fontWeight:700,color:avc(msg.userName)[1]}}>{msg.userName}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{fmtT(msg.timestamp)}</span>
              </div>
          )}

          {msg.replyTo&&(
              <div style={{borderLeft:'2.5px solid rgba(255,255,255,0.18)',paddingLeft:7,marginBottom:4,fontSize:11,color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>
                <b style={{color:'rgba(255,255,255,0.55)'}}>{msg.replyTo.userName}: </b>
                {msg.replyTo.message||msg.replyTo.fileName}
              </div>
          )}

          <div style={{background:isMine?'#2563eb':'rgba(255,255,255,0.09)',borderRadius:isMine?'16px 4px 16px 16px':'4px 16px 16px 16px',border:`1px solid ${isMine?'rgba(59,130,246,0.35)':'rgba(255,255,255,0.08)'}`,padding:msg.type==='image'?'4px':'9px 12px',overflow:'hidden'}}>

            {msg.type==='image'&&msg.data&&(
                <div>
                  <img src={`data:${msg.fileType};base64,${msg.data}`} alt={msg.fileName}
                       style={{maxWidth:'100%',maxHeight:200,borderRadius:10,display:'block',cursor:'pointer'}}
                       onClick={()=>{const w=window.open('');w.document.write(`<img src="data:${msg.fileType};base64,${msg.data}" style="max-width:100%">`);}}/>
                  <div style={{padding:'5px 8px 3px',fontSize:10,color:'rgba(255,255,255,0.45)'}}>{msg.fileName} · {fmtSz(msg.fileSize||0)}</div>
                </div>
            )}

            {msg.type==='file'&&(
                <div style={{display:'flex',alignItems:'center',gap:9,cursor:'pointer',padding:'2px 0'}} onClick={dl}>
                  <div style={{width:38,height:38,borderRadius:9,background:isMine?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.08)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:16}}>{fIcon(msg.fileType)}</span>
                    <span style={{fontSize:7,fontWeight:800,color:'rgba(255,255,255,0.55)',marginTop:1}}>{fExt(msg.fileName)}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:150}}>{msg.fileName}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1}}>{fmtSz(msg.fileSize||0)} · Cliquer pour télécharger</div>
                  </div>
                  <span style={{color:'rgba(255,255,255,0.45)',flexShrink:0}}><IDown/></span>
                </div>
            )}

            {msg.type==='text'&&(
                <span style={{fontSize:13,color:'#e2e8f0',lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{msg.message}</span>
            )}
          </div>

          {isMine&&<div style={{textAlign:'right',fontSize:10,color:'rgba(255,255,255,0.28)',marginTop:2}}>{fmtT(msg.timestamp)}</div>}

          {Object.keys(groups).length>0&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                {Object.entries(groups).map(([e,u])=>(
                    <button key={e} onClick={()=>onReact(msg.id,e)} title={u.join(', ')}
                            style={{display:'flex',alignItems:'center',gap:3,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'rgba(255,255,255,0.7)',fontFamily:'inherit'}}>
                      {e}<span style={{fontSize:10}}>{u.length}</span>
                    </button>
                ))}
              </div>
          )}
        </div>

        {hover&&(
            <div style={{position:'absolute',top:-4,[isMine?'left':'right']:'-6px',display:'flex',gap:2,zIndex:20,background:'#1e2433',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'3px 5px',boxShadow:'0 4px 20px rgba(0,0,0,0.6)'}}>
              {QUICK.map(e=>(
                  <button key={e} onClick={()=>{onReact(msg.id,e);setHover(false);}}
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'2px 3px',borderRadius:5,transition:'transform .1s'}}
                          onMouseEnter={ev=>ev.currentTarget.style.transform='scale(1.35)'}
                          onMouseLeave={ev=>ev.currentTarget.style.transform='scale(1)'}>
                    {e}
                  </button>
              ))}
              <div style={{width:1,background:'rgba(255,255,255,0.1)',margin:'2px 2px'}}/>
              <button onClick={()=>onReply(msg)} title="Répondre" style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.55)',padding:'3px 5px',borderRadius:5,display:'flex',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}><IReply/></button>
              {msg.type==='text'&&<button onClick={cp} title={copied?'Copié!':'Copier'} style={{background:'none',border:'none',cursor:'pointer',color:copied?'#4ade80':'rgba(255,255,255,0.55)',padding:'3px 5px',borderRadius:5,display:'flex',alignItems:'center'}}><ICopy/></button>}
              {(msg.type==='file'||msg.type==='image')&&<button onClick={dl} title="Télécharger" style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.55)',padding:'3px 5px',borderRadius:5,display:'flex',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}><IDown/></button>}
            </div>
        )}
      </div>
  );
}

/* ── Aperçu fichier en attente ── */
function Pending({file,preview,progress,onRemove}){
  const isImg=file.type.startsWith('image/');
  return(
      <div style={{margin:'0 10px 6px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'7px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {isImg&&preview?<img src={preview} alt="" style={{width:34,height:34,borderRadius:7,objectFit:'cover'}}/>
              :<div style={{width:34,height:34,borderRadius:7,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{fIcon(file.type)}</div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{file.name}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>{fmtSz(file.size)}{progress!==null?` · ${progress}%`:''}</div>
          </div>
          {progress===null&&<button onClick={onRemove} style={{background:'rgba(239,68,68,0.15)',border:'none',borderRadius:6,cursor:'pointer',color:'#f87171',padding:'4px 6px',display:'flex',alignItems:'center',flexShrink:0}}><IX/></button>}
        </div>
        {progress!==null&&(
            <div style={{marginTop:6,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2}}>
              <div style={{height:'100%',width:`${progress}%`,background:'#3b82f6',borderRadius:2,transition:'width .2s'}}/>
            </div>
        )}
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function ChatSidebar({roomId,userName,userId}){
  const{socket}=useSocket();
  const{chatOpen,setChatOpen,chatUnread,setChatUnread}=useUI();

  const[messages,setMessages]=useState([]);
  const[reactions,setReactions]=useState({});
  const[input,setInput]=useState('');
  const[dragging,setDragging]=useState(false);
  const[pending,setPending]=useState(null);   // {file,preview}
  const[progress,setProgress]=useState(null);
  const[replyTo,setReplyTo]=useState(null);
  const[showEmoji,setShowEmoji]=useState(false);
  const[sending,setSending]=useState(false);
  const[composerError,setComposerError]=useState('');

  const endRef  =useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);
  useEffect(()=>{ if(chatOpen) setChatUnread(0); },[chatOpen, setChatUnread]);

  /* Socket listeners */
  useEffect(()=>{
    if(!socket)return;
    const onMsg=msg=>{
      setMessages(p=>[...p,msg]);

      const isMine = msg.socketId===socket?.id || msg.userId===userId;
      if (isMine) return;

      if(!chatOpen){
        setChatUnread(n=>n+1);
        platform.notify({
          title: `Nouveau message · ${msg.userName || 'Chat'}`,
          body: msg.type === 'text'
            ? (msg.message || 'Message reçu')
            : `Fichier reçu${msg.fileName ? `: ${msg.fileName}` : ''}`,
        }).catch(() => {});
      }
    };
    const onRx=({messageId,emoji,userId:uid,userName:un})=>{
      setReactions(p=>{
        const list=p[messageId]||[];
        const idx=list.findIndex(r=>r.userId===uid&&r.emoji===emoji);
        return{...p,[messageId]:idx>=0?list.filter((_,i)=>i!==idx):[...list,{emoji,userId:uid,userName:un}]};
      });
    };
    socket.on(EV_CHAT,onMsg);
    socket.on(EV_REACT,onRx);
    return()=>{socket.off(EV_CHAT,onMsg);socket.off(EV_REACT,onRx);};
  },[socket,chatOpen,userId,setChatUnread]);

  /* ✅ CLEF DU FIX : input créé dynamiquement dans le DOM → ref jamais null */
  const openImagePicker=useCallback(()=>{
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='image/*'; inp.style.display='none';
    inp.onchange=e=>{
      const f=e.target.files?.[0];
      if(f)pickFile(f);
      document.body.removeChild(inp);
    };
    document.body.appendChild(inp); inp.click();
  },[]);

  const openFilePicker=useCallback(()=>{
    const inp=document.createElement('input');
    inp.type='file';
    inp.accept='.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json';
    inp.style.display='none';
    inp.onchange=e=>{
      const f=e.target.files?.[0];
      if(f)pickFile(f);
      document.body.removeChild(inp);
    };
    document.body.appendChild(inp); inp.click();
  },[]);

  const pickFile=useCallback(file=>{
    if(!file)return;
    if(file.size>MAX_BYTES){
      setComposerError(`Fichier trop volumineux. Taille maximale: ${MAX_MB} Mo.`);
      return;
    }
    if(file.type.startsWith('image/')){
      const r=new FileReader();
      r.onload=e=>setPending({file,preview:e.target.result});
      r.readAsDataURL(file);
    } else {
      setPending({file,preview:null});
    }
    setComposerError('');
    setShowEmoji(false);
    setTimeout(()=>inputRef.current?.focus(),80);
  },[]);

  /* Drag & drop */
  const onDragOver  =e=>{e.preventDefault();setDragging(true);};
  const onDragLeave =e=>{e.preventDefault();setDragging(false);};
  const onDrop      =e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files?.[0];if(f)pickFile(f);};

  /* Coller image */
  const onPaste=useCallback(e=>{
    for(const item of e.clipboardData?.items||[]){
      if(item.type.startsWith('image/')){
        const f=item.getAsFile();
        if(f){pickFile(f);e.preventDefault();break;}
      }
    }
  },[pickFile]);

  /* Envoyer fichier — base64 complet en 1 emit, pas de chunks */
  const sendFile=useCallback(async file=>{
    setSending(true);setProgress(0);
    setComposerError('');
    try{
      const b64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>res(e.target.result.split(',')[1]);
        r.onerror=rej;
        r.readAsDataURL(file);
      });
      setProgress(60);
      const isImg=file.type.startsWith('image/');
      socket?.emit(EV_CHAT,{
        roomId,
        id:genId(),
        type:isImg?'image':'file',
        message:input.trim()||null,
        fileName:file.name,
        fileType:file.type,
        fileSize:file.size,
        data:b64,
        userId,userName,
        replyTo:replyTo?{id:replyTo.id,userName:replyTo.userName,message:replyTo.message,fileName:replyTo.fileName}:null,
        timestamp:new Date().toISOString(),
      });
      setProgress(100);
      setTimeout(()=>{setProgress(null);setPending(null);setInput('');setReplyTo(null);setSending(false);},400);
    }catch(err){
      setComposerError("L'envoi du fichier a échoué. Réessayez dans quelques instants.");
      setProgress(null);setSending(false);
    }
  },[socket,roomId,userId,userName,input,replyTo]);

  /* Envoyer texte */
  const handleSend=useCallback(()=>{
    if(sending)return;
    if(pending?.file){sendFile(pending.file);return;}
    const t=input.trim();if(!t)return;
    setComposerError('');
    socket?.emit(EV_CHAT,{
      roomId,id:genId(),type:'text',message:t,userId,userName,
      replyTo:replyTo?{id:replyTo.id,userName:replyTo.userName,message:replyTo.message}:null,
      timestamp:new Date().toISOString(),
    });
    setInput('');setReplyTo(null);setShowEmoji(false);
  },[sending,pending,input,socket,roomId,userId,userName,replyTo,sendFile]);

  const handleReact=useCallback((msgId,emoji)=>{
    socket?.emit(EV_REACT,{roomId,messageId:msgId,emoji,userId,userName});
  },[socket,roomId,userId,userName]);

  const addEmoji=e=>{setInput(p=>p+e);setShowEmoji(false);inputRef.current?.focus();};
  const canSend=!sending&&(!!pending||input.trim().length>0);

  if(!chatOpen)return null;

  return(
      <div style={{display:'flex',flexDirection:'column',height:'100%',width:300,background:'#0f1623',borderLeft:'1px solid rgba(255,255,255,0.07)',fontFamily:"'DM Sans',system-ui,sans-serif",position:'relative',flexShrink:0}}
           onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

        {/* Drag overlay */}
        {dragging&&(
            <div style={{position:'absolute',inset:0,zIndex:50,background:'rgba(59,130,246,0.15)',border:'2px dashed #3b82f6',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,pointerEvents:'none'}}>
              <span style={{fontSize:32}}>📎</span>
              <span style={{fontSize:14,fontWeight:700,color:'#60a5fa'}}>Déposer ici</span>
            </div>
        )}

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.02)',flexShrink:0}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'#f1f5f9'}}>💬 Discussion</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:1}}>{messages.length} message{messages.length!==1?'s':''}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            {chatUnread>0&&<div style={{background:'#ef4444',color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:800}}>{chatUnread}</div>}
            <button onClick={()=>setChatOpen(false)}
                    style={{width:26,height:26,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.14)';e.currentTarget.style.color='#fff';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.5)';}}>
              <IClose/>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'10px 10px 4px',display:'flex',flexDirection:'column',gap:1}} onPaste={onPaste}>
          {messages.length===0?(
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.2)',textAlign:'center',gap:10}}>
                <span style={{fontSize:36}}>💬</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Commencez la discussion</div>
                  <div style={{fontSize:11,lineHeight:1.5,color:'rgba(255,255,255,0.15)'}}>Envoyez un message, une image<br/>ou glissez un fichier ici.</div>
                </div>
              </div>
          ):messages.map(msg=>(
              <Bubble key={msg.id} msg={msg}
                      isMine={msg.socketId===socket?.id||msg.userId===userId}
                      onReply={setReplyTo} onReact={handleReact}
                      reactions={reactions[msg.id]}/>
          ))}
          <div ref={endRef}/>
        </div>

        {/* Aperçu fichier */}
        {pending&&<Pending file={pending.file} preview={pending.preview} progress={progress} onRemove={()=>setPending(null)}/>}

        {/* Reply */}
        {replyTo&&(
            <div style={{margin:'0 10px 5px',display:'flex',alignItems:'center',gap:8,borderLeft:'2.5px solid #3b82f6',background:'rgba(59,130,246,0.08)',borderRadius:'0 8px 8px 0',padding:'6px 8px 6px 10px'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:'#93c5fd',fontWeight:700,marginBottom:2}}>↩ {replyTo.userName}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{replyTo.message||replyTo.fileName}</div>
              </div>
              <button onClick={()=>setReplyTo(null)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',flexShrink:0}}><IX/></button>
            </div>
        )}

        {composerError && (
            <div style={{margin:'0 10px 6px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:10,padding:'8px 10px',fontSize:11,color:'#f87171',lineHeight:1.5}}>
              ⚠ {composerError}
            </div>
        )}

        {/* Emoji picker */}
        {showEmoji&&(
            <div style={{margin:'0 10px 6px',background:'#1e2433',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:10,display:'flex',flexWrap:'wrap',gap:4}}>
              {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>addEmoji(e)}
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:19,padding:'3px 4px',borderRadius:7,transition:'transform .1s'}}
                          onMouseEnter={ev=>ev.currentTarget.style.transform='scale(1.3)'}
                          onMouseLeave={ev=>ev.currentTarget.style.transform='scale(1)'}>
                    {e}
                  </button>
              ))}
            </div>
        )}

        {/* Zone saisie */}
        <div style={{padding:'8px 10px 10px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>

          {/* Toolbar */}
          <div style={{display:'flex',gap:5,marginBottom:7,alignItems:'center'}}>

            {/* ✅ BOUTON IMAGE */}
            <button onClick={openImagePicker} title="Envoyer une image"
                    style={{width:30,height:30,borderRadius:8,border:'none',cursor:'pointer',background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.6)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.15)';e.currentTarget.style.color='#fff';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.6)';}}>
              <IImg/>
            </button>

            {/* ✅ BOUTON FICHIER */}
            <button onClick={openFilePicker} title="Joindre un fichier (PDF, Word, Excel…)"
                    style={{width:30,height:30,borderRadius:8,border:'none',cursor:'pointer',background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.6)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.15)';e.currentTarget.style.color='#fff';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.6)';}}>
              <IClip/>
            </button>

            {/* BOUTON EMOJI */}
            <button onClick={()=>setShowEmoji(o=>!o)} title="Emoji"
                    style={{width:30,height:30,borderRadius:8,border:'none',cursor:'pointer',background:showEmoji?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.07)',color:showEmoji?'#fbbf24':'rgba(255,255,255,0.6)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
              <IEmoji/>
            </button>

            <div style={{marginLeft:'auto',fontSize:9,color:'rgba(255,255,255,0.18)',lineHeight:1.3,textAlign:'right'}}>Glisser ou Ctrl+V<br/>pour coller</div>
          </div>

          {/* Input + Envoyer */}
          <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}
                    onPaste={onPaste}
                    placeholder={pending?'Message optionnel…':'Message… (Maj+Entrée = nouvelle ligne)'}
                    rows={1}
                    style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'8px 11px',color:'#e2e8f0',fontSize:13,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.5,maxHeight:90,overflowY:'auto',transition:'border-color .15s'}}
                    onFocus={e=>e.currentTarget.style.borderColor='rgba(59,130,246,0.5)'}
                    onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}/>
            <button onClick={handleSend} disabled={!canSend}
                    style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,background:canSend?'#3b82f6':'rgba(255,255,255,0.06)',color:canSend?'#fff':'rgba(255,255,255,0.2)',cursor:canSend?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',boxShadow:canSend?'0 2px 12px rgba(59,130,246,0.4)':'none'}}>
              <ISend/>
            </button>
          </div>
        </div>

        <style>{`::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}`}</style>
      </div>
  );
}
