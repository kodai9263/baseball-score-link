import { describe,it,expect,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCloudStore } from './cloud-book';
import { createBook,encodeBook } from './scorebook';
const book=createBook(null,'2026-09-12');
function client(row:unknown={data:JSON.parse(encodeBook(book)),revision:3}) {
  const maybeSingle=vi.fn().mockResolvedValue({data:row,error:null});
  const eq=vi.fn(()=>({maybeSingle}));const select=vi.fn(()=>({eq}));const from=vi.fn(()=>({select}));
  const rpc=vi.fn().mockResolvedValue({data:4,error:null});
  return {api:{from,rpc} as unknown as SupabaseClient,from,eq,rpc};
}
describe('クラウド保存の境界',()=>{
  it('指定チームだけを取得し、保存形式を復元する',async()=>{const c=client();const store=createCloudStore(c.api,'team-a','A','editor');const result=await store.load();expect(result.book).toEqual(book);expect(result.revision).toBe(3);expect(c.eq).toHaveBeenCalledWith('team_id','team-a');});
  it('空のチームは初回登録へ進め、見えないチームは拒否する',async()=>{expect(await createCloudStore(client({data:null,revision:0}).api,'a','A','admin').load()).toEqual({book:null,revision:0});await expect(createCloudStore(client(null).api,'a','A','admin').load()).rejects.toThrow('FORBIDDEN');});
  it('閲覧者はRPCを呼ぶ前に書き込みを拒否する',async()=>{const c=client();await expect(createCloudStore(c.api,'a','A','viewer').save(book,3,'request')).rejects.toThrow('FORBIDDEN');expect(c.rpc).not.toHaveBeenCalled();});
  it('更新番号と操作IDを送り、成功した番号を返す',async()=>{const c=client();expect(await createCloudStore(c.api,'a','A','editor').save(book,3,'request')).toBe(4);expect(c.rpc).toHaveBeenCalledWith('score_save_book',{p_team:'a',p_revision:3,p_write_id:'request',p_data:JSON.parse(encodeBook(book))});});
  it('破損したデータを送らず、競合・通信エラーを成功扱いしない',async()=>{const c=client();const store=createCloudStore(c.api,'a','A','admin');await expect(store.save({...book,activeId:'missing'},3,'request')).rejects.toThrow();expect(c.rpc).not.toHaveBeenCalled();c.rpc.mockResolvedValueOnce({data:null,error:{message:'REVISION_CONFLICT'}});await expect(store.save(book,3,'request')).rejects.toMatchObject({message:'REVISION_CONFLICT'});c.rpc.mockRejectedValueOnce(new Error('offline'));await expect(store.save(book,3,'request')).rejects.toThrow('offline');});
  it('異常な更新番号や壊れたクラウドデータを拒否する',async()=>{await expect(createCloudStore(client({data:{version:99},revision:1}).api,'a','A','admin').load()).rejects.toThrow();await expect(createCloudStore(client({data:null,revision:-1}).api,'a','A','admin').load()).rejects.toThrow('INVALID_REVISION');const c=client();c.rpc.mockResolvedValueOnce({data:3,error:null});await expect(createCloudStore(c.api,'a','A','admin').save(book,3,'r')).rejects.toThrow('INVALID_REVISION');});
});
