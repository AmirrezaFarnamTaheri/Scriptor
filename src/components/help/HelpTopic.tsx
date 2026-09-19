import { useState, useSyncExternalStore } from 'react'
import { getGuide } from '../../lib/help/catalog'
import { getProgress, type HelpProgressStore } from '../../lib/help/progress'
import type { HelpLabels } from '../../lib/help/labels'
import type { HelpGuide, HelpView } from '../../lib/help/types'

interface HelpTopicProps {
  guide: HelpGuide
  view: HelpView
  labels: HelpLabels
  store: HelpProgressStore
  onView: (view: HelpView) => void
  onGuide: (id: string) => void
  onReveal: (guide: HelpGuide, selector?: string) => boolean
}

export function HelpTopic({ guide, view, labels, store, onView, onGuide, onReveal }: HelpTopicProps) {
  const { preferences } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const progress = getProgress(preferences, guide.id)
  const stepIndex = Math.min(progress.step, guide.steps.length - 1)
  const step = guide.steps[stepIndex]!
  const [missing, setMissing] = useState(false)
  const start = () => {
    store.dispatch(progress.completed ? { type: 'restart', id: guide.id } : { type: 'step', id: guide.id, step: stepIndex })
    onView('tour')
    setMissing(false)
  }
  const navigate = (index: number) => {
    store.dispatch({ type: 'step', id: guide.id, step: index })
    setMissing(false)
  }
  return (
    <article className="help-topic">
      <div className="help-topic-heading" lang="en" dir="ltr">
        <p className="help-eyebrow">{guide.category}</p>
        <h2>{guide.title}</h2>
      </div>
      <p className="help-policy">{guide.experimental ? `${labels.experimental} · ` : ''}{guide.policy === 'first-run' ? labels.policyApp : guide.policy === 'first-use' ? labels.policyFirst : labels.policyManual}</p>
      <div className="help-view-actions" role="group" aria-label={labels.title}>
        <button type="button" className="toolbar-button" aria-pressed={view === 'guide'} onClick={() => onView('guide')}>{labels.guide}</button>
        <button type="button" className="toolbar-button" aria-pressed={view === 'questions'} onClick={() => onView('questions')}>{labels.questions}</button>
        <button type="button" className="toolbar-button" aria-pressed={view === 'tour'} onClick={start}>{progress.step > 0 && !progress.completed ? labels.resume : labels.start}</button>
      </div>
      <dl className="help-preflight">
        <dt>{labels.entry}</dt><dd lang="en" dir="ltr">{guide.entry}</dd>
        <dt>{labels.prerequisite}</dt><dd lang="en" dir="ltr">{guide.prerequisite}</dd>
        <dt>{labels.safety}</dt><dd lang="en" dir="ltr">{guide.safety}</dd>
      </dl>
      {view === 'tour' ? (
        <section className="help-tour" aria-label={labels.tour}>
          <p className="help-step-count" role="status">{labels.step} {stepIndex + 1} {labels.of} {guide.steps.length}</p>
          <progress max={guide.steps.length} value={stepIndex + 1} aria-label={labels.tour} />
          <div lang="en" dir="ltr"><h3>{step[0]}</h3><p>{step[1]}</p></div>
          <button type="button" className="toolbar-button" onClick={() => setMissing(!onReveal(guide, step[2]))}>{labels.locate}</button>
          <p className="help-note">{labels.returnHint}</p>
          {missing ? <p className="help-notice" role="status">{labels.missing}</p> : null}
          <div className="help-tour-actions">
            <button type="button" className="toolbar-button" disabled={stepIndex === 0} onClick={() => navigate(stepIndex - 1)}>{labels.back}</button>
            {stepIndex < guide.steps.length - 1 ? (
              <button type="button" className="toolbar-button" onClick={() => navigate(stepIndex + 1)}>{labels.next}</button>
            ) : (
              <button type="button" className="toolbar-button" onClick={() => { store.dispatch({ type: 'finish', id: guide.id }); onView('guide') }}>{labels.finish}</button>
            )}
          </div>
        </section>
      ) : null}
      {view === 'guide' ? (
        <ol className="help-guide-steps" lang="en" dir="ltr">
          {guide.steps.map(([title, instruction]) => <li key={title}><h3>{title}</h3><p>{instruction}</p></li>)}
        </ol>
      ) : null}
      {view !== 'tour' ? (
        <section className="help-questions" aria-label={labels.questions}>
          <h3>{labels.questions}</h3>
          {guide.questions.map(([question, answer]) => <details key={question} open={view === 'questions'} lang="en" dir="ltr"><summary>{question}</summary><p>{answer}</p></details>)}
        </section>
      ) : null}
      {progress.completed ? <p role="status">{labels.read}</p> : null}
      {progress.completed || progress.step > 0 ? <button type="button" className="toolbar-button" onClick={() => { store.dispatch({ type: 'restart', id: guide.id }); onView('tour'); setMissing(false) }}>{labels.restart}</button> : null}
      <nav className="help-related" aria-label={labels.related}>
        <h3>{labels.related}</h3>
        {guide.related.map((id) => <button key={id} type="button" className="toolbar-button" onClick={() => onGuide(id)} lang="en" dir="ltr">{getGuide(id).title}</button>)}
      </nav>
    </article>
  )
}
