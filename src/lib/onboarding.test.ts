import { describe,it,expect } from 'vitest';
import { createInitialBook } from './onboarding';
import { createBook,decodeBook,encodeBook } from './scorebook';
const own=createBook(null,'2026-09-12').members.filter(m=>m.team==='top').map(m=>({...m,name:`登録選手${m.number}`}));
describe('初回登録',()=>{
  it('自チーム9人と対戦相手の仮名で初戦を作り、サンプル名を入れない',()=>{const book=createInitialBook('自チーム','相手チーム','2026-09-12',own,'first');expect(book.members).toHaveLength(18);expect(book.matches).toHaveLength(1);expect(book.matches[0].teams.away.name).toBe('自チーム');expect(book.members[9].name).toBe('相手1番');expect(book.matches[0].game.events).toHaveLength(0);expect(decodeBook(encodeBook(book))).toEqual(book);});
  it('保存済みの別試合や元のメンバー配列を変更しない',()=>{const before=JSON.stringify(own);createInitialBook('A','B','2025-09-12',own,'past');expect(JSON.stringify(own)).toBe(before);});
  it('名前抜け、重複、人数不足、不正な日付を拒否する',()=>{expect(()=>createInitialBook('A','B','2026-09-12',own.slice(1),'x')).toThrow();expect(()=>createInitialBook('A','B','2026-09-12',own.map((m,i)=>i?m:{...m,name:' '}),'x')).toThrow();expect(()=>createInitialBook('A','B','2026-09-12',own.map(()=>own[0]),'x')).toThrow();expect(()=>createInitialBook('A','B','invalid',own,'x')).toThrow();});
});
