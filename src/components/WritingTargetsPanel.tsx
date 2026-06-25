import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { X } from 'lucide-react'

import { vaultAppendStatsHistory, vaultReadStatsHistory, type StatsHistoryEntry } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
)

interface WritingTargetsPanelProps {
  dailyTarget: number
  wordsToday: number
  onDailyTargetChange: (value: number) => void
  onClose: () => void
}

export function recordWritingSession(words: number): void {
  if (!isNativeBridgeAvailable() || words <= 0) return
  const today = new Date().toISOString().slice(0, 10)
  void vaultAppendStatsHistory(today, words)
}

export function WritingTargetsPanel({
  dailyTarget,
  wordsToday,
  onDailyTargetChange,
  onClose,
}: WritingTargetsPanelProps) {
  const [history, setHistory] = useState<StatsHistoryEntry[]>([])
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstance = useRef<Chart | null>(null)

  const refreshHistory = useCallback(async () => {
    if (!isNativeBridgeAvailable()) {
      setHistory([])
      return
    }
    try {
      setHistory(await vaultReadStatsHistory())
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory, wordsToday])

  useEffect(() => {
    if (!chartRef.current) return

    const recent = history.slice(-14)
    const labels = recent.map((entry) => entry.date.slice(5))
    const values = recent.map((entry) => entry.words)
    const targetLine = recent.map(() => dailyTarget)

    chartInstance.current?.destroy()
    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Words',
            data: values,
            backgroundColor: 'rgba(13, 148, 136, 0.55)',
            borderColor: '#0d9488',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Target',
            data: targetLine,
            borderColor: '#d97706',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    })

    return () => {
      chartInstance.current?.destroy()
      chartInstance.current = null
    }
  }, [dailyTarget, history])

  const progress = dailyTarget > 0 ? Math.min(100, Math.round((wordsToday / dailyTarget) * 100)) : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="writing-targets-panel" role="dialog" aria-label="Writing targets" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Writing targets</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <label>
          Daily word target
          <input
            type="number"
            min={0}
            step={50}
            value={dailyTarget}
            onChange={(event) => onDailyTargetChange(Number(event.target.value))}
          />
        </label>
        <p>
          Today: <strong>{wordsToday}</strong> / {dailyTarget} words ({progress}%)
        </p>
        <div className="writing-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <h3>Recent history</h3>
        <div className="writing-history-chart">
          <canvas ref={chartRef} aria-label="Writing history chart" />
        </div>
        <ul className="writing-history">
          {history.length === 0 ? (
            <li>No sessions recorded yet.</li>
          ) : (
            history
              .slice()
              .reverse()
              .slice(0, 7)
              .map((entry) => (
                <li key={entry.date}>
                  {entry.date}: {entry.words} words
                </li>
              ))
          )}
        </ul>
      </section>
    </div>
  )
}
