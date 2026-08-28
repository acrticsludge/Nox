import type { ReactNode } from 'react'
import { Section } from '@astryxdesign/core/Section'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Link } from '@astryxdesign/core/Link'
import { Heading, Text } from '@astryxdesign/core/Text'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Grid } from '@astryxdesign/core/Grid'

function DiamondMark() {
  return (
    <span className="diamond-mark" aria-hidden="true">
      <span />
    </span>
  )
}

function Keycap({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <span className={`keycap${accent ? ' keycap-accent' : ''}`}>{children}</span>
}

function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="keycap-label" style={color ? { color } : undefined}>
      {children}
    </span>
  )
}

type OrbType = 'over' | 'shield' | 'blink' | 'heal'
const ORBS: Record<OrbType, { icon: string; label: string; desc: string; color: string; border: string }> = {
  over: { icon: '⚡', label: 'OVER', desc: 'Triple shot // 3× bullets for 4s', color: 'var(--nox-amber)', border: 'var(--nox-amber)' },
  shield: { icon: '❄', label: 'SHLD', desc: 'Frost shield // absorbs 3 hits, cracks', color: 'var(--nox-cyan)', border: 'var(--nox-cyan)' },
  blink: { icon: '✦', label: 'BLNK', desc: 'Dash reset + 22% speed for 3s', color: 'var(--nox-lime)', border: 'var(--nox-lime)' },
  heal: { icon: '✚', label: 'HEAL', desc: '+1 HP // rare, contested (cap 5)', color: 'var(--success)', border: 'var(--success)' },
}

function OrbBubble({ type }: { type: OrbType }) {
  const o = ORBS[type]
  return (
    <span className="orb-wrap" tabIndex={0}>
      <span className={`orb orb-${type}`} style={{ color: o.color, borderColor: o.border }} aria-hidden="true">
        {o.icon}
      </span>
      <span className="orb-bubble" role="tooltip">
        <span className="orb-bubble__label" style={{ color: o.color }}>
          {o.icon} {o.label}
        </span>
        <span className="orb-bubble__desc">{o.desc}</span>
        <span className="orb-bubble__spark" aria-hidden="true" />
      </span>
    </span>
  )
}

const instructions: {
  number: string
  title: string
  accent: 'cyan' | 'pink' | 'amber' | 'orange'
  children: ReactNode
}[] = [
  {
    number: '01',
    title: 'Move & Dash',
    accent: 'cyan',
    children: (
      <div className="instruction-content">
        <div className="move-grid">
          <div className="move-row">
            <span className="move-player" style={{ color: 'var(--nox-cyan)' }}>
              P1 // CYAN
            </span>
            <span className="move-group">
              <Label>MOVE</Label>
              <Keycap>W</Keycap>
              <Keycap>A</Keycap>
              <Keycap>S</Keycap>
              <Keycap>D</Keycap>
            </span>
            <span className="move-group">
              <Label color="var(--nox-cyan)">DASH</Label>
              <Keycap accent>SHIFT</Keycap>
            </span>
            <span className="move-group">
              <Label>SHOOT</Label>
              <span className="keycap keycap--shoot">SPACE</span>
            </span>
          </div>
          <div className="move-row">
            <span className="move-player" style={{ color: 'var(--nox-pink)' }}>
              P2 // PINK
            </span>
            <span className="move-group">
              <Label>MOVE</Label>
              <Keycap>↑</Keycap>
              <Keycap>←</Keycap>
              <Keycap>↓</Keycap>
              <Keycap>→</Keycap>
            </span>
            <span className="move-group">
              <Label color="var(--nox-pink)">DASH</Label>
              <Keycap accent>/</Keycap>
            </span>
            <span className="move-group">
              <Label>SHOOT</Label>
              <span className="keycap keycap--shoot">ENTER</span>
            </span>
          </div>
        </div>
        <p className="move-hint">Dash = 0.25s invincible burst. Walls block both movement & bullets.</p>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Grab Orbs',
    accent: 'pink',
    children: (
      <div className="instruction-content orb-content">
        <div className="orb-row">
          <OrbBubble type="over" />
          <OrbBubble type="shield" />
          <OrbBubble type="blink" />
          <OrbBubble type="heal" />
        </div>
        <Text type="body" color="secondary">
          Hover an orb // see what it does.
          <br />
          <strong>Every orb changes the game.</strong>
        </Text>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Survive',
    accent: 'orange',
    children: (
      <div className="instruction-content survival-content">
        <div className="hazard-line">
          <span className="hazard-icon">∿</span>
          <span>LAVA / SLIME / VOID</span>
        </div>
        <Text type="body" color="secondary">
          Last player standing wins.
          <br />
          <strong>Survive 45 seconds // the void crushes inward.</strong>
        </Text>
      </div>
    ),
  },
]

export default function Landing() {
  const goToGame = () => {
    window.location.href = '/play'
  }

  return (
    <main className="nox-shell">
      <div className="grid-noise" aria-hidden="true" />

      <header className="nox-header">
        <HStack gap={3} vAlign="center">
          <DiamondMark />
          <Link href="#top" className="brand-lockup">
            NOX
          </Link>
        </HStack>
        <span className="cyber-status" role="status" aria-label="NEON VOID // ONLINE">
          <span className="cyber-status__dot" aria-hidden="true" />
          <span className="cyber-status__label">NEON VOID // ONLINE</span>
          <span className="cyber-status__frame" aria-hidden="true">
            <i className="cyber-status__spark" />
          </span>
        </span>
      </header>

      <Section
        variant="transparent"
        padding={0}
        minHeight={590}
        className="nox-content hero-section"
        aria-labelledby="hero-title"
      >
        <p className="eyebrow">
          <span className="eyebrow-line" /> TWO PLAYERS. ONE VOID.
        </p>
        <h1 className="hero-title" id="hero-title">
          NEON
          <br />
          <em>VOID</em>
        </h1>
        <p className="hero-copy">
          A chaotic local multiplayer arena where the floor is lava
          <br className="desktop-break" /> and the last one standing wins.
        </p>
        <Button label="PLAY NOW ↗" variant="primary" size="lg" onClick={goToGame} />
        <div className="hero-decoration" aria-hidden="true">
          <span className="crosshair">+</span>
          <span className="coordinates">
            34° 12&apos; 08&quot; N
            <br />
            118° 14&apos; 37&quot; W
          </span>
        </div>
      </Section>

      <Section
        variant="transparent"
        padding={0}
        dividers={['top']}
        className="nox-content"
        id="how-to-play"
        aria-labelledby="how-title"
      >
        <div className="section-heading">
          <span className="section-kicker">THE BASICS</span>
          <h2 className="section-title" id="how-title">
            HOW TO
            <br />
            <span>PLAY</span>
          </h2>
        </div>
        <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={3} width="100%">
          {instructions.map((item) => (
            <Card
              key={item.number}
              variant={item.accent}
              padding={5}
              minHeight={280}
              className={`instruction-card card-accent-${item.accent}`}
            >
              <span className="card-frame" aria-hidden="true">
                <i className="card-frame__spark" />
              </span>
              <VStack gap={4}>
                <HStack gap={3} vAlign="center">
                  <span className="card-number">{item.number}</span>
                  <span className="card-rule" />
                </HStack>
                <Heading level={3}>{item.title}</Heading>
                {item.children}
              </VStack>
            </Card>
          ))}
        </Grid>
      </Section>

      <footer className="nox-footer">
        <Text type="supporting" color="secondary">
          © NOX / NEON VOID
        </Text>
        <Text type="supporting" color="secondary">
          BUILT FOR THE VOID
        </Text>
      </footer>
    </main>
  )
}
