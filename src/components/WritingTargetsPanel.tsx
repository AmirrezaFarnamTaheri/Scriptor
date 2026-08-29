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

import { vaultReadStatsHistory, type StatsHistoryEntry } from '../bridge/commands'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
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

function readThemeColor(token: '--primary' | '--amber', fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || fallback
}

export function WritingTargetsPanel({
  dailyTarget,
  wordsToday,
  onDailyTargetChange,
  onClose,
}: WritingTargetsPanelProps) {
  const [history, setHistory] = useState<StatsHistoryEntry[]>([])
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstance = useRef<Chart | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const historyRequestId = useRef(0)
  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true })

  const refreshHistory = useCallback(async (showLoading = false) => {
    const requestId = ++historyRequestId.current
    if (showLoading) setHistoryStatus('loading')
    if (!isNativeBridgeAvailable()) {
      setHistory([])
      setHistoryStatus('ready')
      return
    }
    try {
      const entries = await vaultReadStatsHistory()
      if (requestId !== historyRequestId.current) return
      setHistory(entries)
      setHistoryStatus('ready')
    } catch {
      if (requestId !== historyRequestId.current) return
      setHistory([])
      setHistoryStatus('error')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    queueMicrotask(() => {
      if (mounted) void refreshHistory()
    })
    return () => {
      mounted = false
      historyRequestId.current += 1
    }
  }, [refreshHistory])

  useEffect(() => {
    if (!chartRef.current || historyStatus !== 'ready' || history.length === 0) return

    const recent = history.slice(-14)
    const labels = recent.map((entry) => entry.date.slice(5))
    const values = recent.map((entry) => entry.words)
    const targetLine = recent.map(() => dailyTarget)
    const primary = readThemeColor('--primary', '#0d9488')
    const amber = readThemeColor('--amber', '#d97706')

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
            backgroundColor: primary,
            borderColor: primary,
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Target',
            data: targetLine,
            borderColor: amber,
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
  }, [dailyTarget, history, historyStatus])

  const progress = dailyTarget > 0 ? Math.min(100, Math.round((wordsToday / dailyTarget) * 100)) : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section ref={dialogRef} className="writing-targets-panel" role="dialog" aria-modal="true" aria-label="Writing targets" onClick={(e) => e.stopPropagation()}>
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
        {historyStatus === 'ready' && history.length > 0 ? (
          <div className="writing-history-chart">
            <canvas ref={chartRef} aria-label="Writing history chart" />
          </div>
        ) : null}
        <ul className="writing-history">
          {historyStatus === 'loading' ? (
            <li>Loading writing history…</li>
          ) : historyStatus === 'error' ? (
            <li>
              Could not load writing history.{' '}
              <button type="button" className="action-button" onClick={() => void refreshHistory(true)}>
                Retry
              </button>
            </li>
          ) : history.length === 0 ? (
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
