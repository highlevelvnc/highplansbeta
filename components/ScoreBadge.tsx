export default function ScoreBadge({ score }: { score: string }) {
  const cls = score === 'HOT' ? 'badge-hot' : score === 'WARM' ? 'badge-warm' : 'badge-cold'
  return <span className={cls}>{score}</span>
}
