import { PASSWORD_RULE, STRENGTH_STEPS, passwordStrength } from '../../lib/ui.js'

// Live strength bar rendered under a password input as the user types.
// Shows the minimum rule until the password passes it, then the score.
export function PasswordStrengthMeter({ password }) {
  const score = passwordStrength(password)
  const step = STRENGTH_STEPS[score - 1]
  return <div className="mt-2">
    <div className="flex gap-1">{[0, 1, 2, 3].map(index => (
      <span key={index} className="h-1 flex-1 rounded-full transition-colors duration-200"
        style={{ backgroundColor: index < score ? step.color : '#e7ebf0' }} />
    ))}</div>
    <p className="mt-1 text-[10px]" style={{ color: step ? step.color : '#94a3b8' }}>
      {step ? `${step.label} password` : PASSWORD_RULE}
    </p>
  </div>
}
