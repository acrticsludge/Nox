import type { ReactNode } from 'react'
import { Section } from '@astryxdesign/core/Section'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Link } from '@astryxdesign/core/Link'
import { Heading, Text } from '@astryxdesign/core/Text'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Grid } from '@astryxdesign/core/Grid'
import HeroArenaPreview from './HeroArenaPreview'

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
  over: { icon: '⚡', label: 'OVER', desc: 'Shoots 3 at once for a little while', color: 'var(--nox-amber)', border: 'var(--nox-amber)' },
  shield: { icon: '❄', label: 'SHLD', desc: 'Bubble around you // cracks as it takes hits', color: 'var(--nox-cyan)', border: 'var(--nox-cyan)' },
  blink: { icon: '✦', label: 'BLNK', desc: 'Dash again right away + move faster', color: 'var(--nox-lime)', border: 'var(--nox-lime)' },
  heal: { icon: '✚', label: 'HEAL', desc: 'Heals you a little', color: 'var(--success)', border: 'var(--success)' },
}

type BulletType = 'standard' | 'needle' | 'cannon' | 'trick'
const BULLETS: Record<BulletType, { icon: string; label: string; desc: string; color: string; border: string; accent: 'cyan' | 'pink' | 'amber' | 'orange' }> = {
  standard: { icon: '●', label: 'STANDARD', desc: 'Your normal shot - balanced and reliable. You never run out.', color: '#d6e2e4', border: 'rgba(214,226,228,0.4)' },
  needle: { icon: '◈', label: 'NEEDLE', desc: 'Tiny and super fast. Weak from the front, huge from behind.', color: '#a78bfa', border: 'rgba(167,139,250,0.45)' },
  cannon: { icon: '■', label: 'CANNON', desc: 'Big and slow. Hits really hard. You only get a few.', color: 'var(--nox-amber)', border: 'var(--nox-amber)' },
  trick: { icon: '◇', label: 'TRICK', desc: 'Bounces off walls. First hit is strongest.', color: 'var(--nox-cyan)', border: 'var(--nox-cyan)' },
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
        <p className="move-hint">Dash makes you flash and you cannot be hit for a moment.</p>
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
          Hover to see what it does. Special bullets come from pickups too.
          <br />
          <strong>Every pickup changes the game.</strong>
        </Text>
        <div className="orb-row" style={{ marginTop: '10px', gap: '8px' }}>
          <span className="orb orb-needle" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)', fontSize: '12px' }} aria-label="Needle pickup">
            ◈
          </span>
          <span style={{ font: '10px var(--nox-mono)', color: '#a78bfa', letterSpacing: '0.08em' }}>NEEDLE</span>
          <span className="orb orb-cannon" style={{ color: 'var(--nox-amber)', borderColor: 'rgba(255,178,62,0.35)', fontSize: '12px' }} aria-label="Cannon pickup">
            ■
          </span>
          <span style={{ font: '10px var(--nox-mono)', color: 'var(--nox-amber)', letterSpacing: '0.08em' }}>CANNON</span>
          <span className="orb orb-trick" style={{ color: 'var(--nox-cyan)', borderColor: 'rgba(88,216,255,0.35)', fontSize: '12px' }} aria-label="Trick pickup">
            ◇
          </span>
          <span style={{ font: '10px var(--nox-mono)', color: 'var(--nox-cyan)', letterSpacing: '0.08em' }}>TRICK</span>
        </div>
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
          Knock out the other player to win the round.
          <br />
          <strong>After a while the void closes in - stay in the middle.</strong>
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
        minHeight={0}
        className="nox-content hero-section"
        aria-labelledby="hero-title"
      >
        <div className="hero-grid">
          <div className="hero-left">
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
            <div className="hero-left-meta" aria-hidden="true">
              <span className="crosshair">+</span>
              <span className="coordinates">
                34° 12&apos; 08&quot; N
                <br />
                118° 14&apos; 37&quot; W
              </span>
            </div>
          </div>
          <div className="hero-right">
            <HeroArenaPreview />
          </div>
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

      <Section variant="transparent" padding={0} dividers={['top']} className="nox-content" id="arsenal" aria-labelledby="arsenal-title">
        <div className="section-heading">
          <span className="section-kicker">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--nox-lime)', color: '#07090b', border: '1px solid var(--nox-lime)', padding: '2px 6px', font: '10px var(--nox-mono)', fontWeight: 800, letterSpacing: '0.1em' }}>NEW</span>
              ARSENAL UPDATE
            </span>
          </span>
          <h2 className="section-title" id="arsenal-title">
            CHOOSE
            <br />
            <span>YOUR SHOT</span>
          </h2>
          <p style={{ maxWidth: '52ch', marginTop: '12px', color: 'var(--nox-muted)', font: '12px/1.7 var(--nox-mono)' }}>
            Four kinds of bullets. Same arena, new tricks. Pick them up - you get a few shots, then you go back to normal.
          </p>
        </div>

        <Grid columns={{ minWidth: 220, repeat: 'fit' }} gap={3} width="100%">
          <Card variant="cyan" padding={5} minHeight={220} className="instruction-card card-accent-cyan">
            <span className="card-frame" aria-hidden="true">
              <i className="card-frame__spark" />
            </span>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center">
                <span className="orb orb-standard" style={{ color: '#d6e2e4', borderColor: 'rgba(214,226,228,0.35)', fontSize: '16px' }} aria-hidden="true">
                  ●
                </span>
                <span className="card-rule" />
                <Badge label="∞" variant="secondary" />
              </HStack>
              <Heading level={3}>Standard</Heading>
              <Text type="body" color="secondary">
                Your normal shot - balanced and reliable. You never run out.
              </Text>
            </VStack>
          </Card>

          <Card variant="pink" padding={5} minHeight={220} className="instruction-card card-accent-pink">
            <span className="card-frame" aria-hidden="true">
              <i className="card-frame__spark" />
            </span>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center">
                <span className="orb orb-needle" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)', fontSize: '16px' }} aria-hidden="true">
                  ◈
                </span>
                <span className="card-rule" />
                <Badge label="FLANK" variant="secondary" />
              </HStack>
              <Heading level={3}>Needle</Heading>
              <Text type="body" color="secondary">
                Tiny and super fast. Almost nothing from the front, huge from behind. Sneak around.
              </Text>
            </VStack>
          </Card>

          <Card variant="amber" padding={5} minHeight={220} className="instruction-card card-accent-amber">
            <span className="card-frame" aria-hidden="true">
              <i className="card-frame__spark" />
            </span>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center">
                <span className="orb orb-cannon" style={{ color: 'var(--nox-amber)', borderColor: 'rgba(255,178,62,0.35)', fontSize: '16px' }} aria-hidden="true">
                  ■
                </span>
                <span className="card-rule" />
                <Badge label="HEAVY" variant="secondary" />
              </HStack>
              <Heading level={3}>Cannon</Heading>
              <Text type="body" color="secondary">
                Big and slow. Hits really hard. You only get a few - make them count.
              </Text>
            </VStack>
          </Card>

          <Card variant="orange" padding={5} minHeight={220} className="instruction-card card-accent-orange">
            <span className="card-frame" aria-hidden="true">
              <i className="card-frame__spark" />
            </span>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center">
                <span className="orb orb-trick" style={{ color: 'var(--nox-cyan)', borderColor: 'rgba(88,216,255,0.35)', fontSize: '16px' }} aria-hidden="true">
                  ◇
                </span>
                <span className="card-rule" />
                <Badge label="BOUNCE" variant="secondary" />
              </HStack>
              <Heading level={3}>Trick</Heading>
              <Text type="body" color="secondary">
                Bounces off walls. First bounce hits hardest, then it gets weaker.
              </Text>
            </VStack>
          </Card>
        </Grid>

        <div style={{ marginTop: '18px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <span className="cyber-badge cyber-badge--lime" style={{ fontSize: '10px' }}>
            <span className="cyber-badge__text">12 HEALTH • FIRST TO 5 WINS</span>
            <span className="cyber-badge__border" aria-hidden="true" />
            <span className="cyber-badge__spark" aria-hidden="true" />
          </span>
          <span style={{ color: 'var(--nox-muted)', font: '11px var(--nox-mono)' }}>Each hit looks different now.</span>
          <Link href="/docs" style={{ color: 'var(--nox-lime)', font: '11px var(--nox-mono)', textDecoration: 'none', borderBottom: '1px solid rgba(201,255,47,0.3)' }}>
            READ THE MANUAL →
          </Link>
          <Link href="/play/1v1" style={{ color: 'var(--nox-cyan)', font: '11px var(--nox-mono)', textDecoration: 'none', borderBottom: '1px solid rgba(88,216,255,0.3)' }}>
            PLAY 1V1 NOW →
          </Link>
        </div>
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
