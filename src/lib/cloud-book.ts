import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeBook, encodeBook, type Scorebook } from './scorebook';

export type TeamRole = 'admin' | 'editor' | 'viewer';
export const roleLabels: Record<TeamRole,string> = { admin: '管理者', editor: '記録者', viewer: '閲覧者' };
export type CloudSnapshot = { book: Scorebook | null; revision: number };
export interface CloudStore {
  teamId: string;
  teamName: string;
  role: TeamRole;
  load: () => Promise<CloudSnapshot>;
  save: (book: Scorebook, revision: number, writeId: string) => Promise<number>;
}
export function cloudError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (message.includes('REVISION_CONFLICT')) return '別の人が記録を更新しました。最新の記録を読み直してください。';
  if (message.includes('FORBIDDEN') || message.includes('AUTH_REQUIRED')) return 'このチームの操作権限がありません。ログインと権限を確認してください。';
  if (message.includes('LAST_ADMIN')) return '最後の管理者は変更できません。先に別の人を管理者にしてください。';
  if (message.includes('INVALID_INVITE')) return '招待コードが無効・期限切れ、または招待先のメールアドレスと異なります。';
  if (message.includes('10MB')) return '記録が10MBを超えているため保存できません。バックアップを保管して管理者に相談してください。';
  if (message.includes('INVALID_BOOK')) return '記録の形式または容量が保存条件に合いません。バックアップを保管して内容を確認してください。';
  return '通信または設定の問題で処理できませんでした。再度お試しください。';
}
export function createCloudStore(client: SupabaseClient, teamId: string, teamName: string, role: TeamRole): CloudStore {
  return { teamId, teamName, role,
    async load() {
      const { data, error } = await client.from('score_books').select('data,revision').eq('team_id',teamId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('FORBIDDEN');
      if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('INVALID_REVISION');
      return { book: data.data === null ? null : decodeBook(JSON.stringify(data.data)), revision: data.revision };
    },
    async save(book, revision, writeId) {
      if (role === 'viewer') throw new Error('FORBIDDEN');
      const raw = encodeBook(book);
      decodeBook(raw);
      if (new TextEncoder().encode(raw).length > 10 * 1024 * 1024) throw new Error('記録が10MBを超えています。');
      const { data, error } = await client.rpc('score_save_book',{p_team:teamId,p_revision:revision,p_data:JSON.parse(raw),p_write_id:writeId});
      if (error) throw error;
      if (!Number.isSafeInteger(data) || data <= revision) throw new Error('INVALID_REVISION');
      return data;
    }
  };
}
