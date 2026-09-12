import { createMatch, decodeBook, encodeBook, gradeAt, schoolYear, type Member, type Scorebook } from './scorebook';
import { positions } from './lineup-changes';
export function createInitialBook(team: string, opponent: string, date: string, members: Member[], id: string): Scorebook {
  if (members.length !== 9 || members.some(member => !member.name.trim())) throw new Error('最初の打順9人の名前を入力してください。');
  const own = members.map(member => ({ ...member, team: 'top' as const, grade: gradeAt(member,date), gradeYear: schoolYear(date) }));
  const other: Member[] = positions.map((position,index) => ({id:`${id}-opponent-${index}`,name:`相手${index+1}番`,number:index+1,position,grade:'学年不明',gradeYear:schoolYear(date),team:'bottom',bats:'右',throws:'右'}));
  const base: Scorebook = {version:2,members:[...own,...other],matches:[],activeId:id};
  const match = createMatch(base,id,date,team,opponent,{top:own.map(m=>m.id),bottom:other.map(m=>m.id)});
  return decodeBook(encodeBook({...base,matches:[match]}));
}
