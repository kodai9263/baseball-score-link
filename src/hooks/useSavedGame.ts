"use client";
import { useEffect,useRef,useState } from 'react';
import { GAME_STORAGE_KEY } from '@/lib/game-storage';
import { BOOK_KEY,BOOK_LOCK,createBook,decodeBook,saveBook,type Scorebook } from '@/lib/scorebook';
import { useCloudStorage } from '@/components/account/StorageContext';
import { cloudError } from '@/lib/cloud-book';
import type { GameState } from '@/lib/types';
export function useSavedGame() {
  const cloud=useCloudStorage();const store=cloud?.store;
  const [book,setBook]=useState(()=>cloud?.initial.book??createBook(null));
  const match=book.matches.find(item=>item.id===book.activeId)!;const game=match.game;
  const [ready,setReady]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [blocked,setBlocked]=useState(false);
  const raw=useRef<string|null>(null);const legacyRaw=useRef<string|null>(null);const revision=useRef(cloud?.initial.revision??0);const busy=useRef(false);
  const canEdit=store?.role!=='viewer';
  useEffect(()=>{
    let live=true;
    if(store){setReady(true);setSaved(true);
      const refresh=async()=>{if(busy.current)return;const expected=revision.current;try{const next=await store.load();if(!live||busy.current||revision.current!==expected)return;
        if(next.revision!==revision.current){if(store.role==='viewer'&&next.book){revision.current=next.revision;setBook(next.book);}else{setReady(false);setError('別の人が記録を更新しました。最新の記録を読み直してください。');}}
      }catch(e){if(!live)return;const denied=e instanceof Error&&e.message==='FORBIDDEN';if(denied){setBlocked(true);setReady(false);}setError(cloudError(e));}};
      const timer=setInterval(()=>void refresh(),15000);window.addEventListener('focus',refresh);
      return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
    }
    try{const stored=localStorage.getItem(BOOK_KEY);legacyRaw.current=localStorage.getItem(GAME_STORAGE_KEY);setBook(stored===null?createBook(legacyRaw.current):decodeBook(stored));raw.current=stored;setSaved(stored!==null||legacyRaw.current!==null);if(!navigator.locks)throw new Error('保存に非対応');setReady(true);}
    catch{setError('保存機能または保存データを確認できません。元の記録は変更していません。');setBlocked(true);}
    const onStorage=(event:StorageEvent)=>{if(event.key!==BOOK_KEY&&event.key!==GAME_STORAGE_KEY&&event.key!==null)return;setReady(false);setError('別の画面で記録が更新されました。最新の記録を読み直してください。');};
    window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
  },[store]);
  const commitBook=async(next:Scorebook)=>{
    if(!ready||busy.current||!canEdit)return false;busy.current=true;setPending(true);
    try{if(store){revision.current=await store.save(next,revision.current,crypto.randomUUID());}
      else{await navigator.locks.request(BOOK_LOCK,()=>{raw.current=saveBook(localStorage,raw.current,legacyRaw.current,next);});}
      setBook(next);setSaved(true);setError('');return true;
    }catch(cause){if(store){setError(`${cloudError(cause)} 最新の記録を読み直して保存結果を確認してください。`);setReady(false);}
      else{const conflict=cause instanceof Error&&cause.message.startsWith('別の画面');setError(conflict?cause.message:'保存できませんでした。今回の操作は反映していません。空き容量・設定を確認して再度お試しください。');if(conflict)setReady(false);}return false;
    }finally{busy.current=false;setPending(false);}
  };
  const selectMatch=(id:string)=>{if(!pending&&book.matches.some(item=>item.id===id))setBook(current=>({...current,activeId:id}));};
  const commit=(next:GameState)=>commitBook({...book,matches:book.matches.map(item=>item.id===match.id?{...item,game:next}:item)});
  return {book,match,game,commit,commitBook,selectMatch,ready,pending,error,saved,blocked,canEdit,cloud:!!store};
}
