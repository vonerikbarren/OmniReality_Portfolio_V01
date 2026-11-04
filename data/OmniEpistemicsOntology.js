/**
 * data/OmniEpistemicsOntology.js (V271) — the canonical vocabulary of OmniEpistemics (the engine inside is "OmniDynamix").
 * Pure data, no imports. The model (utils/OmniEpistemicsModel.js) is built from this; data/OmniEpistemicsOntology.json is a generated copy (a test checks they agree).
 *
 * PRINCIPLE  Reality does not arrive; it is passed down. Every layer is a lossy copy of the one before it, and each copy adds its own distortion. Nothing here decides what is true:
 *            a node only says how it was made, what it kept, what it lost and what pushes on it. Certainty is DERIVED (from the layer's evidence, or from a linked claim), never typed.
 * SHAPE      Spheres are things that are alike in kind (events, observations, memories, rumours, gossip, what-ifs). Cubes are containers with a limited number of faces
 *            (narratives, meta-views, documentaries). Absence is a hollow wire shape: a place where something should be and is not.
 * ATTRIBUTE  type 'unit' = a number 0..1; 'text' = a short line (<= 80 chars). Every attribute has a default so a new node is always complete.
 */
const u = (key, label, def, tip) => ({ key, label, type: 'unit', default: def, tip })
const t = (key, label, def, tip) => ({ key, label, type: 'text', default: def, tip })

export const ONTOLOGY = {
  version: 1,
  name: 'OmniEpistemics',
  engine: 'OmniDynamix',
  principle: 'Reality is passed down, lossy at every step. Certainty is derived from evidence, never typed in.',
  layers: [
    { id: 'event', label: 'Event', shape: 'sphere', color: '#9be3a8', glyph: '●', summary: 'Something that happened. The root; everything else is a copy of it.',
      attrs: [t('when', 'When', '', 'a time or period'), t('where', 'Where', '', 'a place'), u('magnitude', 'Magnitude', 0.5, 'how big it was'), u('physicalTrace', 'Physical trace', 0.5, 'how much it left behind in the world')] },
    { id: 'observation', label: 'Observation', shape: 'sphere', color: '#66ccff', glyph: '◉', summary: 'One person or sensor seeing the event.',
      attrs: [t('observer', 'Observer', '', 'who or what saw it'), u('clarity', 'Clarity', 0.6, 'how well it was seen'), u('proximity', 'Proximity', 0.5, 'how close the observer was'), u('bias', 'Bias', 0.2, 'how much expectation coloured it'), u('attention', 'Attention', 0.6, 'how closely they were looking')] },
    { id: 'memory', label: 'Memory', shape: 'sphere', color: '#c9a8ff', glyph: '◌', summary: 'An observation after time has worked on it.',
      attrs: [u('vividness', 'Vividness', 0.6, 'how sharp it feels'), u('decay', 'Decay', 0.2, 'how much has faded'), u('reconstruction', 'Reconstruction', 0.3, 'how much was filled in afterwards'), u('confidence', 'Felt confidence', 0.7, 'how sure the rememberer feels (not how right they are)')] },
    { id: 'rumor', label: 'Rumour', shape: 'sphere', color: '#ffa860', glyph: '❍', summary: 'A claim passed on without checking.',
      attrs: [u('propagation', 'Propagation', 0.5, 'how easily it spreads'), u('emotionalCharge', 'Emotional charge', 0.6, 'how much it makes people feel'), u('evidence', 'Evidence', 0.2, 'what actually backs it'), u('novelty', 'Novelty', 0.5, 'how surprising it is')] },
    { id: 'gossip', label: 'Gossip', shape: 'sphere', color: '#ff9ad2', glyph: '❋', summary: 'A rumour told person to person, with colour added.',
      attrs: [u('reach', 'Reach', 0.4, 'how many it got to'), u('intimacy', 'Intimacy', 0.6, 'how close the tellers are'), u('embellishment', 'Embellishment', 0.4, 'how much was added'), u('trust', 'Trust', 0.5, 'how much the listeners trust the teller'), u('emotionalCharge', 'Emotional charge', 0.6, 'how much it makes people feel')] },
    { id: 'narrative', label: 'Narrative', shape: 'cube', color: '#ffd36b', glyph: '▣', summary: 'A story a group tells itself. A container with a limited number of faces.',
      attrs: [u('coherence', 'Coherence', 0.6, 'how well the parts hang together'), u('repetition', 'Repetition', 0.5, 'how often it is told'), u('identity', 'Identity', 0.4, 'how much it says who "we" are'), u('emotionalCharge', 'Emotional charge', 0.5, 'how much it makes people feel'), u('evidence', 'Evidence', 0.2, 'what actually backs it'), u('reproducibility', 'Reproducibility', 0.1, 'whether anyone could check it again'), u('predictiveAccuracy', 'Predictive accuracy', 0.1, 'whether it predicts what happens next')] },
    { id: 'meta', label: 'Meta view', shape: 'cube', color: '#8fe0d0', glyph: '◈', summary: 'A view ABOUT the other views: how this story is told and why.',
      attrs: [t('framing', 'Framing', '', 'the lens it is seen through'), u('reflexivity', 'Reflexivity', 0.5, 'how much it examines itself'), u('humility', 'Humility', 0.5, 'how open it is to being wrong')] },
    { id: 'documentary', label: 'Documentary', shape: 'cube', color: '#e8eef8', glyph: '▤', summary: 'A record meant to last: a report, article, file or archive.',
      attrs: [t('medium', 'Medium', '', 'report, article, film...'), u('evidenceStrength', 'Evidence strength', 0.5, 'how strong the evidence behind it is'), u('reproducibility', 'Reproducibility', 0.4, 'whether the result can be checked again'), u('predictiveAccuracy', 'Predictive accuracy', 0.4, 'whether it has predicted well'), u('authority', 'Authority', 0.5, 'how much weight its source carries')] },
    { id: 'absence', label: 'Absence', shape: 'hollow', color: '#8c96a8', glyph: '◌', summary: 'Something that should exist and does not. A hole in the record is evidence too.',
      attrs: [t('missing', 'What is missing', '', 'the thing that is not there'), u('expectedness', 'Expectedness', 0.6, 'how strongly it should exist'), u('searchEffort', 'Search effort', 0.4, 'how hard anyone looked')] },
    { id: 'counterfactual', label: 'What-if', shape: 'sphere', color: '#b5a6ff', glyph: '◇', summary: 'How it could have gone. Shown as a ghost.',
      attrs: [t('hinge', 'The change', '', 'the one thing that differs'), u('plausibility', 'Plausibility', 0.5, 'how believable the other path is'), u('divergence', 'Divergence', 0.5, 'how far it ends up from what happened')] }
  ],
  transforms: [
    { id: 'observe', from: ['event'], to: 'observation', meaning: 'derives', summary: 'Seeing an event: clarity follows its size and the observer\'s closeness; some of it is lost.' },
    { id: 'remember', from: ['observation'], to: 'memory', meaning: 'distorts', summary: 'Time fades the picture and the mind fills the gaps.' },
    { id: 'propagate', from: ['memory', 'observation'], to: 'rumor', meaning: 'propagates', summary: 'Passed on without checking; the strongest bits survive.' },
    { id: 'gossip', from: ['rumor'], to: 'gossip', meaning: 'propagates', summary: 'Told person to person; colour is added.' },
    { id: 'narrate', from: ['gossip', 'rumor', 'memory'], to: 'narrative', meaning: 'distorts', summary: 'A group turns it into a story that explains something about itself.' },
    { id: 'represent', from: ['narrative', 'event', 'observation'], to: 'documentary', meaning: 'derives', summary: 'Written down: the record looks firmer than what it was made from.' }
  ],
  forces: [
    { id: 'herd', label: 'Herd', summary: 'The more people already believe it, the more others do.' },
    { id: 'emotionalGravity', label: 'Emotional gravity', summary: 'A strong feeling pulls belief towards it.' },
    { id: 'incentive', label: 'Incentive', summary: 'Belief follows what it pays to believe.' },
    { id: 'authority', label: 'Authority', summary: 'A trusted source adds weight.' },
    { id: 'identity', label: 'Identity', summary: 'If it says who "we" are, it is defended.' },
    { id: 'realityResistance', label: 'Reality resistance', summary: 'Evidence, repeatable checks and good predictions push back.' }
  ],
  equations: [
    { id: 'squash', text: 'squash(x) = x / (1 + x)', note: 'turns any non-negative number into 0..1' },
    { id: 'rumorStrength', text: 'squash(propagation x emotionalCharge / (evidence + 0.1))', note: 'spreads fast when it feels big and has little behind it' },
    { id: 'belief', text: '1 - exp(-3 x coherence x repetition x (0.5 + identity))', note: 'a story told often, that hangs together and says who we are, is believed' },
    { id: 'realityResistance', text: 'mean(evidenceStrength, reproducibility, predictiveAccuracy)', note: 'the pushback from the world' },
    { id: 'narrativeStability', text: 'realityResistance x (0.5 + 0.5 x coherence)', note: 'stable only if the world supports it (coherence is counted once)' }
  ],
  visualization: [
    'opacity follows certainty (a firm node is solid, a doubtful one is faint)',
    'size follows how much information the node carries',
    'glow follows emotional charge',
    'spheres = alike in kind, cubes = containers with limited faces, hollow wire = absence, ghost = what-if'
  ]
}
