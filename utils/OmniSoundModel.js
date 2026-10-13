/**
 * utils/OmniSoundModel.js — the SOUND MODEL of the SoundNode (V194). Pure: no DOM, no Web Audio, safe in Node/jsdom.
 *
 * One `sound` object lives on node.data.sound. Every setting is described ONCE here, in SOUND_SCHEMA; the settings panel generates its controls
 * from the schema and systems/OmniSoundEngine.js reads the sanitized object, so adding a setting = add a field here (+ use it in the engine).
 *
 *   SOUND_SCHEMA     groups -> fields { key, label, type 'number'|'enum'|'bool'|'note'|'text'|'color', min, max, step, unit, options, default, desc }
 *   defaultSound()   a fresh default: a soft sine A4, mf, ADSR 0.02/0.2/0.7/0.4, no effects
 *   sanitizeSound()  total function: always returns a complete valid object, never throws, ignores unknown keys (incl. __proto__)
 *   SOUND_PRESETS    { id: { label, settings } }  (partial settings; apply with sanitizeSound({...defaultSound(), ...settings}))
 *   DYNAMICS / dynamicToGain / noteToFreq / freqToNote / midiToFreq / midiToNote / parseNote / NOTE_NAMES   musical helpers
 *
 * For text fields `max` is the maximum LENGTH. The sample field `sampleUrl` is a URL only (blob:, http(s):, data: up to 4096 chars);
 * uploaded audio normally lives in the OmniMixer library and is referenced by `sampleSlot` (1..15), see the engine.
 */

export const KIND_SOUND = 'soundNode'
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const DYNAMICS = ['pppp', 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'ffff']
const DYN_GAIN = { pppp: 0.03, ppp: 0.06, pp: 0.11, p: 0.18, mp: 0.28, mf: 0.42, f: 0.58, ff: 0.74, fff: 0.88, ffff: 1.0 }
export const DYNAMIC_DESC = {
  pppp: 'pianississimo: as quiet as it gets', ppp: 'pianissimo: barely there', pp: 'very soft', p: 'piano: soft', mp: 'mezzo-piano: moderately soft',
  mf: 'mezzo-forte: moderately loud (the default)', f: 'forte: loud', ff: 'fortissimo: very loud', fff: 'fortississimo: extremely loud', ffff: 'maximum'
}

/** dynamic mark (or a 0..1 number) -> linear gain 0.03..1.0, monotonic. Unknown names fall back to mf. */
export function dynamicToGain (name) {
  if (typeof name === 'number' && Number.isFinite(name)) return Math.min(1, Math.max(0, name))
  const k = String(name ?? '').toLowerCase()
  return Object.prototype.hasOwnProperty.call(DYN_GAIN, k) ? DYN_GAIN[k] : DYN_GAIN.mf
}
/** the dynamic mark closest to a linear gain. */
export function gainToDynamic (g) {
  const x = Number.isFinite(+g) ? +g : DYN_GAIN.mf
  let best = DYNAMICS[0]; let bd = Infinity
  for (const d of DYNAMICS) { const e = Math.abs(DYN_GAIN[d] - x); if (e < bd) { bd = e; best = d } }
  return best
}
export const dbToGain = (db) => Math.pow(10, (Number.isFinite(+db) ? +db : 0) / 20)
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-6, Number.isFinite(+g) ? +g : 1))

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** "A4", "c#3", "Bb2", "Db-1" -> { name, midi, letter, octave } or null. */
export function parseNote (s) {
  const m = /^\s*([A-Ga-g])([#b♯♭]?)(-?\d{1,2})\s*$/.exec(String(s ?? ''))
  if (!m) return null
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : (m[2] === 'b' || m[2] === '♭' ? -1 : 0)
  const octave = parseInt(m[3], 10)
  const midi = 12 * (octave + 1) + NOTE_INDEX[m[1].toUpperCase()] + acc
  if (midi < 0 || midi > 127) return null
  return { name: midiToNote(midi), midi, letter: m[1].toUpperCase() + (acc === 1 ? '#' : acc === -1 ? 'b' : ''), octave }
}
export function midiToNote (midi) {
  const m = Math.round(Number.isFinite(+midi) ? +midi : 69)
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1)
}
export function midiToFreq (midi, a4 = 440) { return (Number.isFinite(+a4) && +a4 > 0 ? +a4 : 440) * Math.pow(2, ((Number.isFinite(+midi) ? +midi : 69) - 69) / 12) }
/** note name ("A4") or midi number -> Hz; NaN-safe (falls back to A4). */
export function noteToFreq (name, a4 = 440) {
  if (typeof name === 'number') return midiToFreq(name, a4)
  const p = parseNote(name)
  return midiToFreq(p ? p.midi : 69, a4)
}
/** Hz -> { name, midi, cents } nearest equal-tempered note ("A4", 69, 0). */
export function freqToNote (freq, a4 = 440) {
  const f = Number.isFinite(+freq) && +freq > 0 ? +freq : 440
  const ref = Number.isFinite(+a4) && +a4 > 0 ? +a4 : 440
  const exact = 69 + 12 * Math.log2(f / ref)
  const midi = Math.round(exact)
  return { name: midiToNote(midi), midi, cents: Math.round((exact - midi) * 100) }
}

// ── schema builders ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const N = (key, label, def, min, max, step, unit, desc) => ({ key, label, type: 'number', min, max, step, unit, default: def, desc })
const E = (key, label, def, opts, desc) => ({ key, label, type: 'enum', options: opts.map(o => Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: String(o) }), default: def, desc })
const B = (key, label, def, desc) => ({ key, label, type: 'bool', default: def, desc })
const T = (key, label, def, max, desc) => ({ key, label, type: 'text', max, default: def, desc })
const C = (key, label, def, desc) => ({ key, label, type: 'color', default: def, desc })
const NOTE = (key, label, def, desc) => ({ key, label, type: 'note', default: def, desc })
const DYN_OPTS = DYNAMICS.map(d => [d, d + ' - ' + DYNAMIC_DESC[d]])
const CURVES = [['linear', 'Linear (straight line)'], ['exponential', 'Exponential (fast then slow)'], ['logarithmic', 'Logarithmic (slow then fast)'], ['scurve', 'S-curve (smooth ends)']]
const LFO_SHAPES = [['sine', 'Sine (smooth)'], ['triangle', 'Triangle'], ['square', 'Square (on/off)'], ['sawtooth', 'Saw (ramp)'], ['random', 'Random (sample and hold)']]

export const SOUND_SCHEMA = [
  { id: 'source', label: 'Source', desc: 'What makes the raw sound before anything shapes it: a tone, noise, a recording, or a stack of harmonics.', fields: [
    E('sourceType', 'Source type', 'oscillator', [['oscillator', 'Oscillator (a pure tone)'], ['noise', 'Noise (hiss, wind, drums)'], ['sample', 'Sample (a recording)'], ['additive', 'Additive (built from harmonics)'], ['fm', 'FM (metallic / bell tones)']], 'The kind of sound generator. Oscillator = a steady tone, Noise = random hiss, Sample = a recording you uploaded, Additive = many harmonics added together, FM = one tone bending another (bells, electric pianos).'),
    E('waveform', 'Waveform', 'sine', [['sine', 'Sine (pure, flute-like)'], ['square', 'Square (hollow, retro)'], ['sawtooth', 'Saw (bright, buzzy)'], ['triangle', 'Triangle (soft, mellow)'], ['custom', 'Custom partials']], 'The shape of the tone wave. It decides the timbre (tone colour): sine is the purest, saw is the brightest.'),
    T('customPartials', 'Custom partials', '1, 0.5, 0.25', 120, 'Used when the waveform is Custom: a comma separated list of how loud each harmonic is (first = the base note, second = one octave up, ...). 1, 0.5, 0.25 is a gentle fade.'),
    N('pulseWidth', 'Pulse width', 0.5, 0.05, 0.95, 0.01, '', 'For the square wave: how long it stays "up" in each cycle. 0.5 is a normal square; thin values (0.1) sound nasal and reedy.'),
    N('phase', 'Start phase', 0, 0, 360, 1, 'deg', 'Where in its cycle the wave starts. Matters mostly for clicks and for stacked voices.'),
    E('noiseType', 'Noise colour', 'white', [['white', 'White (bright hiss)'], ['pink', 'Pink (natural, rain-like)'], ['brown', 'Brown (deep rumble)']], 'The flavour of noise. White has equal energy at every pitch, pink falls off gently, brown rumbles.'),
    N('noiseLevel', 'Noise mixed into tone', 0, 0, 1, 0.01, '', 'Adds a little noise under any source: breathiness for a flute, grit for a pad. 0 = none.'),
    N('sampleSlot', 'Sample slot (OmniMixer library)', 0, 0, 15, 1, '', 'Which uploaded OmniMixer audio slot (1 to 15) to play as the sample. 0 = none.'),
    T('sampleUrl', 'Sample URL', '', 4096, 'Optional direct address of an audio file instead of a library slot (blob:, https: or data:).'),
    B('sampleKeyTrack', 'Sample follows the note', false, 'On: the recording is played faster or slower so that it sounds at the chosen note (A4 = original speed). Off: it plays at its own pitch.'),
    N('additiveHarmonics', 'Harmonics count', 8, 1, 64, 1, '', 'Additive source: how many overtones are stacked on the base note. More = brighter and richer.'),
    N('additiveRolloff', 'Harmonics rolloff', 1, 0, 3, 0.05, '', 'Additive: how fast the higher overtones get quieter. 0 = all equal (very bright), 1 = natural saw-like fall, 3 = nearly just the base note.'),
    B('additiveOddOnly', 'Odd harmonics only', false, 'Additive: use only the 1st, 3rd, 5th... overtones. This gives a hollow, clarinet-like tone.'),
    N('fmRatio', 'FM ratio', 2, 0.25, 16, 0.25, 'x', 'FM: pitch of the modulator relative to the base note. Whole numbers (1, 2, 3) sound harmonic; fractions (1.41, 3.5) sound metallic and bell-like.'),
    N('fmDepth', 'FM depth', 3, 0, 20, 0.1, '', 'FM: how strongly the modulator bends the tone. 0 = plain sine, larger = brighter and wilder.'),
    N('fmDecay', 'FM depth decay', 0.6, 0, 10, 0.05, 's', 'FM: how long the bendy brightness takes to die away after the start (like a struck bell getting purer). 0 = stays constant.'),
    E('fmWaveform', 'FM modulator wave', 'sine', [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Saw']], 'FM: the wave shape of the modulator.'),
    N('unisonVoices', 'Unison voices', 1, 1, 8, 1, '', 'How many copies of the tone play together. 1 = single. More copies slightly out of tune make a thick, chorus-like "supersaw" sound.'),
    N('unisonDetune', 'Unison detune', 12, 0, 100, 1, 'cents', 'How far apart the unison copies are tuned (100 cents = one semitone). Small = warm, large = out of tune.'),
    N('unisonSpread', 'Unison stereo spread', 0.6, 0, 1, 0.01, '', 'How widely the unison copies are placed left to right.'),
    B('subEnabled', 'Sub oscillator', false, 'Adds a second tone one or two octaves below to add weight (bass).'),
    N('subLevel', 'Sub level', 0.5, 0, 1, 0.01, '', 'How loud the sub tone is.'),
    E('subOctave', 'Sub octave', '-1', [['-1', 'One octave down'], ['-2', 'Two octaves down']], 'How far below the note the sub tone plays.'),
    E('subWaveform', 'Sub wave', 'sine', [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square']], 'The wave shape of the sub tone.')
  ] },
  { id: 'pitch', label: 'Pitch', desc: 'How high or low the note is, and how it is tuned.', fields: [
    NOTE('note', 'Note', 'A4', 'The note to play, as a letter and an octave: C4 is middle C, A4 is the tuning note (440 Hz).'),
    N('octaveShift', 'Octave shift', 0, -4, 4, 1, 'oct', 'Moves the whole note up or down by whole octaves.'),
    N('transpose', 'Transpose', 0, -48, 48, 1, 'semi', 'Moves the note by semitones (piano keys). 12 = one octave, 7 = a fifth.'),
    N('fineTune', 'Fine tune', 0, -100, 100, 1, 'cents', 'Tiny pitch correction; 100 cents = one semitone.'),
    B('useMidi', 'Use MIDI number', false, 'On: ignore the note name and use the MIDI number below (a 0 to 127 number for each piano key, 60 = middle C).'),
    N('midi', 'MIDI number', 69, 0, 127, 1, '', 'MIDI key number used when "Use MIDI number" is on. 69 = A4.'),
    N('freqOverride', 'Exact frequency', 0, 0, 20000, 0.1, 'Hz', 'If above 0, plays exactly this frequency and ignores the note settings. 0 = off.'),
    N('a4', 'Concert pitch (A4)', 440, 400, 480, 0.5, 'Hz', 'The reference tuning. 440 is the modern standard; 432 or 415 are sometimes used for a different feel.'),
    N('glide', 'Glide (portamento)', 0, 0, 5000, 5, 'ms', 'Slides from the previous pitch to the new one instead of jumping. 0 = no glide.'),
    N('pitchEnvAmount', 'Pitch envelope amount', 0, -2400, 2400, 10, 'cents', 'Pitch swoops at the start of every note: positive starts high and falls (a kick drum or laser), negative starts low and rises.'),
    N('pitchEnvTime', 'Pitch envelope time', 0.1, 0.005, 5, 0.005, 's', 'How long the start-of-note pitch swoop takes.'),
    N('pitchDrift', 'Random pitch drift', 0, 0, 100, 1, 'cents', 'A little random wander of pitch each time the note starts, like a real instrument that is never exactly the same twice.')
  ] },
  { id: 'dynamics', label: 'Dynamics / Amplitude', desc: 'How loud the note is. Musicians write loudness as dynamic marks from pppp (almost silent) to ffff (maximum).', fields: [
    E('dynamic', 'Dynamic mark', 'mf', DYN_OPTS, 'The loudness in musical terms: p = piano = soft, f = forte = loud, m = mezzo = medium, doubled letters = more extreme. Default mf = moderately loud.'),
    N('gainDb', 'Extra gain', 0, -48, 12, 0.5, 'dB', 'A free volume trim on top of the dynamic mark. Every 6 dB doubles or halves the amplitude; 0 = no change.'),
    N('velocity', 'Velocity', 1, 0, 1, 0.01, '', 'How hard the note is "struck", scaling loudness (and a little brightness) as a piano key would.'),
    N('humanizeDb', 'Humanize loudness', 0, 0, 12, 0.5, 'dB', 'Random loudness variation on every new note or repeat, so repeats do not sound mechanical.'),
    N('accentEvery', 'Accent every N repeats', 0, 0, 32, 1, '', 'Every Nth repeat gets louder (a downbeat). 0 = no accents.'),
    N('accentDb', 'Accent boost', 6, 0, 24, 0.5, 'dB', 'How much louder the accented repeats are.'),
    N('fadeIn', 'Fade in', 0, 0, 30, 0.05, 's', 'A slow overall fade-in when the sound starts (on top of the attack).'),
    N('fadeOut', 'Fade out', 0, 0, 30, 0.05, 's', 'A slow overall fade-out when the sound is stopped (on top of the release).'),
    B('muted', 'Muted', false, 'Keeps the sound running (so particles and viewers still react) but makes it silent.')
  ] },
  { id: 'envelope', label: 'Envelope (ADSR)', desc: 'The loudness shape of one note over time: Attack (fade in), Decay (settle down), Sustain (held level), Release (fade out after you let go).', fields: [
    N('attack', 'Attack', 0.02, 0, 10, 0.001, 's', 'Time to rise from silence to full loudness. Short = percussive click, long = slow swell.'),
    N('hold', 'Hold', 0, 0, 10, 0.01, 's', 'Time to stay at full loudness before the decay starts (0 = classic ADSR).'),
    N('decay', 'Decay', 0.2, 0, 10, 0.005, 's', 'Time to fall from full loudness to the sustain level.'),
    N('sustainLevel', 'Sustain level', 0.7, 0, 1, 0.01, '', 'The loudness held while the note continues (fraction of the peak). 0 = the note dies away by itself like a pluck.'),
    N('release', 'Release', 0.4, 0, 20, 0.01, 's', 'Time to fade to silence after the note ends or is stopped.'),
    E('attackCurve', 'Attack curve', 'linear', CURVES, 'The shape of the rise during attack.'),
    E('decayCurve', 'Decay curve', 'exponential', CURVES, 'The shape of the fall during decay.'),
    E('releaseCurve', 'Release curve', 'exponential', CURVES, 'The shape of the fade during release. Exponential sounds the most natural.'),
    N('envTimeScale', 'Envelope speed', 1, 0.1, 10, 0.1, 'x', 'Stretches all envelope times at once: 2 = twice as long, 0.5 = twice as fast.'),
    N('envVelocityTime', 'Velocity shortens attack', 0, 0, 1, 0.05, '', 'Harder notes (higher velocity) get a quicker attack, as on real instruments.')
  ] },
  { id: 'sustain', label: 'Sustain', desc: 'How the note is held. A SUSTAINED sound keeps playing until you stop it; otherwise it plays for a set length.', fields: [
    B('sustained', 'Sustained (hold until stopped)', false, 'On: the note holds at its sustain level indefinitely until Stop is pressed, then fades by the release time. Off: the note plays for the length below and ends by itself.'),
    N('duration', 'Note length', 1.5, 0.02, 120, 0.01, 's', 'How long one note lasts before its release starts (ignored when Sustained is on).'),
    N('sustainDecayDb', 'Sustain fade-away', 0, 0, 24, 0.5, 'dB/s', 'While held, the level slowly sinks by this many dB per second (a piano string). 0 = holds perfectly steady.'),
    N('sustainDrift', 'Sustain level drift', 0, 0, 1, 0.01, '', 'A slow random swell and fade of the held level, so a drone feels alive. 0 = none.'),
    N('sustainDriftRate', 'Drift speed', 0.3, 0.02, 4, 0.02, 'Hz', 'How quickly the sustain drift wanders.'),
    N('sustainBrightDrift', 'Brightness drift', 0, 0, 1, 0.01, '', 'A slow random opening and closing of the filter while held (needs the filter enabled).')
  ] },
  { id: 'modulation', label: 'Vibrato / Tremolo', desc: 'Vibrato wobbles the PITCH; tremolo wobbles the LOUDNESS. Both are driven by a slow wave called an LFO (low frequency oscillator).', fields: [
    N('vibratoRate', 'Vibrato speed', 5, 0, 20, 0.1, 'Hz', 'How many pitch wobbles per second. About 5 to 7 is a human singer.'),
    N('vibratoDepth', 'Vibrato depth', 0, 0, 1200, 1, 'cents', 'How far the pitch wobbles up and down. 0 = off, 20 to 40 = natural, 100 = one semitone.'),
    N('vibratoDelay', 'Vibrato delay', 0, 0, 10, 0.05, 's', 'Wait this long after the note starts before the vibrato begins.'),
    N('vibratoFade', 'Vibrato fade in', 0.3, 0, 10, 0.05, 's', 'How slowly the vibrato grows to full depth once it starts.'),
    E('vibratoShape', 'Vibrato wave', 'sine', LFO_SHAPES, 'The shape of the pitch wobble.'),
    N('tremoloRate', 'Tremolo speed', 6, 0, 40, 0.1, 'Hz', 'How many loudness wobbles per second.'),
    N('tremoloDepth', 'Tremolo depth', 0, 0, 1, 0.01, '', 'How deep the loudness wobble is. 0 = off, 1 = the sound fully drops to silence between pulses.'),
    N('tremoloDelay', 'Tremolo delay', 0, 0, 10, 0.05, 's', 'Wait this long after the note starts before the tremolo begins.'),
    N('tremoloFade', 'Tremolo fade in', 0, 0, 10, 0.05, 's', 'How slowly the tremolo grows to full depth.'),
    E('tremoloShape', 'Tremolo wave', 'sine', LFO_SHAPES, 'The shape of the loudness wobble. Square gives a choppy on/off gate.'),
    N('tremoloPhase', 'Tremolo start phase', 0, 0, 360, 1, 'deg', 'Where in its cycle the tremolo starts.'),
    N('lfoDrift', 'LFO speed drift', 0, 0, 1, 0.01, '', 'Makes vibrato and tremolo speeds waver slightly, like a human.')
  ] },
  { id: 'time', label: 'Time & Playback', desc: 'Looping and iterative play: how the sound repeats, and how each repeat can change.', fields: [
    N('startDelay', 'Start delay', 0, 0, 60, 0.05, 's', 'Wait before the very first note after Play.'),
    B('loop', 'Loop', false, 'Repeat the whole sound again and again.'),
    N('loopCount', 'Loop count', 0, 0, 9999, 1, '', 'How many times to loop. 0 = loop forever.'),
    N('loopGap', 'Gap between loops', 0, 0, 60, 0.01, 's', 'Silence between one loop and the next.'),
    B('iterative', 'Iterative play (repeats)', false, 'Play the note several times in a row on its own, each repeat can change pitch and volume (arpeggios, ladders, echoes, rain drops).'),
    N('iterations', 'Repeats', 4, 1, 999, 1, '', 'How many times the note is played in iterative mode.'),
    B('iterInfinite', 'Repeat forever', false, 'Iterative mode never ends (until Stop).'),
    E('intervalUnit', 'Interval unit', 'ms', [['ms', 'Milliseconds'], ['beat', 'Beats (uses tempo)']], 'Measure the time between repeats in milliseconds or in musical beats.'),
    N('interval', 'Interval', 400, 20, 60000, 10, 'ms', 'Time from the start of one repeat to the start of the next.'),
    N('intervalBeats', 'Interval in beats', 1, 0.0625, 16, 0.0625, 'beats', 'The same, in beats (1 = quarter note, 0.5 = eighth note).'),
    N('tempo', 'Tempo', 120, 20, 300, 1, 'bpm', 'Beats per minute, used when the interval is in beats.'),
    N('intervalJitter', 'Interval jitter', 0, 0, 1, 0.01, '', 'Randomness of the time between repeats (0.2 = up to 20 percent earlier or later). Makes rhythms feel human or like falling rain.'),
    N('swing', 'Swing', 0, 0, 0.9, 0.01, '', 'Delays every second repeat for a lilting, shuffled rhythm.'),
    N('iterPitchStep', 'Pitch step per repeat', 0, -24, 24, 0.5, 'semi', 'Each repeat is this many semitones higher (or lower) than the one before: a rising ladder or a falling cascade.'),
    E('iterPattern', 'Pitch pattern', 'ladder', [['ladder', 'Ladder (keeps climbing)'], ['updown', 'Up and down (arpeggio)'], ['down', 'Falling'], ['random', 'Random pitch'], ['cycle', 'Cycle back to start']], 'How the pitch steps behave across repeats.'),
    N('iterPatternLength', 'Pattern length', 8, 2, 64, 1, '', 'How many steps before up-and-down or cycle patterns turn around or restart.'),
    N('iterGainStep', 'Volume step per repeat', 0, -12, 12, 0.5, 'dB', 'Each repeat is this much louder (or quieter) than the last: negative = echo fading away.'),
    N('iterFilterStep', 'Brightness step per repeat', 0, -2, 2, 0.05, 'oct', 'Each repeat opens (positive) or closes (negative) the filter by this many octaves.'),
    N('iterPanSpread', 'Pan spread per repeat', 0, 0, 1, 0.01, '', 'Places repeats at alternating left and right positions.'),
    N('iterNoteLength', 'Repeat note length', 0, 0, 10, 0.01, 's', 'Length of each repeated note. 0 = use the main note length.'),
    E('retrigger', 'Retrigger mode', 'retrigger', [['retrigger', 'Retrigger (every repeat restarts the envelope)'], ['legato', 'Legato (notes glide on, envelope not restarted)']], 'Whether each repeat starts a fresh note or slides smoothly from the previous one.'),
    N('playbackRate', 'Playback rate', 1, 0.1, 4, 0.01, 'x', 'For samples: speed (and pitch) of playback. 2 = twice as fast and an octave higher.'),
    N('startOffset', 'Sample start offset', 0, 0, 600, 0.01, 's', 'For samples: start playing this many seconds into the recording.'),
    B('reverse', 'Reverse', false, 'For samples: play the recording backwards.'),
    N('maxPlayTime', 'Safety stop', 0, 0, 3600, 1, 's', 'Always stop the sound after this many seconds. 0 = never.')
  ] },
  { id: 'crescendo', label: 'Crescendo / Decrescendo', desc: 'A gradual change of loudness over time: crescendo = getting louder, decrescendo (diminuendo) = getting softer.', fields: [
    B('crescendoEnabled', 'Crescendo / decrescendo', false, 'Turn on a gradual loudness change from one dynamic to another.'),
    E('crescendoFrom', 'From dynamic', 'pp', DYN_OPTS, 'The loudness to start at.'),
    E('crescendoTo', 'To dynamic', 'ff', DYN_OPTS, 'The loudness to arrive at. Higher than From = crescendo, lower = decrescendo.'),
    N('crescendoTime', 'Over', 8, 0.1, 600, 0.1, 's', 'How many seconds the change takes.'),
    E('crescendoCurve', 'Curve', 'linear', CURVES, 'The shape of the change.'),
    N('crescendoDelay', 'Delay', 0, 0, 120, 0.1, 's', 'Wait before the change begins (holds the From level).'),
    E('crescendoRepeat', 'When it arrives', 'hold', [['hold', 'Stay at the end level'], ['loop', 'Start over'], ['pingpong', 'Go back and forth (swell)']], 'What happens after the change completes.'),
    N('crescendoBrightness', 'Opens the filter too', 0, 0, 1, 0.01, '', 'Louder usually also means brighter. This opens the filter as the sound gets louder (needs the filter enabled). 0 = loudness only.'),
    N('crescendoPitch', 'Rising pitch', 0, -1200, 1200, 5, 'cents', 'Pitch change along the crescendo (a rising siren or sinking drone).')
  ] },
  { id: 'filter', label: 'Filter', desc: 'A filter removes or boosts part of the pitch range: lowpass = dull (keeps lows), highpass = thin (keeps highs), bandpass = only a slice.', fields: [
    B('filterEnabled', 'Filter on', false, 'Use the filter.'),
    E('filterType', 'Filter type', 'lowpass', [['lowpass', 'Lowpass (cut highs, darker)'], ['highpass', 'Highpass (cut lows, thinner)'], ['bandpass', 'Bandpass (only a middle slice)'], ['notch', 'Notch (cut a narrow slice)'], ['peaking', 'Peaking (boost / cut a slice)'], ['lowshelf', 'Low shelf (boost / cut bass)'], ['highshelf', 'High shelf (boost / cut treble)'], ['allpass', 'Allpass (phase only)']], 'What the filter does to the sound.'),
    N('filterCutoff', 'Cutoff frequency', 2000, 20, 20000, 1, 'Hz', 'The pitch where the filter starts working. For a lowpass, everything above this gets quieter.'),
    N('filterQ', 'Resonance (Q)', 1, 0.1, 30, 0.1, '', 'Emphasis right at the cutoff. Low = smooth, high = ringing, whistling.'),
    N('filterGainDb', 'Boost / cut', 0, -24, 24, 0.5, 'dB', 'For peaking and shelf types: how much to boost or cut.'),
    E('filterSlope', 'Slope', '12', [['12', 'Gentle (12 dB per octave)'], ['24', 'Steep (24 dB per octave)']], 'Steepness of the cut. Steep uses two filters in a row.'),
    N('filterKeyTrack', 'Follow the note', 0, 0, 1, 0.01, '', 'Moves the cutoff with the note pitch, so high notes are as bright as low ones. 1 = fully follows.'),
    N('filterEnvAmount', 'Filter envelope amount', 0, -8, 8, 0.1, 'oct', 'The cutoff sweeps by this many octaves at the start of each note then settles (the classic "wow" of synth basses).'),
    N('filterEnvAttack', 'Filter env attack', 0.01, 0, 10, 0.005, 's', 'Time for the cutoff to reach the sweep peak.'),
    N('filterEnvDecay', 'Filter env decay', 0.3, 0, 10, 0.005, 's', 'Time for the cutoff to settle back after the peak.'),
    N('filterEnvSustain', 'Filter env sustain', 0, 0, 1, 0.01, '', 'How much of the sweep stays while the note is held.'),
    N('filterEnvRelease', 'Filter env release', 0.3, 0, 10, 0.005, 's', 'Time for the cutoff to return when the note ends.'),
    N('filterLfoRate', 'Filter wobble speed', 2, 0, 30, 0.01, 'Hz', 'Speed of an automatic slow cutoff wobble ("wah-wah").'),
    N('filterLfoDepth', 'Filter wobble depth', 0, 0, 6, 0.05, 'oct', 'How far the wobble moves the cutoff. 0 = no wobble.'),
    E('filterLfoShape', 'Filter wobble wave', 'sine', LFO_SHAPES, 'The wave shape of the cutoff wobble.')
  ] },
  { id: 'fx', label: 'Effects (FX)', desc: 'Effects change the sound after it is made: space (reverb, delay), colour (distortion, EQ), thickness (chorus), and control (compressor).', fields: [
    B('reverbEnabled', 'Reverb on', false, 'Adds the sound of a room or hall around the note.'),
    N('reverbMix', 'Reverb dry/wet', 0.3, 0, 1, 0.01, '', 'Balance between the original (dry, 0) and the reverb only (wet, 1).'),
    N('reverbDecay', 'Reverb decay', 2.5, 0.1, 12, 0.1, 's', 'How long the echoes of the room take to die away: 0.5 s = small room, 3 s = hall, 8 s = cathedral.'),
    N('reverbSize', 'Reverb room size', 0.5, 0, 1, 0.01, '', 'How big the room feels (spacing of the early reflections).'),
    N('reverbPreDelay', 'Reverb pre-delay', 0, 0, 200, 1, 'ms', 'A small gap before the reverb starts, keeping the dry note clear.'),
    N('reverbDamping', 'Reverb damping', 0.4, 0, 1, 0.01, '', 'How quickly high tones fade in the reverb tail. High = warm and dark, low = bright and shiny.'),
    B('delayEnabled', 'Delay (echo) on', false, 'Adds repeating echoes.'),
    N('delayTime', 'Delay time', 350, 5, 2000, 5, 'ms', 'Time between echoes.'),
    N('delayFeedback', 'Delay feedback', 0.35, 0, 0.95, 0.01, '', 'How many echoes: 0 = one echo, 0.5 = several, 0.9 = nearly endless.'),
    N('delayMix', 'Delay mix', 0.3, 0, 1, 0.01, '', 'How loud the echoes are against the original.'),
    N('delayTone', 'Delay tone', 5000, 200, 20000, 50, 'Hz', 'Echoes get darker each repeat above this frequency, like tape or a cave.'),
    B('delayPingPong', 'Ping-pong', false, 'Echoes bounce between left and right.'),
    B('distortionEnabled', 'Distortion on', false, 'Adds crunch by clipping the wave.'),
    N('distortionAmount', 'Distortion amount', 0.4, 0, 1, 0.01, '', 'How hard the sound is pushed. Low = warm saturation, high = fuzz.'),
    E('distortionType', 'Distortion type', 'soft', [['soft', 'Soft clip (warm, tube-like)'], ['hard', 'Hard clip (harsh)'], ['fold', 'Wave fold (metallic)'], ['tube', 'Tube (asymmetric, even harmonics)']], 'The character of the distortion.'),
    N('distortionMix', 'Distortion mix', 1, 0, 1, 0.01, '', 'Blend of distorted and clean sound.'),
    N('distortionTone', 'Distortion tone', 8000, 500, 20000, 50, 'Hz', 'A lowpass after the distortion to tame fizz.'),
    B('modFxEnabled', 'Chorus / flanger on', false, 'Thickens the sound by mixing in slightly detuned, moving copies.'),
    E('modFxType', 'Chorus or flanger', 'chorus', [['chorus', 'Chorus (lush, thick)'], ['flanger', 'Flanger (jet swoosh)']], 'Chorus uses a longer delay and sounds like several players; flanger uses a very short delay and sweeps like a jet plane.'),
    N('modFxRate', 'Rate', 0.8, 0.05, 10, 0.05, 'Hz', 'Speed of the sweep.'),
    N('modFxDepth', 'Depth', 0.5, 0, 1, 0.01, '', 'Width of the sweep.'),
    N('modFxMix', 'Mix', 0.5, 0, 1, 0.01, '', 'How much of the moving copy is mixed in.'),
    N('modFxFeedback', 'Feedback', 0.2, 0, 0.9, 0.01, '', 'Feeds the effect into itself for a more intense, ringing sweep (mostly flanger).'),
    B('bitcrushEnabled', 'Bitcrush on', false, 'Lo-fi digital crunch by using fewer loudness steps.'),
    N('bitcrushBits', 'Bit depth', 8, 1, 16, 1, 'bits', 'Fewer bits = coarser, noisier, more retro. 16 = clean.'),
    N('bitcrushMix', 'Bitcrush mix', 1, 0, 1, 0.01, '', 'Blend of crushed and clean sound.'),
    B('eqEnabled', 'EQ on', false, 'A 3-band tone control: bass, middle, treble.'),
    N('eqLowDb', 'EQ low', 0, -18, 18, 0.5, 'dB', 'Boost or cut the bass.'),
    N('eqLowFreq', 'EQ low corner', 200, 40, 800, 5, 'Hz', 'Where the bass control starts.'),
    N('eqMidDb', 'EQ mid', 0, -18, 18, 0.5, 'dB', 'Boost or cut the middle.'),
    N('eqMidFreq', 'EQ mid centre', 1000, 200, 5000, 10, 'Hz', 'The middle of the mid control.'),
    N('eqMidQ', 'EQ mid width (Q)', 1, 0.2, 10, 0.1, '', 'How narrow the mid control is. High = a narrow slice.'),
    N('eqHighDb', 'EQ high', 0, -18, 18, 0.5, 'dB', 'Boost or cut the treble.'),
    N('eqHighFreq', 'EQ high corner', 4000, 1000, 16000, 50, 'Hz', 'Where the treble control starts.'),
    B('compEnabled', 'Compressor on', false, 'Evens out loudness by turning down the loudest parts.'),
    N('compThreshold', 'Compressor threshold', -24, -60, 0, 1, 'dB', 'Sounds louder than this level get turned down.'),
    N('compRatio', 'Compressor ratio', 4, 1, 20, 0.5, ':1', 'How strongly loud parts are turned down. 4:1 = gentle, 20:1 = nearly a hard limit.'),
    N('compAttack', 'Compressor attack', 0.01, 0, 1, 0.001, 's', 'How fast the compressor reacts.'),
    N('compRelease', 'Compressor release', 0.25, 0.01, 2, 0.01, 's', 'How fast it lets go.'),
    N('compKnee', 'Compressor knee', 12, 0, 40, 1, 'dB', 'Softness of the start of compression.'),
    N('compMakeup', 'Compressor make-up gain', 0, 0, 24, 0.5, 'dB', 'Brings the volume back up after compressing.'),
    N('stereoWidth', 'Stereo width', 1, 0, 2, 0.01, '', '0 = mono, 1 = as is, 2 = extra wide.')
  ] },
  { id: 'spatial', label: 'Spatial', desc: 'Where the sound seems to be in the 3D world. Positional sound gets quieter with distance and pans as you turn.', fields: [
    B('positional', 'Positional (3D)', false, 'On: the sound comes from the node position, so it is louder when you are near and moves left/right as you turn. Off: plays flat in your head.'),
    E('distanceModel', 'Distance model', 'inverse', [['linear', 'Linear'], ['inverse', 'Inverse (natural)'], ['exponential', 'Exponential']], 'How loudness drops with distance.'),
    N('refDistance', 'Full-volume distance', 4, 0.1, 200, 0.1, 'm', 'Within this distance the sound is at full loudness.'),
    N('maxDistance', 'Max distance', 120, 1, 2000, 1, 'm', 'Beyond this distance the sound stops getting quieter (linear model: silent).'),
    N('rolloff', 'Rolloff', 1, 0, 10, 0.05, '', 'How quickly the sound fades with distance. Higher = fades faster.'),
    E('panningModel', 'Panning model', 'equalpower', [['equalpower', 'Simple (speakers)'], ['HRTF', 'HRTF (headphones, 3D)']], 'How left/right/behind is simulated. HRTF is best on headphones.'),
    N('coneInner', 'Cone inner angle', 360, 0, 360, 1, 'deg', 'Inside this angle in front of the node the sound is at full volume. 360 = same in all directions.'),
    N('coneOuter', 'Cone outer angle', 360, 0, 360, 1, 'deg', 'Outside this angle the sound is turned down to the outer gain.'),
    N('coneOuterGain', 'Cone outer gain', 0.2, 0, 1, 0.01, '', 'Volume behind the cone.'),
    N('coneAzimuth', 'Cone direction (turn)', 0, -180, 180, 1, 'deg', 'Which way the cone points around the vertical axis.'),
    N('coneElevation', 'Cone direction (tilt)', 0, -90, 90, 1, 'deg', 'Which way the cone points up or down.'),
    N('pan', 'Pan', 0, -1, 1, 0.01, '', 'Left (-1) to right (+1), used when not positional.'),
    N('panLfoRate', 'Auto-pan speed', 0.5, 0.02, 10, 0.02, 'Hz', 'Speed of an automatic left-right sweep.'),
    N('panLfoDepth', 'Auto-pan depth', 0, 0, 1, 0.01, '', 'Width of the auto sweep. 0 = off.'),
    B('doppler', 'Doppler', false, 'Pitch bends as the node moves past you (like a passing siren).'),
    E('occlusion', 'Distance muffling', 'none', [['none', 'None'], ['air', 'Air absorption (far = duller)']], 'Far sounds lose their treble as in real air.')
  ] },
  { id: 'triggers', label: 'Triggers', desc: 'When the sound starts and stops by itself.', fields: [
    E('autoStart', 'Auto start', 'manual', [['manual', 'Manual (Play button)'], ['scene-load', 'When the scene loads'], ['proximity', 'When you come near'], ['click', 'When the node is clicked']], 'What makes the sound start.'),
    N('proximityRadius', 'Proximity radius', 12, 0.5, 500, 0.5, 'm', 'Distance at which proximity start triggers.'),
    B('proximityStop', 'Stop when you leave', true, 'In proximity mode, stop when you move away.'),
    E('triggerEvent', 'Also start on', 'none', [['none', 'Nothing'], ['selected', 'Node selected'], ['connected', 'Node gets connected']], 'Extra node events that start the sound.'),
    E('triggerStop', 'Stop on', 'none', [['none', 'Nothing'], ['deselected', 'Node deselected']], 'Events that stop the sound.'),
    N('cooldown', 'Cooldown', 0, 0, 60, 0.1, 's', 'Minimum seconds between two automatic starts.'),
    B('clickToggle', 'Click toggles', true, 'In click mode, a second click stops the sound.')
  ] },
  { id: 'analysis', label: 'Analysis', desc: 'How the sound is measured for the viewers, the node reaction and the particles.', fields: [
    B('analysisEnabled', 'Analyse this sound', true, 'Measure the frequencies (needed for particles and viewers). Turn off to save a little power.'),
    E('fftSize', 'FFT size', '2048', [['256', '256 (fast, coarse)'], ['512', '512'], ['1024', '1024'], ['2048', '2048 (balanced)'], ['4096', '4096 (fine detail, slower)']], 'Number of samples per analysis. Bigger = finer frequency detail.'),
    N('smoothing', 'FFT smoothing', 0.8, 0, 0.99, 0.01, '', 'Averages the spectrum over time. High = calm, low = twitchy.'),
    N('minDb', 'Minimum dB', -100, -140, -30, 1, 'dB', 'The level shown as zero in the spectrum.'),
    N('maxDb', 'Maximum dB', -20, -60, 0, 1, 'dB', 'The level shown as full in the spectrum.'),
    N('bandSmoothing', 'Band smoothing', 0.6, 0, 0.99, 0.01, '', 'Extra smoothing of the 7 band values.'),
    N('bandGain', 'Band gain', 1, 0.1, 8, 0.05, 'x', 'Boosts the band values for quiet sounds.'),
    N('peakThreshold', 'Peak threshold', 0.02, 0, 1, 0.005, '', 'Below this level no peak pitch is reported.')
  ] },
  { id: 'meta', label: 'Meta', desc: 'Name and bookkeeping.', fields: [
    B('enabled', 'Sound enabled', true, 'Whether this node makes sound at all.'),
    T('label', 'Sound name', 'Sound', 60, 'A name for this sound.'),
    T('tags', 'Tags', '', 120, 'Comma separated words to find it again.'),
    C('color', 'Colour', '#66ccff', 'A colour used by viewers and the node glow.'),
    T('notes', 'Notes', '', 400, 'Your own notes about this sound.'),
    T('presetId', 'Preset', '', 40, 'The preset this was started from.'),
    N('version', 'Model version', 1, 1, 99, 1, '', 'Internal version of the settings layout.')
  ] }
]

export const SOUND_FIELDS = SOUND_SCHEMA.flatMap(g => g.fields)
const FIELD_BY_KEY = new Map(SOUND_FIELDS.map(f => [f.key, f]))
export const getSoundField = (key) => FIELD_BY_KEY.get(key) || null

export const SOUND_LIMITS = { fieldCount: SOUND_FIELDS.length, groupCount: SOUND_SCHEMA.length, maxVoicesCap: 32, defaultVoices: 8, maxTextLength: 4096, maxPresets: 64 }

const cleanText = (s, max) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, Math.max(0, max | 0))

function sanitizeField (f, v) {
  switch (f.type) {
    case 'number': {
      let n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
      if (!Number.isFinite(n)) n = f.default
      n = Math.min(f.max, Math.max(f.min, n))
      if (f.step > 0) { const dec = Math.min(6, (String(f.step).split('.')[1] || '').length); n = Number((f.min + Math.round((n - f.min) / f.step) * f.step).toFixed(dec)) }
      return Math.min(f.max, Math.max(f.min, n))
    }
    case 'bool':
      if (typeof v === 'boolean') return v
      if (v === 1 || v === 'true' || v === '1') return true
      if (v === 0 || v === 'false' || v === '0') return false
      return f.default
    case 'enum': {
      const s = typeof v === 'string' || typeof v === 'number' ? String(v) : null
      return s !== null && f.options.some(o => o.value === s) ? s : f.default
    }
    case 'note': { const p = typeof v === 'string' ? parseNote(v) : null; return p ? p.name : f.default }
    case 'color': {
      const s = typeof v === 'string' ? v.trim() : ''
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
      if (/^#[0-9a-fA-F]{3}$/.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase()
      return f.default
    }
    case 'text': return typeof v === 'string' || typeof v === 'number' ? cleanText(v, f.max) : f.default
    default: return f.default
  }
}

export function defaultSound () { const o = {}; for (const f of SOUND_FIELDS) o[f.key] = f.default; return o }

/** Complete valid `sound` object from anything. Never throws. Unknown keys (and __proto__ / constructor) are dropped. */
export function sanitizeSound (raw) {
  const out = {}
  let src = null
  try { if (raw && typeof raw === 'object') src = raw } catch (_) { src = null }
  for (const f of SOUND_FIELDS) {
    let v
    try { v = src && Object.prototype.hasOwnProperty.call(src, f.key) ? src[f.key] : undefined } catch (_) { v = undefined }
    out[f.key] = v === undefined ? f.default : sanitizeField(f, v)
  }
  if (out.minDb >= out.maxDb) { out.minDb = -100; out.maxDb = -20 }
  return out
}

/** merge a partial over a base (default if omitted) and sanitize. */
export function mergeSound (partial, base = null) { return sanitizeSound({ ...(base ? sanitizeSound(base) : defaultSound()), ...(partial && typeof partial === 'object' ? partial : {}) }) }
/** names of the keys that differ between two sanitized sounds. */
export function diffSound (a, b) { const out = []; for (const f of SOUND_FIELDS) if (a?.[f.key] !== b?.[f.key]) out.push(f.key); return out }

/** the frequency in Hz that a sound plays (before glide / vibrato / iteration steps). */
export function soundFrequency (s) {
  const x = s && typeof s === 'object' && 'note' in s ? s : sanitizeSound(s)
  if (x.freqOverride > 0) return x.freqOverride
  const base = x.useMidi ? x.midi : (parseNote(x.note)?.midi ?? 69)
  return midiToFreq(base + x.octaveShift * 12 + x.transpose + x.fineTune / 100, x.a4)
}
/** the total linear peak gain from dynamic mark + gain dB + velocity. */
export function soundPeakGain (s) { const x = sanitizeSound(s); return dynamicToGain(x.dynamic) * dbToGain(x.gainDb) * (0.4 + 0.6 * x.velocity) }

const P = (label, settings) => ({ label, settings })
export const SOUND_PRESETS = {
  sinePad: P('Pure sine pad', { sourceType: 'oscillator', waveform: 'sine', attack: 1.2, decay: 0.8, sustainLevel: 0.8, release: 2, sustained: true, unisonVoices: 3, unisonDetune: 8, reverbEnabled: true, reverbMix: 0.4, reverbDecay: 4, dynamic: 'mp' }),
  pluck: P('Pluck', { waveform: 'triangle', attack: 0.003, decay: 0.35, sustainLevel: 0, release: 0.2, duration: 0.4, filterEnabled: true, filterType: 'lowpass', filterCutoff: 1800, filterEnvAmount: 3, filterEnvDecay: 0.25, dynamic: 'f', reverbEnabled: true, reverbMix: 0.15, reverbDecay: 1.2 }),
  bell: P('Bell', { sourceType: 'fm', fmRatio: 3.5, fmDepth: 4, fmDecay: 1.5, attack: 0.002, decay: 2.5, sustainLevel: 0, release: 1.5, duration: 3, note: 'C5', reverbEnabled: true, reverbMix: 0.35, reverbDecay: 4, dynamic: 'mf' }),
  organ: P('Organ', { sourceType: 'additive', additiveHarmonics: 6, additiveRolloff: 0.6, additiveOddOnly: false, attack: 0.01, decay: 0.05, sustainLevel: 1, release: 0.08, sustained: true, vibratoDepth: 12, vibratoRate: 6, vibratoDelay: 0.3, modFxEnabled: true, modFxType: 'chorus', modFxMix: 0.35, note: 'C3' }),
  kick: P('Kick drum', { waveform: 'sine', note: 'C2', pitchEnvAmount: 1800, pitchEnvTime: 0.09, attack: 0.001, decay: 0.3, sustainLevel: 0, release: 0.1, duration: 0.3, dynamic: 'ff', compEnabled: true, distortionEnabled: true, distortionAmount: 0.2 }),
  snare: P('Snare burst', { sourceType: 'noise', noiseType: 'white', attack: 0.001, decay: 0.18, sustainLevel: 0, release: 0.08, duration: 0.2, filterEnabled: true, filterType: 'bandpass', filterCutoff: 2400, filterQ: 0.8, dynamic: 'f', reverbEnabled: true, reverbMix: 0.2, reverbDecay: 0.8 }),
  bass: P('Bass', { waveform: 'sawtooth', note: 'E1', attack: 0.005, decay: 0.2, sustainLevel: 0.6, release: 0.15, duration: 0.8, filterEnabled: true, filterCutoff: 500, filterQ: 3, filterEnvAmount: 2, filterEnvDecay: 0.2, subEnabled: true, subLevel: 0.6, dynamic: 'f' }),
  siren: P('Siren', { waveform: 'sawtooth', sustained: true, attack: 0.1, sustainLevel: 0.8, note: 'A4', vibratoRate: 0.4, vibratoDepth: 600, vibratoShape: 'triangle', vibratoFade: 0, filterEnabled: true, filterCutoff: 3000, positional: true, doppler: true, dynamic: 'mf' }),
  wind: P('Wind', { sourceType: 'noise', noiseType: 'pink', sustained: true, attack: 2, sustainLevel: 0.8, release: 3, filterEnabled: true, filterType: 'bandpass', filterCutoff: 700, filterQ: 2, filterLfoRate: 0.15, filterLfoDepth: 1.2, sustainDrift: 0.4, tremoloDepth: 0.2, tremoloRate: 0.3, reverbEnabled: true, reverbMix: 0.35, dynamic: 'p' }),
  drone: P('Drone', { waveform: 'sawtooth', note: 'D2', sustained: true, attack: 3, sustainLevel: 0.9, release: 4, unisonVoices: 5, unisonDetune: 18, filterEnabled: true, filterCutoff: 700, filterLfoRate: 0.07, filterLfoDepth: 0.8, sustainDrift: 0.3, subEnabled: true, reverbEnabled: true, reverbMix: 0.5, reverbDecay: 6, dynamic: 'mp' }),
  arp: P('Arpeggio', { waveform: 'square', pulseWidth: 0.35, note: 'C4', attack: 0.004, decay: 0.12, sustainLevel: 0.1, release: 0.1, duration: 0.15, iterative: true, iterations: 8, interval: 180, iterPitchStep: 4, iterPattern: 'updown', iterPatternLength: 4, delayEnabled: true, delayTime: 270, delayFeedback: 0.3, dynamic: 'mf' }),
  swell: P('Swell (crescendo)', { sourceType: 'additive', additiveHarmonics: 10, additiveRolloff: 1.1, sustained: true, attack: 0.5, release: 3, crescendoEnabled: true, crescendoFrom: 'pp', crescendoTo: 'fff', crescendoTime: 10, crescendoCurve: 'exponential', crescendoBrightness: 0.7, filterEnabled: true, filterCutoff: 600, reverbEnabled: true, reverbMix: 0.4, note: 'F3' }),
  rain: P('Rain drops', { waveform: 'sine', note: 'E6', attack: 0.001, decay: 0.08, sustainLevel: 0, release: 0.05, duration: 0.08, iterative: true, iterInfinite: true, interval: 140, intervalJitter: 0.9, iterPitchStep: 2, iterPattern: 'random', iterPatternLength: 12, iterGainStep: -1, humanizeDb: 6, iterPanSpread: 0.8, reverbEnabled: true, reverbMix: 0.5, dynamic: 'p' }),
  heartbeat: P('Heartbeat', { waveform: 'sine', note: 'A1', pitchEnvAmount: 600, pitchEnvTime: 0.06, attack: 0.005, decay: 0.2, sustainLevel: 0, release: 0.1, duration: 0.2, loop: true, loopCount: 0, iterative: true, iterations: 2, interval: 220, iterGainStep: -4, loopGap: 0.6, dynamic: 'f' }),
  robot: P('Robot voice', { sourceType: 'fm', fmRatio: 1.5, fmDepth: 6, fmDecay: 0, sustained: true, tremoloDepth: 0.6, tremoloRate: 30, tremoloShape: 'square', bitcrushEnabled: true, bitcrushBits: 5, note: 'G3', dynamic: 'mf' })
}
for (const id of Object.keys(SOUND_PRESETS)) SOUND_PRESETS[id].settings.presetId = id

/** a ready sound for a preset id (default sound if unknown). */
export function soundFromPreset (id) { const p = Object.prototype.hasOwnProperty.call(SOUND_PRESETS, id) ? SOUND_PRESETS[id] : null; return mergeSound(p ? p.settings : {}) }

export default { SOUND_SCHEMA, defaultSound, sanitizeSound, SOUND_PRESETS, DYNAMICS, dynamicToGain, noteToFreq, freqToNote, midiToFreq, NOTE_NAMES }
