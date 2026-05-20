interface ConfidenceBarProps {
  score: number
  fieldsPopulated: number
  fieldsTotal: number
}

export function ConfidenceBar({ score, fieldsPopulated, fieldsTotal }: ConfidenceBarProps) {
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>Confidence</span>
        <span>{fieldsPopulated}/{fieldsTotal} data signals · {pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
